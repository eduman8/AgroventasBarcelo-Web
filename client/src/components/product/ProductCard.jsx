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
        <span>{product.category.slice(0, 1)}</span>
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
