import { useEffect, useState } from 'react';
import { defaultSettings, getSettings } from '../../services/settingsService.js';
import Logo from '../ui/Logo.jsx';

function Footer() {
  const [settings, setSettings] = useState(defaultSettings);

  useEffect(() => {
    let isMounted = true;
    getSettings().then((nextSettings) => { if (isMounted) setSettings(nextSettings); });
    return () => { isMounted = false; };
  }, []);

  const whatsappNumber = String(settings.whatsapp ?? '').replace(/\D/g, '');
  const instagramHref = String(settings.instagram ?? '').startsWith('http') ? settings.instagram : `https://www.instagram.com/${String(settings.instagram ?? '').replace('@', '')}`;

  return (
    <footer className="site-footer" id="contacto">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <Logo variant="footer" />
          <p>{settings.textoFooter}</p>
        </div>
        <div className="site-footer__contact-column">
          <h2 className="site-footer__column-title">Contacto</h2>
          <address className="footer-contact">
            <a className="footer-contact__link footer-contact__link--whatsapp" href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer">WhatsApp</a>
            <a className="footer-contact__link footer-contact__link--email" href={`mailto:${settings.emailContacto}`}>{settings.emailContacto}</a>
            <a className="footer-contact__link footer-contact__link--instagram" href={instagramHref} target="_blank" rel="noreferrer">Instagram</a>
            <span className="footer-contact__location">{settings.ubicacion}</span>
          </address>
        </div>
        <div className="site-footer__bottom"><p>© 2025 AgroBarceló. Todos los derechos reservados.</p></div>
      </div>
    </footer>
  );
}

export default Footer;
