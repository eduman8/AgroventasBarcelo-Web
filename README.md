# AgroVentas Barceló

Plataforma full-stack para AgroVentas Barceló, construida con React + Vite en el cliente y Node.js + Express en la API. El sistema publica maquinaria, repuestos, servicios y formularios de consulta, e incluye paneles administrativos protegidos para gestión operativa.

## Stack

* **Frontend:** React, Vite, JavaScript.
* **Backend:** Node.js, Express.
* **Base de datos:** Microsoft SQL Server mediante `mssql`.
* **Integraciones:** SMTP para consultas por email y WhatsApp para contacto comercial.

## Estructura

```text
client/   Aplicación web React + Vite
api/      API Express, controladores, rutas, servicios y scripts SQL Server
```

## Requisitos

* Node.js compatible con los paquetes del repositorio.
* npm con soporte de workspaces.
* SQL Server accesible desde la API.
* Credenciales SMTP si se enviarán consultas por correo.

## Configuración local

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Crear variables de entorno:

   ```bash
   cp api/.env.example api/.env
   cp client/.env.example client/.env
   ```

3. Completar `api/.env` con los datos reales de SQL Server, JWT y SMTP.

4. Ejecutar en desarrollo:

   ```bash
   npm run dev
   ```

También se puede iniciar cada workspace por separado:

```bash
npm run dev:client
npm run dev:api
```

## Variables de entorno principales de la API

Ver `api/.env.example` para el listado completo. En producción son obligatorias como mínimo:

* `NODE_ENV=production`
* `CLIENT_ORIGIN` con el dominio real del frontend. Acepta múltiples orígenes separados por coma.
* `JWT_SECRET` con al menos 32 caracteres.
* `DB_SERVER`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD`.

La API valida variables críticas al iniciar en producción para fallar temprano ante configuración insegura o incompleta.

## Seguridad HTTP aplicada

La API incluye hardening mínimo sin cambiar la arquitectura existente:

* CORS restringido por `CLIENT_ORIGIN`.
* `express.json()` con límite configurable mediante `JSON_BODY_LIMIT_KB`.
* Rate limiting global para `/api` y límite más estricto para `/api/auth/login`.
* Encabezados de seguridad equivalentes a Helmet para `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, políticas cross-origin y HSTS cuando la petición llega por HTTPS.
* Middleware global de 404 y errores para respuestas JSON consistentes.
* `X-Powered-By` deshabilitado.

> Nota: `helmet` y `express-rate-limit` fueron evaluados como dependencias recomendadas, pero el entorno de instalación bloqueó el acceso al registro npm. Por estabilidad, se implementó el hardening equivalente de forma local y sin introducir cambios de arquitectura.

## Build y producción

Generar el build del frontend:

```bash
npm run build
```

Iniciar la API en producción:

```bash
NODE_ENV=production npm run start:api
```

### Checklist de deploy

1. Configurar variables de `api/.env.example` en el proveedor de hosting/servidor.
2. Usar `NODE_ENV=production`.
3. Definir `CLIENT_ORIGIN` con el dominio público del frontend.
4. Usar un `JWT_SECRET` fuerte y privado.
5. Confirmar conectividad de SQL Server desde el servidor de API.
6. Configurar SMTP si se enviarán emails desde el formulario de contacto.
7. Ejecutar `npm run build` antes de publicar el cliente.
8. Servir `client/dist` desde hosting estático o CDN y ejecutar la API Node detrás de proxy HTTPS.

## Scripts útiles

```bash
npm run build
npm run start:api
npm run dev:client
npm run dev:api
npm run audit:catalog --workspace api
npm run audit:catalog-exact-duplicates --workspace api
```

## Reglas de negocio

* Los precios de maquinaria no se muestran públicamente.
* Los precios de repuestos permanecen ocultos para clientes.
* No se exponen cantidades exactas de stock.
* La disponibilidad pública se muestra de forma simplificada.
* Las consultas se gestionan directamente por AgroVentas Barceló.
* Las imágenes de maquinaria y manuales visuales se administran desde paneles internos.

## Estado

Listo para validación final de producción, manteniendo la arquitectura existente y priorizando estabilidad sobre refactors amplios.
