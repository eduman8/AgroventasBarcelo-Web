import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, '../../../.env')
});

const seedPath = path.join(__dirname, '001_seed_repuestos_manuales.sql');

async function runSeed() {
  const seedSql = await readFile(seedPath, 'utf8');
  const { getSqlPool } = await import('../../config/sqlServer.js');
  const pool = await getSqlPool();

  await pool.request().query(seedSql);
  console.log('Seed de dbo.RepuestosManuales ejecutado correctamente.');
}

runSeed().catch((error) => {
  const diagnosticError = error?.cause || error;

  console.error('No se pudo ejecutar el seed de dbo.RepuestosManuales.', {
    message: diagnosticError?.message,
    code: diagnosticError?.code,
    originalErrorMessage: diagnosticError?.originalError?.message,
    originalErrorCode: diagnosticError?.originalError?.code
  });
  process.exitCode = 1;
});
