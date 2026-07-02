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

export const PDFS_TO_IMPORT = [
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
const tableHeaderPattern = /n[.º°]?\s*de\s*elemento|n[.º°]?\s*de\s*pieza|descripci[oó]n|cantidad/i;
const repeatedWhitespacePattern = /\s+/g;
const objectPattern = /(\d+)\s+0\s+obj\s*([\s\S]*?)\s*endobj/g;
const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/;
const visualVerificationChecks = [
  {
    manualNombre: 'Repuestos Rastras',
    pageNumber: 6,
    codes: ['56-0603', '82-0008', 'C0921', 'C0920']
  },
  {
    manualNombre: 'Repuestos Rastras',
    pageNumber: 7,
    codes: ['C1867', 'C0867']
  }
];

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

const buildLineGroupsFromItems = (items) => {
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

  return lines
    .map((line) => {
      const sortedLineItems = line.items.sort((first, second) => first.x - second.x || first.order - second.order);
      const text = normalizeText(sortedLineItems.map((item) => item.text).join(' '));

      return {
        y: line.y,
        text,
        tokens: sortedLineItems.map((item) => ({ text: item.text, x: item.x, y: item.y, order: item.order }))
      };
    })
    .filter((line) => line.text);
};

const buildLinesFromItems = (items) => buildLineGroupsFromItems(items).map((line) => line.text);

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
    const lineGroups = buildLineGroupsFromItems(items);
    const lines = lineGroups.map((line) => line.text);

    return {
      pageNumber: index + 1,
      printedPageNumber: detectPrintedPageNumber(lines, index + 1),
      rawText: items.map((item) => item.text).join('\n'),
      textItems: items,
      lineGroups,
      lines,
      debugDetections: []
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

const isCodeOnlyLine = (line) => {
  const matches = [...line.matchAll(codePattern)];

  return matches.length === 1 && normalizeCode(matches[0][0]) === normalizeCode(line);
};

const isLikelyStandaloneDescriptionLine = (line) => {
  const description = cleanDescription(line);

  if (!looksLikeUsefulDescription(description)) {
    return false;
  }

  if (isCodeOnlyLine(description) || [...description.matchAll(codePattern)].length > 0) {
    return false;
  }

  return true;
};

const explainNullReference = ({ rawBefore, source }) => {
  if (source === 'standalone-code-description-block') {
    return 'El código fue detectado en una línea independiente; este patrón no contiene columna/valor de referencia asociado.';
  }

  if (!normalizeText(rawBefore)) {
    return 'No hay texto antes del código en la línea reconstruida; la referencia no quedó asociada al código.';
  }

  return `El texto antes del código ("${normalizeText(rawBefore)}") no empieza con un número de referencia válido.`;
};

const detectSparePartsInLine = ({ line, lineIndex = null, pageNumber, printedPageNumber, manualNombre, archivoOrigen, debugDetections = null }) => {
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

    const debugDetection = {
      source: 'inline-code',
      lineIndex,
      line,
      tokens: normalizeText(line).split(' ').filter(Boolean),
      referenciaDetectada: referenciaDespiece,
      codigoDetectado: codigo,
      descripcionDetectada: descripcion || null,
      motivoReferenciaNull: referenciaDespiece ? null : explainNullReference({ rawBefore, source: 'inline-code' })
    };

    if (!looksLikeUsefulDescription(descripcion)) {
      debugDetections?.push({ ...debugDetection, descartado: true, motivoDescarte: 'La descripción detectada no parece útil.' });
      continue;
    }

    debugDetections?.push({ ...debugDetection, descartado: false });

    results.push({
      manualNombre,
      archivoOrigen,
      pagina: pageNumber,
      paginaImpresa: printedPageNumber,
      codigo,
      descripcion,
      referenciaDespiece,
      categoria: inferCategory(descripcion)
    });
  }

  return results;
};

const buildSparePartKey = (sparePart) => [
  sparePart.manualNombre,
  sparePart.archivoOrigen,
  sparePart.pagina,
  sparePart.referenciaDespiece ?? '',
  sparePart.codigo
].join('|');

const buildCodePageKey = (sparePart) => `${sparePart.codigo}|${sparePart.manualNombre}|${sparePart.archivoOrigen}|${sparePart.pagina}|${sparePart.referenciaDespiece ?? ''}`;


const normalizeHeaderText = (value) => normalizeCategoryText(value).replace(/[.º°]/g, '').replace(repeatedWhitespacePattern, ' ');

const hasCoordinateTableHeader = (page) => {
  const headerText = normalizeHeaderText(page.lines.join(' '));
  const nDeMatches = headerText.match(/n de/g) ?? [];
  return nDeMatches.length >= 2
    && headerText.includes('elemento')
    && headerText.includes('pieza')
    && headerText.includes('descripcion')
    && headerText.includes('cantidad');
};

const getCoordinateTableCells = (tokens) => {
  const elementToken = tokens.find((token) => /^\d{1,4}$/.test(token.text));
  const quantityToken = [...tokens].reverse().find((token) => /^\d{1,4}$/.test(token.text) && token.order !== elementToken?.order);

  if (!elementToken || !quantityToken || quantityToken.x - elementToken.x < 80) {
    return null;
  }

  const betweenTokens = tokens.filter((token) => token.order > elementToken.order && token.order < quantityToken.order);
  let code = null;
  let codeEndOrder = null;
  const firstBetween = betweenTokens[0];
  const secondBetween = betweenTokens[1];
  const thirdBetween = betweenTokens[2];

  const firstCodeMatch = firstBetween?.text.match(codePattern);

  if (firstCodeMatch) {
    code = normalizeCode(firstCodeMatch[0]);
    codeEndOrder = firstBetween.order;
  } else if (firstBetween && secondBetween?.text === '-' && thirdBetween && /^\d{2}$/.test(firstBetween.text) && /^\d{4}$/.test(thirdBetween.text)) {
    code = normalizeCode(`${firstBetween.text}-${thirdBetween.text}`);
    codeEndOrder = thirdBetween.order;
  }

  if (!code || codeEndOrder === null) {
    return null;
  }

  const description = cleanDescription(tokens
    .filter((token) => token.order > codeEndOrder && token.order < quantityToken.order)
    .sort((first, second) => first.x - second.x || first.order - second.order)
    .map((token) => token.text)
    .join(' '));

  return {
    elementToken,
    quantityToken,
    codigo: code,
    description,
    columnas: { elementX: elementToken.x, codeX: firstBetween?.x ?? null, descriptionX: tokens.find((token) => token.order > codeEndOrder)?.x ?? null, quantityX: quantityToken.x }
  };
};

const buildCoordinateTableCandidate = ({ line, pageNumber, printedPageNumber, manualNombre, archivoOrigen }) => {
  const tokens = line.tokens.map((token) => ({ ...token, text: normalizeText(token.text) })).filter((token) => token.text);
  const cells = getCoordinateTableCells(tokens);
  const baseDebug = {
    source: 'coordinate-table-row',
    y: line.y,
    line: line.text,
    tokens,
    descartado: true
  };

  if (!cells) {
    return { debug: { ...baseDebug, motivoDescarte: 'La fila no tiene referencia, código, descripción y cantidad en columnas X/Y.' }, sparePart: null };
  }

  const debug = {
    ...baseDebug,
    referenciaDetectada: cells.elementToken.text,
    codigoDetectado: cells.codigo,
    descripcionDetectada: cells.description || null,
    cantidadDetectada: cells.quantityToken.text,
    columnas: cells.columnas
  };

  if (!looksLikeUsefulDescription(cells.description)) return { debug: { ...debug, motivoDescarte: 'La descripción de la columna central no parece útil.' }, sparePart: null };

  return {
    debug: { ...debug, descartado: false, motivoDescarte: null },
    sparePart: {
      manualNombre,
      archivoOrigen,
      pagina: pageNumber,
      paginaImpresa: printedPageNumber,
      codigo: cells.codigo,
      descripcion: cells.description,
      referenciaDespiece: cells.elementToken.text,
      categoria: inferCategory(cells.description)
    }
  };
};

const detectCoordinateTableSpareParts = ({ page, manualNombre, archivoOrigen }) => {
  if (!hasCoordinateTableHeader(page)) {
    return [];
  }

  page.debugDetections.push({
    source: 'coordinate-table-header',
    descartado: false,
    motivoDescarte: null,
    encabezadosDetectados: ['N.º de elemento', 'N.º de pieza', 'Descripción', 'Cantidad']
  });

  return page.lineGroups.flatMap((line) => {
    if (tableHeaderPattern.test(line.text)) {
      return [];
    }

    const candidate = buildCoordinateTableCandidate({
      line,
      pageNumber: page.pageNumber,
      printedPageNumber: page.printedPageNumber,
      manualNombre,
      archivoOrigen
    });
    page.debugDetections.push(candidate.debug);

    return candidate.sparePart ? [candidate.sparePart] : [];
  });
};

const findNextUsefulLine = (lines, startIndex) => {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = cleanDescription(lines[index]);

    if (line) {
      return line;
    }
  }

  return null;
};

const detectStandaloneCodeDescriptionBlock = ({ lines, lineIndex, pageNumber, printedPageNumber, manualNombre, archivoOrigen, debugDetections = null }) => {
  const line = cleanDescription(lines[lineIndex]);

  if (!isCodeOnlyLine(line)) {
    return null;
  }

  const description = findNextUsefulLine(lines, lineIndex);

  if (!description || !isLikelyStandaloneDescriptionLine(description)) {
    return null;
  }

  debugDetections?.push({
    source: 'standalone-code-description-block',
    lineIndex,
    line,
    tokens: normalizeText(line).split(' ').filter(Boolean),
    referenciaDetectada: null,
    codigoDetectado: normalizeCode(line),
    descripcionDetectada: description,
    motivoReferenciaNull: explainNullReference({ rawBefore: '', source: 'standalone-code-description-block' }),
    descartado: false
  });

  return {
    manualNombre,
    archivoOrigen,
    pagina: pageNumber,
    paginaImpresa: printedPageNumber,
    codigo: normalizeCode(line),
    descripcion: description,
    referenciaDespiece: null,
    categoria: inferCategory(description)
  };
};

const addSparePartIfNew = ({ sparePart, spareParts, seen, seenCodePage }) => {
  const key = buildSparePartKey(sparePart);
  const codePageKey = buildCodePageKey(sparePart);

  if (seen.has(key)) {
    return false;
  }

  seen.add(key);
  seenCodePage.add(codePageKey);
  spareParts.push(sparePart);

  return true;
};


const detectSpareParts = ({ pages, manualNombre, archivoOrigen }) => {
  const spareParts = [];
  const seen = new Set();
  const seenCodePage = new Set();

  for (const page of pages) {
    const coordinateTableParts = detectCoordinateTableSpareParts({ page, manualNombre, archivoOrigen });

    for (const sparePart of coordinateTableParts) {
      addSparePartIfNew({ sparePart, spareParts, seen, seenCodePage });
    }

    if (coordinateTableParts.length) {
      continue;
    }

    page.lines.forEach((line, lineIndex) => {
      const detectedInLine = detectSparePartsInLine({
        line,
        lineIndex,
        pageNumber: page.pageNumber,
        printedPageNumber: page.printedPageNumber,
        manualNombre,
        archivoOrigen,
        debugDetections: page.debugDetections
      });

      for (const sparePart of detectedInLine) {
        addSparePartIfNew({ sparePart, spareParts, seen, seenCodePage });
      }

      const standaloneSparePart = detectStandaloneCodeDescriptionBlock({
        lines: page.lines,
        lineIndex,
        pageNumber: page.pageNumber,
        printedPageNumber: page.printedPageNumber,
        manualNombre,
        archivoOrigen,
        debugDetections: page.debugDetections
      });

      if (!standaloneSparePart || seenCodePage.has(buildCodePageKey(standaloneSparePart))) {
        return;
      }

      addSparePartIfNew({ sparePart: standaloneSparePart, spareParts, seen, seenCodePage });
    });
  }

  return spareParts;
};

const insertSparePartIfMissing = async (pool, sparePart, debugInsertFilters = getDebugInsertFilters(), { dryRun = false } = {}) => {
  const sqlParameters = buildInsertSqlParameters(sparePart);
  const debugThisInsert = shouldDebugInsert(sparePart, debugInsertFilters);

  if (debugThisInsert) {
    printInsertDiagnostic({ sparePart, sqlParameters, stage: 'antes de ejecutar SQL' });
  }

  const result = await pool.request()
    .input('ManualNombre', sql.NVarChar(200), sqlParameters.ManualNombre)
    .input('ArchivoOrigen', sql.NVarChar(500), sqlParameters.ArchivoOrigen)
    .input('Pagina', sql.Int, sqlParameters.Pagina)
    .input('PaginaImpresa', sql.Int, sqlParameters.PaginaImpresa)
    .input('Codigo', sql.NVarChar(100), sqlParameters.Codigo)
    .input('Descripcion', sql.NVarChar(500), sqlParameters.Descripcion)
    .input('ReferenciaDespiece', sql.NVarChar(150), sqlParameters.ReferenciaDespiece)
    .input('Categoria', sql.NVarChar(150), sqlParameters.Categoria)
    .input('DryRun', sql.Bit, dryRun ? 1 : 0)
    .query(`
DECLARE @updatedCategory INT = 0;
DECLARE @nullReferenceRepairCandidates INT = 0;
DECLARE @ambiguousSkipped INT = 0;

IF EXISTS (
    SELECT 1
    FROM dbo.RepuestosManuales
    WHERE Codigo = @Codigo
      AND ManualNombre = @ManualNombre
      AND ArchivoOrigen = @ArchivoOrigen
      AND Pagina = @Pagina
      AND COALESCE(NULLIF(LTRIM(RTRIM(ReferenciaDespiece)), ''), '') = COALESCE(NULLIF(LTRIM(RTRIM(@ReferenciaDespiece)), ''), '')
      AND UPPER(LTRIM(RTRIM(Descripcion))) = UPPER(LTRIM(RTRIM(@Descripcion)))
)

BEGIN
    IF @DryRun = 1
    BEGIN
        SELECT CAST(0 AS INT) AS inserted,
               CAST(1 AS INT) AS duplicated,
               CAST(0 AS INT) AS updatedCategory,
               @nullReferenceRepairCandidates AS nullReferenceRepairCandidates,
               @ambiguousSkipped AS ambiguousSkipped;
    END
    ELSE
    BEGIN
        UPDATE dbo.RepuestosManuales
        SET PaginaImpresa = COALESCE(PaginaImpresa, @PaginaImpresa)
        WHERE Codigo = @Codigo
          AND ManualNombre = @ManualNombre
          AND ArchivoOrigen = @ArchivoOrigen
          AND Pagina = @Pagina
          AND COALESCE(NULLIF(LTRIM(RTRIM(ReferenciaDespiece)), ''), '') = COALESCE(NULLIF(LTRIM(RTRIM(@ReferenciaDespiece)), ''), '')
          AND UPPER(LTRIM(RTRIM(Descripcion))) = UPPER(LTRIM(RTRIM(@Descripcion)));

        IF NULLIF(LTRIM(RTRIM(@Categoria)), '') IS NOT NULL
        BEGIN
            UPDATE dbo.RepuestosManuales
            SET Categoria = @Categoria
            WHERE Codigo = @Codigo
              AND ManualNombre = @ManualNombre
              AND ArchivoOrigen = @ArchivoOrigen
              AND Pagina = @Pagina
              AND COALESCE(NULLIF(LTRIM(RTRIM(ReferenciaDespiece)), ''), '') = COALESCE(NULLIF(LTRIM(RTRIM(@ReferenciaDespiece)), ''), '')
              AND UPPER(LTRIM(RTRIM(Descripcion))) = UPPER(LTRIM(RTRIM(@Descripcion)))
              AND (
                NULLIF(LTRIM(RTRIM(Categoria)), '') IS NULL
                OR LTRIM(RTRIM(Categoria)) IN (N'Sin categoría', N'Sin categoria')
              );

            SET @updatedCategory = @@ROWCOUNT;
        END;

        SELECT CAST(0 AS INT) AS inserted,
               CAST(1 AS INT) AS duplicated,
               @updatedCategory AS updatedCategory,
               @nullReferenceRepairCandidates AS nullReferenceRepairCandidates,
               @ambiguousSkipped AS ambiguousSkipped;
    END;
END
ELSE
BEGIN
    IF NULLIF(LTRIM(RTRIM(@ReferenciaDespiece)), '') IS NOT NULL
    BEGIN
        SELECT @nullReferenceRepairCandidates = COUNT(1)
        FROM dbo.RepuestosManuales
        WHERE Codigo = @Codigo
          AND ManualNombre = @ManualNombre
          AND ArchivoOrigen = @ArchivoOrigen
          AND Pagina = @Pagina
          AND UPPER(LTRIM(RTRIM(Descripcion))) = UPPER(LTRIM(RTRIM(@Descripcion)))
          AND NULLIF(LTRIM(RTRIM(ReferenciaDespiece)), '') IS NULL;
    END;

    IF @nullReferenceRepairCandidates = 1
    BEGIN
        IF @DryRun = 1
        BEGIN
            SELECT CAST(0 AS INT) AS inserted,
                   CAST(0 AS INT) AS duplicated,
                   CAST(0 AS INT) AS updatedCategory,
                   CAST(1 AS INT) AS nullReferenceRepairCandidates,
                   CAST(0 AS INT) AS ambiguousSkipped;
        END
        ELSE
        BEGIN
        UPDATE dbo.RepuestosManuales
        SET ReferenciaDespiece = @ReferenciaDespiece,
            PaginaImpresa = COALESCE(PaginaImpresa, @PaginaImpresa),
            UpdatedAt = SYSUTCDATETIME()
        WHERE Codigo = @Codigo
          AND ManualNombre = @ManualNombre
          AND ArchivoOrigen = @ArchivoOrigen
          AND Pagina = @Pagina
          AND UPPER(LTRIM(RTRIM(Descripcion))) = UPPER(LTRIM(RTRIM(@Descripcion)))
          AND NULLIF(LTRIM(RTRIM(ReferenciaDespiece)), '') IS NULL;

        SELECT CAST(0 AS INT) AS inserted,
               CAST(0 AS INT) AS duplicated,
               CAST(0 AS INT) AS updatedCategory,
               CAST(1 AS INT) AS nullReferenceRepairCandidates,
               CAST(0 AS INT) AS ambiguousSkipped;
        END;
    END
    ELSE IF @nullReferenceRepairCandidates > 1
    BEGIN
        SET @ambiguousSkipped = @nullReferenceRepairCandidates;

        SELECT CAST(0 AS INT) AS inserted,
               CAST(0 AS INT) AS duplicated,
               CAST(0 AS INT) AS updatedCategory,
               @nullReferenceRepairCandidates AS nullReferenceRepairCandidates,
               @ambiguousSkipped AS ambiguousSkipped;
    END
    ELSE
    BEGIN
        IF @DryRun = 1
        BEGIN
            SELECT CAST(1 AS INT) AS inserted,
                   CAST(0 AS INT) AS duplicated,
                   CAST(0 AS INT) AS updatedCategory,
                   CAST(0 AS INT) AS nullReferenceRepairCandidates,
                   CAST(0 AS INT) AS ambiguousSkipped;
        END
        ELSE
        BEGIN
        INSERT INTO dbo.RepuestosManuales (
            ManualNombre,
            ArchivoOrigen,
            Pagina,
            PaginaImpresa,
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
            @PaginaImpresa,
            @Codigo,
            @Descripcion,
            @ReferenciaDespiece,
            @Categoria,
            1
        );

        SELECT CAST(1 AS INT) AS inserted,
               CAST(0 AS INT) AS duplicated,
               CAST(0 AS INT) AS updatedCategory,
               CAST(0 AS INT) AS nullReferenceRepairCandidates,
               CAST(0 AS INT) AS ambiguousSkipped;
        END;
    END;
END;
`);

  const counters = result.recordset?.[0] ?? { inserted: 0, duplicated: 0, updatedCategory: 0, nullReferenceRepairCandidates: 0, ambiguousSkipped: 0 };

  const normalizedCounters = {
    inserted: Number(counters.inserted) || 0,
    duplicated: Number(counters.duplicated) || 0,
    updatedCategory: Number(counters.updatedCategory) || 0,
    nullReferenceRepairCandidates: Number(counters.nullReferenceRepairCandidates) || 0,
    ambiguousSkipped: Number(counters.ambiguousSkipped) || 0
  };

  if (debugThisInsert) {
    const existingRows = await fetchExistingRowsForInsertDiagnostic(pool, sparePart);
    printInsertDiagnostic({
      sparePart,
      sqlParameters,
      stage: 'después de ejecutar SQL',
      counters: normalizedCounters,
      existingRows
    });
  }

  return normalizedCounters;
};

export const buildImportPreview = async ({ manualNombre, archivoOrigen }) => {
  const pdfPath = path.join(pdfsDirectory, archivoOrigen);
  const pages = await extractPdfPages(pdfPath);
  const spareParts = detectSpareParts({ pages, manualNombre, archivoOrigen });

  return { pages, spareParts };
};

const buildVisualVerification = ({ manualNombre, spareParts }) => visualVerificationChecks
  .filter((check) => check.manualNombre === manualNombre)
  .map((check) => ({
    ...check,
    matches: check.codes.map((code) => {
      const match = spareParts.find((sparePart) => (
        sparePart.pagina === check.pageNumber
        && sparePart.codigo.toUpperCase() === code.toUpperCase()
      ));

      return {
        code,
        found: Boolean(match),
        pagina: match?.pagina ?? null,
        paginaImpresa: match?.paginaImpresa ?? null,
        referenciaDespiece: match?.referenciaDespiece ?? null
      };
    })
  }));


const parseCsvOption = (value) => (value ?? '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const getDebugInsertFilters = () => ({
  enabled: process.argv.includes('--debug-insert'),
  referencias: parseCsvOption(getCliOption('debug-insert-reference')).map((value) => value.toLocaleUpperCase('es-AR')),
  codigos: parseCsvOption(getCliOption('debug-insert-code')).map((value) => value.toLocaleUpperCase('es-AR'))
});

const shouldDebugInsert = (sparePart, filters = getDebugInsertFilters()) => {
  if (!filters.enabled && !filters.referencias.length && !filters.codigos.length) {
    return false;
  }

  const referencia = String(sparePart.referenciaDespiece ?? '').trim().toLocaleUpperCase('es-AR');
  const codigo = String(sparePart.codigo ?? '').trim().toLocaleUpperCase('es-AR');

  if (filters.referencias.length && !filters.referencias.includes(referencia)) {
    return false;
  }

  if (filters.codigos.length && !filters.codigos.includes(codigo)) {
    return false;
  }

  return true;
};

const buildInsertSqlParameters = (sparePart) => ({
  ManualNombre: sparePart.manualNombre,
  ArchivoOrigen: sparePart.archivoOrigen,
  Pagina: sparePart.pagina,
  PaginaImpresa: sparePart.paginaImpresa,
  Codigo: sparePart.codigo,
  Descripcion: sparePart.descripcion,
  ReferenciaDespiece: sparePart.referenciaDespiece,
  Categoria: sparePart.categoria
});

const printInsertDiagnostic = ({ sparePart, sqlParameters, stage, counters = null, existingRows = null }) => {
  const parserObject = {
    referenciaDespiece: sparePart.referenciaDespiece ?? null,
    codigo: sparePart.codigo,
    descripcion: sparePart.descripcion,
    pagina: sparePart.pagina,
    paginaImpresa: sparePart.paginaImpresa ?? null
  };
  const comparison = {
    referenciaDespiece: Object.is(parserObject.referenciaDespiece, sqlParameters.ReferenciaDespiece ?? null) ? 'OK' : 'DIFERENTE',
    codigo: Object.is(parserObject.codigo, sqlParameters.Codigo) ? 'OK' : 'DIFERENTE',
    descripcion: Object.is(parserObject.descripcion, sqlParameters.Descripcion) ? 'OK' : 'DIFERENTE',
    pagina: Object.is(parserObject.pagina, sqlParameters.Pagina) ? 'OK' : 'DIFERENTE',
    paginaImpresa: Object.is(parserObject.paginaImpresa, sqlParameters.PaginaImpresa ?? null) ? 'OK' : 'DIFERENTE'
  };

  console.log(`\n[DEBUG INSERT RepuestosManuales] ${stage}`);
  console.log('Objeto JavaScript inmediatamente antes del INSERT:');
  console.log(JSON.stringify(parserObject, null, 2));
  console.log('Parámetros enviados al INSERT SQL:');
  console.log(JSON.stringify(sqlParameters, null, 2));
  console.log('Comparación objeto JS vs parámetros SQL:');
  console.log(JSON.stringify(comparison, null, 2));

  if (counters) {
    console.log('Resultado INSERT/duplicado:');
    console.log(JSON.stringify(counters, null, 2));
  }

  if (existingRows) {
    console.log('Registros existentes que coinciden por código/descripción/manual/página para revisar importaciones anteriores:');
    console.log(JSON.stringify(existingRows, null, 2));
  }
};

const fetchExistingRowsForInsertDiagnostic = async (pool, sparePart) => {
  const result = await pool.request()
    .input('ManualNombre', sql.NVarChar(200), sparePart.manualNombre)
    .input('Pagina', sql.Int, sparePart.pagina)
    .input('PaginaImpresa', sql.Int, sparePart.paginaImpresa)
    .input('Codigo', sql.NVarChar(100), sparePart.codigo)
    .input('Descripcion', sql.NVarChar(500), sparePart.descripcion)
    .query(`
SELECT TOP (20)
    Id,
    ManualNombre,
    Pagina,
    PaginaImpresa,
    Codigo,
    Descripcion,
    ReferenciaDespiece,
    CreatedAt,
    UpdatedAt
FROM dbo.RepuestosManuales
WHERE Codigo = @Codigo
  AND ManualNombre = @ManualNombre
  AND (Pagina = @Pagina OR Pagina = @PaginaImpresa)
  AND UPPER(LTRIM(RTRIM(Descripcion))) = UPPER(LTRIM(RTRIM(@Descripcion)))
ORDER BY Id;
`);

  return result.recordset ?? [];
};

const getCliOption = (name) => {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));

  return argument ? argument.slice(prefix.length) : null;
};

const shouldDebugPage = (page, debugPage) => {
  if (!debugPage) {
    return false;
  }

  const parsedDebugPage = Number.parseInt(debugPage, 10);

  return page.pageNumber === parsedDebugPage || page.printedPageNumber === parsedDebugPage;
};

const printPageDebug = ({ pdfConfig, page, spareParts }) => {
  const pageParts = spareParts.filter((sparePart) => sparePart.pagina === page.pageNumber);

  console.log(`\nDEBUG importador PDF: ${pdfConfig.manualNombre} / ${pdfConfig.archivoOrigen}`);
  console.log(`Página interna=${page.pageNumber}; Página impresa=${page.printedPageNumber}`);
  console.log('\n[Texto crudo extraído]');
  console.log(page.rawText || '(sin texto extraído)');

  console.log('\n[Líneas reconstruidas]');
  page.lineGroups.forEach((line, index) => {
    console.log(`${index + 1}. y=${line.y}: ${line.text}`);
  });

  console.log('\n[Tokens por línea]');
  page.lineGroups.forEach((line, index) => {
    const tokens = line.tokens.map((token) => `${token.text} (x=${token.x}, y=${token.y}, orden=${token.order})`).join(' | ');
    console.log(`${index + 1}. ${tokens}`);
  });

  console.log('\n[Filas candidatas tabulares por coordenadas]');
  const coordinateCandidates = page.debugDetections.filter((detection) => detection.source === 'coordinate-table-header' || detection.source === 'coordinate-table-row');
  if (!coordinateCandidates.length) {
    console.log('(sin parser tabular activo; no se detectaron encabezados de tabla por columnas)');
  }
  for (const candidate of coordinateCandidates) {
    console.log(JSON.stringify(candidate, null, 2));
  }

  console.log('\n[Detecciones por línea]');
  if (!page.debugDetections.length) {
    console.log('(sin detecciones)');
  }
  for (const detection of page.debugDetections) {
    console.log(JSON.stringify(detection, null, 2));
  }

  console.log('\n[Registros detectados para importar en esta página]');
  if (!pageParts.length) {
    console.log('(sin registros)');
  }
  for (const part of pageParts) {
    console.log(JSON.stringify({
      referenciaDespiece: part.referenciaDespiece ?? null,
      codigo: part.codigo,
      descripcion: part.descripcion,
      categoria: part.categoria ?? null
    }, null, 2));
  }
};

const printDebugPages = ({ pages, spareParts, pdfConfig, debugPage }) => {
  for (const page of pages) {
    if (shouldDebugPage(page, debugPage)) {
      printPageDebug({ pdfConfig, page, spareParts });
    }
  }
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
    nullReferenceRepairCandidates: 0,
    ambiguousSkipped: 0,
    uncategorized: spareParts.length - categorizedDetected,
    withReferenciaDespiece: spareParts.filter((sparePart) => sparePart.referenciaDespiece).length,
    withoutReferenciaDespiece: spareParts.filter((sparePart) => !sparePart.referenciaDespiece).length,
    visualVerification: buildVisualVerification({ manualNombre: pdfConfig.manualNombre, spareParts })
  };
};

const importPdf = async ({ pool, manualNombre, archivoOrigen, dryRun = false }) => {
  const { pages, spareParts } = await buildImportPreview({ manualNombre, archivoOrigen });
  const categorizedDetected = spareParts.filter((sparePart) => sparePart.categoria).length;
  const summary = {
    pdf: archivoOrigen,
    dryRun,
    pagesRead: pages.length,
    detected: spareParts.length,
    inserted: 0,
    duplicated: 0,
    categorizedNew: 0,
    updatedExistingWithCategory: 0,
    nullReferenceRepairCandidates: 0,
    ambiguousSkipped: 0,
    uncategorized: spareParts.length - categorizedDetected,
    withReferenciaDespiece: spareParts.filter((sparePart) => sparePart.referenciaDespiece).length,
    withoutReferenciaDespiece: spareParts.filter((sparePart) => !sparePart.referenciaDespiece).length,
    visualVerification: buildVisualVerification({ manualNombre, spareParts })
  };

  const debugInsertFilters = getDebugInsertFilters();

  for (const sparePart of spareParts) {
    const counters = await insertSparePartIfMissing(pool, sparePart, debugInsertFilters, { dryRun });
    summary.inserted += counters.inserted;
    summary.duplicated += counters.duplicated;
    summary.updatedExistingWithCategory += counters.updatedCategory;
    summary.nullReferenceRepairCandidates += counters.nullReferenceRepairCandidates;
    summary.ambiguousSkipped += counters.ambiguousSkipped;

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
  console.log(`  Registros ${summary.dryRun ? 'a insertar (dry-run)' : 'insertados'}: ${summary.inserted}`);
  console.log(`  Registros categorizados nuevos: ${summary.categorizedNew}`);
  console.log(`  Registros existentes actualizados con categoría: ${summary.updatedExistingWithCategory}`);
  console.log(`  Registros que siguen sin categoría: ${summary.uncategorized}`);
  console.log(`  Registros omitidos por duplicados reales: ${summary.duplicated}`);
  console.log(`  Candidatos a reparar ReferenciaDespiece NULL: ${summary.nullReferenceRepairCandidates}`);
  console.log(`  Ambiguos omitidos: ${summary.ambiguousSkipped}`);
  console.log(`  Registros con ReferenciaDespiece detectada: ${summary.withReferenciaDespiece}`);
  console.log(`  Registros sin ReferenciaDespiece: ${summary.withoutReferenciaDespiece}`);

  for (const check of summary.visualVerification ?? []) {
    console.log(`  Verificación visual ${check.manualNombre} página interna ${check.pageNumber}:`);

    for (const match of check.matches) {
      console.log(`    ${match.found ? 'OK' : 'FALTA'} ${match.code} (Pagina=${match.pagina ?? '-'}, PaginaImpresa=${match.paginaImpresa ?? '-'}, Ref=${match.referenciaDespiece ?? '-'})`);
    }
  }
};

async function runImporter() {
  const dryRun = process.argv.includes('--dry-run');
  const debugPage = getCliOption('debug-page');
  const debugManual = getCliOption('debug-manual');
  const pool = await getSqlPool();
  const summaries = [];

  for (const pdfConfig of PDFS_TO_IMPORT) {
    if (debugManual && pdfConfig.manualNombre.toLocaleLowerCase('es-AR') !== debugManual.toLocaleLowerCase('es-AR')) {
      continue;
    }

    const summary = await importPdf({ pool, ...pdfConfig, dryRun });
    if (debugPage) {
      const { pages, spareParts } = await buildImportPreview(pdfConfig);
      printDebugPages({ pages, spareParts, pdfConfig, debugPage });
    }

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
    nullReferenceRepairCandidates: accumulator.nullReferenceRepairCandidates + summary.nullReferenceRepairCandidates,
    ambiguousSkipped: accumulator.ambiguousSkipped + summary.ambiguousSkipped,
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
    nullReferenceRepairCandidates: 0,
    ambiguousSkipped: 0,
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
  console.log(`  Registros omitidos por duplicados reales: ${totals.duplicated}`);
  console.log(`  Candidatos a reparar ReferenciaDespiece NULL: ${totals.nullReferenceRepairCandidates}`);
  console.log(`  Ambiguos omitidos: ${totals.ambiguousSkipped}`);
  console.log(`  Registros con ReferenciaDespiece detectada: ${totals.withReferenciaDespiece}`);
  console.log(`  Registros sin ReferenciaDespiece: ${totals.withoutReferenciaDespiece}`);
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
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
}
