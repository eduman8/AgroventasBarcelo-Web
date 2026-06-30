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
        PaginaImpresa INT NULL,
        Codigo NVARCHAR(100) NULL,
        Descripcion NVARCHAR(500) NOT NULL,
        Marca NVARCHAR(120) NULL,
        Modelo NVARCHAR(180) NULL,
        Categoria NVARCHAR(150) NULL,
        ReferenciaDespiece NVARCHAR(150) NULL,
        Observaciones NVARCHAR(MAX) NULL,
        Activo BIT NOT NULL DEFAULT 1,
        FechaAlta DATETIME NOT NULL DEFAULT GETDATE(),
        FechaModificacion DATETIME NULL
    );
END;

IF COL_LENGTH(N'dbo.RepuestosManuales', N'PaginaImpresa') IS NULL
BEGIN
    ALTER TABLE dbo.RepuestosManuales
    ADD PaginaImpresa INT NULL;
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
    INCLUDE (ManualNombre, Pagina, PaginaImpresa, Marca, Categoria, ReferenciaDespiece);
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

IF NOT EXISTS (
    SELECT 1
    FROM sys.tables t
    INNER JOIN sys.schemas s
        ON s.schema_id = t.schema_id
    WHERE t.name = N'RepuestosManualesPuntosVisuales'
      AND s.name = N'dbo'
)
BEGIN
    CREATE TABLE dbo.RepuestosManualesPuntosVisuales (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ManualNombre NVARCHAR(200) NOT NULL,
        Pagina INT NOT NULL,
        ReferenciaDespiece NVARCHAR(150) NOT NULL,
        RepuestoManualId INT NULL,
        CodigoManual NVARCHAR(100) NULL,
        DescripcionManual NVARCHAR(500) NULL,
        CategoriaManual NVARCHAR(200) NULL,
        MarcaManual NVARCHAR(200) NULL,
        ModeloManual NVARCHAR(200) NULL,
        ObservacionManual NVARCHAR(1000) NULL,
        XPercent DECIMAL(6,3) NOT NULL,
        YPercent DECIMAL(6,3) NOT NULL,
        Activo BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NULL
    );
END;

IF COL_LENGTH(N'dbo.RepuestosManualesPuntosVisuales', N'RepuestoManualId') IS NULL
BEGIN
    ALTER TABLE dbo.RepuestosManualesPuntosVisuales
    ADD RepuestoManualId INT NULL;
END;

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

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_RepuestosManualesPuntosVisuales_ManualPagina'
      AND object_id = OBJECT_ID(N'dbo.RepuestosManualesPuntosVisuales')
)
BEGIN
    CREATE INDEX IX_RepuestosManualesPuntosVisuales_ManualPagina
    ON dbo.RepuestosManualesPuntosVisuales (Activo, ManualNombre, Pagina, ReferenciaDespiece);
END;


IF NOT EXISTS (
    SELECT 1
    FROM sys.tables t
    INNER JOIN sys.schemas s
        ON s.schema_id = t.schema_id
    WHERE t.name = N'RepuestosManualesPaginasVisuales'
      AND s.name = N'dbo'
)
BEGIN
    CREATE TABLE dbo.RepuestosManualesPaginasVisuales (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ManualNombre NVARCHAR(200) NOT NULL,
        PaginaVisual INT NOT NULL,
        PaginaDatos INT NOT NULL,
        Activo BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NULL
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_RepuestosManualesPaginasVisuales_ManualPaginaVisual'
      AND object_id = OBJECT_ID(N'dbo.RepuestosManualesPaginasVisuales')
)
BEGIN
    CREATE UNIQUE INDEX UX_RepuestosManualesPaginasVisuales_ManualPaginaVisual
    ON dbo.RepuestosManualesPaginasVisuales (ManualNombre, PaginaVisual);
END;
