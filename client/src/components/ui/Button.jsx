function Button({ children, href = '#catalogo', variant = 'primary', className = '', ...props }) {
  return (
    <a className={`button button--${variant} ${className}`.trim()} href={href} {...props}>
      {children}
    </a>
  );
}

export default Button;
