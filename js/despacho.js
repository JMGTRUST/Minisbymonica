/*
 * Componente A — Motor de despacho diario.
 *
 * Reemplaza la digitacion manual del Excel: importa el reporte de ventas del
 * dia (pegado desde Excel, archivo CSV o entrada manual), calcula cuanto
 * reponer por tienda y genera la relacion de despacho por chofer, la hoja de
 * produccion y la exportacion a CSV.
 */
'use strict';

const Despacho = {
  fechaVenta: null,
  lineasCalculadas: null, // resultado editable antes de confirmar
  metodo: 'pegar',

  render(cont) {
    if (!this.fechaVenta) this.fechaVenta = Util.hoyISO();
    const fecha = this.fechaVenta;
    const conVentas = Store.tiendasConVentas(fecha);
    const tiendas = Store.tiendas();
    const despachoExistente = Store.despachoPorFecha(Util.sumarDias(fecha, 1));

    cont.innerHTML = `
      <div class="card">
        <div class="fila-fecha">
          <label><strong>Ventas del día:</strong>
            <input type="date" id="desp-fecha" value="${fecha}">
          </label>
          <span class="pill ${conVentas.size === tiendas.length ? 'pill-ok' : 'pill-warn'}">
            ${conVentas.size} de ${tiendas.length} tiendas con ventas registradas
          </span>
        </div>
        ${
          conVentas.size > 0 && conVentas.size < tiendas.length
            ? `<details class="detalle-faltantes"><summary>Ver a cuáles tiendas les faltan las ventas (${tiendas.length - conVentas.size})</summary>
               <p class="ayuda">${tiendas.filter((t) => !conVentas.has(t.id)).map((t) => Util.esc(t.nombre)).join(' · ')}</p></details>`
            : ''
        }
        <p class="ayuda">El despacho calculado se entrega el día siguiente
        (<strong>${Util.fechaBonita(Util.sumarDias(fecha, 1))}</strong>).
        ${despachoExistente ? '<span class="pill pill-ok">Ya hay un despacho guardado para esa fecha — puedes regenerarlo.</span>' : ''}</p>
      </div>

      <div class="card">
        <h3>1. Cargar ventas del día</h3>
        <div class="tabs-mini">
          <button class="tab-mini ${this.metodo === 'pegar' ? 'activo' : ''}" data-metodo="pegar">📋 Pegar desde Excel</button>
          <button class="tab-mini ${this.metodo === 'csv' ? 'activo' : ''}" data-metodo="csv">📄 Archivo CSV</button>
          <button class="tab-mini ${this.metodo === 'manual' ? 'activo' : ''}" data-metodo="manual">✍️ Entrada manual</button>
        </div>
        <div id="desp-metodo"></div>
        <div id="desp-import-resultado"></div>
      </div>

      <div class="card">
        <h3>2. Calcular y confirmar despacho</h3>
        <p class="ayuda">Si la tienda tiene conteo de chofer, el sistema la lleva a su nivel par;
        si no, repone lo vendido (el criterio del Excel actual). Puedes ajustar cualquier cantidad antes de confirmar.</p>
        <button class="btn btn-primario" id="desp-calcular">Calcular despacho sugerido</button>
        <div id="desp-tabla"></div>
      </div>

      <div class="card">
        <h3>3. Hojas de reparto guardadas</h3>
        <div id="desp-historial"></div>
      </div>
    `;

    cont.querySelector('#desp-fecha').addEventListener('change', (e) => {
      this.fechaVenta = e.target.value;
      this.lineasCalculadas = null;
      this.render(cont);
    });
    cont.querySelectorAll('.tab-mini').forEach((b) =>
      b.addEventListener('click', () => {
        this.metodo = b.dataset.metodo;
        this.render(cont);
      })
    );
    cont.querySelector('#desp-calcular').addEventListener('click', () => {
      if (Store.tiendasConVentas(this.fechaVenta).size === 0) {
        const seguir = confirm(
          `No hay ventas registradas para el ${Util.fechaBonita(this.fechaVenta)}, así que casi todo saldrá en 0.\n\n` +
            'Carga primero las ventas en el paso 1 (o presiona Aceptar si de verdad quieres calcular sin ventas).'
        );
        if (!seguir) return;
      }
      this.lineasCalculadas = Store.calcularDespacho(this.fechaVenta);
      this.renderTabla(cont.querySelector('#desp-tabla'));
      cont.querySelector('#desp-tabla').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    this.renderMetodo(cont.querySelector('#desp-metodo'));
    if (this.lineasCalculadas) this.renderTabla(cont.querySelector('#desp-tabla'));
    this.renderHistorial(cont.querySelector('#desp-historial'));
  },

  /* ---------- 1. Importacion de ventas ---------- */

  renderMetodo(cont) {
    if (this.metodo === 'pegar') {
      cont.innerHTML = `
        <p class="ayuda">Copia el rango del reporte con los nombres de producto en la primera fila
        y las tiendas en la primera columna, y pégalo aquí. También acepta el formato largo
        <code>tienda / producto / cantidad</code>.</p>
        <textarea id="desp-pegar" rows="6" placeholder="Tienda\tDulce de leche\tDulce de coco...\nBravo 27 de Febrero\t4\t2..."></textarea>
        <button class="btn" id="desp-btn-pegar">Procesar lo pegado</button>
      `;
      cont.querySelector('#desp-btn-pegar').addEventListener('click', () => {
        this.procesarTexto(document.getElementById('desp-pegar').value, '\t');
      });
    } else if (this.metodo === 'csv') {
      cont.innerHTML = `
        <p class="ayuda">Acepta dos formatos: matriz (primera fila productos, primera columna tiendas)
        o largo (columnas <code>tienda,producto,cantidad</code>). Hay un ejemplo en
        <code>ejemplos/ventas-ejemplo.csv</code>.</p>
        <input type="file" id="desp-archivo" accept=".csv,.txt">
      `;
      cont.querySelector('#desp-archivo').addEventListener('change', (e) => {
        const archivo = e.target.files[0];
        if (!archivo) return;
        const lector = new FileReader();
        lector.onload = () => this.procesarTexto(String(lector.result), ',');
        lector.readAsText(archivo);
      });
    } else {
      const conVentas = Store.tiendasConVentas(this.fechaVenta);
      cont.innerHTML = `
        <p class="ayuda">Elige una tienda y digita las unidades vendidas hoy. Las tiendas con ✅ ya tienen ventas registradas.</p>
        <select id="desp-tienda-manual">
          <option value="">— Elegir tienda —</option>
          ${Store.tiendas()
            .map((t) => `<option value="${t.id}">${conVentas.has(t.id) ? '✅ ' : ''}${Util.esc(t.nombre)}</option>`)
            .join('')}
        </select>
        <div id="desp-manual-form"></div>
      `;
      cont.querySelector('#desp-tienda-manual').addEventListener('change', (e) => {
        this.renderFormManual(cont.querySelector('#desp-manual-form'), Number(e.target.value));
      });
    }
  },

  renderFormManual(cont, tiendaId) {
    if (!tiendaId) {
      cont.innerHTML = '';
      return;
    }
    const ventas = Store.ventasDe(this.fechaVenta, tiendaId);
    cont.innerHTML = `
      <table class="tabla">
        <thead><tr><th>Producto</th><th class="num">Unidades vendidas</th></tr></thead>
        <tbody>
          ${Store.productos()
            .map(
              (p) => `<tr><td>${Util.esc(p.nombre)}</td>
              <td class="num"><input type="number" min="0" inputmode="numeric" class="input-num desp-manual-cant"
                data-producto="${p.id}" value="${ventas[p.id] != null ? ventas[p.id] : ''}" placeholder="0"></td></tr>`
            )
            .join('')}
        </tbody>
      </table>
      <button class="btn btn-primario" id="desp-guardar-manual">Guardar ventas de esta tienda</button>
    `;
    cont.querySelector('#desp-guardar-manual').addEventListener('click', () => {
      const cantidades = {};
      cont.querySelectorAll('.desp-manual-cant').forEach((inp) => {
        if (inp.value !== '') cantidades[inp.dataset.producto] = Number(inp.value);
      });
      Store.registrarVentasTienda(this.fechaVenta, tiendaId, cantidades);
      App.aviso('Ventas guardadas ✔');
      this.render(document.getElementById('vista'));
    });
  },

  /**
   * Procesa texto pegado o CSV. Detecta automaticamente:
   *  - formato largo:  tienda, producto, cantidad  (3+ columnas, encabezados con esas palabras o valores repetidos)
   *  - formato matriz: primera fila = productos, primera columna = tiendas
   */
  procesarTexto(texto, sepPreferido) {
    const resultado = document.getElementById('desp-import-resultado');
    const filas = this.parsearTabla(texto, sepPreferido);
    if (filas.length < 2) {
      resultado.innerHTML = '<p class="error">No se pudo leer nada. Verifica que pegaste/subiste datos con al menos encabezado y una fila.</p>';
      return;
    }

    const encabezado = filas[0].map((c) => Util.normalizar(c));
    const esLargo =
      filas[0].length <= 4 &&
      encabezado.some((c) => c.includes('tienda') || c.includes('sucursal') || c.includes('supermercado')) &&
      encabezado.some((c) => c.includes('producto')) &&
      encabezado.some((c) => c.includes('cantidad') || c.includes('venta') || c.includes('unidades'));

    const ventasPorTienda = {}; // {tiendaId: {productoId: cantidad}}
    const noMatchTiendas = new Set();
    const noMatchProductos = new Set();
    let celdasLeidas = 0;

    if (esLargo) {
      const iT = encabezado.findIndex((c) => c.includes('tienda') || c.includes('sucursal') || c.includes('supermercado'));
      const iP = encabezado.findIndex((c) => c.includes('producto'));
      const iC = encabezado.findIndex((c) => c.includes('cantidad') || c.includes('venta') || c.includes('unidades'));
      for (const fila of filas.slice(1)) {
        if (!fila[iT] && !fila[iP]) continue;
        const t = Store.buscarTienda(fila[iT]);
        const p = Store.buscarProducto(fila[iP]);
        if (!t) { noMatchTiendas.add(fila[iT]); continue; }
        if (!p) { noMatchProductos.add(fila[iP]); continue; }
        const c = Number(String(fila[iC]).replace(',', '.'));
        if (!Number.isFinite(c)) continue;
        ventasPorTienda[t.id] = ventasPorTienda[t.id] || {};
        ventasPorTienda[t.id][p.id] = (ventasPorTienda[t.id][p.id] || 0) + c;
        celdasLeidas++;
      }
    } else {
      // Matriz: columnas = productos
      const columnas = filas[0].slice(1).map((nombre) => ({ nombre, producto: Store.buscarProducto(nombre) }));
      columnas.forEach((c) => { if (!c.producto && Util.normalizar(c.nombre)) noMatchProductos.add(c.nombre); });
      for (const fila of filas.slice(1)) {
        if (!fila[0]) continue;
        const t = Store.buscarTienda(fila[0]);
        if (!t) { noMatchTiendas.add(fila[0]); continue; }
        ventasPorTienda[t.id] = ventasPorTienda[t.id] || {};
        fila.slice(1).forEach((celda, i) => {
          const col = columnas[i];
          if (!col || !col.producto || celda === '' || celda == null) return;
          const c = Number(String(celda).replace(',', '.'));
          if (!Number.isFinite(c)) return;
          ventasPorTienda[t.id][col.producto.id] = c;
          celdasLeidas++;
        });
      }
    }

    for (const [tiendaId, cantidades] of Object.entries(ventasPorTienda)) {
      Store.registrarVentasTienda(this.fechaVenta, Number(tiendaId), cantidades);
    }

    const avisos = [];
    if (noMatchTiendas.size) {
      avisos.push(`<p class="error">Tiendas no reconocidas (revisa el nombre en Configuración): ${[...noMatchTiendas].map(Util.esc).join(', ')}</p>`);
    }
    if (noMatchProductos.size) {
      avisos.push(`<p class="error">Productos no reconocidos: ${[...noMatchProductos].map(Util.esc).join(', ')}</p>`);
    }
    resultado.innerHTML = `
      <p class="ok">✔ Se registraron ventas de <strong>${Object.keys(ventasPorTienda).length}</strong> tiendas
      (${celdasLeidas} celdas leídas) para el ${Util.fechaBonita(this.fechaVenta)}.</p>
      ${avisos.join('')}
    `;
    this.lineasCalculadas = null;
    // Refresca el contador de tiendas sin perder el mensaje de resultado
    const html = resultado.innerHTML;
    this.render(document.getElementById('vista'));
    document.getElementById('desp-import-resultado').innerHTML = html;
  },

  parsearTabla(texto, sepPreferido) {
    const lineas = String(texto || '').split(/\r?\n/).filter((l) => l.trim() !== '');
    if (!lineas.length) return [];
    // Elige el separador que mas columnas produce en la primera linea
    const seps = ['\t', ';', ','];
    let sep = sepPreferido;
    let max = lineas[0].split(sepPreferido).length;
    for (const s of seps) {
      const n = lineas[0].split(s).length;
      if (n > max) { max = n; sep = s; }
    }
    return lineas.map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, '')));
  },

  /* ---------- 2. Tabla de despacho editable ---------- */

  renderTabla(cont) {
    const lineas = this.lineasCalculadas;
    if (!lineas) { cont.innerHTML = ''; return; }
    const productos = Store.productos();
    const porTienda = {};
    for (const l of lineas) {
      porTienda[l.tiendaId] = porTienda[l.tiendaId] || {};
      porTienda[l.tiendaId][l.productoId] = l;
    }

    let filas = '';
    for (const ch of Store.choferes()) {
      const tiendas = Store.tiendasDeChofer(ch.id);
      if (!tiendas.length) continue;
      filas += `<tr class="fila-chofer"><td colspan="${productos.length + 2}">🚚 ${Util.esc(ch.nombre)}</td></tr>`;
      for (const t of tiendas) {
        const celdas = productos
          .map((p) => {
            const l = porTienda[t.id][p.id];
            const titulo = l.criterio === 'par' ? 'Llevar a nivel par (hay conteo de chofer)' : 'Reponer lo vendido';
            return `<td class="num"><input type="number" min="0" inputmode="numeric" class="input-num desp-cant ${l.criterio === 'par' ? 'criterio-par' : ''}"
              title="${titulo} — vendido: ${l.vendido}" data-tienda="${t.id}" data-producto="${p.id}" value="${l.sugerido}"></td>`;
          })
          .join('');
        const totalTienda = productos.reduce((s, p) => s + porTienda[t.id][p.id].sugerido, 0);
        filas += `<tr><td class="celda-tienda">${Util.esc(t.nombre)}</td>${celdas}<td class="num total-fila" data-tienda="${t.id}">${totalTienda}</td></tr>`;
      }
    }

    const totalesProducto = productos
      .map((p) => lineas.filter((l) => l.productoId === p.id).reduce((s, l) => s + l.sugerido, 0));

    cont.innerHTML = `
      <div class="scroll-x">
        <table class="tabla tabla-despacho">
          <thead>
            <tr>
              <th>Tienda</th>
              ${productos.map((p) => `<th class="num th-vert"><span>${Util.esc(p.nombre)}</span></th>`).join('')}
              <th class="num">Total</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
          <tfoot>
            <tr>
              <td><strong>Producción total</strong></td>
              ${totalesProducto.map((n, i) => `<td class="num total-prod" data-producto="${productos[i].id}"><strong>${n}</strong></td>`).join('')}
              <td class="num" id="desp-gran-total"><strong>${totalesProducto.reduce((a, b) => a + b, 0)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p class="ayuda">Las celdas azules se calcularon por nivel par (hay conteo del chofer); las demás reponen lo vendido.</p>
      <button class="btn btn-primario" id="desp-confirmar">💾 Confirmar despacho del ${Util.fechaBonita(Util.sumarDias(this.fechaVenta, 1))}</button>
    `;

    cont.querySelectorAll('.desp-cant').forEach((inp) =>
      inp.addEventListener('input', () => {
        const l = porTienda[Number(inp.dataset.tienda)][Number(inp.dataset.producto)];
        l.sugerido = Math.max(0, Number(inp.value) || 0);
        this.actualizarTotales(cont, porTienda, productos);
      })
    );
    cont.querySelector('#desp-confirmar').addEventListener('click', () => {
      const existente = Store.despachoPorFecha(Util.sumarDias(this.fechaVenta, 1));
      if (existente && !confirm('Ya hay un despacho guardado para esa fecha de entrega. ¿Reemplazarlo con este?')) return;
      const d = Store.guardarDespacho(
        this.fechaVenta,
        this.lineasCalculadas.map((l) => ({ tiendaId: l.tiendaId, productoId: l.productoId, cantidad: l.sugerido }))
      );
      this.lineasCalculadas = null;
      App.aviso('Despacho guardado ✔');
      this.render(document.getElementById('vista'));
      this.imprimirHojas(d.id);
    });
  },

  actualizarTotales(cont, porTienda, productos) {
    cont.querySelectorAll('.total-fila').forEach((td) => {
      const tid = Number(td.dataset.tienda);
      td.textContent = productos.reduce((s, p) => s + porTienda[tid][p.id].sugerido, 0);
    });
    let gran = 0;
    cont.querySelectorAll('.total-prod').forEach((td) => {
      const pid = Number(td.dataset.producto);
      const total = this.lineasCalculadas.filter((l) => l.productoId === pid).reduce((s, l) => s + l.sugerido, 0);
      td.innerHTML = `<strong>${total}</strong>`;
      gran += total;
    });
    cont.querySelector('#desp-gran-total').innerHTML = `<strong>${gran}</strong>`;
  },

  /* ---------- 3. Historial, impresion y exportacion ---------- */

  renderHistorial(cont) {
    const despachos = Store.despachosOrdenados().slice(0, 15);
    if (!despachos.length) {
      cont.innerHTML = '<p class="ayuda">Aún no hay despachos guardados.</p>';
      return;
    }
    cont.innerHTML = `
      <table class="tabla">
        <thead><tr><th>Entrega</th><th>Ventas de</th><th class="num">Unidades</th><th class="num">Valor</th><th></th></tr></thead>
        <tbody>
          ${despachos
            .map((d) => {
              const unidades = d.lineas.reduce((s, l) => s + l.cantidad, 0);
              const valor = d.lineas.reduce((s, l) => s + l.cantidad * Number((Store.producto(l.productoId) || {}).precio || 0), 0);
              return `<tr>
                <td>${Util.fechaBonita(d.fechaDespacho)}</td>
                <td>${Util.fechaBonita(d.fechaVenta)}</td>
                <td class="num">${Util.entero(unidades)}</td>
                <td class="num">${Util.moneda(valor)}</td>
                <td class="acciones">
                  <button class="btn btn-mini" data-imprimir="${d.id}">🖨️ Hojas de reparto</button>
                  <button class="btn btn-mini" data-csv="${d.id}">⬇️ CSV</button>
                </td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    `;
    cont.querySelectorAll('[data-imprimir]').forEach((b) => b.addEventListener('click', () => this.imprimirHojas(Number(b.dataset.imprimir))));
    cont.querySelectorAll('[data-csv]').forEach((b) => b.addEventListener('click', () => this.exportarCSV(Number(b.dataset.csv))));
  },

  exportarCSV(despachoId) {
    const d = Store.datos.despachos.find((x) => x.id === despachoId);
    if (!d) return;
    const filas = d.lineas.map((l) => ({
      fecha_despacho: d.fechaDespacho,
      chofer: (Store.chofer((Store.tienda(l.tiendaId) || {}).choferId) || {}).nombre || '',
      tienda: (Store.tienda(l.tiendaId) || {}).nombre || l.tiendaId,
      codigo: (Store.producto(l.productoId) || {}).codigo || '',
      producto: (Store.producto(l.productoId) || {}).nombre || l.productoId,
      cantidad: l.cantidad,
    }));
    Util.descargar(`despacho-${d.fechaDespacho}.csv`, Util.aCSV(filas, ['fecha_despacho', 'chofer', 'tienda', 'codigo', 'producto', 'cantidad']), 'text/csv');
  },

  /** Genera las hojas de reparto por chofer + hoja de produccion y abre el dialogo de impresion */
  imprimirHojas(despachoId) {
    const d = Store.datos.despachos.find((x) => x.id === despachoId);
    if (!d) return;
    const productos = Store.productos();
    const porTienda = {};
    for (const l of d.lineas) {
      porTienda[l.tiendaId] = porTienda[l.tiendaId] || {};
      porTienda[l.tiendaId][l.productoId] = l.cantidad;
    }

    let hojas = '';
    for (const ch of Store.choferes()) {
      const tiendas = Store.tiendasDeChofer(ch.id).filter((t) => porTienda[t.id]);
      if (!tiendas.length) continue;
      const prodsUsados = productos.filter((p) => tiendas.some((t) => (porTienda[t.id][p.id] || 0) > 0));
      hojas += `
        <section class="hoja">
          <h2>Minis by Mónica — Hoja de reparto</h2>
          <p><strong>${Util.esc(ch.nombre)}</strong> · Entrega: ${Util.fechaBonita(d.fechaDespacho)} · Generado: ${d.generadoEl}</p>
          <table>
            <thead><tr><th>Tienda</th>${prodsUsados.map((p) => `<th>${Util.esc(p.nombre)}</th>`).join('')}<th>Total</th><th>Recibido ✍</th></tr></thead>
            <tbody>
              ${tiendas
                .map((t) => {
                  const total = prodsUsados.reduce((s, p) => s + (porTienda[t.id][p.id] || 0), 0);
                  return `<tr><td>${Util.esc(t.nombre)}</td>${prodsUsados
                    .map((p) => `<td class="num">${porTienda[t.id][p.id] || ''}</td>`)
                    .join('')}<td class="num"><strong>${total}</strong></td><td></td></tr>`;
                })
                .join('')}
              <tr><td><strong>Total ruta</strong></td>${prodsUsados
                .map((p) => `<td class="num"><strong>${tiendas.reduce((s, t) => s + (porTienda[t.id][p.id] || 0), 0)}</strong></td>`)
                .join('')}<td class="num"><strong>${tiendas.reduce((s, t) => s + prodsUsados.reduce((x, p) => x + (porTienda[t.id][p.id] || 0), 0), 0)}</strong></td><td></td></tr>
            </tbody>
          </table>
        </section>`;
    }

    // Hoja de produccion: total por producto para cocina
    const totales = productos
      .map((p) => ({ p, total: d.lineas.filter((l) => l.productoId === p.id).reduce((s, l) => s + l.cantidad, 0) }))
      .filter((x) => x.total > 0);
    hojas += `
      <section class="hoja">
        <h2>Minis by Mónica — Hoja de producción</h2>
        <p>Para la entrega del ${Util.fechaBonita(d.fechaDespacho)}</p>
        <table>
          <thead><tr><th>Código</th><th>Producto</th><th class="num">Unidades a producir</th></tr></thead>
          <tbody>
            ${totales.map((x) => `<tr><td>${Util.esc(x.p.codigo)}</td><td>${Util.esc(x.p.nombre)}</td><td class="num"><strong>${x.total}</strong></td></tr>`).join('')}
            <tr><td></td><td><strong>Total</strong></td><td class="num"><strong>${totales.reduce((s, x) => s + x.total, 0)}</strong></td></tr>
          </tbody>
        </table>
      </section>`;

    const area = document.getElementById('area-impresion');
    area.innerHTML = hojas;
    window.print();
  },
};
