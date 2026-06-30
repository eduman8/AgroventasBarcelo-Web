import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSqlPool, sql } from '../../config/sqlServer.js';
import { PDFS_TO_IMPORT, buildImportPreview } from '../importers/importRepuestosManualesFromPdf.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, '../../../.env')
});

const normalizeReference = (value) => String(value ?? '').trim();

const repuestosManualesColumnExists = async (pool, columnName) => {
  const result = await pool.request()
    .input('ColumnName', sql.NVarChar(128), columnName)
    .query(`
SELECT 1 AS ExistsFlag
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'dbo'
  AND TABLE_NAME = 'RepuestosManuales'
  AND COLUMN_NAME = @ColumnName;
`);

  return result.recordset.length > 0;
};

const ensurePaginaImpresaColumn = async (pool) => {
  if (await repuestosManualesColumnExists(pool, 'PaginaImpresa')) {
    return;
  }

  await pool.request().query(`
ALTER TABLE dbo.RepuestosManuales ADD PaginaImpresa INT NULL;
`);
};

const getRepuestosManualesOptionalColumns = async (pool) => ({
  fechaModificacion: await repuestosManualesColumnExists(pool, 'FechaModificacion')
});

const repairSparePartPage = async (pool, sparePart, optionalColumns) => {
  const fechaModificacionUpdate = optionalColumns.fechaModificacion
    ? ',\n    FechaModificacion = COALESCE(FechaModificacion, GETDATE())'
    : '';

  const result = await pool.request()
    .input('ManualNombre', sql.NVarChar(200), sparePart.manualNombre)
    .input('Pagina', sql.Int, sparePart.pagina)
    .input('PaginaImpresa', sql.Int, sparePart.paginaImpresa)
    .input('Codigo', sql.NVarChar(100), sparePart.codigo)
    .input('ReferenciaDespiece', sql.NVarChar(150), normalizeReference(sparePart.referenciaDespiece))
    .query(`
UPDATE dbo.RepuestosManuales
SET Pagina = @Pagina,
    PaginaImpresa = @PaginaImpresa${fechaModificacionUpdate}
WHERE LTRIM(RTRIM(ManualNombre)) = LTRIM(RTRIM(@ManualNombre))
  AND UPPER(LTRIM(RTRIM(Codigo))) = UPPER(LTRIM(RTRIM(@Codigo)))
  AND COALESCE(NULLIF(LTRIM(RTRIM(ReferenciaDespiece)), ''), '') = COALESCE(NULLIF(LTRIM(RTRIM(@ReferenciaDespiece)), ''), '')
  AND (
    Pagina = @Pagina
    OR Pagina = @PaginaImpresa
    OR PaginaImpresa IS NULL
  );
`);

  return result.rowsAffected?.[0] ?? 0;
};

const runMigration = async () => {
  const pool = await getSqlPool();
  await ensurePaginaImpresaColumn(pool);
  const optionalColumns = await getRepuestosManualesOptionalColumns(pool);

  let detected = 0;
  let updated = 0;

  for (const pdfConfig of PDFS_TO_IMPORT) {
    const { spareParts } = await buildImportPreview(pdfConfig);
    detected += spareParts.length;

    for (const sparePart of spareParts) {
      updated += await repairSparePartPage(pool, sparePart, optionalColumns);
    }
  }

  console.log('Migración de páginas técnicas de dbo.RepuestosManuales finalizada.');
  console.log(`  Registros detectados desde PDFs: ${detected}`);
  console.log(`  Filas actualizadas/reparadas: ${updated}`);
};

runMigration().catch((error) => {
  const diagnosticError = error?.cause || error;

  console.error('No se pudo migrar dbo.RepuestosManuales a páginas internas de PDF.', {
    message: diagnosticError?.message,
    code: diagnosticError?.code,
    originalErrorMessage: diagnosticError?.originalError?.message,
    originalErrorCode: diagnosticError?.originalError?.code
  });
  process.exitCode = 1;
});
