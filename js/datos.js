/*
 * Datos — respaldo, exportacion e historial.
 * Sustituye el "registro que se borra" de los grupos de WhatsApp: todo queda
 * guardado y se puede exportar en cualquier momento.
 */
'use strict';

const Datos = {
  render(cont) {
    const d = Store.datos;
    cont.innerHTML = `
      <div class="card">
        <h3>Respaldo</h3>
        <p class="ayuda">Los datos viven en este dispositivo (piloto sin servidor). Descarga un respaldo
        con frecuencia y guárdalo en el Drive; se puede restaurar en cualquier otro dispositivo.</p>
        <div class="acciones">
          <button class="btn btn-primario" id="dat-exportar">⬇️ Descargar respaldo (JSON)</button>
          <label class="btn">⬆️ Restaurar respaldo <input type="file" id="dat-importar" accept=".json" hidden></label>
        </div>
      </div>
      <div class="card">
        <h3>Exportar historial (CSV)</h3>
        <p class="ayuda">Para abrir en Excel o conectar con Odoo más adelante.</p>
        <div class="acciones">
          <button class="btn" id="dat-csv-ventas">Ventas (${Util.entero(d.ventas.length)} registros)</button>
          <button class="btn" id="dat-csv-visitas">Visitas de chofer (${Util.entero(d.visitas.filter((v) => v.cerrada).length)} cerradas)</button>
          <button class="btn" id="dat-csv-despachos">Despachos (${Util.entero(d.despachos.length)})</button>
        </div>
      </div>
      <div class="card">
        <h3>Demostración y reinicio</h3>
        <div class="acciones">
          <button class="btn" id="dat-demo">🎬 Cargar datos de demostración</button>
          <button class="btn btn-peligro" id="dat-reiniciar">Reiniciar (dejar todo limpio)</button>
        </div>
        <p class="ayuda">La demostración llena el sistema con un día de operación inventado para explorar sin miedo.
        Reiniciar borra todo lo registrado y deja los catálogos de ejemplo. En ambos casos, descarga un respaldo antes.</p>
      </div>
    `;

    cont.querySelector('#dat-exportar').addEventListener('click', () => {
      Util.descargar(`minis-respaldo-${Util.hoyISO()}.json`, JSON.stringify(Store.datos, null, 2), 'application/json');
    });
    cont.querySelector('#dat-importar').addEventListener('change', (e) => {
      const archivo = e.target.files[0];
      if (!archivo) return;
      const lector = new FileReader();
      lector.onload = () => {
        try {
          Store.importarJSON(String(lector.result));
          App.aviso('Respaldo restaurado ✔');
          this.render(cont);
        } catch (err) {
          alert('No se pudo restaurar: ' + err.message);
        }
      };
      lector.readAsText(archivo);
    });

    cont.querySelector('#dat-csv-ventas').addEventListener('click', () => {
      const filas = d.ventas.map((v) => ({
        fecha: v.fecha,
        tienda: (Store.tienda(v.tiendaId) || {}).nombre || v.tiendaId,
        codigo: (Store.producto(v.productoId) || {}).codigo || '',
        producto: (Store.producto(v.productoId) || {}).nombre || v.productoId,
        cantidad: v.cantidad,
      }));
      Util.descargar('ventas.csv', Util.aCSV(filas, ['fecha', 'tienda', 'codigo', 'producto', 'cantidad']), 'text/csv');
    });

    cont.querySelector('#dat-csv-visitas').addEventListener('click', () => {
      const filas = [];
      for (const v of d.visitas.filter((x) => x.cerrada)) {
        for (const [pid, cantidad] of Object.entries(v.conteos)) {
          filas.push({
            fecha: v.fecha,
            hora: v.hora || '',
            tienda: (Store.tienda(v.tiendaId) || {}).nombre || v.tiendaId,
            chofer: (Store.chofer(v.choferId) || {}).nombre || v.choferId,
            producto: (Store.producto(Number(pid)) || {}).nombre || pid,
            quedaban: cantidad,
            notas: v.notas || '',
          });
        }
      }
      Util.descargar('visitas.csv', Util.aCSV(filas, ['fecha', 'hora', 'tienda', 'chofer', 'producto', 'quedaban', 'notas']), 'text/csv');
    });

    cont.querySelector('#dat-csv-despachos').addEventListener('click', () => {
      const filas = [];
      for (const desp of d.despachos) {
        for (const l of desp.lineas) {
          filas.push({
            fecha_despacho: desp.fechaDespacho,
            tienda: (Store.tienda(l.tiendaId) || {}).nombre || l.tiendaId,
            producto: (Store.producto(l.productoId) || {}).nombre || l.productoId,
            cantidad: l.cantidad,
          });
        }
      }
      Util.descargar('despachos.csv', Util.aCSV(filas, ['fecha_despacho', 'tienda', 'producto', 'cantidad']), 'text/csv');
    });

    cont.querySelector('#dat-demo').addEventListener('click', () => {
      if (!confirm('Esto reemplaza los datos actuales con un día de operación de demostración. ¿Continuar?')) return;
      Store.cargarDemo();
      App.aviso('Datos de demostración cargados 🎬');
      App.ir('panel');
    });
    cont.querySelector('#dat-reiniciar').addEventListener('click', () => {
      if (!confirm('Esto borra TODOS los datos registrados y vuelve a los datos de ejemplo. ¿Continuar?')) return;
      Store.reiniciarConEjemplo();
      App.aviso('Sistema reiniciado con datos de ejemplo');
      this.render(cont);
    });
  },
};
