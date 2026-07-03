/*
 * Componente B — Captura de inventario en tienda (app del chofer).
 *
 * Regla central pedida por la clienta: la visita NO se puede cerrar hasta que
 * los 13 productos de conteo tengan un valor registrado (el 0 cuenta, pero hay
 * que digitarlo — nada de "no lo vio, no pasó"). Reemplaza las fotos en grupos
 * de WhatsApp que se borran: cada visita queda guardada con fecha y hora.
 */
'use strict';

const Visitas = {
  choferId: null,
  visitaActivaId: null,

  render(cont) {
    if (this.visitaActivaId) {
      const v = Store.visita(this.visitaActivaId);
      if (v && !v.cerrada) return this.renderFormulario(cont, v);
      this.visitaActivaId = null;
    }
    this.renderListaTiendas(cont);
  },

  renderListaTiendas(cont) {
    const hoy = Util.hoyISO();
    const choferes = Store.choferes();
    if (this.choferId == null && choferes.length) this.choferId = choferes[0].id;
    const tiendas = Store.tiendasDeChofer(this.choferId);

    const filas = tiendas
      .map((t) => {
        const cerrada = Store.visitaCerrada(t.id, hoy);
        const abierta = Store.visitaAbierta(t.id, hoy);
        let estado, boton;
        if (cerrada) {
          estado = `<span class="pill pill-ok">✔ Visitada ${cerrada.hora || ''}</span>`;
          boton = `<button class="btn btn-mini" data-ver="${cerrada.id}">Ver</button>`;
        } else if (abierta) {
          const faltan = Store.faltantesDeVisita(abierta).length;
          estado = `<span class="pill pill-warn">En curso — faltan ${faltan}</span>`;
          boton = `<button class="btn btn-mini btn-primario" data-abrir="${abierta.id}">Continuar</button>`;
        } else {
          estado = '<span class="pill">Pendiente</span>';
          boton = `<button class="btn btn-mini btn-primario" data-iniciar="${t.id}">Iniciar visita</button>`;
        }
        return `<tr><td>${Util.esc(t.nombre)}</td><td>${estado}</td><td class="acciones">${boton}</td></tr>`;
      })
      .join('');

    const visitadas = tiendas.filter((t) => Store.visitaCerrada(t.id, hoy)).length;

    cont.innerHTML = `
      <div class="card">
        <label><strong>Chofer / ruta:</strong>
          <select id="vis-chofer">
            ${choferes.map((c) => `<option value="${c.id}" ${c.id === this.choferId ? 'selected' : ''}>${Util.esc(c.nombre)}</option>`).join('')}
          </select>
        </label>
        <p class="ayuda">Hoy ${Util.fechaBonita(hoy)} — <strong>${visitadas} de ${tiendas.length}</strong> tiendas de esta ruta visitadas.</p>
      </div>
      <div class="card">
        <table class="tabla">
          <thead><tr><th>Tienda</th><th>Estado</th><th></th></tr></thead>
          <tbody>${filas || '<tr><td colspan="3">Esta ruta no tiene tiendas asignadas.</td></tr>'}</tbody>
        </table>
      </div>
    `;

    cont.querySelector('#vis-chofer').addEventListener('change', (e) => {
      this.choferId = Number(e.target.value);
      this.render(cont);
    });
    cont.querySelectorAll('[data-iniciar]').forEach((b) =>
      b.addEventListener('click', () => {
        const v = Store.crearVisita(Number(b.dataset.iniciar), this.choferId, hoy);
        this.visitaActivaId = v.id;
        this.render(cont);
      })
    );
    cont.querySelectorAll('[data-abrir]').forEach((b) =>
      b.addEventListener('click', () => {
        this.visitaActivaId = Number(b.dataset.abrir);
        this.render(cont);
      })
    );
    cont.querySelectorAll('[data-ver]').forEach((b) =>
      b.addEventListener('click', () => this.renderResumen(cont, Store.visita(Number(b.dataset.ver))))
    );
  },

  renderFormulario(cont, visita) {
    const tienda = Store.tienda(visita.tiendaId);
    const productos = Store.productosConteo();
    const completados = productos.length - Store.faltantesDeVisita(visita).length;

    cont.innerHTML = `
      <div class="card">
        <button class="btn btn-mini" id="vis-volver">← Volver a la ruta</button>
        <h3>📍 ${Util.esc(tienda.nombre)}</h3>
        <p class="ayuda">Cuenta lo que queda en el exhibidor <strong>antes de reponer</strong>.
        Si un producto no tiene unidades, digita <strong>0</strong> — la visita no se puede cerrar con productos sin contar.</p>
        <div class="progreso">
          <div class="progreso-barra" id="vis-barra" style="width:${(completados / productos.length) * 100}%"></div>
        </div>
        <p id="vis-progreso-texto"><strong>${completados} de ${productos.length}</strong> productos contados</p>
      </div>
      <div class="card">
        <table class="tabla tabla-visita">
          <tbody>
            ${productos
              .map((p) => {
                const val = visita.conteos[p.id];
                return `<tr>
                  <td>${Util.esc(p.nombre)}</td>
                  <td class="num"><input type="number" min="0" inputmode="numeric"
                    class="input-num input-grande vis-conteo" data-producto="${p.id}"
                    value="${val === undefined || val === null || val === '' ? '' : val}" placeholder="—"></td>
                </tr>`;
              })
              .join('')}
          </tbody>
        </table>
        <label>Notas de la visita (opcional):
          <textarea id="vis-notas" rows="2" placeholder="Ej.: nevera dañada, producto vencido retirado...">${Util.esc(visita.notas)}</textarea>
        </label>
        <button class="btn btn-primario btn-grande" id="vis-cerrar">✔ Cerrar visita</button>
        <p class="error" id="vis-error" hidden></p>
      </div>
    `;

    const actualizarProgreso = () => {
      const faltan = Store.faltantesDeVisita(visita);
      const hechos = productos.length - faltan.length;
      cont.querySelector('#vis-barra').style.width = `${(hechos / productos.length) * 100}%`;
      cont.querySelector('#vis-progreso-texto').innerHTML = `<strong>${hechos} de ${productos.length}</strong> productos contados`;
      const btn = cont.querySelector('#vis-cerrar');
      btn.classList.toggle('btn-listo', faltan.length === 0);
    };

    cont.querySelector('#vis-volver').addEventListener('click', () => {
      this.visitaActivaId = null;
      this.render(cont);
    });
    cont.querySelectorAll('.vis-conteo').forEach((inp) =>
      inp.addEventListener('input', () => {
        const pid = Number(inp.dataset.producto);
        if (inp.value === '') delete visita.conteos[pid];
        else visita.conteos[pid] = Math.max(0, Number(inp.value));
        Store.guardar();
        actualizarProgreso();
      })
    );
    cont.querySelector('#vis-notas').addEventListener('input', (e) => {
      visita.notas = e.target.value;
      Store.guardar();
    });
    cont.querySelector('#vis-cerrar').addEventListener('click', () => {
      const r = Store.cerrarVisita(visita.id);
      const err = cont.querySelector('#vis-error');
      if (!r.ok) {
        err.hidden = false;
        err.innerHTML = `⛔ No se puede cerrar la visita. Falta contar:
          <strong>${r.faltan.map((p) => Util.esc(p.nombre)).join(', ')}</strong>.
          Si no quedan unidades, digita 0.`;
        err.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      this.visitaActivaId = null;
      App.aviso('Visita cerrada ✔ Inventario actualizado');
      this.render(cont);
    });
    actualizarProgreso();
  },

  renderResumen(cont, visita) {
    const tienda = Store.tienda(visita.tiendaId);
    cont.innerHTML = `
      <div class="card">
        <button class="btn btn-mini" id="vis-volver">← Volver a la ruta</button>
        <h3>📍 ${Util.esc(tienda.nombre)}</h3>
        <p class="ayuda">Visita cerrada el ${Util.fechaBonita(visita.fecha)} a las ${visita.hora || '—'}
        por ${Util.esc((Store.chofer(visita.choferId) || {}).nombre || '')}.</p>
        <table class="tabla">
          <thead><tr><th>Producto</th><th class="num">Quedaban</th></tr></thead>
          <tbody>
            ${Store.productosConteo()
              .map((p) => `<tr><td>${Util.esc(p.nombre)}</td><td class="num">${visita.conteos[p.id] != null ? visita.conteos[p.id] : '—'}</td></tr>`)
              .join('')}
          </tbody>
        </table>
        ${visita.notas ? `<p><strong>Notas:</strong> ${Util.esc(visita.notas)}</p>` : ''}
        <button class="btn" id="vis-reabrir">✏️ Reabrir para corregir</button>
      </div>
    `;
    cont.querySelector('#vis-volver').addEventListener('click', () => this.render(cont));
    cont.querySelector('#vis-reabrir').addEventListener('click', () => {
      visita.cerrada = false;
      Store.guardar();
      this.visitaActivaId = visita.id;
      this.render(cont);
    });
  },
};
