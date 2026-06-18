SET XACT_ABORT ON;

BEGIN TRANSACTION;

DECLARE @RepuestosManualesSeed TABLE (
    ManualNombre NVARCHAR(200) NOT NULL,
    ArchivoOrigen NVARCHAR(500) NULL,
    Pagina INT NOT NULL,
    Codigo NVARCHAR(100) NOT NULL,
    Descripcion NVARCHAR(500) NOT NULL,
    Categoria NVARCHAR(150) NULL
);

INSERT INTO @RepuestosManualesSeed (
    ManualNombre,
    ArchivoOrigen,
    Pagina,
    Codigo,
    Descripcion,
    Categoria
)
VALUES
    (N'Repuestos Rastras', N'manual-repuestos-rastras.pdf', 3, N'C0915', N'Lanza mediana de rastra armada completa', N'Lanza'),
    (N'Repuestos Rastras', N'manual-repuestos-rastras.pdf', 4, N'C1067', N'Lanza Chica de Rastra', N'Lanza'),
    (N'Repuestos Rastras', N'manual-repuestos-rastras.pdf', 8, N'C2061', N'Balancín chico armado completo', N'Balancín'),
    (N'Repuestos Rastras', N'manual-repuestos-rastras.pdf', 10, N'C3635', N'Balancín grande armado completo de rastra', N'Balancín'),
    (N'Repuestos Rastras', N'manual-repuestos-rastras.pdf', 15, N'65-0001', N'Disco dentado DD - 018-040-045-076', N'Disco'),
    (N'Repuestos Rastras', N'manual-repuestos-rastras.pdf', 22, N'C1097', N'Bancada chica 30211-6211 - Eje 1 ½” Armada', N'Bancada'),
    (N'Grano Fino 2019', N'manual-repuestos-grano-fino-2019.pdf', 1, N'62-0009', N'Cilindro hidráulico', N'Hidráulica'),
    (N'Grano Fino 2019', N'manual-repuestos-grano-fino-2019.pdf', 1, N'C0378', N'Cigüeña', N'Cigüeña'),
    (N'Grano Fino 2019', N'manual-repuestos-grano-fino-2019.pdf', 7, N'C1778', N'Lanza de transporte grano fino', N'Lanza'),
    (N'Grano Fino 2019', N'manual-repuestos-grano-fino-2019.pdf', 5, N'C0387', N'Primer tramo marcador', N'Marcador'),
    (N'Grano Fino 2019', N'manual-repuestos-grano-fino-2019.pdf', 9, N'C0381', N'Lanza de trabajo grano fino', N'Lanza');

INSERT INTO dbo.RepuestosManuales (
    ManualNombre,
    ArchivoOrigen,
    Pagina,
    Codigo,
    Descripcion,
    Categoria,
    Activo
)
SELECT
    seed.ManualNombre,
    seed.ArchivoOrigen,
    seed.Pagina,
    seed.Codigo,
    seed.Descripcion,
    seed.Categoria,
    1 AS Activo
FROM @RepuestosManualesSeed seed
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.RepuestosManuales existing
    WHERE existing.Codigo = seed.Codigo
      AND existing.ManualNombre = seed.ManualNombre
      AND existing.Pagina = seed.Pagina
);

COMMIT TRANSACTION;
