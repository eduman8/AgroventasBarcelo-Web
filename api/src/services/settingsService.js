import { getSqlPool, sql } from '../config/sqlServer.js';

const defaultSettings = {
  emailContacto: 'info@agrobarcelo.com.ar',
  whatsapp: '5493471345613',
  instagram: 'https://www.instagram.com/agrobarcelo/',
  ubicacion: 'San Luis 759, Armstrong, Santa Fe',
  textoFooter: 'Acompañamos al productor con soluciones confiables, repuestos agrícolas, maquinarias, postventa y mecanizado CNC para el trabajo de cada día.'
};

const setupQuery = `
IF NOT EXISTS (SELECT 1 FROM sys.tables t INNER JOIN sys.schemas s ON s.schema_id = t.schema_id WHERE t.name = N'WebConfiguracion' AND s.name = N'dbo')
BEGIN
  CREATE TABLE dbo.WebConfiguracion (
    ID_WebConfiguracion INT NOT NULL CONSTRAINT PK_WebConfiguracion PRIMARY KEY DEFAULT 1,
    EmailContacto NVARCHAR(200) NULL,
    WhatsApp NVARCHAR(80) NULL,
    Instagram NVARCHAR(300) NULL,
    Ubicacion NVARCHAR(300) NULL,
    TextoFooter NVARCHAR(600) NULL,
    FechaModificacion DATETIME NULL,
    CONSTRAINT CK_WebConfiguracion_SingleRow CHECK (ID_WebConfiguracion = 1)
  );
END;
IF NOT EXISTS (SELECT 1 FROM dbo.WebConfiguracion WHERE ID_WebConfiguracion = 1)
BEGIN
  INSERT INTO dbo.WebConfiguracion (ID_WebConfiguracion, EmailContacto, WhatsApp, Instagram, Ubicacion, TextoFooter)
  VALUES (1, @emailContacto, @whatsapp, @instagram, @ubicacion, @textoFooter);
END;
`;

const selectQuery = `SELECT TOP (1) EmailContacto AS emailContacto, WhatsApp AS whatsapp, Instagram AS instagram, Ubicacion AS ubicacion, TextoFooter AS textoFooter FROM dbo.WebConfiguracion WHERE ID_WebConfiguracion = 1;`;
const updateQuery = `
UPDATE dbo.WebConfiguracion
SET EmailContacto = @emailContacto, WhatsApp = @whatsapp, Instagram = @instagram, Ubicacion = @ubicacion, TextoFooter = @textoFooter, FechaModificacion = GETDATE()
OUTPUT INSERTED.EmailContacto AS emailContacto, INSERTED.WhatsApp AS whatsapp, INSERTED.Instagram AS instagram, INSERTED.Ubicacion AS ubicacion, INSERTED.TextoFooter AS textoFooter
WHERE ID_WebConfiguracion = 1;
`;

const clean = (v, max) => String(v ?? '').trim().slice(0, max) || null;
const map = (row) => ({ ...defaultSettings, ...(row ?? {}) });

async function ensureSettings(pool) {
  await pool.request()
    .input('emailContacto', sql.NVarChar(200), defaultSettings.emailContacto)
    .input('whatsapp', sql.NVarChar(80), defaultSettings.whatsapp)
    .input('instagram', sql.NVarChar(300), defaultSettings.instagram)
    .input('ubicacion', sql.NVarChar(300), defaultSettings.ubicacion)
    .input('textoFooter', sql.NVarChar(600), defaultSettings.textoFooter)
    .query(setupQuery);
}

export async function setupSettings() {
  const pool = await getSqlPool();
  await ensureSettings(pool);
}

export async function getSettings() {
  const pool = await getSqlPool();
  await ensureSettings(pool);
  const result = await pool.request().query(selectQuery);
  return map(result.recordset?.[0]);
}

export async function updateSettings(payload) {
  const pool = await getSqlPool();
  await ensureSettings(pool);
  const next = map({
    emailContacto: clean(payload?.emailContacto, 200),
    whatsapp: clean(payload?.whatsapp, 80),
    instagram: clean(payload?.instagram, 300),
    ubicacion: clean(payload?.ubicacion, 300),
    textoFooter: clean(payload?.textoFooter, 600)
  });
  const result = await pool.request()
    .input('emailContacto', sql.NVarChar(200), next.emailContacto)
    .input('whatsapp', sql.NVarChar(80), next.whatsapp)
    .input('instagram', sql.NVarChar(300), next.instagram)
    .input('ubicacion', sql.NVarChar(300), next.ubicacion)
    .input('textoFooter', sql.NVarChar(600), next.textoFooter)
    .query(updateQuery);
  return map(result.recordset?.[0]);
}
