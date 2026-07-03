/* Navegacion principal de la aplicacion */
'use strict';

const App = {
  vistas: {
    panel: { titulo: '📊 Panel', modulo: () => Panel },
    despacho: { titulo: '🚚 Despacho', modulo: () => Despacho },
    visitas: { titulo: '🏪 Visita de tienda', modulo: () => Visitas },
    config: { titulo: '⚙️ Configuración', modulo: () => Config },
    datos: { titulo: '💾 Datos', modulo: () => Datos },
  },
  actual: 'panel',

  init() {
    Store.init();
    const nav = document.getElementById('nav');
    nav.innerHTML = Object.entries(this.vistas)
      .map(([clave, v]) => `<button class="tab" data-vista="${clave}">${v.titulo}</button>`)
      .join('');
    nav.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => this.ir(b.dataset.vista)));
    this.ir(this.actual);
  },

  ir(clave) {
    this.actual = clave;
    document.querySelectorAll('#nav .tab').forEach((b) => b.classList.toggle('activo', b.dataset.vista === clave));
    this.vistas[clave].modulo().render(document.getElementById('vista'));
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
