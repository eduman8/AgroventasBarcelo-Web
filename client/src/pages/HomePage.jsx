import Button from '../components/ui/Button.jsx';
import Hero from '../components/home/Hero.jsx';

const advantages = [
  {
    title: 'Atención personalizada',
    description: 'Te orientamos según tu equipo, tu necesidad y la disponibilidad actual.'
  },
  {
    title: 'Soluciones para el agro',
    description: 'Integramos repuestos, maquinarias, servicios postventa y mecanizado CNC.'
  },
  {
    title: 'Repuestos y servicios confiables',
    description: 'Acompañamos el trabajo diario con respuestas claras y soporte cercano.'
  }
];

function HomePage() {
  return (
    <>
      <Hero />
      <section className="section home-advantages" aria-labelledby="home-advantages-title">
        <div className="section-heading">
          <p className="eyebrow">Por qué elegir AgroBarceló</p>
          <h2 id="home-advantages-title">Acompañamiento práctico para tu actividad</h2>
        </div>

        <div className="home-advantages__grid">
          {advantages.map((advantage) => (
            <article className="home-advantage-card" key={advantage.title}>
              <span className="home-advantage-card__marker" aria-hidden="true" />
              <h3>{advantage.title}</h3>
              <p>{advantage.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section home-cta" aria-labelledby="home-cta-title">
        <div>
          <p className="eyebrow">Consulta personalizada</p>
          <h2 id="home-cta-title">¿Necesitás ayuda para encontrar un repuesto o una maquinaria?</h2>
          <p>Contactanos y te orientamos con la mejor opción disponible.</p>
        </div>
        <Button href="/contacto" className="home-cta__button">
          Consultar ahora
        </Button>
      </section>
    </>
  );
}

export default HomePage;
