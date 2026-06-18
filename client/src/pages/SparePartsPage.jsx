import { useEffect, useState } from 'react';
import CatalogAccessRequired from '../components/auth/CatalogAccessRequired.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiUrl, getSpareParts } from '../services/sparePartsService.js';
import { addContactSelectedPart, getContactSelectedParts } from '../utils/contactSelectedParts.js';

const emptyValue = 'Sin informar';
const sparePartsLimit = 50;

const sparePartsManuals = [
  {
    name: 'Repuestos Rastras',
    type: 'Manual de repuestos',
    pages: 'Cantidad aproximada: 98 páginas',
    description: 'Despieces, códigos y referencias para identificar repuestos de rastras.',
    actionLabel: 'Ver manual',
    url: `${apiUrl}/pdfs/manual-repuestos-rastras.pdf`
  },
  {
    name: 'Grano Fino 2019',
    type: 'Manual de repuestos',
    pages: 'Cantidad aproximada: 104 páginas',
    description: 'Referencias y códigos para repuestos de sembradoras de grano fino.',
    actionLabel: 'Ver manual',
    url: `${apiUrl}/pdfs/manual-repuestos-grano-fino-2019.pdf`
  }
];

function getDisplayValue(value) {
  if (value === null || value === undefined || value === '') {
    return emptyValue;
  }

  return value;
}

function getSparePartKey(sparePart) {
  return sparePart.id ?? `${sparePart.codigo}-${sparePart.nombre}`;
}

function SparePartsPage() {
  const { isAuthenticated, token } = useAuth();
  const [spareParts, setSpareParts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: sparePartsLimit,
    totalPages: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPartIds, setSelectedPartIds] = useState(() =>
    getContactSelectedParts().map((sparePart) => String(sparePart.id))
  );
  const [selectionNotice, setSelectionNotice] = useState('');

  useEffect(() => {
    let isMounted = true;

    if (!isAuthenticated) {
      setIsLoading(false);
      setSpareParts([]);
      setPagination({
        total: 0,
        page,
        limit: sparePartsLimit,
        totalPages: 0
      });
      return undefined;
    }

    async function loadSpareParts() {
      setIsLoading(true);
      setError('');

      try {
        const response = await getSpareParts({
          page,
          limit: sparePartsLimit,
          search: searchTerm,
          token
        });

        if (isMounted) {
          setSpareParts(Array.isArray(response.data) ? response.data : []);
          setPagination({
            total: response.pagination?.total ?? 0,
            page: response.pagination?.page ?? page,
            limit: response.pagination?.limit ?? sparePartsLimit,
            totalPages: response.pagination?.totalPages ?? 0
          });
        }
      } catch (currentError) {
        if (isMounted) {
          setSpareParts([]);
          setPagination({
            total: 0,
            page,
            limit: sparePartsLimit,
            totalPages: 0
          });
          setError(currentError.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadSpareParts();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, page, searchTerm, token]);

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setPage(1);
  };

  const goToPreviousPage = () => {
    setPage((currentPage) => Math.max(currentPage - 1, 1));
  };

  const goToNextPage = () => {
    setPage((currentPage) => Math.min(currentPage + 1, pagination.totalPages || currentPage));
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

  const currentPage = pagination.page || page;
  const totalPages = pagination.totalPages || 1;
  const isPreviousDisabled = isLoading || currentPage === 1;
  const isNextDisabled = isLoading || currentPage >= totalPages;

  return (
    <section className="spare-parts-page" aria-labelledby="spare-parts-title">
      <div className="spare-parts-hero">
        <p className="eyebrow">Catálogo AgroBarceló</p>
        <h1 id="spare-parts-title">Repuestos</h1>
        <p>Encontrá repuestos para tu maquinaria de forma rápida y sencilla.</p>
      </div>

      {!isAuthenticated ? <CatalogAccessRequired /> : null}

      {isAuthenticated ? (
        <>
      <section className="spare-parts-finder" aria-labelledby="spare-parts-finder-title">
        <div>
          <p className="eyebrow">Buscador de repuestos</p>
          <h2 id="spare-parts-finder-title">¿No encontrás el repuesto que buscás?</h2>
          <p>
            Utilizá nuestro buscador para localizar repuestos por código, descripción o referencias
            encontradas en manuales.
          </p>
        </div>
        <a className="spare-parts-finder__button" href="/buscador-repuestos">
          Abrir buscador de repuestos
        </a>
      </section>

      <section className="spare-parts-manuals" aria-labelledby="spare-parts-manuals-title">
        <div className="spare-parts-manuals__header">
          <p className="eyebrow">Ayuda para identificar piezas</p>
          <h2 id="spare-parts-manuals-title">Manuales y Catálogos</h2>
          <p>
            Encontrá despieces, códigos y referencias para identificar correctamente el repuesto que
            necesitás.
          </p>
        </div>

        <div className="spare-parts-manuals__grid">
          {sparePartsManuals.map((manual) => (
            <article className="spare-parts-manual-card" key={manual.url}>
              <div className="spare-parts-manual-card__top">
                <span className="spare-parts-manual-card__icon" aria-hidden="true">
                  PDF
                </span>
                <div>
                  <p className="spare-parts-manual-card__type">{manual.type}</p>
                  <h3>{manual.name}</h3>
                </div>
              </div>

              <p>{manual.description}</p>

              <div className="spare-parts-manual-card__footer">
                <span className="spare-parts-manual-card__pages">{manual.pages}</span>
                <a
                  className="spare-parts-manual-card__button"
                  href={manual.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${manual.actionLabel}: ${manual.name}`}
                >
                  {manual.actionLabel}
                </a>
              </div>
            </article>
          ))}
        </div>

        <div className="spare-parts-manuals__note" aria-label="Datos para solicitar un repuesto">
          <p>Para solicitar un repuesto indicá:</p>
          <ul>
            <li>Código de la pieza.</li>
            <li>Página del manual.</li>
            <li>Modelo de la máquina.</li>
          </ul>
          <p>Esto permite identificar el repuesto con mayor precisión.</p>
        </div>
      </section>

      <div className="spare-parts-search" role="search">
        <label className="spare-parts-search__label" htmlFor="spare-parts-search-input">
          Buscar repuestos
        </label>
        <input
          id="spare-parts-search-input"
          type="search"
          value={searchTerm}
          placeholder="Buscar por nombre, código o marca..."
          onChange={handleSearchChange}
        />
      </div>

      {isLoading && <p className="status-message">Cargando repuestos...</p>}
      {error && <p className="status-message status-message--error">{error}</p>}

      {!isLoading && !error && (
        <>
          <p className="spare-parts-results-count">
            Mostrando {spareParts.length} de {pagination.total} repuestos
          </p>

          {selectionNotice ? (
            <p className="spare-parts-selection-notice" aria-live="polite">
              {selectionNotice} <a href="/contacto">Ver consulta</a>
            </p>
          ) : null}

          <div className="spare-parts-table-wrapper">
            <table className="spare-parts-table">
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Nombre</th>
                  <th scope="col">Marca</th>
                  <th scope="col">SubRubro</th>
                  <th scope="col">Disponibilidad</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {spareParts.map((sparePart) => (
                  <tr key={getSparePartKey(sparePart)}>
                    <td data-label="Código">{getDisplayValue(sparePart.codigo)}</td>
                    <td data-label="Nombre">{getDisplayValue(sparePart.nombre)}</td>
                    <td data-label="Marca">{getDisplayValue(sparePart.marca)}</td>
                    <td data-label="SubRubro">{getDisplayValue(sparePart.subRubro)}</td>
                    <td data-label="Disponibilidad">
                      <span className="availability">
                        {getDisplayValue(sparePart.disponibilidad)}
                      </span>
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

          {spareParts.length === 0 ? (
            <p className="status-message spare-parts-empty">
              No se encontraron repuestos con ese nombre, código o marca.
            </p>
          ) : null}

          <div className="spare-parts-pagination" aria-label="Paginación de repuestos">
            <button type="button" onClick={goToPreviousPage} disabled={isPreviousDisabled}>
              Anterior
            </button>
            <span>
              Página {currentPage} de {totalPages}
            </span>
            <button type="button" onClick={goToNextPage} disabled={isNextDisabled}>
              Siguiente
            </button>
          </div>
        </>
      )}
        </>
      ) : null}
    </section>
  );
}

export default SparePartsPage;
