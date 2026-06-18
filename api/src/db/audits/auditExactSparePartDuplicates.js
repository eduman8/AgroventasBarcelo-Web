import dotenv from 'dotenv';
import { getSqlPool } from '../../config/sqlServer.js';

dotenv.config();

const sparePartRubrosFilter = 'p.ID_Rubro IN (3, 4, 8, 11, 13, 24, 26, 27)';
const OUTPUT_JSON = ['true', '1', 'yes', 'y'].includes(
  String(process.env.CATALOG_EXACT_DUPLICATES_JSON ?? '').trim().toLowerCase()
);

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

const formatValue = (value) => {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (String(value).trim() === '') {
    return '(empty string)';
  }

  return String(value);
};

const groupBy = (items, getKey) => items.reduce((groups, item) => {
  const key = getKey(item);
  if (!groups.has(key)) {
    groups.set(key, []);
  }
  groups.get(key).push(item);
  return groups;
}, new Map());

const uniqueValues = (items, getValue) => [...new Set(items.map(getValue))];

const buildClassification = (products) => {
  const rawCodes = uniqueValues(products, (product) => normalizeWhitespace(product.codigo));
  const rawDescriptions = uniqueValues(products, (product) => normalizeWhitespace(product.descripcion));
  const normalizedCategories = uniqueValues(products, (product) => product.normalizedCategory);
  const reasons = [];

  if (rawCodes.length > 1) {
    reasons.push('codigo visible distinto tras normalizar puntuacion/mayusculas');
  }

  if (rawDescriptions.length > 1) {
    reasons.push('descripcion visible distinta tras normalizar puntuacion/mayusculas');
  }

  if (normalizedCategories.length > 1) {
    reasons.push('categorias distintas');
  }

  return {
    type: reasons.length === 0 ? 'Duplicado exacto eliminable' : 'Requiere revision manual',
    reasons: reasons.length === 0 ? ['mismo codigo, descripcion y categoria normalizados'] : reasons
  };
};

const buildAudit = (products) => {
  const normalizedProducts = products.map((product) => ({
    ...product,
    normalizedCode: normalizeForComparison(product.codigo),
    normalizedDescription: normalizeForComparison(product.descripcion),
    normalizedCategory: normalizeForComparison(product.categoria)
  }));

  const duplicateGroups = [...groupBy(
    normalizedProducts,
    (product) => `${product.normalizedCode}\u0000${product.normalizedDescription}`
  ).values()]
    .filter((values) => values.length > 1 && values[0].normalizedCode !== '' && values[0].normalizedDescription !== '')
    .map((values) => {
      const sortedValues = [...values].sort((left, right) => left.id - right.id);
      const classification = buildClassification(sortedValues);

      return {
        ids: sortedValues.map((product) => product.id),
        code: sortedValues[0].normalizedCode,
        description: sortedValues[0].normalizedDescription,
        visibleCode: normalizeWhitespace(sortedValues[0].codigo),
        visibleDescription: normalizeWhitespace(sortedValues[0].descripcion),
        classification: classification.type,
        classificationReasons: classification.reasons,
        products: sortedValues
      };
    })
    .sort((left, right) => left.code.localeCompare(right.code) || left.description.localeCompare(right.description));

  const eliminableGroups = duplicateGroups.filter(
    (group) => group.classification === 'Duplicado exacto eliminable'
  );
  const manualReviewGroups = duplicateGroups.filter(
    (group) => group.classification === 'Requiere revision manual'
  );

  return {
    totalProducts: normalizedProducts.length,
    totalDuplicateGroups: duplicateGroups.length,
    totalAffectedProducts: duplicateGroups.reduce((total, group) => total + group.products.length, 0),
    eliminableGroups,
    manualReviewGroups,
    duplicateGroups
  };
};

const printGroup = (group, index) => {
  console.log(`\n${index + 1}. ${group.classification}`);
  console.log(`   IDs: ${group.ids.join(', ')}`);
  console.log(`   Codigo: ${formatValue(group.visibleCode)}`);
  console.log(`   Descripcion: ${formatValue(group.visibleDescription)}`);
  console.log(`   Codigo normalizado: ${group.code}`);
  console.log(`   Descripcion normalizada: ${group.description}`);
  console.log(`   Motivo clasificacion: ${group.classificationReasons.join('; ')}`);
  group.products.forEach((product) => {
    console.log(
      `   - #${product.id} | Codigo: ${formatValue(product.codigo)} | Descripcion: ${formatValue(product.descripcion)} | Categoria: ${formatValue(product.categoria)}`
    );
  });
};

const printGroups = (title, groups) => {
  console.log('\n');
  console.log('='.repeat(88));
  console.log(title);
  console.log('='.repeat(88));
  console.log(`Grupos: ${groups.length}`);

  if (groups.length === 0) {
    console.log('No se detectaron hallazgos.');
    return;
  }

  groups.forEach(printGroup);
};

const printReport = (audit) => {
  console.log('AUDITORIA EXCLUSIVA DE DUPLICADOS EXACTOS DE REPUESTOS');
  console.log(`Fecha de ejecucion: ${new Date().toISOString()}`);
  console.log(`Filtro aplicado: ${sparePartRubrosFilter}`);
  console.log('Criterio: Codigo normalizado identico + Descripcion normalizada identica');
  console.log('Alcance: no compara marca, medidas, rodamientos/retenes variantes ni productos similares.');
  console.log('Modo: solo lectura; no modifica datos.');
  console.log(`Total de repuestos evaluados: ${audit.totalProducts}`);
  console.log(`Total de grupos duplicados exactos: ${audit.totalDuplicateGroups}`);
  console.log(`Productos involucrados: ${audit.totalAffectedProducts}`);
  console.log(`Duplicados exactos eliminables: ${audit.eliminableGroups.length}`);
  console.log(`Duplicados que requieren revision manual: ${audit.manualReviewGroups.length}`);

  printGroups('1. Duplicados exactos eliminables', audit.eliminableGroups);
  printGroups('2. Duplicados que requieren revision manual', audit.manualReviewGroups);
};

const runAudit = async () => {
  const pool = await getSqlPool();
  const result = await pool.request().query(catalogQuery);
  const audit = buildAudit(result.recordset ?? []);

  if (OUTPUT_JSON) {
    console.log(JSON.stringify(audit, null, 2));
    return;
  }

  printReport(audit);
};

runAudit()
  .catch((error) => {
    console.error('No se pudo completar la auditoria exclusiva de duplicados exactos.');
    console.error(error.message);
    if (error.cause?.message) {
      console.error(error.cause.message);
    }
    process.exitCode = 1;
  });
