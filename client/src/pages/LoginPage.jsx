import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

function LoginPage() {
  const { isAuthenticated, signIn, user } = useAuth();
  const [formValues, setFormValues] = useState({ email: '', password: '' });
  const [formStatus, setFormStatus] = useState('idle');
  const [notice, setNotice] = useState('');

  function handleFieldChange(event) {
    const { name, value } = event.target;
    setFormValues((currentValues) => ({ ...currentValues, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormStatus('sending');
    setNotice('');

    try {
      await signIn(formValues);
      setFormStatus('success');
      setNotice('Sesión iniciada correctamente.');
    } catch (error) {
      setFormStatus('error');
      setNotice(error.message || 'No se pudo iniciar sesión.');
    }
  }

  return (
    <section className="login-page" aria-labelledby="login-title">
      <div className="login-card">
        <p className="eyebrow">Acceso clientes</p>
        <h1 id="login-title">Iniciar sesión</h1>
        <p>Ingresá con el email y la contraseña registrados en tu solicitud aprobada.</p>

        {isAuthenticated ? (
          <p className="contact-form__notice contact-form__notice--success" aria-live="polite">
            Sesión activa como {user?.nombre || user?.email}.
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
