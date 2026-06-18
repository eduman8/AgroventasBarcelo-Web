import Button from '../components/ui/Button.jsx';

const services = [
  {
    icon: '🚜',
    title: 'Venta de maquinaria',
    description:
      'Maquinaria agrícola seleccionada para responder a las necesidades reales de cada productor y tipo de trabajo.',
    benefits: [
      'Asesoramiento según la labor',
      'Opciones para distintas escalas',
      'Acompañamiento en la elección'
    ],
    action: 'Ver maquinarias',
    href: '/maquinarias'
  },
  {
    icon: '◎',
    title: 'Venta de repuestos',
    description:
      'Repuestos agrícolas para mantener los equipos operativos y reducir tiempos de parada en plena campaña.',
    benefits: [
      'Búsqueda simple y ordenada',
      'Consulta personalizada',
      'Soluciones para mantenimiento'
    ],
    action: 'Buscar repuestos',
    href: '/repuestos'
  },
  {
    icon: '☏',
    title: 'Servicio postventa',
    description:
      'Asistencia técnica y seguimiento para acompañar el rendimiento de la maquinaria después de la compra.',
    benefits: [
      'Soporte especializado',
      'Orientación técnica',
      'Respuesta cercana'
    ],
    action: 'Consultar postventa',
    href: '/contacto?servicio=postventa'
  },
  {
    icon: '⚙',
    title: 'Mecanizado CNC',
    description:
      'Fabricación y mecanizado de piezas con precisión para resolver necesidades específicas del sector agropecuario.',
    benefits: [
      'Piezas a medida',
      'Terminación precisa',
      'Soluciones para reparaciones'
    ],
    action: 'Consultar mecanizado',
    href: '/contacto?servicio=mecanizado-cnc'
  }
];

function ServicesPage() {
  return (
    <section className="services-page" aria-labelledby="services-title">
      <div className="services-hero">
        <p className="eyebrow">Soluciones AgroBarceló</p>
        <h1 id="services-title">Servicios para acompañar el trabajo del campo</h1>
        <p>
          AgroBarceló combina venta de maquinaria, repuestos, asistencia técnica y mecanizado para
          brindar soluciones concretas al sector agropecuario.
        </p>
      </div>

      <div className="services-grid">
        {services.map((service) => (
          <article className="service-card" key={service.title}>
            <span className="service-card__icon" aria-hidden="true">
              {service.icon}
            </span>
            <div className="service-card__content">
              <h2>{service.title}</h2>
              <p>{service.description}</p>
              <ul className="service-card__benefits" aria-label={`Beneficios de ${service.title}`}>
                {service.benefits.map((benefit) => (
                  <li key={benefit}>{benefit}</li>
                ))}
              </ul>
            </div>
            <Button href={service.href} variant="primary" className="service-card__button">
              {service.action}
            </Button>
          </article>
        ))}
      </div>

      <div className="services-cta" aria-labelledby="services-cta-title">
        <div>
          <p className="eyebrow">Asesoramiento</p>
          <h2 id="services-cta-title">¿Necesitás asesoramiento?</h2>
          <p>Contanos qué necesitás y te orientamos con la mejor solución disponible.</p>
        </div>
        <Button href="/contacto" variant="primary" className="services-cta__button">
          Contactar ahora
        </Button>
      </div>
    </section>
  );
}

export default ServicesPage;
