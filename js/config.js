/*
 * Configuracion — catalogos que hoy viven en el Excel maestro:
 * productos (con precio y nivel par), tiendas con su ruta/chofer, y choferes.
 */
'use strict';

const Config = {
  seccion: 'productos',
  tiendaPar: null, // tienda cuyo nivel par se esta editando

  render(cont) {
    cont.innerHTML = `
      <div class="card">
        <div class="tabs-mini">
          <button class="tab-mini ${this.seccion === 'productos' ? 'activo' : ''}" data-sec="productos">🧁 Productos</button>
          <button class="tab-mini ${this.seccion === 'tiendas' ? 'activo' : ''}" data-sec="tiendas">🏪 Tiendas y rutas</button>
          <button class="tab-mini ${this.seccion === 'choferes' ? 'activo' : ''}" data-sec="choferes">🚚 Choferes</button>
        </div>
        <div id="conf-cuerpo"></div>
      </div>
    `;
    cont.querySelectorAll('.tab-mini').forEach((b) =>
      b.addEventListener('click', () => {
        this.seccion = b.dataset.sec;
        this.tiendaPar = null;
        this.render(cont);
      })
    );
    const cuerpo = cont.querySelector('#conf-cuerpo');
    if (this.seccion === 'productos') this.renderProductos(cuerpo);
    else if (this.seccion === 'tiendas') this.renderTiendas(cuerpo);
    else this.renderChoferes(cuerpo);
  },

  /* ---------- Productos ---------- */

  renderProductos(cont) {
    const conteo = Store.productosConteo().length;
    cont.innerHTML = `
      <p class="ayuda">Los productos marcados como <strong>"conteo chofer"</strong> son los que la visita en tienda
      obliga a contar (hoy: <strong>${conteo}</strong>). El <strong>nivel par</strong> es el stock objetivo por tienda
      que usa el cálculo de despacho; se puede afinar por tienda en "Tiendas y rutas".</p>
      <div class="scroll-x">
      <table class="tabla">
        <thead><tr><th>Código</th><th>Nombre</th><th class="num">Precio RD$</th><th class="num">Nivel par</th><th>Conteo chofer</th><th>Activo</th><th></th></tr></thead>
        <tbody>
          ${Store.datos.productos
            .map(
              (p) => `<tr class="${p.activo ? '' : 'fila-inactiva'}">
              <td><input class="input-corto" data-campo="codigo" data-id="${p.id}" value="${Util.esc(p.codigo)}"></td>
              <td><input data-campo="nombre" data-id="${p.id}" value="${Util.esc(p.nombre)}"></td>
              <td class="num"><input type="number" min="0" step="0.01" class="input-num" data-campo="precio" data-id="${p.id}" value="${p.precio}"></td>
              <td class="num"><input type="number" min="0" class="input-num" data-campo="par" data-id="${p.id}" value="${p.par}"></td>
              <td class="centro"><input type="checkbox" data-campo="conteoChofer" data-id="${p.id}" ${p.conteoChofer ? 'checked' : ''}></td>
              <td class="centro"><input type="checkbox" data-campo="activo" data-id="${p.id}" ${p.activo ? 'checked' : ''}></td>
              <td class="acciones"><button class="btn btn-mini" data-borrar="${p.id}">🗑️</button></td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
      </div>
      <button class="btn" id="conf-nuevo-prod">＋ Agregar producto</button>
    `;
    cont.querySelectorAll('input[data-campo]').forEach((inp) =>
      inp.addEventListener('change', () => {
        const p = Store.producto(Number(inp.dataset.id));
        const campo = inp.dataset.campo;
        if (inp.type === 'checkbox') p[campo] = inp.checked;
        else if (inp.type === 'number') p[campo] = Number(inp.value) || 0;
        else p[campo] = inp.value;
        Store.guardar();
      })
    );
    cont.querySelectorAll('[data-borrar]').forEach((b) =>
      b.addEventListener('click', () => {
        const id = Number(b.dataset.borrar);
        const p = Store.producto(id);
        const usado =
          Store.datos.ventas.some((v) => v.productoId === id) ||
          Store.datos.visitas.some((v) => v.conteos[id] != null) ||
          Store.datos.despachos.some((d) => d.lineas.some((l) => l.productoId === id));
        if (usado) {
          alert(`"${p.nombre}" tiene historial (ventas, conteos o despachos). Desmárcalo como activo en vez de borrarlo.`);
          return;
        }
        if (!confirm(`¿Borrar el producto "${p.nombre}"?`)) return;
        Store.datos.productos = Store.datos.productos.filter((x) => x.id !== id);
        Store.guardar();
        this.render(document.getElementById('vista'));
      })
    );
    cont.querySelector('#conf-nuevo-prod').addEventListener('click', () => {
      const id = Math.max(0, ...Store.datos.productos.map((p) => p.id)) + 1;
      Store.datos.productos.push({ id, codigo: `P${String(id).padStart(2, '0')}`, nombre: 'Nuevo producto', precio: 0, par: 0, conteoChofer: false, activo: true });
      Store.guardar();
      this.render(document.getElementById('vista'));
    });
  },

  /* ---------- Tiendas ---------- */

  renderTiendas(cont) {
    if (this.tiendaPar) return this.renderParTienda(cont, this.tiendaPar);
    const choferes = Store.choferes(false);
    cont.innerHTML = `
      <p class="ayuda">Cada tienda pertenece a la ruta de un chofer; la hoja de reparto se agrupa así.
      El nombre debe coincidir (aunque sea parcialmente) con el que usa el reporte de ventas del supermercado
      para que la importación lo reconozca.</p>
      <table class="tabla">
        <thead><tr><th>Tienda</th><th>Ruta / chofer</th><th>Activa</th><th></th></tr></thead>
        <tbody>
          ${Store.datos.tiendas
            .map(
              (t) => `<tr class="${t.activo ? '' : 'fila-inactiva'}">
              <td><input data-tcampo="nombre" data-id="${t.id}" value="${Util.esc(t.nombre)}"></td>
              <td><select data-tcampo="choferId" data-id="${t.id}">
                ${choferes.map((c) => `<option value="${c.id}" ${c.id === t.choferId ? 'selected' : ''}>${Util.esc(c.nombre)}</option>`).join('')}
              </select></td>
              <td class="centro"><input type="checkbox" data-tcampo="activo" data-id="${t.id}" ${t.activo ? 'checked' : ''}></td>
              <td class="acciones"><button class="btn btn-mini" data-par="${t.id}">Nivel par</button></td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
      <button class="btn" id="conf-nueva-tienda">＋ Agregar tienda</button>
    `;
    cont.querySelectorAll('[data-tcampo]').forEach((inp) =>
      inp.addEventListener('change', () => {
        const t = Store.tienda(Number(inp.dataset.id));
        const campo = inp.dataset.tcampo;
        if (inp.type === 'checkbox') t[campo] = inp.checked;
        else if (campo === 'choferId') t[campo] = Number(inp.value);
        else t[campo] = inp.value;
        Store.guardar();
      })
    );
    cont.querySelectorAll('[data-par]').forEach((b) =>
      b.addEventListener('click', () => {
        this.tiendaPar = Number(b.dataset.par);
        this.render(document.getElementById('vista'));
      })
    );
    cont.querySelector('#conf-nueva-tienda').addEventListener('click', () => {
      const id = Math.max(0, ...Store.datos.tiendas.map((t) => t.id)) + 1;
      Store.datos.tiendas.push({ id, nombre: 'Nueva tienda', choferId: (choferes[0] || {}).id || 1, activo: true, parOverride: {} });
      Store.guardar();
      this.render(document.getElementById('vista'));
    });
  },

  renderParTienda(cont, tiendaId) {
    const t = Store.tienda(tiendaId);
    cont.innerHTML = `
      <button class="btn btn-mini" id="conf-par-volver">← Volver a tiendas</button>
      <h4>Nivel par de ${Util.esc(t.nombre)}</h4>
      <p class="ayuda">Deja la casilla vacía para usar el nivel par general del producto.
      Escribe un número para ajustarlo solo en esta tienda (ej.: una tienda que vende más).</p>
      <table class="tabla">
        <thead><tr><th>Producto</th><th class="num">Par general</th><th class="num">Par en esta tienda</th></tr></thead>
        <tbody>
          ${Store.productos()
            .map(
              (p) => `<tr>
              <td>${Util.esc(p.nombre)}</td>
              <td class="num celda-suave">${p.par}</td>
              <td class="num"><input type="number" min="0" class="input-num conf-par" data-producto="${p.id}"
                value="${t.parOverride[p.id] != null ? t.parOverride[p.id] : ''}" placeholder="${p.par}"></td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    `;
    cont.querySelector('#conf-par-volver').addEventListener('click', () => {
      this.tiendaPar = null;
      this.render(document.getElementById('vista'));
    });
    cont.querySelectorAll('.conf-par').forEach((inp) =>
      inp.addEventListener('change', () => {
        const pid = Number(inp.dataset.producto);
        if (inp.value === '') delete t.parOverride[pid];
        else t.parOverride[pid] = Math.max(0, Number(inp.value) || 0);
        Store.guardar();
      })
    );
  },

  /* ---------- Choferes ---------- */

  renderChoferes(cont) {
    cont.innerHTML = `
      <table class="tabla">
        <thead><tr><th>Nombre / ruta</th><th class="num">Tiendas asignadas</th><th>Activo</th><th></th></tr></thead>
        <tbody>
          ${Store.datos.choferes
            .map(
              (c) => `<tr class="${c.activo ? '' : 'fila-inactiva'}">
              <td><input data-ccampo="nombre" data-id="${c.id}" value="${Util.esc(c.nombre)}"></td>
              <td class="num">${Store.tiendasDeChofer(c.id).length}</td>
              <td class="centro"><input type="checkbox" data-ccampo="activo" data-id="${c.id}" ${c.activo ? 'checked' : ''}></td>
              <td class="acciones"><button class="btn btn-mini" data-cborrar="${c.id}">🗑️</button></td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
      <button class="btn" id="conf-nuevo-chofer">＋ Agregar chofer</button>
    `;
    cont.querySelectorAll('[data-ccampo]').forEach((inp) =>
      inp.addEventListener('change', () => {
        const c = Store.chofer(Number(inp.dataset.id));
        if (inp.type === 'checkbox') {
          // Un chofer inactivo con tiendas asignadas dejaria esas tiendas fuera
          // de las hojas de reparto: obligar a reasignarlas primero.
          if (!inp.checked && Store.tiendasDeChofer(c.id).length) {
            alert('Este chofer tiene tiendas activas asignadas. Reasígnalas en "Tiendas y rutas" antes de desactivarlo.');
            inp.checked = true;
            return;
          }
          c.activo = inp.checked;
        } else {
          c.nombre = inp.value;
        }
        Store.guardar();
      })
    );
    cont.querySelectorAll('[data-cborrar]').forEach((b) =>
      b.addEventListener('click', () => {
        const id = Number(b.dataset.cborrar);
        if (Store.tiendasDeChofer(id).length) {
          alert('Este chofer tiene tiendas asignadas. Reasígnalas primero en "Tiendas y rutas".');
          return;
        }
        if (!confirm('¿Borrar este chofer?')) return;
        Store.datos.choferes = Store.datos.choferes.filter((c) => c.id !== id);
        Store.guardar();
        this.render(document.getElementById('vista'));
      })
    );
    cont.querySelector('#conf-nuevo-chofer').addEventListener('click', () => {
      const id = Math.max(0, ...Store.datos.choferes.map((c) => c.id)) + 1;
      Store.datos.choferes.push({ id, nombre: 'Nuevo chofer', activo: true });
      Store.guardar();
      this.render(document.getElementById('vista'));
    });
  },
};
