import { getSqlPool } from '../../config/sqlServer.js';

const migrationSql = `
IF COL_LENGTH(N'dbo.RepuestosManualesPuntosVisuales', N'CodigoManual') IS NULL
BEGIN
  ALTER TABLE dbo.RepuestosManualesPuntosVisuales ADD CodigoManual NVARCHAR(100) NULL;
END;
IF COL_LENGTH(N'dbo.RepuestosManualesPuntosVisuales', N'DescripcionManual') IS NULL
BEGIN
  ALTER TABLE dbo.RepuestosManualesPuntosVisuales ADD DescripcionManual NVARCHAR(500) NULL;
END;
IF COL_LENGTH(N'dbo.RepuestosManualesPuntosVisuales', N'CategoriaManual') IS NULL
BEGIN
  ALTER TABLE dbo.RepuestosManualesPuntosVisuales ADD CategoriaManual NVARCHAR(200) NULL;
END;
IF COL_LENGTH(N'dbo.RepuestosManualesPuntosVisuales', N'MarcaManual') IS NULL
BEGIN
  ALTER TABLE dbo.RepuestosManualesPuntosVisuales ADD MarcaManual NVARCHAR(200) NULL;
END;
IF COL_LENGTH(N'dbo.RepuestosManualesPuntosVisuales', N'ModeloManual') IS NULL
BEGIN
  ALTER TABLE dbo.RepuestosManualesPuntosVisuales ADD ModeloManual NVARCHAR(200) NULL;
END;
IF COL_LENGTH(N'dbo.RepuestosManualesPuntosVisuales', N'ObservacionManual') IS NULL
BEGIN
  ALTER TABLE dbo.RepuestosManualesPuntosVisuales ADD ObservacionManual NVARCHAR(1000) NULL;
END;
`;

export const runAddCustomManualFieldsToVisualPointsMigration = async () => {
  const pool = await getSqlPool();
  await pool.request().query(migrationSql);
  console.log('Migración de datos manuales personalizados en dbo.RepuestosManualesPuntosVisuales finalizada.');
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runAddCustomManualFieldsToVisualPointsMigration().catch((error) => {
    console.error('No se pudieron agregar datos manuales personalizados a dbo.RepuestosManualesPuntosVisuales.', error);
    process.exit(1);
  });
}
