/* Navegacion principal de la aplicacion */
'use strict';

const App = {
  vistas: {
    panel: { titulo: '📊 Panel', modulo: () => Panel },
    despacho: { titulo: '🚚 Despacho', modulo: () => Despacho },
    visitas: { titulo: '🏪 Visita de tienda', modulo: () => Visitas },
    config: { titulo: '⚙️ Configuración', modulo: () => Config },
    datos: { titulo: '💾 Datos', modulo: () => Datos },
    ayuda: { titulo: '❓ Ayuda', modulo: () => Ayuda },
  },
  actual: 'panel',

  init() {
    Store.init();
    if (typeof Sync !== 'undefined') Sync.init(); // no bloquea: la app arranca en local y se conecta detras
    // Vuelve a la pestana donde quedo el usuario (el chofer vive en "visitas")
    const ultima = localStorage.getItem('minis_tab');
    if (ultima && this.vistas[ultima]) this.actual = ultima;
    const nav = document.getElementById('nav');
    nav.innerHTML = Object.entries(this.vistas)
      .map(([clave, v]) => `<button class="tab" data-vista="${clave}">${v.titulo}</button>`)
      .join('');
    nav.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => this.ir(b.dataset.vista)));
    this.ir(this.actual);
  },

  ir(clave) {
    this.actual = clave;
    localStorage.setItem('minis_tab', clave);
    document.querySelectorAll('#nav .tab').forEach((b) => b.classList.toggle('activo', b.dataset.vista === clave));
    this.vistas[clave].modulo().render(document.getElementById('vista'));
  },

  /** Indicador de conexion con la base compartida (solo si esta configurada) */
  pintarEstadoSync() {
    const el = document.getElementById('estado-sync');
    if (!el || typeof Sync === 'undefined') return;
    const estados = {
      conectando: ['pill', '⋯ Conectando'],
      enlinea: ['pill pill-ok', '● En línea — datos compartidos'],
      error: ['pill pill-error', '⚠ Sin conexión con la base'],
    };
    const e = estados[Sync.estado];
    el.hidden = !e;
    if (e) {
      el.className = e[0];
      el.textContent = e[1];
    }
  },

  /**
   * Re-dibuja la vista actual cuando llegan cambios de otros dispositivos.
   * Si el usuario esta escribiendo, espera: un re-render le robaria el foco.
   */
  refrescar() {
    const activo = document.activeElement;
    if (activo && (activo.tagName === 'INPUT' || activo.tagName === 'TEXTAREA') && document.getElementById('vista').contains(activo)) {
      clearTimeout(this._timerRefrescar);
      this._timerRefrescar = setTimeout(() => this.refrescar(), 4000);
      return;
    }
    this.vistas[this.actual].modulo().render(document.getElementById('vista'));
  },

  /** Aviso flotante breve */
  aviso(texto) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = texto;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('visible'), 10);
    setTimeout(() => {
      el.classList.remove('visible');
      setTimeout(() => el.remove(), 300);
    }, 2500);
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());

// Copia sin conexion (solo aplica cuando la app esta publicada en un servidor;
// abierta como archivo local no hace falta y el navegador no lo permite)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
