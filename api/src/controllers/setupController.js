import { getSqlPool } from '../config/sqlServer.js';
import { setupUsers } from '../services/adminUsersService.js';
import { setupAccessRequests } from '../services/accessRequestsService.js';

const webMachinesSetupQuery = `
IF NOT EXISTS (
    SELECT 1
    FROM sys.tables t
    INNER JOIN sys.schemas s
        ON s.schema_id = t.schema_id
    WHERE t.name = N'WebMaquinarias'
      AND s.name = N'dbo'
)
BEGIN
    CREATE TABLE dbo.WebMaquinarias (
        ID_WebMaquinaria INT IDENTITY(1,1) PRIMARY KEY,
        Slug NVARCHAR(150) NOT NULL UNIQUE,
        Nombre NVARCHAR(200) NOT NULL,
        Marca NVARCHAR(100) NULL,
        Categoria NVARCHAR(100) NOT NULL,
        Estado NVARCHAR(100) NOT NULL,
        DescripcionCorta NVARCHAR(500) NULL,
        DescripcionLarga NVARCHAR(MAX) NULL,
        ImagenPrincipal NVARCHAR(500) NULL,
        Galeria NVARCHAR(MAX) NULL,
        Disponible BIT NOT NULL DEFAULT 1,
        Activo BIT NOT NULL DEFAULT 1,
        FechaAlta DATETIME NOT NULL DEFAULT GETDATE(),
        FechaModificacion DATETIME NULL
    );
END;

IF COL_LENGTH('dbo.WebMaquinarias', 'Marca') IS NULL
BEGIN
    ALTER TABLE dbo.WebMaquinarias
    ADD Marca NVARCHAR(100) NULL;
END;
`;

export const setupWebMachinesController = async (request, response) => {
  if (process.env.ALLOW_DB_SETUP !== 'true') {
    response.status(403).json({
      status: 'error',
      message: 'Setup de base de datos no habilitado.'
    });
    return;
  }

  try {
    const pool = await getSqlPool();

    await pool.request().query(webMachinesSetupQuery);

    response.json({
      status: 'ok',
      message: 'Tabla dbo.WebMaquinarias verificada o creada correctamente.'
    });
  } catch (error) {
    const diagnosticError = error?.cause || error;

    console.error('[setup-web-maquinarias] SQL Server query error', {
      message: diagnosticError?.message,
      code: diagnosticError?.code,
      originalErrorMessage: diagnosticError?.originalError?.message,
      originalErrorCode: diagnosticError?.originalError?.code
    });

    response.status(500).json({
      status: 'error',
      message: 'No se pudo ejecutar el setup de dbo.WebMaquinarias.'
    });
  }
};


const webInquiriesSetupQuery = `
IF NOT EXISTS (
    SELECT 1
    FROM sys.tables t
    INNER JOIN sys.schemas s
        ON s.schema_id = t.schema_id
    WHERE t.name = N'WebConsultas'
      AND s.name = N'dbo'
)
BEGIN
    CREATE TABLE dbo.WebConsultas (
        ID_WebConsulta INT IDENTITY(1,1) PRIMARY KEY,
        FechaAlta DATETIME NOT NULL DEFAULT GETDATE(),
        Nombre NVARCHAR(200) NOT NULL,
        Email NVARCHAR(200) NOT NULL,
        Telefono NVARCHAR(80) NOT NULL,
        TipoConsulta NVARCHAR(150) NOT NULL,
        Estado NVARCHAR(50) NOT NULL DEFAULT N'Nueva',
        Mensaje NVARCHAR(4000) NOT NULL,
        Contexto NVARCHAR(MAX) NULL,
        RepuestosSeleccionados NVARCHAR(MAX) NULL,
        InformacionManual NVARCHAR(MAX) NULL,
        FechaModificacion DATETIME NULL,
        CONSTRAINT CK_WebConsultas_Estado CHECK (Estado IN (N'Nueva', N'En proceso', N'Respondida', N'Cerrada'))
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_WebConsultas_Estado_FechaAlta'
      AND object_id = OBJECT_ID(N'dbo.WebConsultas')
)
BEGIN
    CREATE INDEX IX_WebConsultas_Estado_FechaAlta
    ON dbo.WebConsultas (Estado, FechaAlta DESC);
END;
`;

export const setupWebInquiriesController = async (request, response) => {
  if (process.env.ALLOW_DB_SETUP !== 'true') {
    response.status(403).json({
      status: 'error',
      message: 'Setup de base de datos no habilitado.'
    });
    return;
  }

  try {
    const pool = await getSqlPool();

    await pool.request().query(webInquiriesSetupQuery);

    response.json({
      status: 'ok',
      message: 'Tabla dbo.WebConsultas verificada o creada correctamente.'
    });
  } catch (error) {
    const diagnosticError = error?.cause || error;

    console.error('[setup-web-consultas] SQL Server query error', {
      message: diagnosticError?.message,
      code: diagnosticError?.code,
      originalErrorMessage: diagnosticError?.originalError?.message,
      originalErrorCode: diagnosticError?.originalError?.code
    });

    response.status(500).json({
      status: 'error',
      message: 'No se pudo ejecutar el setup de dbo.WebConsultas.'
    });
  }
};


export const setupAccessRequestsController = async (request, response) => {
  if (process.env.ALLOW_DB_SETUP !== 'true') {
    response.status(403).json({
      status: 'error',
      message: 'Setup de base de datos no habilitado.'
    });
    return;
  }

  try {
    await setupAccessRequests();

    response.json({
      status: 'ok',
      message: 'Tabla dbo.WebSolicitudesAcceso verificada o creada correctamente.'
    });
  } catch (error) {
    const diagnosticError = error?.cause || error;

    console.error('[setup-solicitudes-acceso] SQL Server query error', {
      message: diagnosticError?.message,
      code: diagnosticError?.code,
      originalErrorMessage: diagnosticError?.originalError?.message,
      originalErrorCode: diagnosticError?.originalError?.code
    });

    response.status(500).json({
      status: 'error',
      message: 'No se pudo ejecutar el setup de dbo.WebSolicitudesAcceso.'
    });
  }
};

export const setupUsersController = async (request, response) => {
  if (process.env.ALLOW_DB_SETUP !== 'true') {
    response.status(403).json({
      status: 'error',
      message: 'Setup de base de datos no habilitado.'
    });
    return;
  }

  try {
    await setupUsers();

    response.json({
      status: 'ok',
      message: 'Tabla dbo.WebUsuarios verificada o creada correctamente.'
    });
  } catch (error) {
    const diagnosticError = error?.cause || error;

    console.error('[setup-web-usuarios] SQL Server query error', {
      message: diagnosticError?.message,
      code: diagnosticError?.code,
      originalErrorMessage: diagnosticError?.originalError?.message,
      originalErrorCode: diagnosticError?.originalError?.code
    });

    response.status(500).json({
      status: 'error',
      message: 'No se pudo ejecutar el setup de dbo.WebUsuarios.'
    });
  }
};

const manualSparePartsSetupQuery = `
IF NOT EXISTS (
    SELECT 1
    FROM sys.tables t
    INNER JOIN sys.schemas s
        ON s.schema_id = t.schema_id
    WHERE t.name = N'RepuestosManuales'
      AND s.name = N'dbo'
)
BEGIN
    CREATE TABLE dbo.RepuestosManuales (
        ID_RepuestoManual INT IDENTITY(1,1) PRIMARY KEY,
        ManualNombre NVARCHAR(200) NOT NULL,
        ArchivoOrigen NVARCHAR(500) NULL,
        Pagina INT NULL,
        Codigo NVARCHAR(100) NULL,
        Descripcion NVARCHAR(500) NOT NULL,
        Marca NVARCHAR(120) NULL,
        ModeloMaquina NVARCHAR(180) NULL,
        Categoria NVARCHAR(150) NULL,
        ReferenciaDespiece NVARCHAR(150) NULL,
        Observaciones NVARCHAR(MAX) NULL,
        Activo BIT NOT NULL DEFAULT 1,
        FechaAlta DATETIME NOT NULL DEFAULT GETDATE(),
        FechaModificacion DATETIME NULL
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_RepuestosManuales_Busqueda'
      AND object_id = OBJECT_ID(N'dbo.RepuestosManuales')
)
BEGIN
    CREATE INDEX IX_RepuestosManuales_Busqueda
    ON dbo.RepuestosManuales (Activo, Codigo, Descripcion)
    INCLUDE (ManualNombre, Pagina, Marca, ModeloMaquina, Categoria, ReferenciaDespiece);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_RepuestosManuales_Manual'
      AND object_id = OBJECT_ID(N'dbo.RepuestosManuales')
)
BEGIN
    CREATE INDEX IX_RepuestosManuales_Manual
    ON dbo.RepuestosManuales (ManualNombre, Pagina);
END;


IF NOT EXISTS (
    SELECT 1
    FROM sys.tables t
    INNER JOIN sys.schemas s
        ON s.schema_id = t.schema_id
    WHERE t.name = N'RepuestosManualesImagenes'
      AND s.name = N'dbo'
)
BEGIN
    CREATE TABLE dbo.RepuestosManualesImagenes (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ManualNombre NVARCHAR(200) NOT NULL,
        ManualSlug NVARCHAR(150) NOT NULL,
        Pagina INT NOT NULL,
        ImageUrl NVARCHAR(500) NOT NULL,
        ArchivoOrigen NVARCHAR(500) NULL,
        Activo BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NULL
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_RepuestosManualesImagenes_ManualPagina'
      AND object_id = OBJECT_ID(N'dbo.RepuestosManualesImagenes')
)
BEGIN
    CREATE UNIQUE INDEX UX_RepuestosManualesImagenes_ManualPagina
    ON dbo.RepuestosManualesImagenes (ManualSlug, Pagina);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_RepuestosManualesImagenes_Busqueda'
      AND object_id = OBJECT_ID(N'dbo.RepuestosManualesImagenes')
)
BEGIN
    CREATE INDEX IX_RepuestosManualesImagenes_Busqueda
    ON dbo.RepuestosManualesImagenes (Activo, ManualNombre, Pagina)
    INCLUDE (ImageUrl, ManualSlug);
END;
`;

export const setupManualSparePartsController = async (request, response) => {
  if (process.env.ALLOW_DB_SETUP !== 'true') {
    response.status(403).json({
      status: 'error',
      message: 'Setup de base de datos no habilitado.'
    });
    return;
  }

  try {
    const pool = await getSqlPool();

    await pool.request().query(manualSparePartsSetupQuery);

    response.json({
      status: 'ok',
      message: 'Tabla dbo.RepuestosManuales verificada o creada correctamente.'
    });
  } catch (error) {
    const diagnosticError = error?.cause || error;

    console.error('[setup-repuestos-manuales] SQL Server query error', {
      message: diagnosticError?.message,
      code: diagnosticError?.code,
      originalErrorMessage: diagnosticError?.originalError?.message,
      originalErrorCode: diagnosticError?.originalError?.code
    });

    response.status(500).json({
      status: 'error',
      message: 'No se pudo ejecutar el setup de dbo.RepuestosManuales.'
    });
  }
};
