import dotenv from 'dotenv';
import { getSqlPool } from '../../config/sqlServer.js';

dotenv.config();

const sparePartRubrosFilter = 'p.ID_Rubro IN (3, 4, 8, 11, 13, 24, 26, 27)';
const UNCATEGORIZED_LABELS = new Set(['sin categoria', 'sin categoría']);
const SIMILARITY_THRESHOLD = Number.parseFloat(process.env.CATALOG_AUDIT_SIMILARITY_THRESHOLD ?? '0.9');
const MAX_SIMILAR_LENGTH_DELTA = Number.parseInt(process.env.CATALOG_AUDIT_MAX_LENGTH_DELTA ?? '8', 10);

const catalogQuery = `
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

SELECT
    p.ID_Articulo AS id,
    p.CodigoAlternativo AS codigo,
    p.Descripcion AS descripcion,
    r.Descripcion AS categoria
FROM dbo.Productos p
LEFT JOIN dbo.Rubros r
    ON r.ID_Rubro = p.ID_Rubro
WHERE ${sparePartRubrosFilter}
ORDER BY p.ID_Articulo;
`;

const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const normalizeForComparison = (value) => normalizeWhitespace(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const isNull = (value) => value === null || value === undefined;
const isEmptyString = (value) => !isNull(value) && String(value).trim() === '';
const isSinCategoria = (value) => UNCATEGORIZED_LABELS.has(normalizeForComparison(value));
const isMissing = (value) => isNull(value) || isEmptyString(value);
const isMissingCategory = (value) => isMissing(value) || isSinCategoria(value);

const groupBy = (items, getKey) => items.reduce((groups, item) => {
  const key = getKey(item);
  if (!groups.has(key)) {
    groups.set(key, []);
  }
  groups.get(key).push(item);
  return groups;
}, new Map());

const getDuplicates = (items, getKey) => [...groupBy(items, getKey).entries()]
  .filter(([key, values]) => key !== '' && values.length > 1)
  .map(([key, values]) => ({ key, values }));

const levenshteinDistance = (left, right) => {
  if (left === right) {
    return 0;
  }

  if (left.length === 0) {
    return right.length;
  }

  if (right.length === 0) {
    return left.length;
  }

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  let current = new Array(right.length + 1);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost
      );
    }

    [previous, current] = [current, previous];
  }

  return previous[right.length];
};

const similarityScore = (left, right) => {
  const maxLength = Math.max(left.length, right.length);
  if (maxLength === 0) {
    return 1;
  }

  return 1 - (levenshteinDistance(left, right) / maxLength);
};

const getDescriptionBlocks = (items) => groupBy(items, (item) => {
  const [firstToken = '', secondToken = ''] = item.normalizedDescription.split(' ');
  return `${firstToken.slice(0, 4)}:${secondToken.slice(0, 4)}`;
});

const getSimilarDescriptions = (items) => {
  const candidates = items.filter((item) => item.normalizedDescription.length > 0);
  const blocks = getDescriptionBlocks(candidates);
  const pairs = [];
  const seen = new Set();

  for (const blockItems of blocks.values()) {
    for (let leftIndex = 0; leftIndex < blockItems.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < blockItems.length; rightIndex += 1) {
        const left = blockItems[leftIndex];
        const right = blockItems[rightIndex];
        const lengthDelta = Math.abs(left.normalizedDescription.length - right.normalizedDescription.length);

        if (lengthDelta > MAX_SIMILAR_LENGTH_DELTA || left.normalizedDescription === right.normalizedDescription) {
          continue;
        }

        const pairKey = [left.id, right.id].sort((a, b) => a - b).join(':');
        if (seen.has(pairKey)) {
          continue;
        }

        const score = similarityScore(left.normalizedDescription, right.normalizedDescription);
        if (score >= SIMILARITY_THRESHOLD) {
          seen.add(pairKey);
          pairs.push({ left, right, score });
        }
      }
    }
  }

  return pairs.sort((a, b) => b.score - a.score || a.left.descripcion.localeCompare(b.left.descripcion));
};

const formatValue = (value) => {
  if (isNull(value)) {
    return 'NULL';
  }

  if (String(value).trim() === '') {
    return '(empty string)';
  }

  return String(value);
};

const formatProduct = (product) => [
  `#${product.id}`,
  `Codigo: ${formatValue(product.codigo)}`,
  `Descripcion: ${formatValue(product.descripcion)}`,
  `Categoria: ${formatValue(product.categoria)}`
].join(' | ');

const printSection = (title) => {
  console.log('\n');
  console.log('='.repeat(88));
  console.log(title);
  console.log('='.repeat(88));
};

const printDuplicateGroups = (title, groups) => {
  printSection(title);
  console.log(`Grupos encontrados: ${groups.length}`);
  const affectedProducts = groups.reduce((total, group) => total + group.values.length, 0);
  console.log(`Productos afectados: ${affectedProducts}`);

  if (groups.length === 0) {
    console.log('No se detectaron hallazgos.');
    return;
  }

  groups.forEach((group, index) => {
    console.log(`\n${index + 1}. Valor duplicado: "${group.key}" (${group.values.length} productos)`);
    group.values.forEach((product) => console.log(`   - ${formatProduct(product)}`));
  });
};

const printMissingFieldReport = (label, products) => {
  console.log(`\n${label}: ${products.length}`);
  if (products.length === 0) {
    return;
  }

  products.forEach((product) => console.log(`   - ${formatProduct(product)}`));
};

const buildAudit = (products) => {
  const normalizedProducts = products.map((product) => ({
    ...product,
    normalizedCode: normalizeForComparison(product.codigo),
    normalizedDescription: normalizeForComparison(product.descripcion),
    normalizedCategory: normalizeForComparison(product.categoria)
  }));

  return {
    products: normalizedProducts,
    total: normalizedProducts.length,
    categories: [...groupBy(normalizedProducts, (product) => formatValue(product.categoria)).entries()]
      .map(([category, values]) => ({ category, count: values.length }))
      .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category)),
    withoutCategory: {
      null: normalizedProducts.filter((product) => isNull(product.categoria)),
      emptyString: normalizedProducts.filter((product) => isEmptyString(product.categoria)),
      sinCategoriaAccent: normalizedProducts.filter(
        (product) => normalizeWhitespace(product.categoria).toLowerCase() === 'sin categoría'
      ),
      sinCategoriaNoAccent: normalizedProducts.filter(
        (product) => normalizeWhitespace(product.categoria).toLowerCase() === 'sin categoria'
      )
    },
    duplicateCodes: getDuplicates(normalizedProducts, (product) => product.normalizedCode),
    duplicateDescriptions: getDuplicates(normalizedProducts, (product) => product.normalizedDescription),
    similarDescriptions: getSimilarDescriptions(normalizedProducts),
    missingFields: {
      codigo: normalizedProducts.filter((product) => isMissing(product.codigo)),
      descripcion: normalizedProducts.filter((product) => isMissing(product.descripcion)),
      categoria: normalizedProducts.filter((product) => isMissingCategory(product.categoria))
    }
  };
};

const printReport = (audit) => {
  console.log('AUDITORIA DE CATALOGO DE REPUESTOS');
  console.log(`Fecha de ejecucion: ${new Date().toISOString()}`);
  console.log(`Filtro aplicado: ${sparePartRubrosFilter}`);
  console.log(`Umbral de similitud: ${SIMILARITY_THRESHOLD}`);
  console.log(`Total de repuestos: ${audit.total}`);

  printSection('1. Conteo de productos por categoria');
  if (audit.categories.length === 0) {
    console.log('No se encontraron categorias.');
  } else {
    audit.categories.forEach(({ category, count }) => console.log(`${category}: ${count}`));
  }

  printSection('2. Productos sin categoria');
  console.log(`NULL: ${audit.withoutCategory.null.length}`);
  console.log(`Empty string: ${audit.withoutCategory.emptyString.length}`);
  console.log(`"Sin categoría": ${audit.withoutCategory.sinCategoriaAccent.length}`);
  console.log(`"Sin categoria": ${audit.withoutCategory.sinCategoriaNoAccent.length}`);

  printDuplicateGroups('3. Duplicados potenciales por Codigo', audit.duplicateCodes);
  printDuplicateGroups('4. Duplicados potenciales por Descripcion exacta', audit.duplicateDescriptions);

  printSection('5. Descripciones similares');
  console.log(`Pares encontrados: ${audit.similarDescriptions.length}`);
  if (audit.similarDescriptions.length === 0) {
    console.log('No se detectaron hallazgos.');
  } else {
    audit.similarDescriptions.forEach((pair, index) => {
      console.log(`\n${index + 1}. Similitud: ${(pair.score * 100).toFixed(2)}%`);
      console.log(`   - ${formatProduct(pair.left)}`);
      console.log(`   - ${formatProduct(pair.right)}`);
    });
  }

  printSection('6. Campos criticos faltantes');
  printMissingFieldReport('Codigo faltante', audit.missingFields.codigo);
  printMissingFieldReport('Descripcion faltante', audit.missingFields.descripcion);
  printMissingFieldReport('Categoria faltante o no informada', audit.missingFields.categoria);

  printSection('Fin del reporte');
};

const runAudit = async () => {
  const pool = await getSqlPool();
  const result = await pool.request().query(catalogQuery);
  const audit = buildAudit(result.recordset ?? []);
  printReport(audit);
};

runAudit()
  .catch((error) => {
    console.error('No se pudo completar la auditoria del catalogo.');
    console.error(error.message);
    if (error.cause?.message) {
      console.error(error.cause.message);
    }
    process.exitCode = 1;
  });
