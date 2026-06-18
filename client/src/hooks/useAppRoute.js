import { useEffect, useMemo, useState } from 'react';
import { fallbackRoute, routes } from '../config/routes.jsx';

function normalizePath(pathname) {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname || '/';
}

function matchRoute(pathname) {
  const currentPath = normalizePath(pathname);

  if (routes[currentPath]) {
    return {
      currentPath,
      Page: routes[currentPath],
      routeParams: {}
    };
  }

  for (const [routePattern, Page] of Object.entries(routes)) {
    const routeParts = routePattern.split('/').filter(Boolean);
    const pathParts = currentPath.split('/').filter(Boolean);

    if (routeParts.length !== pathParts.length) {
      continue;
    }

    const routeParams = {};
    const isMatch = routeParts.every((routePart, index) => {
      if (routePart.startsWith(':')) {
        routeParams[routePart.slice(1)] = decodeURIComponent(pathParts[index]);
        return true;
      }

      return routePart === pathParts[index];
    });

    if (isMatch) {
      return { currentPath, Page, routeParams };
    }
  }

  return {
    currentPath,
    Page: fallbackRoute,
    routeParams: {}
  };
}

export function useAppRoute() {
  const [currentLocation, setCurrentLocation] = useState(() => ({
    pathname: normalizePath(window.location.pathname),
    search: window.location.search
  }));
  const currentPath = currentLocation.pathname;

  useEffect(() => {
    function handleNavigation(event) {
      if (!(event.target instanceof Element)) {
        return;
      }

      const link = event.target.closest('a');

      if (!link || link.target || link.origin !== window.location.origin) {
        return;
      }

      const nextPath = normalizePath(link.pathname);
      const nextRoute = matchRoute(nextPath);

      if (link.hash && nextPath === currentPath && link.search === window.location.search) {
        return;
      }

      if (nextRoute.Page === fallbackRoute && !routes[nextPath]) {
        return;
      }

      event.preventDefault();
      window.history.pushState({}, '', `${nextPath}${link.search}${link.hash}`);
      setCurrentLocation({ pathname: nextPath, search: link.search });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function handlePopState() {
      setCurrentLocation({
        pathname: normalizePath(window.location.pathname),
        search: window.location.search
      });
    }

    document.addEventListener('click', handleNavigation);
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('click', handleNavigation);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentPath]);

  const route = useMemo(() => matchRoute(currentPath), [currentPath, currentLocation.search]);

  return route;
}
