function CatalogAccessRequired() {
  return (
    <div className="catalog-access-required" role="status">
      <p>Debe iniciar sesión para acceder al catálogo de repuestos.</p>
      <a className="button button--primary" href="/login">
        Iniciar sesión
      </a>
      <a className="button button--secondary" href="/solicitar-acceso">
        Solicitar acceso
      </a>
    </div>
  );
}

export default CatalogAccessRequired;
