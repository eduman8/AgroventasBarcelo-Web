import { getSqlPool } from '../../config/sqlServer.js';

const migrationSql = `
IF COL_LENGTH(N'dbo.RepuestosManualesPuntosVisuales', N'ArchivoOrigen') IS NULL
BEGIN
  ALTER TABLE dbo.RepuestosManualesPuntosVisuales ADD ArchivoOrigen NVARCHAR(255) NULL;
END;
IF COL_LENGTH(N'dbo.RepuestosManualesPuntosVisuales', N'PaginaImpresa') IS NULL
BEGIN
  ALTER TABLE dbo.RepuestosManualesPuntosVisuales ADD PaginaImpresa INT NULL;
END;
`;

export const run = async () => {
  const pool = await getSqlPool();
  await pool.request().query(migrationSql);
  console.log('Migración de campos visuales en dbo.RepuestosManualesPuntosVisuales finalizada.');
};

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((error) => {
    console.error('No se pudieron agregar campos visuales a dbo.RepuestosManualesPuntosVisuales.', error);
    process.exitCode = 1;
  });
}
