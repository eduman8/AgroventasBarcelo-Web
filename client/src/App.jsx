import Footer from './components/layout/Footer.jsx';
import Header from './components/layout/Header.jsx';
import { useAppRoute } from './hooks/useAppRoute.js';

function App() {
  const { currentPath, Page, routeParams } = useAppRoute();
  const isAdminRoute = currentPath === '/admin' || currentPath.startsWith('/admin/');

  if (isAdminRoute) {
    return <Page currentPath={currentPath} routeParams={routeParams} />;
  }

  return (
    <>
      <Header currentPath={currentPath} />
      <main className="page">
        <Page currentPath={currentPath} routeParams={routeParams} />
      </main>
      <Footer currentPath={currentPath} />
    </>
  );
}

export default App;
