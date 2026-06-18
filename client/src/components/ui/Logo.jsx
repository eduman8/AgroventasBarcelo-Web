import { useState } from 'react';
import logoSrc from '../../assets/images/agrobarcelo-logo.webp';

function Logo({ className = '', variant = 'header' }) {
  const [hasImageError, setHasImageError] = useState(false);
  const variantClassName = `logo--${variant}`;
  const logoClassName = ['logo', variantClassName, className].filter(Boolean).join(' ');

  if (hasImageError) {
    return <span className={`${logoClassName} logo--fallback`}>AgroVentas Barceló</span>;
  }

  return (
    <img
      className={logoClassName}
      src={logoSrc}
      alt="AgroVentas Barceló"
      loading={variant === 'footer' ? 'lazy' : 'eager'}
      decoding="async"
      onError={() => setHasImageError(true)}
    />
  );
}

export default Logo;
