# Minis by Mónica — Sistema de ventas y reparto en tiempo real

Piloto desarrollado por **The Trust for the Americas** dentro de su programa de consultoría de
IA para PyMEs. Es la solución que la empresa priorizó: sustituir la digitación manual del Excel
de despacho y las fotos de inventario en WhatsApp por un solo sistema con visibilidad en tiempo
real del inventario en consignación — y de su valor en dinero.

## Qué resuelve

| Situación de partida | Cómo lo resuelve la herramienta |
| --- | --- |
| **Despacho diario manual** (~1 h 30 min digitando ventas de 18 productos en 28 tiendas) | **Componente A — Motor de despacho:** el reporte de ventas se pega desde Excel o se sube como CSV; el sistema lo lee, calcula cuánto reponer por tienda y genera la relación de despacho por chofer y la hoja de producción, listas para imprimir. |
| **Inventario en tienda incompleto** (se contaba solo una parte de los productos) | **Componente B — Visita de chofer:** formulario móvil que **no permite cerrar la visita hasta contar los 13 productos** (el 0 hay que digitarlo). Cada visita queda registrada con fecha y hora. |
| **Fotos en grupos de WhatsApp que se borran** | Todo el historial (ventas, visitas, despachos) queda guardado y se exporta a CSV o respaldo JSON en la pestaña **Datos**. |
| **Sin visibilidad del stock por tienda** | El **Panel** estima el stock por tienda en tiempo real (último conteo + despachos − ventas) y lo valora en RD$. |

## Cómo usarlo

Es una aplicación web sin servidor: **abrir `index.html` en cualquier navegador** (computadora
o teléfono). También puede publicarse tal cual en GitHub Pages para que los choferes la abran
desde un enlace.

Al abrirlo por primera vez aparece una **guía de bienvenida** con la opción de cargar
**datos de demostración** (un día de operación inventado) para explorar la herramienta con un
clic — ideal para la demo de la Sesión 2. La pestaña **❓ Ayuda** explica el día a día en
lenguaje simple. Cuando se vaya a operar de verdad: **Datos → Reiniciar**.

Flujo diario:

1. **Configuración** (solo la primera vez): cargar los productos reales con precio y nivel par,
   las 28 tiendas con su ruta/chofer, y los choferes. El sistema viene con datos de **ejemplo**
   ilustrativos — reemplazarlos antes de operar.
2. **Despacho → Cargar ventas del día**: pegar el reporte desde Excel (matriz tiendas ×
   productos), subir un CSV (hay un ejemplo en `ejemplos/ventas-ejemplo.csv`) o digitar manualmente.
3. **Despacho → Calcular**: revisar/ajustar las cantidades sugeridas y confirmar. Se imprimen las
   hojas de reparto por chofer y la hoja de producción para cocina.
4. **Visita de tienda** (el chofer, en su teléfono): elegir su ruta, iniciar la visita, contar los
   13 productos y cerrar. El Panel se actualiza al momento.

### Lógica de cálculo del despacho

- Si la tienda tiene conteo de chofer y el producto tiene nivel par: se repone hasta el **nivel
  par** (`sugerido = par − stock estimado`).
- Si no hay conteo: se **repone lo vendido**, el mismo criterio del Excel actual.
- Toda cantidad es editable antes de confirmar.

## Arquitectura: modo local y modo compartido

```
Chofer (WhatsApp) ──► n8n + Claude ──► Supabase ◄──► App (panel, despacho, visitas)
                     agente-choferes/   base común        esta misma página
```

- **Modo local (por defecto):** sin configurar nada, los datos viven en el dispositivo
  (localStorage) con respaldo/restauración JSON desde la pestaña Datos.
- **Modo compartido:** al crear un proyecto gratuito de Supabase, ejecutar
  `supabase/esquema.sql` y completar `js/supabase-config.js`, todos los dispositivos ven los
  mismos datos **en tiempo real** (un conteo cerrado en tienda aparece al instante en el panel
  de la oficina). La app sigue funcionando sin señal y sincroniza al volver la conexión.
- **Agente de WhatsApp para choferes:** en `agente-choferes/` está el workflow de n8n con
  Claude que captura las visitas conversando por WhatsApp y escribe a la misma base — misma
  regla de los 13 productos. Ver su README para montarlo.

## Alcance del piloto y siguiente fase

- **Integración con Odoo:** la base compartida es el punto de enchufe natural para el puente
  Odoo↔sistema acordado en la llamada (n8n lee/escribe ambos lados).
- **Importación de ventas:** acepta matriz (tiendas × productos) y formato largo
  (`tienda,producto,cantidad`), con nombres tolerantes a acentos y coincidencias parciales.
  El alcance final del Componente A se valida cuando se reciba un **reporte de ventas real de
  muestra** (próximo paso 2 del informe).
- Los datos de ejemplo (productos, precios, tiendas, rutas) son ilustrativos y editables.

## Estructura del código

```
index.html          Punto de entrada (sin build, sin dependencias)
css/styles.css      Estilos (móvil primero) + hojas de impresión
js/util.js          Utilidades (fechas, moneda, CSV, normalización de nombres)
js/seed.js          Datos de ejemplo (18 productos, 28 tiendas, 4 rutas)
js/store.js         Capa de datos y cálculos (stock estimado, despacho sugerido)
js/despacho.js      Componente A — importación de ventas y motor de despacho
js/visitas.js       Componente B — visita de chofer con conteo obligatorio
js/panel.js         Panel de visibilidad (stock y valor RD$ por tienda)
js/config.js        Catálogos: productos, tiendas/rutas, choferes, niveles par
js/datos.js         Respaldos JSON y exportación CSV
js/ayuda.js         Guía del día a día y preguntas frecuentes
js/sync.js          Sincronización con la base compartida (Supabase, opcional)
js/supabase-config.js  Credenciales del proyecto Supabase (vacío = modo local)
supabase/esquema.sql   Esquema de la base compartida + datos semilla
agente-choferes/    Agente de WhatsApp para choferes (n8n + Claude)
sw.js               Copia sin conexión (solo activa cuando la app está publicada)
manifest.webmanifest / icono.svg   Instalable en el teléfono del chofer (PWA)
ejemplos/           Reporte de ventas de ejemplo para probar la importación
pruebas/smoke.js    Prueba de humo end-to-end (npm i playwright-core && node pruebas/smoke.js)
```
