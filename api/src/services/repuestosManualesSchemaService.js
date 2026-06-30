const REPUESTOS_MANUALES_MODEL_COLUMNS = ['Modelo', 'ModeloMaquina'];

export const getRepuestosManualesSchema = async (pool) => {
  const result = await pool.request().query(`
    SELECT COLUMN_NAME AS columnName
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = N'dbo'
      AND TABLE_NAME = N'RepuestosManuales';
  `);
  const columnNames = new Set((result.recordset ?? []).map((column) => column.columnName));
  const pickColumn = (candidates, fallback = null) => candidates.find((candidate) => columnNames.has(candidate)) ?? fallback;

  return {
    idColumn: pickColumn(['Id', 'ID_RepuestoManual'], 'ID_RepuestoManual'),
    modelColumn: pickColumn(REPUESTOS_MANUALES_MODEL_COLUMNS),
    importDateColumn: pickColumn(['FechaCreacion', 'FechaAlta']),
    printedPageColumn: pickColumn(['PaginaImpresa'])
  };
};

export const buildRepuestosManualesModelSelect = ({ modelColumn, tableAlias = 'rm', alias = 'modelo' } = {}) => {
  const expression = modelColumn ? `${tableAlias}.${modelColumn}` : 'NULL';
  return `${expression} AS ${alias}`;
};

export const buildRepuestosManualesModelSearch = ({ modelColumn, tableAlias = 'rm', parameterName = 'searchTerm' } = {}) => (
  modelColumn ? `OR ${tableAlias}.${modelColumn} LIKE @${parameterName}` : ''
);
