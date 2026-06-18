import { useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button.jsx';
import { getMachines } from '../services/machinesService.js';
import {
  getMachineAvailabilityLabel,
  getMachineBadges,
  getMachineCategory,
  getMachineSlug,
  getMachineStatus,
  isAvailableMachine,
  sortMachinesByAvailability
} from '../utils/machines.js';

const allPublicationsLabel = 'Todas';
const soldPublicationsLabel = 'Vendidos';

const publicationFilters = [
  { label: allPublicationsLabel },
  { label: 'Nuevas', category: 'Nueva' },
  { label: 'Usadas', category: 'Usada' },
  { label: 'Trabajos realizados', category: 'Trabajo Realizado' },
  { label: soldPublicationsLabel, status: 'Vendido' }
];

function MachinesPage() {
  const [machines, setMachines] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState(allPublicationsLabel);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadMachines() {
      setIsLoading(true);
      setError('');

      try {
        const response = await getMachines();

        if (!isMounted) {
          return;
        }

        setMachines(Array.isArray(response) ? response : []);

        if (response?.isFallback) {
          setError('No se pudo conectar con la API real. Se muestran maquinarias mock temporalmente.');
        }
      } catch (currentError) {
        if (isMounted) {
          setMachines([]);
          setError(currentError.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadMachines();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredMachines = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase('es-AR');

    return sortMachinesByAvailability(machines.filter((machine) => {
      const selectedPublicationFilter = publicationFilters.find((filter) => filter.label === selectedFilter);
      const matchesCategory = !selectedPublicationFilter?.category || getMachineCategory(machine) === selectedPublicationFilter.category;
      const matchesStatus = !selectedPublicationFilter?.status || getMachineStatus(machine) === selectedPublicationFilter.status;
      const matchesSearch = machine.nombre.toLocaleLowerCase('es-AR').includes(normalizedSearchTerm);

      return matchesCategory && matchesStatus && matchesSearch;
    }));
  }, [machines, searchTerm, selectedFilter]);

  return (
    <section className="machines-page" aria-labelledby="machines-title">
      <div className="machines-hero">
        <p className="eyebrow">Catálogo AgroBarceló</p>
        <h1 id="machines-title">Maquinarias</h1>
        <p>
          Explorá maquinaria nueva, usada y trabajos realizados por AgroBarceló, con una
          estructura lista para sumar fotos y publicaciones reales.
        </p>
      </div>

      <div className="machines-toolbar">
        <div className="machines-search" role="search">
          <label className="machines-search__label" htmlFor="machines-search-input">
            Buscar por nombre
          </label>
          <input
            id="machines-search-input"
            type="search"
            value={searchTerm}
            placeholder="Ej: tractor, sembradora, rastra..."
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <div className="machines-filter-group">
          <p>Filtros</p>
          <div className="machines-filter" aria-label="Filtrar maquinarias">
            {publicationFilters.map((filter) => {
              const isActive = selectedFilter === filter.label;

              return (
                <button
                  className={`machines-filter__item${isActive ? ' is-active' : ''}`}
                  key={filter.label}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setSelectedFilter(filter.label)}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isLoading && <p className="status-message">Cargando maquinarias...</p>}
      {error && <p className="status-message status-message--error">{error}</p>}

      {!isLoading && (
        <>
          <p className="machines-results-count">
            Mostrando {filteredMachines.length} de {machines.length} publicaciones
          </p>

          <div className="machines-grid">
            {filteredMachines.map((machine) => (
              <article className="machine-card" key={machine.id}>
                {machine.imagenPrincipal ? (
                  <img
                    className="machine-card__image"
                    src={machine.imagenPrincipal}
                    alt={`Imagen principal de ${machine.nombre}`}
                  />
                ) : (
                  <div className="machine-card__placeholder" aria-hidden="true">
                    <span>Imagen próximamente</span>
                  </div>
                )}

                <div className="machine-card__topline">
                  {getMachineBadges(machine).map((badge) => (
                    <span
                      className={`machine-card__status machine-card__status--${badge.type}${badge.label === 'Vendido' ? ' machine-card__status--sold' : ''}`}
                      key={`${badge.type}-${badge.label}`}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>

                <div className="machine-card__content">
                  <h2>{machine.nombre}</h2>
                  <p>{machine.descripcionCorta}</p>
                </div>

                <div className="machine-card__details">
                  <span className={`availability${!isAvailableMachine(machine) ? ' availability--sold' : ''}`}>
                    {getMachineAvailabilityLabel(machine)}
                  </span>
                </div>

                <Button
                  href={`/maquinarias/${encodeURIComponent(getMachineSlug(machine))}`}
                  variant="primary"
                  className="machine-card__button"
                >
                  Ver detalle
                </Button>
              </article>
            ))}
          </div>

          {filteredMachines.length === 0 ? (
            <p className="status-message machines-empty">
              No se encontraron maquinarias con ese nombre o categoría.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

export default MachinesPage;
