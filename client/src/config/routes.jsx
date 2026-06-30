import HomePage from '../pages/HomePage.jsx';
import AboutPage from '../pages/AboutPage.jsx';
import ContactPage from '../pages/ContactPage.jsx';
import MachinesPage from '../pages/MachinesPage.jsx';
import VisualSparePartsSearchPage from '../pages/VisualSparePartsSearchPage.jsx';
import MachinesDetailPage from '../pages/MachinesDetailPage.jsx';
import ServicesPage from '../pages/ServicesPage.jsx';
import SparePartDetailPage from '../pages/SparePartDetailPage.jsx';
import SparePartsPage from '../pages/SparePartsPage.jsx';
import AdminDashboardPage from '../pages/admin/AdminDashboardPage.jsx';
import AdminConsultasPage from '../pages/admin/AdminConsultasPage.jsx';
import AdminMachinesPage from '../pages/admin/AdminMachinesPage.jsx';
import AdminSettingsPage from '../pages/admin/AdminSettingsPage.jsx';
import AdminVisualSparePartsPage from '../pages/admin/AdminVisualSparePartsPage.jsx';
import AdminUsersPage from '../pages/admin/AdminUsersPage.jsx';
import AdminAccessRequestsPage from '../pages/admin/AdminAccessRequestsPage.jsx';
import AccessRequestPage from '../pages/AccessRequestPage.jsx';
import LoginPage from '../pages/LoginPage.jsx';

export const routes = {
  '/': HomePage,
  '/admin': AdminDashboardPage,
  '/admin/maquinarias': AdminMachinesPage,
  '/admin/usuarios': AdminUsersPage,
  '/admin/consultas': AdminConsultasPage,
  '/admin/solicitudes-acceso': AdminAccessRequestsPage,
  '/admin/configuracion': AdminSettingsPage,
  '/admin/repuestos-visuales': AdminVisualSparePartsPage,
  '/repuestos': SparePartsPage,
  '/buscador-repuestos': VisualSparePartsSearchPage,
  '/buscador-visual-repuestos': VisualSparePartsSearchPage,
  '/repuestos/:id': SparePartDetailPage,
  '/maquinarias': MachinesPage,
  '/maquinarias/:slug': MachinesDetailPage,
  '/servicios': ServicesPage,
  '/acerca-de': AboutPage,
  '/contacto': ContactPage,
  '/solicitar-acceso': AccessRequestPage,
  '/login': LoginPage
};

export const fallbackRoute = HomePage;
