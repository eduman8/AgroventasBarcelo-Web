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
