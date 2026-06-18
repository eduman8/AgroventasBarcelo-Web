import { useEffect, useMemo, useRef, useState } from 'react';
import CatalogAccessRequired from '../components/auth/CatalogAccessRequired.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getSpareParts } from '../services/sparePartsService.js';
import {
  getManualSparePartsDiagnostics,
  searchManualSpareParts
} from '../services/manualSparePartsSearchService.js';
import { addContactSelectedPart, getContactSelectedParts } from '../utils/contactSelectedParts.js';

const searchLimit = 25;
const shouldShowManualDiagnostics = false; // Reservado para un futuro panel administrativo.

const numberFormatter = new Intl.NumberFormat('es-AR');
const percentFormatter = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0
});
const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

const formatNumber = (value) => numberFormatter.format(Number(value ?? 0));
const formatPercent = (value) => `${percentFormatter.format(Number(value ?? 0))}%`;
const formatDate = (value) => {
  if (!value) {
    return 'Sin registros';
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? 'Sin registros' : dateFormatter.format(date);
};

const getDisplayValue = (value, fallback = 'Sin informar') => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  return value;
};

const getCatalogPartKey = (sparePart) => sparePart.id ?? `${sparePart.codigo}-${sparePart.nombre}`;
const getManualPartKey = (sparePart) => `manual-${sparePart.id ?? `${sparePart.codigo}-${sparePart.manualNombre}`}`;
const getManualSelectedPartId = (sparePart) => getManualPartKey(sparePart);

const getInitialSearchTerm = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  return new URLSearchParams(window.location.search).get('busqueda')?.trim() || '';
};

const buildManualSelectedPart = (sparePart) => ({
  id: getManualSelectedPartId(sparePart),
  nombre: getDisplayValue(sparePart.descripcion, 'Repuesto de manual'),
  codigo: getDisplayValue(sparePart.codigo, 'Sin código'),
  manual: getDisplayValue(sparePart.manualNombre),
  pagina: getDisplayValue(sparePart.pagina),
  categoria: getDisplayValue(sparePart.categoria),
  source: 'manual'
});

const buildCatalogSelectedPartFromManual = (sparePart) => ({
  id: sparePart.catalogoId,
  nombre: getDisplayValue(sparePart.catalogoNombre, sparePart.descripcion),
  codigo: getDisplayValue(sparePart.catalogoCodigo, sparePart.codigo),
  marca: getDisplayValue(sparePart.catalogoMarca),
  disponibilidad: getDisplayValue(sparePart.catalogoDisponible, 'Disponible'),
  source: 'catalog'
});

function ManualSparePartsSearchPage() {
  const { isAuthenticated, token } = useAuth();
  const [searchTerm, setSearchTerm] = useState(() => getInitialSearchTerm());
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [catalogResults, setCatalogResults] = useState([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [manualResults, setManualResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [manualError, setManualError] = useState('');
  const [selectedPartIds, setSelectedPartIds] = useState(() =>
    getContactSelectedParts().map((sparePart) => String(sparePart.id))
  );
  const [selectionNotice, setSelectionNotice] = useState('');
  const [diagnostics, setDiagnostics] = useState(null);
  const [diagnosticsError, setDiagnosticsError] = useState('');
  const [isLoadingDiagnostics, setIsLoadingDiagnostics] = useState(true);
  const didRunInitialSearch = useRef(false);

  const executeSearch = async (normalizedSearch) => {
    setSubmittedSearch(normalizedSearch);
    setSelectionNotice('');

    if (!normalizedSearch) {
      setCatalogResults([]);
      setCatalogTotal(0);
      setManualResults([]);
      setCatalogError('');
      setManualError('');
      return;
    }

    setIsLoading(true);
    setCatalogError('');
    setManualError('');

    const [catalogResponse, manualResponse] = await Promise.allSettled([
      getSpareParts({ page: 1, limit: searchLimit, search: normalizedSearch, token }),
      searchManualSpareParts({ search: normalizedSearch, limit: searchLimit, token })
    ]);

    if (catalogResponse.status === 'fulfilled') {
      setCatalogResults(Array.isArray(catalogResponse.value.data) ? catalogResponse.value.data : []);
      setCatalogTotal(catalogResponse.value.pagination?.total ?? 0);
    } else {
      setCatalogResults([]);
      setCatalogTotal(0);
      setCatalogError(catalogResponse.reason?.message || 'No se pudo buscar en el catálogo.');
    }

    if (manualResponse.status === 'fulfilled') {
      setManualResults(Array.isArray(manualResponse.value.data) ? manualResponse.value.data : []);
    } else {
      setManualResults([]);
      setManualError(manualResponse.reason?.message || 'No se pudo buscar en los manuales.');
    }

    setIsLoading(false);
  };

  useEffect(() => {
    if (!isAuthenticated || didRunInitialSearch.current) {
      return;
    }

    didRunInitialSearch.current = true;

    const initialSearchTerm = getInitialSearchTerm();

    if (initialSearchTerm) {
      executeSearch(initialSearchTerm);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    let isMounted = true;

    const loadDiagnostics = async () => {
      if (!isAuthenticated) {
        setIsLoadingDiagnostics(false);
        return;
      }

      try {
        const diagnosticsResponse = await getManualSparePartsDiagnostics(token);

        if (isMounted) {
          setDiagnostics(diagnosticsResponse);
          setDiagnosticsError('');
        }
      } catch (error) {
        if (isMounted) {
          setDiagnostics(null);
          setDiagnosticsError(error?.message || 'No se pudo cargar el estado de datos.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingDiagnostics(false);
        }
      }
    };

    loadDiagnostics();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, token]);

  const hasSearch = submittedSearch.trim().length > 0;
  const hasAnyError = Boolean(catalogError || manualError);
  const hasAnyResults = catalogResults.length > 0 || manualResults.length > 0;
  const resultsSummary = useMemo(() => {
    if (!hasSearch || isLoading || hasAnyError) {
      return '';
    }

    return `${catalogResults.length} coincidencias en catálogo y ${manualResults.length} coincidencias en manuales para “${submittedSearch}”.`;
  }, [catalogResults.length, hasAnyError, hasSearch, isLoading, manualResults.length, submittedSearch]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    await executeSearch(searchTerm.trim());
  };

  const handleAddToQuery = (sparePart) => {
    const { selectedParts, wasAdded } = addContactSelectedPart(sparePart);
    setSelectedPartIds(selectedParts.map((selectedPart) => String(selectedPart.id)));
    setSelectionNotice(
      wasAdded
        ? `${getDisplayValue(sparePart.nombre)} se agregó a la consulta.`
        : `${getDisplayValue(sparePart.nombre)} ya estaba agregado a la consulta.`
    );
  };

  const handleAddManualToQuery = (sparePart) => {
    const selectedManualPart = buildManualSelectedPart(sparePart);
    const { selectedParts, wasAdded } = addContactSelectedPart(selectedManualPart);
    setSelectedPartIds(selectedParts.map((selectedPart) => String(selectedPart.id)));
    setSelectionNotice(
      wasAdded
        ? `${selectedManualPart.nombre} se agregó a la consulta desde manual.`
        : `${selectedManualPart.nombre} ya estaba agregado a la consulta.`
    );
  };

  const handleAddCatalogMatchToQuery = (sparePart) => {
    const selectedCatalogPart = buildCatalogSelectedPartFromManual(sparePart);
    const { selectedParts, wasAdded } = addContactSelectedPart(selectedCatalogPart);
    setSelectedPartIds(selectedParts.map((selectedPart) => String(selectedPart.id)));
    setSelectionNotice(
      wasAdded
        ? `${selectedCatalogPart.nombre} se agregó a la consulta desde catálogo.`
        : `${selectedCatalogPart.nombre} ya estaba agregado a la consulta.`
    );
  };

  return (
    <section className="manual-spare-parts-page" aria-labelledby="manual-spare-parts-title">
      <div className="manual-spare-parts-hero">
        <p className="eyebrow">Búsqueda unificada</p>
        <h1 id="manual-spare-parts-title">Buscador de Repuestos</h1>
        <p>
          Consultá en una sola búsqueda los repuestos disponibles del catálogo y las coincidencias
          identificadas en manuales técnicos.
        </p>
      </div>

      {!isAuthenticated ? <CatalogAccessRequired /> : null}

      {isAuthenticated ? (
        <>
      <section className="manual-spare-parts-panel" aria-labelledby="manual-spare-parts-search-title">
        <div className="manual-spare-parts-panel__header">
          <p className="eyebrow">Búsqueda</p>
          <h2 id="manual-spare-parts-search-title">Buscar repuestos</h2>
          <p>
            Ingresá código, descripción, marca, manual o modelo. El sistema consultará el catálogo
            SQL y los repuestos cargados desde manuales.
          </p>
        </div>

        <form className="manual-spare-parts-search" onSubmit={handleSubmit} role="search">
          <label htmlFor="manual-spare-parts-search-input">Código, descripción, marca, manual o modelo</label>
          <div className="manual-spare-parts-search__controls">
            <input
              id="manual-spare-parts-search-input"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Ej.: C2497, C1097, lanza, rastra"
            />
            <button type="submit" disabled={isLoading}>{isLoading ? 'Buscando...' : 'Buscar'}</button>
          </div>
        </form>

        <div className="manual-spare-parts-panel__shortcut">
          <div>
            <strong>¿Tenés el número de elemento del despiece?</strong>
            <span>Usá el buscador visual para indicar manual, página y N.º de elemento.</span>
          </div>
          <a href="/buscador-visual-repuestos">Abrir buscador visual</a>
        </div>
      </section>

      {shouldShowManualDiagnostics ? (
        <aside className="manual-spare-parts-diagnostics" aria-labelledby="manual-spare-parts-diagnostics-title">
          <div className="manual-spare-parts-diagnostics__header">
            <div>
              <p className="eyebrow">Estado de datos</p>
              <h2 id="manual-spare-parts-diagnostics-title">Diagnóstico de manuales</h2>
            </div>
            {isLoadingDiagnostics ? <span>Cargando...</span> : null}
          </div>

          {diagnosticsError ? (
            <p className="status-message status-message--error">{diagnosticsError}</p>
          ) : null}

          {!diagnosticsError && diagnostics ? (
            <div className="manual-spare-parts-diagnostics__content">
              <dl className="manual-spare-parts-diagnostics__metrics">
                <div>
                  <dt>Total registros manuales</dt>
                  <dd>{formatNumber(diagnostics.totalRegistrosManuales)}</dd>
                </div>
                <div>
                  <dt>Con coincidencia en catálogo</dt>
                  <dd>{formatNumber(diagnostics.registrosConCoincidenciaCatalogo)}</dd>
                </div>
                <div>
                  <dt>Solo manual</dt>
                  <dd>{formatNumber(diagnostics.registrosSoloManual)}</dd>
                </div>
                <div>
                  <dt>% coincidencia</dt>
                  <dd>{formatPercent(diagnostics.porcentajeCoincidenciaCatalogo)}</dd>
                </div>
                <div>
                  <dt>Última importación</dt>
                  <dd>{formatDate(diagnostics.ultimaFechaImportacion)}</dd>
                </div>
              </dl>

              <div className="manual-spare-parts-diagnostics__lists">
                <section aria-labelledby="diagnostics-manuals-title">
                  <h3 id="diagnostics-manuals-title">Registros por manual</h3>
                  <ul>
                    {(diagnostics.registrosPorManual ?? []).map((manual) => (
                      <li key={manual.nombre}>
                        <span>{manual.nombre}</span>
                        <strong>{formatNumber(manual.total)}</strong>
                      </li>
                    ))}
                  </ul>
                </section>

                <section aria-labelledby="diagnostics-categories-title">
                  <h3 id="diagnostics-categories-title">Categorías principales</h3>
                  <ul>
                    {(diagnostics.topCategorias ?? []).map((categoria) => (
                      <li key={categoria.nombre}>
                        <span>{categoria.nombre}</span>
                        <strong>{formatNumber(categoria.total)}</strong>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>
          ) : null}
        </aside>
      ) : null}

      <section className="manual-spare-parts-results" aria-labelledby="unified-spare-parts-results-title">
        <div className="manual-spare-parts-results__header">
          <div>
            <p className="eyebrow">Resultados</p>
            <h2 id="unified-spare-parts-results-title">Resultados de búsqueda</h2>
          </div>
          {resultsSummary ? <span>{resultsSummary}</span> : null}
        </div>

        {selectionNotice ? (
          <p className="spare-parts-selection-notice" aria-live="polite">
            {selectionNotice} <a href="/contacto">Ver consulta</a>
          </p>
        ) : null}

        {!hasSearch && !isLoading ? (
          <p className="status-message manual-spare-parts-empty">
            Ingresá un término y presioná Buscar para ver coincidencias del catálogo y de manuales.
          </p>
        ) : null}

        {isLoading ? <p className="status-message">Buscando repuestos en catálogo y manuales...</p> : null}

        {hasSearch && !isLoading ? (
          <div className="unified-spare-parts-results">
            <section className="unified-spare-parts-section" aria-labelledby="catalog-results-title">
              <div className="unified-spare-parts-section__header">
                <h3 id="catalog-results-title">Coincidencias en catálogo</h3>
                {!catalogError ? <span>{catalogTotal} resultados totales</span> : null}
              </div>

              {catalogError ? <p className="status-message status-message--error">{catalogError}</p> : null}

              {!catalogError && catalogResults.length > 0 ? (
                <div className="spare-parts-table-wrapper">
                  <table className="spare-parts-table">
                    <thead>
                      <tr>
                        <th scope="col">Código</th>
                        <th scope="col">Descripción</th>
                        <th scope="col">Marca</th>
                        <th scope="col">Disponibilidad</th>
                        <th scope="col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catalogResults.map((sparePart) => (
                        <tr key={getCatalogPartKey(sparePart)}>
                          <td data-label="Código">{getDisplayValue(sparePart.codigo)}</td>
                          <td data-label="Descripción">{getDisplayValue(sparePart.nombre)}</td>
                          <td data-label="Marca">{getDisplayValue(sparePart.marca)}</td>
                          <td data-label="Disponibilidad">
                            <span className="availability">{getDisplayValue(sparePart.disponibilidad)}</span>
                          </td>
                          <td data-label="Acciones">
                            <div className="spare-parts-table__actions">
                              <a className="spare-parts-table__detail-link" href={`/repuestos/${sparePart.id}`}>
                                Ver detalle
                              </a>
                              <button
                                className="spare-parts-table__add-button"
                                type="button"
                                onClick={() => handleAddToQuery(sparePart)}
                              >
                                {selectedPartIds.includes(String(sparePart.id)) ? 'Agregado' : 'Agregar a consulta'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {!catalogError && catalogResults.length === 0 ? (
                <p className="status-message spare-parts-empty">
                  No se encontraron coincidencias en catálogo para “{submittedSearch}”.
                </p>
              ) : null}
            </section>

            <section className="unified-spare-parts-section" aria-labelledby="manual-results-title">
              <div className="unified-spare-parts-section__header">
                <h3 id="manual-results-title">Coincidencias en manuales</h3>
                {!manualError ? <span>{manualResults.length} resultados</span> : null}
              </div>

              {manualError ? <p className="status-message status-message--error">{manualError}</p> : null}

              {!manualError && manualResults.length > 0 ? (
                <div className="manual-spare-parts-table-wrapper">
                  <table className="manual-spare-parts-table">
                    <thead>
                      <tr>
                        <th scope="col">Código</th>
                        <th scope="col">Descripción</th>
                        <th scope="col">Manual</th>
                        <th scope="col">Página</th>
                        <th scope="col">Categoría</th>
                        <th scope="col">Catálogo</th>
                        <th scope="col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manualResults.map((sparePart) => {
                        const selectedManualPartId = getManualSelectedPartId(sparePart);
                        const catalogPartId = sparePart.catalogoId ? String(sparePart.catalogoId) : '';

                        return (
                          <tr key={getManualPartKey(sparePart)}>
                            <td data-label="Código">{getDisplayValue(sparePart.codigo, 'Sin código')}</td>
                            <td data-label="Descripción">{getDisplayValue(sparePart.descripcion)}</td>
                            <td data-label="Manual">{getDisplayValue(sparePart.manualNombre)}</td>
                            <td data-label="Página">{getDisplayValue(sparePart.pagina)}</td>
                            <td data-label="Categoría">{getDisplayValue(sparePart.categoria)}</td>
                            <td data-label="Catálogo">
                              {sparePart.existeEnCatalogo ? (
                                <div className="manual-catalog-match">
                                  <span className="manual-catalog-match__badge manual-catalog-match__badge--available">
                                    También disponible en catálogo
                                  </span>
                                  <span className="manual-catalog-match__detail">
                                    {getDisplayValue(sparePart.catalogoCodigo, sparePart.codigo)} ·{' '}
                                    {getDisplayValue(sparePart.catalogoNombre, sparePart.descripcion)}
                                  </span>
                                </div>
                              ) : (
                                <span className="manual-catalog-match__badge manual-catalog-match__badge--manual-only">
                                  Solo encontrado en manual
                                </span>
                              )}
                            </td>
                            <td data-label="Acciones">
                              {sparePart.existeEnCatalogo ? (
                                <div className="spare-parts-table__actions">
                                  <a className="spare-parts-table__detail-link" href={`/repuestos/${sparePart.catalogoId}`}>
                                    Ver detalle
                                  </a>
                                  <button
                                    className="spare-parts-table__add-button"
                                    type="button"
                                    onClick={() => handleAddCatalogMatchToQuery(sparePart)}
                                  >
                                    {selectedPartIds.includes(catalogPartId)
                                      ? 'Agregado'
                                      : 'Agregar repuesto del catálogo a consulta'}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="spare-parts-table__add-button"
                                  type="button"
                                  onClick={() => handleAddManualToQuery(sparePart)}
                                >
                                  {selectedPartIds.includes(String(selectedManualPartId))
                                    ? 'Agregado'
                                    : 'Agregar a consulta desde manual'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {!manualError && manualResults.length === 0 ? (
                <p className="status-message manual-spare-parts-empty">
                  No se encontraron coincidencias en manuales para “{submittedSearch}”.
                </p>
              ) : null}
            </section>

            {!hasAnyResults && !hasAnyError ? (
              <p className="status-message manual-spare-parts-empty">
                No hubo coincidencias en ninguna fuente para “{submittedSearch}”.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
        </>
      ) : null}
    </section>
  );
}

export default ManualSparePartsSearchPage;
