import { useEffect, useState } from 'react';
import Button from '../components/ui/Button.jsx';
import { getMachineBySlug } from '../services/machinesService.js';
import { getMachineAvailabilityLabel, getMachineCategory, getMachineStatus, isAvailableMachine, isSoldMachine } from '../utils/machines.js';

function getMachineSlug(routeParams) {
  return routeParams?.slug ?? routeParams?.id ?? window.location.pathname.split('/').filter(Boolean).at(-1);
}


function getContactMachineValue(machine) {
  return String(machine?.slug ?? '').trim() || machine?.id;
}

function getDisplayValue(value) {
  return value === null || value === undefined || value === '' ? 'Sin informar' : value;
}

function MachinesDetailPage({ routeParams }) {
  const machineSlug = getMachineSlug(routeParams);
  const [machine, setMachine] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [wasNotFound, setWasNotFound] = useState(false);
  const galleryImages = machine?.galeria ?? [];
  const hasGalleryImages = galleryImages.length > 0;
  const isSold = isSoldMachine(machine);
  const isAvailable = isAvailableMachine(machine);

  useEffect(() => {
    let isMounted = true;

    async function loadMachine() {
      setIsLoading(true);
      setError('');
      setWasNotFound(false);

      try {
        const response = await getMachineBySlug(machineSlug);

        if (!isMounted) {
          return;
        }

        if (!response) {
          setMachine(null);
          setWasNotFound(true);
          return;
        }

        setMachine(response);

        if (response.isFallback) {
          setError('No se pudo conectar con la API real. Se muestra una maquinaria mock temporalmente.');
        }
      } catch (currentError) {
        if (isMounted) {
          setMachine(null);
          setError(currentError.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadMachine();

    return () => {
      isMounted = false;
    };
  }, [machineSlug]);

  return (
    <section className="machine-detail-page" aria-labelledby="machine-detail-title">
      <a className="machine-detail__back" href="/maquinarias">
        ← Volver a maquinarias
      </a>

      {isLoading && <p className="status-message">Cargando detalle de la maquinaria...</p>}
      {error && <p className="status-message status-message--error">{error}</p>}

      {wasNotFound && (
        <div className="machine-detail-card machine-detail-card--empty">
          <p className="eyebrow">Detalle de maquinaria</p>
          <h1 id="machine-detail-title">Maquinaria no encontrada</h1>
          <p>No encontramos una publicación de maquinarias con el identificador solicitado.</p>
          <a className="machine-detail-actions__secondary" href="/maquinarias">
            Volver a maquinarias
          </a>
        </div>
      )}

      {!isLoading && machine && (
        <article className="machine-detail-card">
          <div className="machine-detail-gallery" aria-labelledby="machine-gallery-title">
            <div className="machine-detail-card__media">
              {machine.imagenPrincipal ? (
                <img src={machine.imagenPrincipal} alt={`Imagen principal de ${machine.nombre}`} />
              ) : (
                <div className="machine-detail-media__placeholder" aria-hidden="true">
                  <span>Imagen principal próximamente</span>
                </div>
              )}
            </div>

            <div className="machine-detail-gallery__header">
              <h2 id="machine-gallery-title">Galería de imágenes</h2>
              <p>Espacio preparado para fotos reales y miniaturas de la publicación.</p>
            </div>

            {hasGalleryImages ? (
              <div className="machine-detail-thumbnails" aria-label="Miniaturas de la maquinaria">
                {galleryImages.map((imageSrc, index) => (
                  <button className="machine-detail-thumbnail" key={`${imageSrc}-${index}`} type="button">
                    <img src={imageSrc} alt={`${machine.nombre} - imagen ${index + 1}`} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="machine-detail-gallery__empty" aria-live="polite">
                <span>Galería próximamente</span>
                <p>Esta publicación todavía no tiene imágenes cargadas.</p>
              </div>
            )}
          </div>

          <div className="machine-detail-card__body">
            <div className="machine-detail-card__header">
              <div>
                <p className="eyebrow">Ficha de maquinaria</p>
                <h1 id="machine-detail-title">{machine.nombre}</h1>
              </div>
              <span className={`availability${!isAvailable ? ' availability--sold' : ''}`}>
                {getMachineAvailabilityLabel(machine)}
              </span>
            </div>

            <dl className="machine-detail-list">
              <div>
                <dt>Marca</dt>
                <dd>{getDisplayValue(machine.marca)}</dd>
              </div>
              <div>
                <dt>Categoría</dt>
                <dd>{getMachineCategory(machine)}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{getMachineStatus(machine)}</dd>
              </div>
              <div>
                <dt>Disponibilidad</dt>
                <dd>{getMachineAvailabilityLabel(machine)}</dd>
              </div>
            </dl>

            <div className="machine-detail-description">
              <h2>Descripción larga</h2>
              <p>{machine.descripcionLarga}</p>
            </div>

            {isSold ? (
              <p className="machine-detail-sold-message">
                Trabajo realizado. Esta maquinaria ya fue comercializada. Consúltenos por equipos similares.
              </p>
            ) : null}

            <div className="machine-detail-actions">
              {isAvailable ? (
                <Button href={`/contacto?maquinaria=${encodeURIComponent(getContactMachineValue(machine))}`} variant="primary">
                  Consultar
                </Button>
              ) : null}
              <a className="machine-detail-actions__secondary" href="/maquinarias">
                Volver
              </a>
            </div>
          </div>
        </article>
      )}
    </section>
  );
}

export default MachinesDetailPage;
