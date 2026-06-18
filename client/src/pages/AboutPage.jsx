import Button from '../components/ui/Button.jsx';

const businessAreas = [
  {
    title: 'Venta de repuestos',
    text: 'Asesoramos en la búsqueda de repuestos agrícolas para mantener cada equipo operativo y reducir tiempos de parada.'
  },
  {
    title: 'Venta de maquinaria',
    text: 'Acompañamos la elección de maquinaria acorde a las necesidades del productor, contratista o establecimiento.'
  },
  {
    title: 'Servicio postventa',
    text: 'Brindamos seguimiento y soporte técnico para que cada solución continúe funcionando en el trabajo diario.'
  },
  {
    title: 'Mecanizado CNC',
    text: 'Desarrollamos piezas y trabajos especiales con precisión para responder a necesidades concretas del sector.'
  }
];

const advantages = [
  'Atención personalizada',
  'Conocimiento del sector agropecuario',
  'Repuestos y soluciones confiables',
  'Acompañamiento antes y después de la venta'
];

function AboutPage() {
  return (
    <section className="about-page" aria-labelledby="about-title">
      <div className="about-hero">
        <p className="eyebrow">Empresa local</p>
        <h1 id="about-title">Acerca de AgroBarceló</h1>
        <p>
          Desde Armstrong, Santa Fe, acompañamos al sector agropecuario con repuestos,
          maquinarias y servicios especializados.
        </p>
      </div>

      <div className="about-story">
        <div>
          <p className="eyebrow">Nuestra historia</p>
          <h2>Nuestra historia</h2>
        </div>
        <p>
          AgroBarceló nace con el objetivo de brindar soluciones concretas al productor
          agropecuario, combinando experiencia, atención cercana y conocimiento del trabajo rural.
        </p>
      </div>

      <section className="about-section" aria-labelledby="about-work-title">
        <div className="about-section__heading">
          <p className="eyebrow">Qué hacemos</p>
          <h2 id="about-work-title">Soluciones para el trabajo agropecuario</h2>
        </div>
        <div className="about-grid about-grid--work">
          {businessAreas.map((area) => (
            <article className="about-card" key={area.title}>
              <span className="about-card__marker" aria-hidden="true" />
              <div>
                <h3>{area.title}</h3>
                <p>{area.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section about-section--split" aria-labelledby="about-why-title">
        <div
          className="about-visual-placeholder"
          aria-label="Espacio reservado para futuras imágenes reales"
        >
          <span>Fotos reales de AgroBarceló próximamente</span>
        </div>

        <div className="about-advantages">
          <p className="eyebrow">Por qué elegir AgroBarceló</p>
          <h2 id="about-why-title">Cercanía, experiencia y respuesta confiable</h2>
          <ul className="about-advantages__list">
            {advantages.map((advantage) => (
              <li key={advantage}>{advantage}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="about-cta" aria-labelledby="about-cta-title">
        <div>
          <p className="eyebrow">Hablemos</p>
          <h2 id="about-cta-title">¿Querés conocer más sobre nuestras soluciones?</h2>
          <p>
            Contactanos y te ayudamos a encontrar la mejor opción para tu maquinaria o
            establecimiento.
          </p>
        </div>
        <Button href="/contacto" variant="primary" className="about-cta__button">
          Contactar ahora
        </Button>
      </section>
    </section>
  );
}

export default AboutPage;
