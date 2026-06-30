import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

function getRedirectTarget(isAdmin) {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect');

  if (isAdmin && redirect?.startsWith('/admin')) {
    return redirect;
  }

  return isAdmin ? '/admin' : '/';
}

function navigateTo(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function LoginPage() {
  const { isAdmin, isAuthenticated, signIn, user } = useAuth();
  const [formValues, setFormValues] = useState({ email: '', password: '' });
  const [formStatus, setFormStatus] = useState('idle');
  const [notice, setNotice] = useState('');
  const redirectTarget = useMemo(() => getRedirectTarget(isAdmin), [isAdmin]);

  useEffect(() => {
    if (isAuthenticated && formStatus !== 'sending') {
      navigateTo(redirectTarget);
    }
  }, [formStatus, isAuthenticated, redirectTarget]);

  function handleFieldChange(event) {
    const { name, value } = event.target;
    setFormValues((currentValues) => ({ ...currentValues, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormStatus('sending');
    setNotice('');

    try {
      const nextSession = await signIn(formValues);
      const target = getRedirectTarget(String(nextSession?.rol ?? '').trim().toLowerCase() === 'admin');
      navigateTo(target);
    } catch (error) {
      setFormStatus('error');
      setNotice(error.message || 'No se pudo iniciar sesión.');
    }
  }

  return (
    <section className="login-page" aria-labelledby="login-title">
      <div className="login-card login-card--compact">
        <div className="login-card__header">
          <p className="eyebrow">Acceso clientes</p>
          <h1 id="login-title">Iniciar sesión</h1>
          <p>Ingresá con el email y la contraseña registrados en tu solicitud aprobada.</p>
        </div>

        {isAuthenticated ? (
          <p className="contact-form__notice contact-form__notice--success" aria-live="polite">
            Redirigiendo sesión activa de {user?.nombre || user?.email}...
          </p>
        ) : null}

        <form className="contact-form login-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              name="email"
              type="email"
              value={formValues.email}
              placeholder="tu@email.com"
              autoComplete="email"
              required
              onChange={handleFieldChange}
            />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              value={formValues.password}
              placeholder="Tu contraseña"
              autoComplete="current-password"
              required
              onChange={handleFieldChange}
            />
          </label>
          <button className="button button--primary contact-form__submit" type="submit" disabled={formStatus === 'sending'}>
            {formStatus === 'sending' ? 'Ingresando...' : 'Ingresar'}
          </button>
          {notice ? <p className={`contact-form__notice contact-form__notice--${formStatus}`} aria-live="polite">{notice}</p> : null}
        </form>

        <div className="login-access-request" aria-label="Solicitud de acceso">
          <p>¿Todavía no tenés acceso?</p>
          <a className="button button--secondary" href="/solicitar-acceso">
            Solicitar acceso
          </a>
        </div>
      </div>
    </section>
  );
}

export default LoginPage;
