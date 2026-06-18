import dotenv from 'dotenv';
import { getSqlPool, sql } from '../../config/sqlServer.js';

// Load .env explicitly because this utility is intended to be run directly from npm scripts.
dotenv.config();

const sparePartRubrosFilter = 'p.ID_Rubro IN (3, 4, 8, 11, 13, 24, 26, 27)';

const REPAIR_REPLACEMENTS = [
  ['├í', 'á'],
  ['├│', 'ó'],
  ['├¡', 'í'],
  ['├®', 'é'],
  ['├æ', 'Ñ'],
  ['├▒', 'ñ'],
  ['┬║', 'º'],
  ['┬┤', '´'],
  ['├ÿ', 'Ø']
];

const TARGET_FIELDS = [
  {
    label: 'Descripcion',
    table: 'dbo.Productos',
    alias: 'p',
    idColumn: 'ID_Articulo',
    valueColumn: 'Descripcion',
    sqlType: sql.NVarChar(500),
    selectExpression: 'p.Descripcion',
    productIdExpression: 'p.ID_Articulo',
    productCodeExpression: 'p.CodigoAlternativo'
  },
  {
    label: 'Categoria',
    table: 'dbo.Rubros',
    alias: 'r',
    idColumn: 'ID_Rubro',
    valueColumn: 'Descripcion',
    sqlType: sql.NVarChar(100),
    selectExpression: 'r.Descripcion',
    productIdExpression: 'p.ID_Articulo',
    productCodeExpression: 'p.CodigoAlternativo'
  },
  {
    label: 'CodigoAlternativo',
    table: 'dbo.Productos',
    alias: 'p',
    idColumn: 'ID_Articulo',
    valueColumn: 'CodigoAlternativo',
    sqlType: sql.NVarChar(100),
    selectExpression: 'p.CodigoAlternativo',
    productIdExpression: 'p.ID_Articulo',
    productCodeExpression: 'p.CodigoAlternativo'
  },
  {
    label: 'Marca',
    table: 'dbo.Marcas',
    alias: 'm',
    idColumn: 'ID_Marca',
    valueColumn: 'Marca',
    sqlType: sql.NVarChar(100),
    selectExpression: 'm.Marca',
    productIdExpression: 'p.ID_Articulo',
    productCodeExpression: 'p.CodigoAlternativo'
  }
];

const usage = `
Uso:
  npm run repair:catalog-encoding --workspace api -- --preview
  npm run repair:catalog-encoding --workspace api -- --dry-run
  npm run repair:catalog-encoding --workspace api -- --apply

Modos:
  --preview  Modo por defecto. Solo lectura; genera el reporte de valores reparables.
  --dry-run  Ejecuta las reparaciones dentro de una transacción y siempre hace rollback.
  --apply    Aplica las reparaciones dentro de una transacción y hace commit.

Opciones:
  --json     Imprime el reporte completo en JSON.
  --help     Muestra esta ayuda.
`;

const normalizeArg = (arg) => String(arg ?? '').trim().toLowerCase();

const parseArgs = (argv) => {
  const args = new Set(argv.map(normalizeArg));

  if (args.has('--help') || args.has('-h')) {
    return { help: true };
  }

  const selectedModes = ['--preview', '--dry-run', '--apply'].filter((mode) => args.has(mode));
  if (selectedModes.length > 1) {
    throw new Error(`Seleccione un solo modo: ${selectedModes.join(', ')}.`);
  }

  return {
    mode: selectedModes[0]?.replace('--', '') ?? 'preview',
    json: args.has('--json')
  };
};

const repairMojibake = (value) => {
  if (value === null || value === undefined) {
    return value;
  }

  return REPAIR_REPLACEMENTS.reduce(
    (repaired, [pattern, replacement]) => repaired.split(pattern).join(replacement),
    String(value)
  );
};

const hasMojibake = (value) => value !== null
  && value !== undefined
  && REPAIR_REPLACEMENTS.some(([pattern]) => String(value).includes(pattern));

const formatValue = (value) => {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (String(value).trim() === '') {
    return '(empty string)';
  }

  return String(value);
};

const getCatalogRows = async (request) => {
  const result = await request.query(`
SELECT
    p.ID_Articulo AS productId,
    p.CodigoAlternativo AS code,
    p.Descripcion AS descripcion,
    p.ID_Rubro AS categoryId,
    r.Descripcion AS categoria,
    p.ID_Marca AS brandId,
    m.Marca AS marca
FROM dbo.Productos p
LEFT JOIN dbo.Rubros r
    ON r.ID_Rubro = p.ID_Rubro
LEFT JOIN dbo.Marcas m
    ON m.ID_Marca = p.ID_Marca
WHERE ${sparePartRubrosFilter}
ORDER BY p.ID_Articulo;
`);

  return result.recordset ?? [];
};

const buildPreviewReport = (rows) => rows.flatMap((row) => {
  const candidates = [
    {
      field: 'Descripcion',
      targetTable: 'dbo.Productos',
      targetIdColumn: 'ID_Articulo',
      targetId: row.productId,
      originalValue: row.descripcion
    },
    {
      field: 'Categoria',
      targetTable: 'dbo.Rubros',
      targetIdColumn: 'ID_Rubro',
      targetId: row.categoryId,
      originalValue: row.categoria
    },
    {
      field: 'CodigoAlternativo',
      targetTable: 'dbo.Productos',
      targetIdColumn: 'ID_Articulo',
      targetId: row.productId,
      originalValue: row.code
    },
    {
      field: 'Marca',
      targetTable: 'dbo.Marcas',
      targetIdColumn: 'ID_Marca',
      targetId: row.brandId,
      originalValue: row.marca
    }
  ];

  return candidates
    .filter((candidate) => candidate.targetId !== null && candidate.targetId !== undefined && hasMojibake(candidate.originalValue))
    .map((candidate) => ({
      productId: row.productId,
      code: row.code,
      field: candidate.field,
      targetTable: candidate.targetTable,
      targetIdColumn: candidate.targetIdColumn,
      targetId: candidate.targetId,
      originalValue: candidate.originalValue,
      repairedValue: repairMojibake(candidate.originalValue)
    }))
    .filter((candidate) => candidate.originalValue !== candidate.repairedValue);
});

const getUniqueRepairs = (previewRows) => {
  const repairs = new Map();

  previewRows.forEach((row) => {
    const key = `${row.targetTable}:${row.targetIdColumn}:${row.targetId}:${row.field}`;
    if (!repairs.has(key)) {
      repairs.set(key, row);
    }
  });

  return [...repairs.values()];
};

const getSummary = (previewRows) => {
  const affectedProducts = new Set(previewRows.map((row) => row.productId));
  const affectedValuesByField = previewRows.reduce((summary, row) => {
    summary[row.field] = (summary[row.field] ?? 0) + 1;
    return summary;
  }, {});
  const uniqueRepairsByField = getUniqueRepairs(previewRows).reduce((summary, row) => {
    summary[row.field] = (summary[row.field] ?? 0) + 1;
    return summary;
  }, {});

  return {
    affectedProducts: affectedProducts.size,
    reportRows: previewRows.length,
    uniqueDatabaseValues: getUniqueRepairs(previewRows).length,
    affectedValuesByField,
    uniqueRepairsByField
  };
};

const printPreviewReport = (previewRows, summary, mode) => {
  console.log('REPARACION SEGURA DE ENCODING EN CATALOGO');
  console.log(`Fecha de ejecucion: ${new Date().toISOString()}`);
  console.log(`Modo: ${mode}`);
  console.log(`Filtro aplicado: ${sparePartRubrosFilter}`);
  console.log(`Patrones reparados: ${REPAIR_REPLACEMENTS.map(([pattern, replacement]) => `${pattern} -> ${replacement}`).join(', ')}`);
  console.log('Actualizaciones automaticas: NO. Solo --apply confirma cambios persistentes.');
  console.log('');
  console.log('Resumen de registros afectados:');
  console.log(`- Productos afectados: ${summary.affectedProducts}`);
  console.log(`- Filas de reporte: ${summary.reportRows}`);
  console.log(`- Valores unicos de base a reparar: ${summary.uniqueDatabaseValues}`);
  console.log('- Filas de reporte por campo:');
  TARGET_FIELDS.forEach((field) => {
    console.log(`  - ${field.label}: ${summary.affectedValuesByField[field.label] ?? 0}`);
  });
  console.log('- Reparaciones unicas por campo:');
  TARGET_FIELDS.forEach((field) => {
    console.log(`  - ${field.label}: ${summary.uniqueRepairsByField[field.label] ?? 0}`);
  });

  if (previewRows.length === 0) {
    console.log('\nNo se detectaron valores con los patrones de mojibake conocidos.');
    return;
  }

  console.log('\nReporte de previsualizacion:');
  previewRows.forEach((row, index) => {
    console.log(`${index + 1}. Product ID: ${row.productId} | Code: ${formatValue(row.code)} | Campo: ${row.field}`);
    console.log(`   Original: ${formatValue(row.originalValue)}`);
    console.log(`   Reparado: ${formatValue(row.repairedValue)}`);
  });
};

const getFieldDefinition = (fieldLabel) => TARGET_FIELDS.find((field) => field.label === fieldLabel);

const applyRepairs = async (transaction, uniqueRepairs) => {
  const results = [];

  for (const repair of uniqueRepairs) {
    const fieldDefinition = getFieldDefinition(repair.field);
    const request = transaction.request();
    request.input('targetId', sql.Int, repair.targetId);
    request.input('originalValue', fieldDefinition.sqlType, repair.originalValue);
    request.input('repairedValue', fieldDefinition.sqlType, repair.repairedValue);

    const result = await request.query(`
UPDATE ${fieldDefinition.table}
SET ${fieldDefinition.valueColumn} = @repairedValue
WHERE ${fieldDefinition.idColumn} = @targetId
  AND ${fieldDefinition.valueColumn} = @originalValue;
`);

    results.push({
      ...repair,
      rowsAffected: result.rowsAffected?.[0] ?? 0
    });
  }

  return results;
};

const runPreview = async (pool, mode, json) => {
  const rows = await getCatalogRows(pool.request());
  const previewRows = buildPreviewReport(rows);
  const summary = getSummary(previewRows);

  if (json) {
    console.log(JSON.stringify({ mode, summary, report: previewRows }, null, 2));
  } else {
    printPreviewReport(previewRows, summary, mode);
  }

  return { previewRows, summary };
};

const runTransactionalMode = async (pool, mode, json) => {
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

  try {
    const rows = await getCatalogRows(transaction.request());
    const previewRows = buildPreviewReport(rows);
    const uniqueRepairs = getUniqueRepairs(previewRows);
    const updateResults = await applyRepairs(transaction, uniqueRepairs);
    const updatedRows = updateResults.reduce((total, result) => total + result.rowsAffected, 0);
    const summary = {
      ...getSummary(previewRows),
      attemptedUniqueRepairs: uniqueRepairs.length,
      updatedRows
    };

    if (mode === 'apply') {
      await transaction.commit();
    } else {
      await transaction.rollback();
      summary.updatedRows = 0;
      summary.rolledBackRows = updatedRows;
    }

    if (json) {
      console.log(JSON.stringify({ mode, summary, report: previewRows, updateResults }, null, 2));
    } else {
      printPreviewReport(previewRows, summary, mode);
      console.log('');
      if (mode === 'apply') {
        console.log(`Cambios aplicados: ${updatedRows} filas actualizadas.`);
      } else {
        console.log(`Dry-run completado: ${updatedRows} filas habrian sido actualizadas, pero se hizo rollback.`);
      }
    }
  } catch (error) {
    if (!transaction._aborted) {
      await transaction.rollback().catch(() => undefined);
    }
    throw error;
  }
};

const run = async () => {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(usage.trim());
    return;
  }

  const pool = await getSqlPool();

  if (options.mode === 'preview') {
    await runPreview(pool, options.mode, options.json);
    return;
  }

  await runTransactionalMode(pool, options.mode, options.json);
};

run()
  .catch((error) => {
    console.error('No se pudo completar la reparacion de encoding del catalogo.');
    console.error(error.message);
    if (error.cause?.message) {
      console.error(error.cause.message);
    }
    process.exitCode = 1;
  });
