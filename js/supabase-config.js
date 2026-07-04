/*
 * Conexion a la base compartida (Supabase).
 *
 * SIN esta configuracion la app funciona en MODO LOCAL: todo se guarda en el
 * dispositivo, igual que hasta ahora. Para activar el modo compartido (varios
 * dispositivos viendo los mismos datos en tiempo real + agente de WhatsApp):
 *
 *   1. Crear el proyecto en https://supabase.com (gratis).
 *   2. Ejecutar supabase/esquema.sql en el SQL Editor del proyecto.
 *   3. Copiar de Settings → API la "Project URL" y la llave "anon public",
 *      y pegarlas aqui:
 *
 *      window.SUPABASE_CONFIG = {
 *        url: 'https://TU-PROYECTO.supabase.co',
 *        anonKey: 'eyJ...',
 *      };
 *
 * La llave anon es publica por diseño (el acceso real lo controlan las
 * politicas de la base). Aun asi, en fase 2 se restringe por usuario/rol.
 */
'use strict';

window.SUPABASE_CONFIG = null;
