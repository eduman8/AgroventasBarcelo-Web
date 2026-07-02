import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSqlPool, sql } from '../../config/sqlServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const args = new Set(process.argv.slice(2));
const shouldApply = args.has('--apply');

const rowReference = (row) => String(row.ReferenciaDespiece ?? '').trim();
const isNumericReference = (value) => /^\d+$/.test(String(value ?? '').trim());

const inferPageProposals = (rows) => {
  const firstReferencedIndex = rows.findIndex((row) => isNumericReference(rowReference(row)));
  if (firstReferencedIndex <= 0) return [];
  const nullPrefix = rows.slice(0, firstReferencedIndex).filter((row) => !rowReference(row));
  const firstReference = Number.parseInt(rowReference(rows[firstReferencedIndex]), 10);
  if (firstReference === 2 && nullPrefix.length === 1) {
    return [{ row: nullPrefix[0], inferredReference: '1', reason: 'Única fila NULL antes de la referencia 2.' }];
  }
  return [];
};

const main = async () => {
  const pool = await getSqlPool();
  const result = await pool.request().query(`
SELECT Id, ManualNombre, Pagina, PaginaImpresa, ReferenciaDespiece, Codigo, Descripcion
FROM dbo.RepuestosManuales
WHERE Activo = 1
ORDER BY ManualNombre, Pagina, Id;`);

  const pages = new Map();
  for (const row of result.recordset ?? []) {
    const key = `${row.ManualNombre}|${row.Pagina}`;
    if (!pages.has(key)) pages.set(key, []);
    pages.get(key).push(row);
  }

  const proposals = [];
  const ambiguous = [];
  for (const [key, rows] of pages) {
    const nullRows = rows.filter((row) => !rowReference(row));
    if (!nullRows.length) continue;
    const pageProposals = inferPageProposals(rows);
    proposals.push(...pageProposals.map((proposal) => ({ ...proposal, pageKey: key })));
    if (!pageProposals.length || nullRows.length > pageProposals.length) {
      ambiguous.push({ pageKey: key, nullCount: nullRows.length, firstReferences: rows.map(rowReference).filter(Boolean).slice(0, 8), nullRows: nullRows.map((row) => ({ id: row.Id, codigo: row.Codigo, descripcion: row.Descripcion })) });
    }
  }

  console.log(JSON.stringify({ mode: shouldApply ? 'apply' : 'dry-run', proposals: proposals.map(({ row, inferredReference, reason, pageKey }) => ({ pageKey, id: row.Id, codigo: row.Codigo, descripcion: row.Descripcion, inferredReference, reason })), ambiguous }, null, 2));

  if (!shouldApply || !proposals.length) return;
  for (const proposal of proposals) {
    await pool.request()
      .input('id', sql.Int, proposal.row.Id)
      .input('referenciaDespiece', sql.NVarChar(150), proposal.inferredReference)
      .query(`UPDATE dbo.RepuestosManuales SET ReferenciaDespiece = @referenciaDespiece WHERE Id = @id AND NULLIF(LTRIM(RTRIM(ReferenciaDespiece)), '') IS NULL;`);
  }
};

main().then(() => process.exit(0)).catch((error) => {
  console.error('No se pudo diagnosticar/reparar ReferenciaDespiece NULL.', error);
  process.exit(1);
});
