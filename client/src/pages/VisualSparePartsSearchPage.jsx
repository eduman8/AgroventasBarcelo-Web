import { useEffect, useMemo, useState } from 'react';
import CatalogAccessRequired from '../components/auth/CatalogAccessRequired.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiUrl } from '../services/sparePartsService.js';
import { getVisualSparePartsPanel, searchVisualSpareParts } from '../services/manualSparePartsSearchService.js';
import { addContactSelectedPart, getContactSelectedParts } from '../utils/contactSelectedParts.js';

const manualOptions = [
  {
    label: 'Repuestos Rastras',
    value: 'Repuestos Rastras',
    file: 'manual-repuestos-rastras.pdf'
  },
  {
    label: 'Grano Fino 2019',
    value: 'Grano Fino 2019',
    file: 'manual-repuestos-grano-fino-2019.pdf'
  }
];

const getDisplayValue = (value, fallback = 'Sin informar') => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  return value;
};

const getManualPartKey = (sparePart) => `manual-${sparePart.id ?? `${sparePart.codigo}-${sparePart.manualNombre}`}`;
const getManualSelectedPartId = (sparePart) => getManualPartKey(sparePart);

const buildManualUrl = (sparePart, selectedManual) => {
  const manualFile = sparePart.archivoOrigen || manualOptions.find((manual) => manual.value === selectedManual)?.file;

  return manualFile ? `${apiUrl}/pdfs/${encodeURIComponent(manualFile)}` : '';
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

const buildGeneralSearchUrl = (sparePart) => {
  const searchTerm = String(getDisplayValue(sparePart.catalogoCodigo || sparePart.codigo || sparePart.descripcion, '')).trim();

  return searchTerm
    ? `/buscador-repuestos?busqueda=${encodeURIComponent(searchTerm)}`
    : '/buscador-repuestos';
};

function VisualSparePartsSearchPage() {
  const { isAuthenticated, token } = useAuth();
  const [manual, setManual] = useState(manualOptions[0].value);
  const [pagina, setPagina] = useState('');
  const [elemento, setElemento] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState(null);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectionNotice, setSelectionNotice] = useState('');
  const [panelData, setPanelData] = useState(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState('');
  const [selectedPanelPoint, setSelectedPanelPoint] = useState(null);
  const [selectedPartIds, setSelectedPartIds] = useState(() =>
    getContactSelectedParts().map((sparePart) => String(sparePart.id))
  );

  const hasSubmittedSearch = Boolean(submittedSearch);
  useEffect(() => {
    const normalizedManual = manual.trim();
    const normalizedPagina = pagina.trim();

    if (!isAuthenticated || !normalizedManual || !normalizedPagina) {
      setPanelData(null);
      setSelectedPanelPoint(null);
      return;
    }

    let isCurrentRequest = true;
    setPanelLoading(true);
    setPanelError('');

    getVisualSparePartsPanel({ manualNombre: normalizedManual, pagina: normalizedPagina, token })
      .then((panelResponse) => {
        if (isCurrentRequest) {
          setPanelData(panelResponse);
          setSelectedPanelPoint(null);
        }
      })
      .catch((panelLoadError) => {
        if (isCurrentRequest) {
          setPanelData(null);
          setPanelError(panelLoadError?.message || 'No se pudo cargar el panel visual.');
        }
      })
      .finally(() => {
        if (isCurrentRequest) {
          setPanelLoading(false);
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [isAuthenticated, manual, pagina, token]);

  const resultsSummary = useMemo(() => {
    if (!submittedSearch || isLoading || error) {
      return '';
    }

    return `${results.length} coincidencias para ${submittedSearch.manual}, página ${submittedSearch.pagina}, elemento ${submittedSearch.elemento}.`;
  }, [error, isLoading, results.length, submittedSearch]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedManual = manual.trim();
    const normalizedPagina = pagina.trim();
    const normalizedElemento = elemento.trim();

    setSubmittedSearch({
      manual: normalizedManual,
      pagina: normalizedPagina,
      elemento: normalizedElemento
    });
    setSelectionNotice('');

    if (!normalizedManual || !normalizedPagina || !normalizedElemento) {
      setResults([]);
      setError('Completá manual, página y número de elemento para buscar.');
      return;
    }

    setIsLoading(true);
    setError('');
    setPanelError('');

    try {
      const response = await searchVisualSpareParts({
        manual: normalizedManual,
        pagina: normalizedPagina,
        elemento: normalizedElemento,
        token
      });

      setResults(Array.isArray(response.data) ? response.data : []);
    } catch (searchError) {
      setResults([]);
      setError(searchError?.message || 'No se pudo buscar el repuesto visual.');
    } finally {
      setIsLoading(false);
    }
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

  const handleAddResultToQuery = (sparePart) => {
    if (sparePart.existeEnCatalogo) {
      handleAddCatalogMatchToQuery(sparePart);
      return;
    }

    handleAddManualToQuery(sparePart);
  };

  return (
    <section className="manual-spare-parts-page visual-spare-parts-page" aria-labelledby="visual-spare-parts-title">
      <div className="manual-spare-parts-hero visual-spare-parts-hero">
        <p className="eyebrow">Búsqueda guiada por manual</p>
        <h1 id="visual-spare-parts-title">Buscador Visual de Repuestos</h1>
        <p>Identificá un repuesto usando el manual, la página y el número de elemento del despiece.</p>
      </div>

      {!isAuthenticated ? <CatalogAccessRequired /> : null}

      {isAuthenticated ? (
        <>
      <section className="manual-spare-parts-panel" aria-labelledby="visual-spare-parts-search-title">
        <div className="manual-spare-parts-panel__header">
          <p className="eyebrow">Datos del despiece</p>
          <h2 id="visual-spare-parts-search-title">Buscar por manual, página y elemento</h2>
          <p>
            Abrí el manual, buscá el número marcado en el despiece e ingresalo junto con la página.
          </p>
        </div>

        <form className="visual-spare-parts-search" onSubmit={handleSubmit} role="search">
          <div className="visual-spare-parts-field visual-spare-parts-field--manual">
            <label htmlFor="visual-spare-parts-manual">Manual</label>
            <select
              id="visual-spare-parts-manual"
              value={manual}
              onChange={(event) => setManual(event.target.value)}
            >
              {manualOptions.map((manualOption) => (
                <option key={manualOption.value} value={manualOption.value}>
                  {manualOption.label}
                </option>
              ))}
            </select>
          </div>

          <div className="visual-spare-parts-field">
            <label htmlFor="visual-spare-parts-page">Página</label>
            <input
              id="visual-spare-parts-page"
              type="number"
              min="1"
              inputMode="numeric"
              value={pagina}
              onChange={(event) => setPagina(event.target.value)}
              placeholder="Ej.: 22"
            />
          </div>

          <div className="visual-spare-parts-field">
            <label htmlFor="visual-spare-parts-element">N.º de elemento</label>
            <input
              id="visual-spare-parts-element"
              type="text"
              value={elemento}
              onChange={(event) => setElemento(event.target.value)}
              placeholder="Ej.: 7"
            />
          </div>

          <button type="submit" disabled={isLoading}>{isLoading ? 'Buscando...' : 'Buscar repuesto'}</button>
        </form>

        <p className="visual-spare-parts-help">
          Abrí el manual, buscá el número marcado en el despiece e ingresalo junto con la página.
        </p>
      </section>


      <section className="manual-spare-parts-panel visual-panel" aria-labelledby="visual-panel-title">
        <div className="manual-spare-parts-panel__header">
          <p className="eyebrow">Panel visual interactivo</p>
          <h2 id="visual-panel-title">Puntos clickeables del despiece</h2>
          <p>Seleccioná manual y página para ver la imagen cargada y sus referencias disponibles.</p>
        </div>

        {panelLoading ? <p className="status-message">Cargando panel visual...</p> : null}
        {panelError ? <p className="status-message status-message--error">{panelError}</p> : null}
        {!panelLoading && !panelError && !panelData ? (
          <p className="status-message manual-spare-parts-empty">Buscá una página para cargar el panel visual interactivo.</p>
        ) : null}
        {!panelLoading && !panelError && panelData ? (
          <div className="visual-panel__layout">
            <div className="visual-panel__canvas">
              {panelData.imageUrl ? (
                <div className="visual-panel__image-wrap">
                  <img src={`${apiUrl}${panelData.imageUrl}`} alt={`Despiece ${panelData.manualNombre} página ${panelData.pagina}`} />
                  {(panelData.puntos || []).map((point) => (
                    <button
                      className="visual-panel__marker"
                      type="button"
                      key={point.id}
                      style={{ left: `${point.xPercent}%`, top: `${point.yPercent}%` }}
                      onClick={() => setSelectedPanelPoint(point)}
                      aria-label={`Ver referencia ${point.referenciaDespiece}`}
                    >
                      {point.referenciaDespiece}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="status-message manual-spare-parts-empty">No hay imagen cargada para esta página del manual.</p>
              )}
              {(panelData.puntos || []).length === 0 ? (
                <p className="status-message manual-spare-parts-empty">Todavía no hay puntos visuales cargados para esta página. Podés usar la búsqueda por número de referencia.</p>
              ) : null}
            </div>
            <aside className="visual-panel__detail" aria-live="polite">
              {selectedPanelPoint ? (
                <>
                  <p className="eyebrow">Referencia {selectedPanelPoint.referenciaDespiece}</p>
                  <h3>{getDisplayValue(selectedPanelPoint.descripcion)}</h3>
                  <dl>
                    <div><dt>Código</dt><dd>{getDisplayValue(selectedPanelPoint.codigo, 'Sin código')}</dd></div>
                    <div><dt>Manual</dt><dd>{getDisplayValue(selectedPanelPoint.manualNombre)}</dd></div>
                    <div><dt>Página</dt><dd>{getDisplayValue(selectedPanelPoint.pagina)}</dd></div>
                    <div><dt>Categoría</dt><dd>{getDisplayValue(selectedPanelPoint.categoria)}</dd></div>
                    <div><dt>Estado</dt><dd>{selectedPanelPoint.disponibleEnCatalogo ? 'Disponible en catálogo' : 'Solo manual'}</dd></div>
                  </dl>
                  <button className="spare-parts-table__add-button" type="button" onClick={() => handleAddResultToQuery({ ...selectedPanelPoint, existeEnCatalogo: selectedPanelPoint.disponibleEnCatalogo, catalogoId: selectedPanelPoint.repuestoCatalogoId })}>Agregar a consulta</button>
                </>
              ) : (
                <p>Hacé clic en un marcador para ver el detalle del repuesto.</p>
              )}
            </aside>
          </div>
        ) : null}
      </section>

      <section className="manual-spare-parts-results" aria-labelledby="visual-spare-parts-results-title">
        <div className="manual-spare-parts-results__header">
          <div>
            <p className="eyebrow">Resultados</p>
            <h2 id="visual-spare-parts-results-title">Repuestos identificados</h2>
          </div>
          {resultsSummary ? <span>{resultsSummary}</span> : null}
        </div>

        {selectionNotice ? (
          <p className="spare-parts-selection-notice" aria-live="polite">
            {selectionNotice} <a href="/contacto">Ver consulta</a>
          </p>
        ) : null}

        {!hasSubmittedSearch && !isLoading ? (
          <p className="status-message manual-spare-parts-empty">
            Seleccioná un manual, ingresá página y elemento, y presioná Buscar repuesto.
          </p>
        ) : null}

        {isLoading ? <p className="status-message">Buscando coincidencias en manuales...</p> : null}
        {error ? <p className="status-message status-message--error">{error}</p> : null}

        {hasSubmittedSearch && !isLoading && !error && results.length === 0 ? (
          <p className="status-message manual-spare-parts-empty">
            No encontramos coincidencias para ese elemento. Probá revisar la página o usar el{' '}
            <a href="/buscador-repuestos">buscador general</a>.
          </p>
        ) : null}

        {!isLoading && !error && results.length > 0 ? (
          <div className="manual-spare-parts-table-wrapper">
            <table className="manual-spare-parts-table visual-spare-parts-table">
              <thead>
                <tr>
                  <th scope="col">N.º de elemento</th>
                  <th scope="col">Código</th>
                  <th scope="col">Descripción</th>
                  <th scope="col">Manual</th>
                  <th scope="col">Página</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {results.map((sparePart) => {
                  const selectedManualPartId = getManualSelectedPartId(sparePart);
                  const catalogPartId = sparePart.catalogoId ? String(sparePart.catalogoId) : '';
                  const manualUrl = buildManualUrl(sparePart, manual);
                  const generalSearchUrl = buildGeneralSearchUrl(sparePart);
                  const selectedResultId = sparePart.existeEnCatalogo && catalogPartId
                    ? catalogPartId
                    : selectedManualPartId;

                  return (
                    <tr key={getManualPartKey(sparePart)}>
                      <td data-label="N.º de elemento" className="visual-spare-parts-table__element">
                        {getDisplayValue(sparePart.referenciaDespiece, submittedSearch.elemento)}
                      </td>
                      <td data-label="Código" className="visual-spare-parts-table__code">
                        {getDisplayValue(sparePart.codigo, 'Sin código')}
                      </td>
                      <td data-label="Descripción" className="visual-spare-parts-table__description">
                        {getDisplayValue(sparePart.descripcion)}
                      </td>
                      <td data-label="Manual">{getDisplayValue(sparePart.manualNombre)}</td>
                      <td data-label="Página">{getDisplayValue(sparePart.pagina)}</td>
                      <td data-label="Estado">
                        {sparePart.existeEnCatalogo ? (
                          <span className="manual-catalog-match__badge manual-catalog-match__badge--available">
                            Disponible en catálogo
                          </span>
                        ) : (
                          <span className="manual-catalog-match__badge manual-catalog-match__badge--manual-only">
                            Solo manual
                          </span>
                        )}
                      </td>
                      <td data-label="Acciones">
                        <div className="spare-parts-table__actions">
                          {manualUrl ? (
                            <a
                              className="spare-parts-table__detail-link"
                              href={manualUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Ver manual
                            </a>
                          ) : null}
                          <a className="spare-parts-table__detail-link" href={generalSearchUrl}>
                            Buscar por código/descripción
                          </a>
                          <button
                            className="spare-parts-table__add-button"
                            type="button"
                            onClick={() => handleAddResultToQuery(sparePart)}
                          >
                            {selectedPartIds.includes(String(selectedResultId)) ? 'Agregado' : 'Agregar a consulta'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
        </>
      ) : null}
    </section>
  );
}

export default VisualSparePartsSearchPage;
