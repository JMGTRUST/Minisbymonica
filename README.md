# Minis by Mónica — Portales de operaciones

Primera versión autenticada del sistema de despacho e inventario en consignación.
Una misma aplicación muestra una experiencia distinta según la cuenta:

- **Administración (`/admin`)**: resumen operativo, valor de mercancía, ventas,
  alertas y seguimiento de todas las rutas.
- **Chofer (`/chofer`)**: únicamente su ruta asignada, sus tiendas y el flujo de
  visitas. No ve precios, ventas, configuración ni rutas de otros choferes.

## Estado de esta versión

Esta entrega valida el acceso por roles y el diseño de ambos portales. Usa dos
cuentas configuradas mediante variables de entorno y datos visuales de
demostración. La siguiente fase conectará las pantallas a Render Postgres para
guardar usuarios, rutas, visitas, conteos, ventas y despachos reales.

La sesión se firma en el servidor y se guarda en una cookie `HttpOnly`, `SameSite=Lax`
y `Secure` en producción. Las páginas vuelven a validar el rol en el servidor:
escribir manualmente `/admin` o `/chofer` no permite saltarse los permisos.

## Desarrollo local

Requiere Node.js 20.9 o posterior.

```bash
cp .env.example .env.local
npm ci
npx playwright install chromium
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `SESSION_SECRET` | Secreto aleatorio de al menos 32 caracteres para firmar sesiones |
| `ADMIN_EMAIL` | Correo de la cuenta administrativa inicial |
| `ADMIN_PASSWORD` | Contraseña fuerte de administración |
| `CHOFER_EMAIL` | Correo del chofer piloto |
| `CHOFER_PASSWORD` | Contraseña fuerte del chofer piloto |
| `CHOFER_NAME` | Nombre visible del chofer |

Nunca guardes contraseñas reales en Git. Configúralas como secretos en Render.

## Publicar en Render

El repositorio incluye [`render.yaml`](render.yaml). En Render:

1. Crea un **Blueprint** desde este repositorio.
2. Render detectará el Web Service `minis-by-monica`.
3. Introduce los cuatro valores marcados como secretos:
   `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CHOFER_EMAIL` y `CHOFER_PASSWORD`.
4. `SESSION_SECRET` se genera automáticamente.
5. Despliega y abre la URL `onrender.com` asignada.

El endpoint `/api/health` permite que Render compruebe el estado del servicio.

## Verificación

```bash
npm run lint
npm run build
npm test
npm audit
```

Las pruebas de Playwright cubren escritorio y móvil:

- rechazo de credenciales incorrectas;
- acceso del administrador a `/admin`;
- acceso del chofer a `/chofer`;
- redirección cuando un rol intenta abrir el portal del otro.

## Piloto estático anterior

Los archivos estáticos de la prueba original (`index.html`, `js/`, `css/` y
`sw.js`) permanecen temporalmente en el repositorio como referencia para migrar
la lógica de inventario y despacho. Next.js no los publica ni los utiliza.
