import { getSqlPool } from '../config/sqlServer.js';

const tableExistsQuery = `
SELECT CASE WHEN OBJECT_ID(N'dbo.WebConsultas', N'U') IS NULL THEN 0 ELSE 1 END AS existsFlag;
`;

const catalogSummaryQuery = `
SELECT
  (SELECT COUNT(*) FROM dbo.WebMaquinarias WHERE Activo = 1) AS maquinariasTotal,
  (SELECT COUNT(*) FROM dbo.WebMaquinarias WHERE Activo = 1 AND Disponible = 1 AND Estado = N'Disponible') AS maquinariasDisponibles,
  (SELECT COUNT(*) FROM dbo.WebMaquinarias WHERE Activo = 1 AND (Disponible = 0 OR Estado = N'Vendido')) AS maquinariasVendidas,
  (SELECT COUNT(*) FROM dbo.Productos p WHERE p.ID_Rubro IN (3, 4, 8, 11, 13, 24, 26, 27)) AS repuestosTotal;
`;

const inquiriesSummaryQuery = `
SELECT
  COUNT(*) AS consultasTotal,
  SUM(CASE WHEN Estado = N'Nueva' THEN 1 ELSE 0 END) AS consultasNuevas,
  SUM(CASE WHEN Estado = N'En proceso' THEN 1 ELSE 0 END) AS consultasEnProceso,
  SUM(CASE WHEN Estado = N'Respondida' THEN 1 ELSE 0 END) AS consultasRespondidas,
  SUM(CASE WHEN Estado = N'Cerrada' THEN 1 ELSE 0 END) AS consultasCerradas
FROM dbo.WebConsultas;
`;

const latestInquiriesQuery = `
SELECT TOP (10)
    ID_WebConsulta AS id,
    FechaAlta AS fecha,
    Nombre AS nombre,
    TipoConsulta AS tipoConsulta,
    Estado AS estado
FROM dbo.WebConsultas
ORDER BY FechaAlta DESC, ID_WebConsulta DESC;
`;

const emptyInquiriesSummary = {
  consultasTotal: 0,
  consultasNuevas: 0,
  consultasEnProceso: 0,
  consultasRespondidas: 0,
  consultasCerradas: 0
};

const toNumber = (value) => Number(value ?? 0);

const mapLatestInquiry = (inquiry) => ({
  id: inquiry.id,
  fecha: inquiry.fecha,
  nombre: inquiry.nombre,
  tipoConsulta: inquiry.tipoConsulta,
  estado: inquiry.estado
});

const hasWebConsultasTable = async (pool) => {
  const result = await pool.request().query(tableExistsQuery);
  return toNumber(result.recordset?.[0]?.existsFlag) === 1;
};

export const getAdminDashboard = async () => {
  const pool = await getSqlPool();
  const catalogSummaryResult = await pool.request().query(catalogSummaryQuery);
  const catalogSummary = catalogSummaryResult.recordset?.[0] ?? {};

  let inquiriesSummary = emptyInquiriesSummary;
  let latestInquiries = [];

  if (await hasWebConsultasTable(pool)) {
    const [inquiriesSummaryResult, latestInquiriesResult] = await Promise.all([
      pool.request().query(inquiriesSummaryQuery),
      pool.request().query(latestInquiriesQuery)
    ]);

    inquiriesSummary = inquiriesSummaryResult.recordset?.[0] ?? emptyInquiriesSummary;
    latestInquiries = (latestInquiriesResult.recordset ?? []).map(mapLatestInquiry);
  }

  return {
    consultas: {
      total: toNumber(inquiriesSummary.consultasTotal),
      nuevas: toNumber(inquiriesSummary.consultasNuevas),
      enProceso: toNumber(inquiriesSummary.consultasEnProceso),
      respondidas: toNumber(inquiriesSummary.consultasRespondidas),
      cerradas: toNumber(inquiriesSummary.consultasCerradas)
    },
    maquinarias: {
      total: toNumber(catalogSummary.maquinariasTotal),
      disponibles: toNumber(catalogSummary.maquinariasDisponibles),
      vendidas: toNumber(catalogSummary.maquinariasVendidas)
    },
    repuestos: {
      total: toNumber(catalogSummary.repuestosTotal)
    },
    ultimasConsultas: latestInquiries
  };
};
