import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import dotenv from 'dotenv';
import { getSqlPool, sql } from '../../config/sqlServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carga api/.env igual que los scripts de seed, sin tocar npm run dev.
dotenv.config({
  path: path.resolve(__dirname, '../../../.env')
});

const PDFS_TO_IMPORT = [
  {
    manualNombre: 'Repuestos Rastras',
    archivoOrigen: 'manual-repuestos-rastras.pdf'
  },
  {
    manualNombre: 'Grano Fino 2019',
    archivoOrigen: 'manual-repuestos-grano-fino-2019.pdf'
  }
];

const pdfsDirectory = path.resolve(__dirname, '../../public/pdfs');
const codePattern = /\b(?:[CP]\d{4}|[A-Z]\d{3,5}|\d{2}\s*[-–—]\s*\d{4})\b/g;
const leadingElementNumberPattern = /^\s*(\d{1,4})(?:[.)-])?\s+/;
const repeatedWhitespacePattern = /\s+/g;
const objectPattern = /(\d+)\s+0\s+obj\s*([\s\S]*?)\s*endobj/g;
const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/;

const categoryRules = [
  { category: 'Rodamiento', keywords: ['rodamiento', 'rodamientos', 'bolilla', 'bolillas', 'bolas', 'rodillo', 'rodillos'] },
  { category: 'Retén', keywords: ['reten', 'retenes'] },
  { category: 'Tuerca', keywords: ['tuerca', 'tuercas'] },
  { category: 'Bulón', keywords: ['bulon', 'bulones', 'tornillo', 'tornillos'] },
  { category: 'Arandela', keywords: ['arandela', 'arandelas', 'grower'] },
  { category: 'Chaveta', keywords: ['chaveta', 'chavetas'] },
  { category: 'Resorte', keywords: ['resorte', 'resortes'] },
  { category: 'Engranaje', keywords: ['engranaje', 'engranajes', 'engr.', 'pinon', 'pinones'] },
  { category: 'Llanta', keywords: ['llanta', 'llantas'] },
  { category: 'Cubierta', keywords: ['cubierta', 'cubiertas', 'neumatico', 'neumaticos'] },
  { category: 'Maza', keywords: ['maza', 'mazas'] },
  { category: 'Eje', keywords: ['eje', 'ejes', 'esparrago', 'esparragos'] },
  { category: 'Buje', keywords: ['buje', 'bujes'] },
  { category: 'Soporte', keywords: ['soporte', 'soportes'] },
  { category: 'Lanza', keywords: ['lanza', 'lanzas'] },
  { category: 'Bancada', keywords: ['bancada', 'bancadas'] },
  { category: 'Hidráulica', keywords: ['hidraulico', 'hidraulica', 'cilindro', 'cilindros', 'manguera', 'mangueras'] },
  { category: 'Disco', keywords: ['disco', 'discos'] },
  { category: 'Marcador', keywords: ['marcador', 'marcadores'] },
  { category: 'Tolva', keywords: ['tolva', 'tolvas'] },
  { category: 'Dosificador', keywords: ['dosificador', 'dosificadores'] },
  { category: 'Cuchilla', keywords: ['cuchilla', 'cuchillas'] },
  { category: 'Rueda', keywords: ['rueda', 'ruedas'] },
  { category: 'Grampa', keywords: ['grampa', 'grampas', 'abrazadera', 'abrazaderas'] },
  { category: 'Balancín', keywords: ['balancin', 'balancines'] },
  { category: 'Cigüeña', keywords: ['cigueña', 'cigueñas', 'ciguena', 'ciguenas'] }
];

const parsePdfObjects = (buffer) => {
  const pdfText = buffer.toString('latin1');
  const objects = new Map();
  let match;

  while ((match = objectPattern.exec(pdfText)) !== null) {
    objects.set(Number(match[1]), match[2]);
  }

  return objects;
};

const getStreamContent = (objectBody) => {
  const streamMatch = objectBody.match(streamPattern);

  if (!streamMatch) {
    return '';
  }

  const rawStream = Buffer.from(streamMatch[1], 'latin1');

  if (!/\/FlateDecode\b/.test(objectBody)) {
    return rawStream.toString('latin1');
  }

  try {
    return zlib.inflateSync(rawStream).toString('latin1');
  } catch {
    return '';
  }
};

const parseHexCodePoints = (hex) => {
  const values = [];

  for (let index = 0; index < hex.length; index += 4) {
    const chunk = hex.slice(index, index + 4);

    if (chunk.length === 4) {
      values.push(Number.parseInt(chunk, 16));
    }
  }

  return values;
};

const parseUnicodeHex = (hex) => {
  let text = '';

  for (let index = 0; index < hex.length; index += 4) {
    const chunk = hex.slice(index, index + 4);

    if (chunk.length === 4) {
      text += String.fromCodePoint(Number.parseInt(chunk, 16));
    }
  }

  return text;
};

const parseToUnicodeCMap = (content) => {
  const map = new Map();
  const bfCharPattern = /beginbfchar([\s\S]*?)endbfchar/g;
  const bfRangePattern = /beginbfrange([\s\S]*?)endbfrange/g;
  let match;

  while ((match = bfCharPattern.exec(content)) !== null) {
    const entries = match[1].matchAll(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/g);

    for (const entry of entries) {
      map.set(Number.parseInt(entry[1], 16), parseUnicodeHex(entry[2]));
    }
  }

  while ((match = bfRangePattern.exec(content)) !== null) {
    const rangeContent = match[1];
    const arrayRanges = rangeContent.matchAll(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+\[([^\]]+)\]/g);

    for (const range of arrayRanges) {
      const start = Number.parseInt(range[1], 16);
      const end = Number.parseInt(range[2], 16);
      const values = [...range[3].matchAll(/<([0-9A-Fa-f]+)>/g)].map((value) => parseUnicodeHex(value[1]));

      for (let code = start; code <= end; code += 1) {
        const value = values[code - start];

        if (value) {
          map.set(code, value);
        }
      }
    }

    const offsetRanges = rangeContent.matchAll(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/g);

    for (const range of offsetRanges) {
      const start = Number.parseInt(range[1], 16);
      const end = Number.parseInt(range[2], 16);
      const destinationStart = Number.parseInt(range[3], 16);

      for (let code = start; code <= end; code += 1) {
        map.set(code, String.fromCodePoint(destinationStart + code - start));
      }
    }
  }

  return map;
};

const buildFontMaps = (objects) => {
  const fontMapsByObject = new Map();

  for (const [objectNumber, body] of objects) {
    const toUnicodeMatch = body.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);

    if (!toUnicodeMatch) {
      continue;
    }

    const cmapObject = objects.get(Number(toUnicodeMatch[1]));
    const cmapContent = cmapObject ? getStreamContent(cmapObject) : '';
    fontMapsByObject.set(objectNumber, parseToUnicodeCMap(cmapContent));
  }

  return fontMapsByObject;
};

const extractContentReferences = (pageBody) => {
  const contentsMatch = pageBody.match(/\/Contents\s+(?:\[([^\]]+)\]|(\d+)\s+0\s+R)/);

  if (!contentsMatch) {
    return [];
  }

  if (contentsMatch[2]) {
    return [Number(contentsMatch[2])];
  }

  return [...contentsMatch[1].matchAll(/(\d+)\s+0\s+R/g)].map((match) => Number(match[1]));
};

const extractPageFontReferences = (pageBody) => {
  const fontReferences = new Map();
  const resourcesMatch = pageBody.match(/\/Font\s*<<([\s\S]*?)>>/);

  if (!resourcesMatch) {
    return fontReferences;
  }

  const references = resourcesMatch[1].matchAll(/\/(F\d+)\s+(\d+)\s+0\s+R/g);

  for (const reference of references) {
    fontReferences.set(reference[1], Number(reference[2]));
  }

  return fontReferences;
};

const getPages = (objects) => [...objects.entries()]
  .filter(([, body]) => /\/Type\s*\/Page\b/.test(body))
  .sort((first, second) => first[0] - second[0])
  .map(([, body]) => ({
    contentReferences: extractContentReferences(body),
    fontReferences: extractPageFontReferences(body)
  }));

const decodeLiteralString = (value) => value
  .replace(/\\([nrtbf()\\])/g, (_, escaped) => {
    const replacements = {
      n: '\n',
      r: '\r',
      t: '\t',
      b: '\b',
      f: '\f',
      '(': '(',
      ')': ')',
      '\\': '\\'
    };

    return replacements[escaped] ?? escaped;
  })
  .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(Number.parseInt(octal, 8)));

const decodeHexString = (hex, fontMap) => {
  const normalizedHex = hex.replace(/\s/g, '');

  if (fontMap?.size) {
    return parseHexCodePoints(normalizedHex).map((codePoint) => fontMap.get(codePoint) ?? '').join('');
  }

  return Buffer.from(normalizedHex, 'hex').toString('latin1');
};

const extractTextFromToken = (token, fontMap) => {
  if (token.startsWith('(')) {
    return decodeLiteralString(token.slice(1, -1));
  }

  if (token.startsWith('<')) {
    return decodeHexString(token.slice(1, -1), fontMap);
  }

  return '';
};

const extractTextItems = (content, pageFonts, fontMapsByObject) => {
  const items = [];
  const textOperationPattern = /(\/F\d+\s+[\d.]+\s+Tf)|(?:([-\d.]+)\s+[-\d.]+\s+[-\d.]+\s+[-\d.]+\s+([-\d.]+)\s+([-\d.]+)\s+Tm)|(?:\[((?:\([^()\\]*(?:\\.[^()\\]*)*\)|<[^>]+>|[^\]])*)\]\s*TJ)|(?:(\([^()\\]*(?:\\.[^()\\]*)*\)|<[^>]+>)\s*Tj)/g;
  let currentFont = null;
  let currentX = 0;
  let currentY = 0;
  let order = 0;
  let match;

  while ((match = textOperationPattern.exec(content)) !== null) {
    if (match[1]) {
      currentFont = match[1].match(/\/(F\d+)/)?.[1] ?? currentFont;
      continue;
    }

    if (match[2] !== undefined) {
      currentX = Number.parseFloat(match[3]);
      currentY = Number.parseFloat(match[4]);
      continue;
    }

    const fontObjectNumber = currentFont ? pageFonts.get(currentFont) : undefined;
    const fontMap = fontObjectNumber ? fontMapsByObject.get(fontObjectNumber) : undefined;
    const source = match[5] ?? match[6] ?? '';
    const tokens = [...source.matchAll(/\([^()\\]*(?:\\.[^()\\]*)*\)|<[^>]+>/g)].map((tokenMatch) => tokenMatch[0]);
    const text = tokens.map((token) => extractTextFromToken(token, fontMap)).join('').trim();

    if (text) {
      items.push({ text, x: currentX, y: currentY, order });
      order += 1;
    }
  }

  return items;
};

const normalizeText = (value) => value
  .replace(/[\u0000-\u001F\u007F]/g, ' ')
  .replace(repeatedWhitespacePattern, ' ')
  .trim();

const normalizeCategoryText = (value) => normalizeText(value)
  .toLocaleLowerCase('es-AR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const categoryRulesWithPatterns = categoryRules.map((rule) => ({
  ...rule,
  patterns: rule.keywords.map((keyword) => new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizeCategoryText(keyword))}(?=$|[^a-z0-9])`, 'i'))
}));

const detectPrintedPageNumber = (lines, fallbackPageNumber) => {
  const printedPageNumber = [...lines]
    .reverse()
    .map((line) => line.match(/^\d{1,4}$/)?.[0])
    .find(Boolean);

  if (!printedPageNumber) {
    return fallbackPageNumber;
  }

  const parsedPageNumber = Number.parseInt(printedPageNumber, 10);

  return Number.isInteger(parsedPageNumber) && parsedPageNumber > 0
    ? parsedPageNumber
    : fallbackPageNumber;
};

const buildLinesFromItems = (items) => {
  const lines = [];
  const sortedItems = [...items].sort((first, second) => {
    const yDifference = second.y - first.y;

    if (Math.abs(yDifference) > 2) {
      return yDifference;
    }

    const xDifference = first.x - second.x;

    return Math.abs(xDifference) > 2 ? xDifference : first.order - second.order;
  });

  for (const item of sortedItems) {
    const existingLine = lines.find((line) => Math.abs(line.y - item.y) <= 2);

    if (existingLine) {
      existingLine.items.push(item);
      continue;
    }

    lines.push({ y: item.y, items: [item] });
  }

  return lines.map((line) => normalizeText(line.items
    .sort((first, second) => first.x - second.x || first.order - second.order)
    .map((item) => item.text)
    .join(' ')))
    .filter(Boolean);
};

const extractPdfPages = async (pdfPath) => {
  const buffer = await readFile(pdfPath);
  const objects = parsePdfObjects(buffer);
  const fontMapsByObject = buildFontMaps(objects);
  const pages = getPages(objects);

  return pages.map((page, index) => {
    const pageContent = page.contentReferences
      .map((reference) => objects.get(reference))
      .filter(Boolean)
      .map(getStreamContent)
      .join('\n');
    const items = extractTextItems(pageContent, page.fontReferences, fontMapsByObject);
    const lines = buildLinesFromItems(items);

    return {
      pageNumber: detectPrintedPageNumber(lines, index + 1),
      lines
    };
  });
};

const inferCategory = (description) => {
  const normalizedDescription = normalizeCategoryText(description);

  return categoryRulesWithPatterns.find((rule) => (
    rule.patterns.some((pattern) => pattern.test(normalizedDescription))
  ))?.category ?? null;
};

const normalizeCode = (value) => value.replace(/\s*[-–—]\s*/g, '-').trim();

const detectReferenciaDespiece = (value) => {
  const match = value.match(leadingElementNumberPattern);

  return match?.[1] ?? null;
};

const removeLeadingReferenciaDespiece = (value, referenciaDespiece) => {
  if (!referenciaDespiece) {
    return value;
  }

  return value.replace(leadingElementNumberPattern, '');
};

const cleanDescription = (value) => normalizeText(value)
  .replace(/^[-–—:;.,\s]+/, '')
  .replace(/[-–—:;.,\s]+$/, '')
  .slice(0, 500);

const looksLikeUsefulDescription = (description) => {
  if (description.length < 4 || description.length > 500) {
    return false;
  }

  if (!/[a-záéíóúüñ]/i.test(description)) {
    return false;
  }

  if (/^(cod|c[oó]digo|cant|cantidad|p[aá]g(?:ina)?|item|pos|nro|n°)$/i.test(description)) {
    return false;
  }

  return true;
};

const detectSparePartsInLine = ({ line, pageNumber, manualNombre, archivoOrigen }) => {
  const results = [];
  const matches = [...line.matchAll(codePattern)];

  for (const match of matches) {
    const rawCodigo = match[0];
    const codigo = normalizeCode(rawCodigo);
    const rawBefore = line.slice(0, match.index);
    const referenciaDespiece = detectReferenciaDespiece(rawBefore);
    const before = cleanDescription(removeLeadingReferenciaDespiece(rawBefore, referenciaDespiece));
    const after = cleanDescription(line.slice(match.index + rawCodigo.length));
    const descripcion = looksLikeUsefulDescription(after) ? after : before;

    if (!looksLikeUsefulDescription(descripcion)) {
      continue;
    }

    results.push({
      manualNombre,
      archivoOrigen,
      pagina: pageNumber,
      codigo,
      descripcion,
      referenciaDespiece,
      categoria: inferCategory(descripcion)
    });
  }

  return results;
};

const detectSpareParts = ({ pages, manualNombre, archivoOrigen }) => {
  const spareParts = [];
  const seen = new Set();

  for (const page of pages) {
    for (const line of page.lines) {
      const detectedInLine = detectSparePartsInLine({
        line,
        pageNumber: page.pageNumber,
        manualNombre,
        archivoOrigen
      });

      for (const sparePart of detectedInLine) {
        const key = `${sparePart.codigo}|${sparePart.manualNombre}|${sparePart.pagina}|${sparePart.referenciaDespiece ?? ''}`;

        if (!seen.has(key)) {
          seen.add(key);
          spareParts.push(sparePart);
        }
      }
    }
  }

  return spareParts;
};

const insertSparePartIfMissing = async (pool, sparePart) => {
  const result = await pool.request()
    .input('ManualNombre', sql.NVarChar(200), sparePart.manualNombre)
    .input('ArchivoOrigen', sql.NVarChar(500), sparePart.archivoOrigen)
    .input('Pagina', sql.Int, sparePart.pagina)
    .input('Codigo', sql.NVarChar(100), sparePart.codigo)
    .input('Descripcion', sql.NVarChar(500), sparePart.descripcion)
    .input('ReferenciaDespiece', sql.NVarChar(150), sparePart.referenciaDespiece)
    .input('Categoria', sql.NVarChar(150), sparePart.categoria)
    .query(`
IF EXISTS (
    SELECT 1
    FROM dbo.RepuestosManuales
    WHERE Codigo = @Codigo
      AND ManualNombre = @ManualNombre
      AND Pagina = @Pagina
      AND COALESCE(NULLIF(LTRIM(RTRIM(ReferenciaDespiece)), ''), '') = COALESCE(NULLIF(LTRIM(RTRIM(@ReferenciaDespiece)), ''), '')
)
BEGIN
    DECLARE @updatedCategory INT = 0;

    IF NULLIF(LTRIM(RTRIM(@Categoria)), '') IS NOT NULL
    BEGIN
        UPDATE dbo.RepuestosManuales
        SET Categoria = @Categoria
        WHERE Codigo = @Codigo
          AND ManualNombre = @ManualNombre
          AND Pagina = @Pagina
          AND COALESCE(NULLIF(LTRIM(RTRIM(ReferenciaDespiece)), ''), '') = COALESCE(NULLIF(LTRIM(RTRIM(@ReferenciaDespiece)), ''), '')
          AND (
            NULLIF(LTRIM(RTRIM(Categoria)), '') IS NULL
            OR LTRIM(RTRIM(Categoria)) IN (N'Sin categoría', N'Sin categoria')
          );

        SET @updatedCategory = @@ROWCOUNT;
    END;

    SELECT CAST(0 AS INT) AS inserted, CAST(1 AS INT) AS duplicated, @updatedCategory AS updatedCategory;
END
ELSE
BEGIN
    INSERT INTO dbo.RepuestosManuales (
        ManualNombre,
        ArchivoOrigen,
        Pagina,
        Codigo,
        Descripcion,
        ReferenciaDespiece,
        Categoria,
        Activo
    )
    VALUES (
        @ManualNombre,
        @ArchivoOrigen,
        @Pagina,
        @Codigo,
        @Descripcion,
        @ReferenciaDespiece,
        @Categoria,
        1
    );

    SELECT CAST(1 AS INT) AS inserted, CAST(0 AS INT) AS duplicated, CAST(0 AS INT) AS updatedCategory;
END;
`);

  const counters = result.recordset?.[0] ?? { inserted: 0, duplicated: 0, updatedCategory: 0 };

  return {
    inserted: Number(counters.inserted) || 0,
    duplicated: Number(counters.duplicated) || 0,
    updatedCategory: Number(counters.updatedCategory) || 0
  };
};

const buildImportPreview = async ({ manualNombre, archivoOrigen }) => {
  const pdfPath = path.join(pdfsDirectory, archivoOrigen);
  const pages = await extractPdfPages(pdfPath);
  const spareParts = detectSpareParts({ pages, manualNombre, archivoOrigen });

  return { pages, spareParts };
};

const previewPdfImport = async (pdfConfig) => {
  const { pages, spareParts } = await buildImportPreview(pdfConfig);
  const categorizedDetected = spareParts.filter((sparePart) => sparePart.categoria).length;

  return {
    pdf: pdfConfig.archivoOrigen,
    pagesRead: pages.length,
    detected: spareParts.length,
    inserted: 0,
    duplicated: 0,
    categorizedNew: 0,
    updatedExistingWithCategory: 0,
    uncategorized: spareParts.length - categorizedDetected,
    withReferenciaDespiece: spareParts.filter((sparePart) => sparePart.referenciaDespiece).length,
    withoutReferenciaDespiece: spareParts.filter((sparePart) => !sparePart.referenciaDespiece).length
  };
};

const importPdf = async ({ pool, manualNombre, archivoOrigen }) => {
  const { pages, spareParts } = await buildImportPreview({ manualNombre, archivoOrigen });
  const categorizedDetected = spareParts.filter((sparePart) => sparePart.categoria).length;
  const summary = {
    pdf: archivoOrigen,
    pagesRead: pages.length,
    detected: spareParts.length,
    inserted: 0,
    duplicated: 0,
    categorizedNew: 0,
    updatedExistingWithCategory: 0,
    uncategorized: spareParts.length - categorizedDetected,
    withReferenciaDespiece: spareParts.filter((sparePart) => sparePart.referenciaDespiece).length,
    withoutReferenciaDespiece: spareParts.filter((sparePart) => !sparePart.referenciaDespiece).length
  };

  for (const sparePart of spareParts) {
    const counters = await insertSparePartIfMissing(pool, sparePart);
    summary.inserted += counters.inserted;
    summary.duplicated += counters.duplicated;
    summary.updatedExistingWithCategory += counters.updatedCategory;

    if (counters.inserted && sparePart.categoria) {
      summary.categorizedNew += counters.inserted;
    }
  }

  return summary;
};

const printSummary = (summary) => {
  console.log(`PDF procesado: ${summary.pdf}`);
  console.log(`  Páginas leídas: ${summary.pagesRead}`);
  console.log(`  Registros detectados: ${summary.detected}`);
  console.log(`  Registros insertados: ${summary.inserted}`);
  console.log(`  Registros categorizados nuevos: ${summary.categorizedNew}`);
  console.log(`  Registros existentes actualizados con categoría: ${summary.updatedExistingWithCategory}`);
  console.log(`  Registros que siguen sin categoría: ${summary.uncategorized}`);
  console.log(`  Registros omitidos por duplicados: ${summary.duplicated}`);
  console.log(`  Registros con ReferenciaDespiece detectada: ${summary.withReferenciaDespiece}`);
  console.log(`  Registros sin ReferenciaDespiece: ${summary.withoutReferenciaDespiece}`);
};

async function runImporter() {
  const dryRun = process.argv.includes('--dry-run');
  const pool = dryRun ? null : await getSqlPool();
  const summaries = [];

  for (const pdfConfig of PDFS_TO_IMPORT) {
    const summary = dryRun
      ? await previewPdfImport(pdfConfig)
      : await importPdf({ pool, ...pdfConfig });
    printSummary(summary);
    summaries.push(summary);
  }

  const totals = summaries.reduce((accumulator, summary) => ({
    pagesRead: accumulator.pagesRead + summary.pagesRead,
    detected: accumulator.detected + summary.detected,
    inserted: accumulator.inserted + summary.inserted,
    duplicated: accumulator.duplicated + summary.duplicated,
    categorizedNew: accumulator.categorizedNew + summary.categorizedNew,
    updatedExistingWithCategory: accumulator.updatedExistingWithCategory + summary.updatedExistingWithCategory,
    uncategorized: accumulator.uncategorized + summary.uncategorized,
    withReferenciaDespiece: accumulator.withReferenciaDespiece + summary.withReferenciaDespiece,
    withoutReferenciaDespiece: accumulator.withoutReferenciaDespiece + summary.withoutReferenciaDespiece
  }), {
    pagesRead: 0,
    detected: 0,
    inserted: 0,
    duplicated: 0,
    categorizedNew: 0,
    updatedExistingWithCategory: 0,
    uncategorized: 0,
    withReferenciaDespiece: 0,
    withoutReferenciaDespiece: 0
  });

  console.log('Resumen total importación dbo.RepuestosManuales:');
  console.log(`  PDFs procesados: ${summaries.length}`);
  console.log(`  Páginas leídas: ${totals.pagesRead}`);
  console.log(`  Registros detectados: ${totals.detected}`);
  console.log(`  Registros insertados: ${totals.inserted}`);
  console.log(`  Registros categorizados nuevos: ${totals.categorizedNew}`);
  console.log(`  Registros existentes actualizados con categoría: ${totals.updatedExistingWithCategory}`);
  console.log(`  Registros que siguen sin categoría: ${totals.uncategorized}`);
  console.log(`  Registros omitidos por duplicados: ${totals.duplicated}`);
  console.log(`  Registros con ReferenciaDespiece detectada: ${totals.withReferenciaDespiece}`);
  console.log(`  Registros sin ReferenciaDespiece: ${totals.withoutReferenciaDespiece}`);
}

runImporter().catch((error) => {
  const diagnosticError = error?.cause || error;

  console.error('No se pudo importar repuestos desde PDFs hacia dbo.RepuestosManuales.', {
    message: diagnosticError?.message,
    code: diagnosticError?.code,
    originalErrorMessage: diagnosticError?.originalError?.message,
    originalErrorCode: diagnosticError?.originalError?.code
  });
  process.exitCode = 1;
});
