const categoryIcons = {
  repuestos: (
    <svg viewBox="0 0 64 64" focusable="false" aria-hidden="true">
      <circle cx="32" cy="32" r="23" />
      <circle cx="32" cy="32" r="9" />
      <path d="M32 9v10M32 45v10M9 32h10M45 32h10M15.7 15.7l7.1 7.1M41.2 41.2l7.1 7.1M48.3 15.7l-7.1 7.1M22.8 41.2l-7.1 7.1" />
    </svg>
  ),
  maquinarias: (
    <svg viewBox="0 0 64 64" focusable="false" aria-hidden="true">
      <path d="M11 42h6l4-15h15l4 15h8l-4-10h7l5 10h2" />
      <path d="M23 27l3-9h9l1 9M12 42h46" />
      <circle cx="21" cy="45" r="8" />
      <circle cx="48" cy="45" r="6" />
      <circle cx="21" cy="45" r="3" />
      <circle cx="48" cy="45" r="2" />
    </svg>
  )
};

function ProductCard({ product }) {
  const categoryClassName = product.category
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return (
    <article className={`product-card product-card--${categoryClassName}`}>
      <div className="product-card__image" aria-hidden="true">
        <span>{categoryIcons[categoryClassName] || product.category.slice(0, 1)}</span>
      </div>
      <div className="product-card__body">
        <span className="product-card__category">{product.category}</span>
        <h3>{product.name}</h3>
        <div className="product-card__meta">
          <span className="availability">Disponible</span>
          <strong>Consultar precio</strong>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
