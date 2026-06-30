import { getSqlPool } from '../../config/sqlServer.js';

const migrationQuery = `
IF COL_LENGTH(N'dbo.RepuestosManualesPuntosVisuales', N'RepuestoManualId') IS NULL
BEGIN
  ALTER TABLE dbo.RepuestosManualesPuntosVisuales
  ADD RepuestoManualId INT NULL;
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = N'IX_RepuestosManualesPuntosVisuales_RepuestoManualId'
    AND object_id = OBJECT_ID(N'dbo.RepuestosManualesPuntosVisuales')
)
BEGIN
  CREATE INDEX IX_RepuestosManualesPuntosVisuales_RepuestoManualId
  ON dbo.RepuestosManualesPuntosVisuales (RepuestoManualId)
  WHERE RepuestoManualId IS NOT NULL;
END;
`;

export const runAddRepuestoManualIdToVisualPointsMigration = async () => {
  const pool = await getSqlPool();
  await pool.request().query(migrationQuery);
  console.log('Migración RepuestoManualId en dbo.RepuestosManualesPuntosVisuales finalizada.');
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runAddRepuestoManualIdToVisualPointsMigration().catch((error) => {
    console.error('No se pudo agregar RepuestoManualId a dbo.RepuestosManualesPuntosVisuales.', error);
    process.exitCode = 1;
  });
}
