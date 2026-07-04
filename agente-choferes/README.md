# Agente de choferes por WhatsApp

Los choferes ya reportan por WhatsApp; este agente convierte esa costumbre en
datos estructurados. El chofer conversa ("llegué al Bravo de la Núñez... leche
en corte 4, coco 2, majarete no queda"), Claude estructura el texto libre,
**no cierra la visita hasta tener los 13 productos** —la misma regla que la
app— y escribe todo a la base compartida de Supabase, de donde el panel de la
oficina se actualiza al instante.

```
Chofer (WhatsApp) ──► n8n + Claude ──► Supabase ──► Panel de la app (en vivo)
```

## Contenido

| Archivo | Qué es |
| --- | --- |
| `workflow-n8n.json` | Workflow completo listo para importar en n8n |
| `prompt-sistema.md` | El prompt del agente, legible y editable |

## Cómo montarlo

1. **Supabase primero:** crear el proyecto y ejecutar `../supabase/esquema.sql`
   (crea las tablas, la función `registrar_visita_agente` y el tiempo real).
2. **En n8n** (cloud o self-hosted): *Workflows → Import from file* →
   `workflow-n8n.json`.
3. **Variables de entorno** que el workflow espera (en n8n: *Settings →
   Environments*, o variables del contenedor):
   - `SUPABASE_URL` — ej. `https://tuproyecto.supabase.co`
   - `SUPABASE_ANON_KEY` — llave *anon public* del proyecto
   - `ANTHROPIC_API_KEY` — llave de la API de Claude (console.anthropic.com)
4. **Activar el workflow** y probar sin WhatsApp con un `curl` (o el chat
   simulador de n8n):

   ```bash
   curl -X POST https://TU-N8N/webhook/agente-choferes \
     -H 'Content-Type: application/json' \
     -d '{"telefono": "+18091234567", "mensaje": "Llegué a Bravo Santiago"}'
   ```

   La respuesta es `{"respuesta": "..."}` — el mensaje que vería el chofer.
   La conversación mantiene memoria por teléfono (tabla `agente_sesiones`).

## Pasar a WhatsApp de verdad

El nodo **Webhook** es la única pieza provisional. Cuando llegue el acceso a
WhatsApp Cloud API (Meta):

1. Sustituir el nodo Webhook por el trigger de WhatsApp (o apuntar el webhook
   de Meta a esta misma URL) y mapear sus campos a lo que el workflow espera:
   `telefono` (el `wa_id` del remitente) y `mensaje` (el texto).
2. Añadir al final un nodo que envíe `respuesta` de vuelta por la API de
   WhatsApp (Send Message) en lugar de responder al webhook.

Nada más del workflow cambia: la lógica, el prompt y las escrituras a la base
quedan igual.

## Detalles de diseño

- **La regla de los 13 se valida dos veces:** el prompt la impone en la
  conversación y la acción `guardar_visita` solo se emite con el checklist
  completo y la confirmación del chofer. La escritura es atómica (función SQL
  `registrar_visita_agente`): visita + conteos + alertas en una transacción.
- **Alertas:** si un producto queda por debajo de la mitad de su nivel par, el
  agente inserta una fila en `alertas`. Enviar esa alerta a Mónica por WhatsApp
  es un workflow aparte de una sola línea (trigger de Supabase o polling) que
  se añade cuando esté el canal de salida.
- **Memoria:** últimos 30 turnos por teléfono en `agente_sesiones.estado`.
- **Modelo:** `claude-sonnet-5` — suficiente para estructurar texto libre y
  seguir el flujo; se cambia en el nodo *Claude* si se quiere otro.
