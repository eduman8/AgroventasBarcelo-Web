import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildImportPreview, PDFS_TO_IMPORT } from '../importers/importRepuestosManualesFromPdf.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultOutputDirectory = path.resolve(__dirname, '../../../../reports');

const getCliOption = (name) => {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));

  return argument ? argument.slice(prefix.length) : null;
};

const getParserType = (page) => (
  page.debugDetections.some((detection) => detection.source === 'coordinate-table-header') ? 'Tabular' : 'Lineal'
);

const getDiscardReason = (detection) => detection.motivoDescarte
  || detection.motivoReferenciaNull
  || 'Candidato descartado sin motivo específico.';

const summarizeDiscardReasons = (discardedDetections) => {
  const counts = new Map();

  for (const detection of discardedDetections) {
    const reason = getDiscardReason(detection);
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }

  return [...counts.entries()].map(([motivo, cantidad]) => ({ motivo, cantidad }));
};

const hasParseErrors = (page) => page.debugDetections.some((detection) => detection.error || detection.parseError);

const buildReviewReasons = ({ parserType, detectedCount, nullReferencesCount, discardedCount, discardedRatio, parseErrors }) => {
  const reasons = [];

  if (nullReferencesCount > 0) {
    reasons.push('Referencias NULL');
  }

  if (parserType === 'Tabular' && detectedCount < 2) {
    reasons.push('Menos de 2 registros en página con tabla');
  }

  if (discardedRatio > 0.2) {
    reasons.push('Más de 20% de filas/candidatos descartados');
  }

  if (parseErrors) {
    reasons.push('Errores de parsing');
  }

  return reasons;
};

const buildPageQualityReport = ({ pdfConfig, page, spareParts }) => {
  const pageParts = spareParts.filter((sparePart) => sparePart.pagina === page.pageNumber);
  const parserType = getParserType(page);
  const discardedDetections = page.debugDetections.filter((detection) => detection.descartado);
  const acceptedDetections = page.debugDetections.filter((detection) => detection.descartado === false && detection.source !== 'coordinate-table-header');
  const candidateCount = acceptedDetections.length + discardedDetections.length;
  const discardedCount = discardedDetections.length;
  const discardedRatio = candidateCount > 0 ? discardedCount / candidateCount : 0;
  const parseErrors = hasParseErrors(page);
  const nullReferencesCount = pageParts.filter((sparePart) => !sparePart.referenciaDespiece).length;
  const reviewReasons = buildReviewReasons({
    parserType,
    detectedCount: pageParts.length,
    nullReferencesCount,
    discardedCount,
    discardedRatio,
    parseErrors
  });

  return {
    manual: pdfConfig.manualNombre,
    archivoOrigen: pdfConfig.archivoOrigen,
    paginaInterna: page.pageNumber,
    paginaImpresa: page.printedPageNumber,
    tipoParser: parserType,
    registrosDetectados: pageParts.length,
    registrosReferenciaDespieceNull: nullReferencesCount,
    registrosSinCodigo: pageParts.filter((sparePart) => !sparePart.codigo).length,
    registrosSinDescripcion: pageParts.filter((sparePart) => !sparePart.descripcion).length,
    registrosDescartados: discardedCount,
    totalCandidatos: candidateCount,
    porcentajeDescartado: Number((discardedRatio * 100).toFixed(2)),
    motivosDescarte: summarizeDiscardReasons(discardedDetections),
    erroresParsing: parseErrors,
    estado: reviewReasons.length ? 'Revisar' : 'OK',
    motivosRevision: reviewReasons
  };
};

const csvEscape = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  const text = typeof value === 'string' ? value : JSON.stringify(value);

  if (!/[",\n;]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
};

const toCsv = (rows) => {
  const headers = [
    'manual',
    'archivoOrigen',
    'paginaInterna',
    'paginaImpresa',
    'tipoParser',
    'registrosDetectados',
    'registrosReferenciaDespieceNull',
    'registrosSinCodigo',
    'registrosSinDescripcion',
    'registrosDescartados',
    'totalCandidatos',
    'porcentajeDescartado',
    'motivosDescarte',
    'erroresParsing',
    'estado',
    'motivosRevision'
  ];

  return [
    headers.join(';'),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(';'))
  ].join('\n');
};

const buildTotals = (rows) => ({
  paginasAuditadas: rows.length,
  paginasARevisar: rows.filter((row) => row.estado === 'Revisar').length,
  registrosDetectados: rows.reduce((total, row) => total + row.registrosDetectados, 0),
  registrosReferenciaDespieceNull: rows.reduce((total, row) => total + row.registrosReferenciaDespieceNull, 0),
  registrosDescartados: rows.reduce((total, row) => total + row.registrosDescartados, 0)
});

export const buildImporterQualityAudit = async ({ pdfsToImport = PDFS_TO_IMPORT } = {}) => {
  const rows = [];

  for (const pdfConfig of pdfsToImport) {
    const { pages, spareParts } = await buildImportPreview(pdfConfig);

    for (const page of pages) {
      rows.push(buildPageQualityReport({ pdfConfig, page, spareParts }));
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    totals: buildTotals(rows),
    pages: rows
  };
};

async function runAudit() {
  const outputDirectory = path.resolve(getCliOption('output-dir') ?? defaultOutputDirectory);
  const format = (getCliOption('format') ?? 'both').toLocaleLowerCase('es-AR');
  const audit = await buildImporterQualityAudit();
  const baseName = `repuestos-manuales-importer-quality-${new Date().toISOString().slice(0, 10)}`;

  await mkdir(outputDirectory, { recursive: true });

  if (format === 'json' || format === 'both') {
    const jsonPath = path.join(outputDirectory, `${baseName}.json`);
    await writeFile(jsonPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
    console.log(`Informe JSON generado: ${jsonPath}`);
  }

  if (format === 'csv' || format === 'both') {
    const csvPath = path.join(outputDirectory, `${baseName}.csv`);
    await writeFile(csvPath, `${toCsv(audit.pages)}\n`, 'utf8');
    console.log(`Informe CSV generado: ${csvPath}`);
  }

  console.log('Resumen auditoría calidad importador RepuestosManuales:');
  console.log(JSON.stringify(audit.totals, null, 2));
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  runAudit().catch((error) => {
    console.error('No se pudo generar el informe de calidad del importador.', error);
    process.exitCode = 1;
  });
}
