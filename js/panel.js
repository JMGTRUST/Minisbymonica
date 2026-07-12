/*
 * Panel — visibilidad actualizada dentro del dispositivo.
 * La mercancía en consignación es dinero de la empresa parado en las tiendas:
 * el panel muestra el stock estimado por tienda y su valor en RD$.
 */
'use strict';

const Panel = {
  tiendaDetalle: null,

  render(cont) {
    if (this.tiendaDetalle) return this.renderDetalle(cont, this.tiendaDetalle);
    if (Store.sinMovimientos()) return this.renderBienvenida(cont);

    const hoy = Util.hoyISO();
    const tiendas = Store.tiendas();
    let valorTotal = 0;
    let unidadesTotal = 0;
    let tiendasConConteo = 0;

    const filas = tiendas.map((t) => {
      const stock = Store.stockTienda(t.id, hoy);
      const visitadaHoy = !!Store.visitaCerrada(t.id, hoy);
      let estado;
      if (!stock) {
        estado = '<span class="pill pill-error">Sin conteo</span>';
      } else {
        tiendasConConteo++;
        valorTotal += stock.valor;
        unidadesTotal += stock.totalUnidades;
        const dias = Util.diasEntre(stock.visita.fecha, hoy);
        if (visitadaHoy) estado = '<span class="pill pill-ok">Visitada hoy</span>';
        else if (dias <= 3) estado = `<span class="pill pill-ok">Conteo de hace ${dias} día${dias === 1 ? '' : 's'}</span>`;
        else estado = `<span class="pill pill-warn">Conteo de hace ${dias} días</span>`;
      }
      return { t, stock, estado };
    });

    const diasSinRespaldo = Store.diasSinRespaldo();
    const avisoRespaldo =
      diasSinRespaldo != null && diasSinRespaldo >= 7
        ? `<div class="card banner-respaldo">💾 ${
            diasSinRespaldo === Infinity
              ? 'Aún no has descargado ningún respaldo'
              : `Hace ${diasSinRespaldo} días que no descargas un respaldo`
          } y los datos viven solo en este dispositivo.
          <button class="btn btn-mini" id="pan-respaldo">Descargar respaldo ahora</button></div>`
        : '';

    const visitadasHoy = tiendas.filter((t) => Store.visitaCerrada(t.id, hoy)).length;
    const ventasHoy = Store.datos.ventas.filter((v) => v.fecha === hoy);
    const unidadesVendidas = ventasHoy.reduce((s, v) => s + v.cantidad, 0);
    const valorVendido = ventasHoy.reduce((s, v) => s + v.cantidad * Number((Store.producto(v.productoId) || {}).precio || 0), 0);

    cont.innerHTML = `
      ${avisoRespaldo}
      <div class="kpis">
        <div class="kpi">
          <div class="kpi-valor">${Util.moneda(valorTotal)}</div>
          <div class="kpi-nombre">Mercancía en consignación<br>(${tiendasConConteo} de ${tiendas.length} tiendas con conteo)</div>
        </div>
        <div class="kpi">
          <div class="kpi-valor">${Util.entero(unidadesTotal)}</div>
          <div class="kpi-nombre">Unidades en tiendas</div>
        </div>
        <div class="kpi">
          <div class="kpi-valor">${visitadasHoy} / ${tiendas.length}</div>
          <div class="kpi-nombre">Tiendas visitadas hoy</div>
        </div>
        <div class="kpi">
          <div class="kpi-valor">${Util.moneda(valorVendido)}</div>
          <div class="kpi-nombre">Ventas de hoy (${Util.entero(unidadesVendidas)} unid.)</div>
        </div>
      </div>
      <div class="card">
        <h3>Stock por tienda</h3>
        <table class="tabla">
          <thead><tr><th>Tienda</th><th>Ruta</th><th class="num">Unidades</th><th class="num">Valor</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${filas
              .map(
                ({ t, stock, estado }) => `<tr>
                <td>${Util.esc(t.nombre)}</td>
                <td class="celda-suave">${Util.esc((Store.chofer(t.choferId) || {}).nombre || '—')}</td>
                <td class="num">${stock ? Util.entero(stock.totalUnidades) : '—'}</td>
                <td class="num">${stock ? Util.moneda(stock.valor) : '—'}</td>
                <td>${estado}</td>
                <td class="acciones"><button class="btn btn-mini" data-detalle="${t.id}">Ver</button></td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
        <p class="ayuda">El stock se estima con el último conteo del chofer + despachos entregados − ventas reportadas.
        Las tiendas "sin conteo" necesitan su primera visita cerrada para entrar al panel.</p>
      </div>
    `;
    cont.querySelectorAll('[data-detalle]').forEach((b) =>
      b.addEventListener('click', () => {
        this.tiendaDetalle = Number(b.dataset.detalle);
        this.render(cont);
      })
    );
    const btnRespaldo = cont.querySelector('#pan-respaldo');
    if (btnRespaldo)
      btnRespaldo.addEventListener('click', () => {
        Store.descargarRespaldo();
        App.aviso('Respaldo descargado ✔ Guárdalo en el Drive');
        this.render(cont);
      });
  },

  /** Primera vez (sin movimientos): guia de inicio en lugar de un panel vacio */
  renderBienvenida(cont) {
    cont.innerHTML = `
      <div class="card bienvenida">
        <h2>👋 ¡Bienvenida! Así funciona el sistema</h2>
        <ol class="pasos">
          <li><strong>⚙️ Configuración</strong> — revisa que los productos (con precio y nivel par),
            las tiendas con su ruta y los choferes sean los tuyos. Vienen unos de ejemplo para empezar.</li>
          <li><strong>🚚 Despacho</strong> — cada día, pega el reporte de ventas desde Excel (o súbelo en CSV).
            El sistema calcula cuánto reponer por tienda e imprime las hojas de reparto por chofer
            y la hoja de producción. Adiós a la hora y media digitando.</li>
          <li><strong>🏪 Visita de tienda</strong> — el chofer, desde su teléfono, cuenta lo que queda en
            cada tienda. <strong>No puede cerrar la visita sin contar los 13 productos.</strong></li>
        </ol>
        <p>Con eso, este Panel te muestra al momento cuánta mercancía —y cuánto dinero— tienes en cada tienda
        <strong>en este dispositivo</strong>.</p>
        <div class="acciones">
          <button class="btn btn-primario" id="bienv-demo">🎬 Ver una demostración con datos de prueba</button>
          <button class="btn" id="bienv-config">⚙️ Empezar por la configuración</button>
        </div>
        <p class="ayuda">La demostración llena el sistema con un día de operación inventado para que explores
        sin miedo. Cuando quieras empezar de verdad, ve a <strong>Datos → Reiniciar</strong> y quedará limpio.</p>
      </div>
    `;
    cont.querySelector('#bienv-demo').addEventListener('click', () => {
      Store.cargarDemo();
      App.aviso('Datos de demostración cargados 🎬');
      App.ir('panel');
    });
    cont.querySelector('#bienv-config').addEventListener('click', () => App.ir('config'));
  },

  renderDetalle(cont, tiendaId) {
    const hoy = Util.hoyISO();
    const t = Store.tienda(tiendaId);
    const stock = Store.stockTienda(tiendaId, hoy);
    const ventasHoy = Store.ventasDe(hoy, tiendaId);

    cont.innerHTML = `
      <div class="card">
        <button class="btn btn-mini" id="pan-volver">← Volver al panel</button>
        <h3>📍 ${Util.esc(t.nombre)}</h3>
        ${
          stock
            ? `<p class="ayuda">Último conteo: ${Util.fechaBonita(stock.visita.fecha)} ${stock.visita.hora || ''}.
               Valor estimado en tienda: <strong>${Util.moneda(stock.valor)}</strong></p>`
            : '<p class="error">Esta tienda no tiene ningún conteo de chofer cerrado todavía.</p>'
        }
        <table class="tabla">
          <thead><tr><th>Producto</th><th class="num">Stock est.</th><th class="num">Nivel par</th><th class="num">Vendido hoy</th><th class="num">Valor</th></tr></thead>
          <tbody>
            ${Store.productos()
              .map((p) => {
                const s = stock ? stock.porProducto[p.id] : null;
                const par = Store.par(tiendaId, p.id);
                const bajo = s != null && p.conteoChofer && par > 0 && s < par / 2;
                return `<tr class="${bajo ? 'fila-alerta' : ''}">
                  <td>${Util.esc(p.nombre)} ${p.conteoChofer ? '' : '<span class="celda-suave">(sin conteo)</span>'}</td>
                  <td class="num">${s != null ? s : '—'}</td>
                  <td class="num celda-suave">${par || '—'}</td>
                  <td class="num">${ventasHoy[p.id] || ''}</td>
                  <td class="num">${s != null ? Util.moneda(s * Number(p.precio || 0)) : '—'}</td>
                </tr>`;
              })
              .join('')}
          </tbody>
        </table>
        <p class="ayuda">Las filas resaltadas están por debajo de la mitad de su nivel par.</p>
      </div>
    `;
    cont.querySelector('#pan-volver').addEventListener('click', () => {
      this.tiendaDetalle = null;
      this.render(cont);
    });
  },
};
