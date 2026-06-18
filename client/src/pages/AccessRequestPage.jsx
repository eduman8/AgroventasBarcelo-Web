import { useState } from 'react';
import { createAccessRequest } from '../services/accessRequestsService.js';

const initialFormValues = {
  nombre: '',
  email: '',
  telefono: '',
  empresa: '',
  cuit: '',
  localidad: '',
  cargo: '',
  password: ''
};

function AccessRequestPage() {
  const [formValues, setFormValues] = useState(initialFormValues);
  const [formStatus, setFormStatus] = useState('idle');
  const [notice, setNotice] = useState('');

  function handleFieldChange(event) {
    const { name, value } = event.target;

    setFormValues((currentValues) => ({
      ...currentValues,
      [name]: value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormStatus('sending');
    setNotice('');

    try {
      await createAccessRequest(formValues);
      setFormStatus('success');
      setNotice('Solicitud enviada correctamente. AgroBarceló revisará tus datos y se pondrá en contacto.');
      setFormValues(initialFormValues);
    } catch (error) {
      setFormStatus('error');
      setNotice(error.message || 'No se pudo enviar la solicitud. Intentá nuevamente.');
    }
  }

  return (
    <section className="access-request-page" aria-labelledby="access-request-title">
      <div className="access-request-hero">
        <p className="eyebrow">Catálogo de repuestos</p>
        <h1 id="access-request-title">Solicitar acceso</h1>
        <p>
          Completá tus datos para que AgroBarceló revise tu solicitud y pueda habilitarte el acceso al
          catálogo de repuestos cuando esté disponible para clientes aprobados.
        </p>
      </div>

      <div className="access-request-layout">
        <form className="contact-form access-request-form" onSubmit={handleSubmit}>
          <div className="contact-form__heading">
            <p className="eyebrow">Datos del cliente</p>
            <h2>Formulario de solicitud</h2>
            <p>Los campos marcados son necesarios para evaluar el alta comercial.</p>
          </div>

          <div className="contact-form__grid">
            <label>
              Nombre *
              <input
                name="nombre"
                type="text"
                value={formValues.nombre}
                placeholder="Nombre y apellido"
                required
                onChange={handleFieldChange}
              />
            </label>
            <label>
              Email *
              <input
                name="email"
                type="email"
                value={formValues.email}
                placeholder="tu@email.com"
                required
                onChange={handleFieldChange}
              />
            </label>
            <label>
              Teléfono *
              <input
                name="telefono"
                type="tel"
                value={formValues.telefono}
                placeholder="Tu teléfono"
                required
                onChange={handleFieldChange}
              />
            </label>
            <label>
              Empresa *
              <input
                name="empresa"
                type="text"
                value={formValues.empresa}
                placeholder="Nombre de la empresa"
                required
                onChange={handleFieldChange}
              />
            </label>
            <label>
              CUIT *
              <input
                name="cuit"
                type="text"
                value={formValues.cuit}
                placeholder="Ej: 30-12345678-9"
                required
                onChange={handleFieldChange}
              />
            </label>
            <label>
              Localidad *
              <input
                name="localidad"
                type="text"
                value={formValues.localidad}
                placeholder="Localidad / Provincia"
                required
                onChange={handleFieldChange}
              />
            </label>
            <label>
              Contraseña *
              <input
                name="password"
                type="password"
                value={formValues.password}
                placeholder="Mínimo 8 caracteres"
                minLength="8"
                autoComplete="new-password"
                required
                onChange={handleFieldChange}
              />
            </label>
            <label>
              Cargo
              <input
                name="cargo"
                type="text"
                value={formValues.cargo}
                placeholder="Ej: Compras, titular, encargado"
                onChange={handleFieldChange}
              />
            </label>
          </div>

          <button className="button button--primary contact-form__submit" type="submit" disabled={formStatus === 'sending'}>
            {formStatus === 'sending' ? 'Enviando solicitud...' : 'Enviar solicitud'}
          </button>

          {notice ? (
            <p className={`contact-form__notice contact-form__notice--${formStatus}`} aria-live="polite">
              {notice}
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}

export default AccessRequestPage;
