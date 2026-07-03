/* Ayuda — guia del dia a dia en lenguaje simple, para quien no tomo la capacitacion */
'use strict';

const Ayuda = {
  render(cont) {
    cont.innerHTML = `
      <div class="card">
        <h3>❓ ¿Cómo se usa en el día a día?</h3>
        <ol class="pasos">
          <li><strong>En la mañana, el chofer</strong> abre <strong>🏪 Visita de tienda</strong> en su teléfono,
            elige su ruta (el teléfono la recuerda) y en cada tienda cuenta lo que queda en el exhibidor.
            Si de un producto no queda nada, toca el botón <strong>0</strong>.
            La visita no se puede cerrar hasta contar los 13 productos — así no se queda ninguno sin revisar.</li>
          <li><strong>En la tarde, en la oficina</strong>, se abre <strong>🚚 Despacho</strong>, se pega el reporte
            de ventas del día tal como viene en Excel y se presiona <em>Calcular</em>. El sistema propone cuánto
            enviar a cada tienda; se ajusta lo que haga falta y se confirma.</li>
          <li><strong>Al confirmar</strong> se imprimen solas las <strong>hojas de reparto</strong> (una por chofer,
            con espacio para la firma de recibido) y la <strong>hoja de producción</strong> para la cocina.</li>
          <li><strong>En cualquier momento</strong>, el <strong>📊 Panel</strong> muestra cuánta mercancía
            —y cuánto dinero— hay en cada tienda, y cuáles tiendas llevan días sin contarse.</li>
        </ol>
      </div>
      <div class="card">
        <h3>Preguntas frecuentes</h3>
        <p><strong>¿Cómo decide el sistema cuánto enviar?</strong><br>
        Si la tienda tiene conteo del chofer, la rellena hasta su <em>nivel par</em> (el stock ideal que se define
        en Configuración). Si no hay conteo, repone lo vendido — igual que el Excel de siempre. Toda cantidad se
        puede corregir a mano antes de confirmar.</p>
        <p><strong>¿Qué pasa si el chofer se queda sin internet?</strong><br>
        Todo se guarda en el teléfono: los conteos no se pierden al cerrar o recargar la página.
        Y cuando la app está publicada en internet, el teléfono guarda una copia la primera vez que la abre,
        así que sigue abriendo aunque no haya señal en el supermercado.</p>
        <p><strong>¿Y si me equivoqué en un conteo o en las ventas?</strong><br>
        Las visitas cerradas se pueden reabrir desde la lista de la ruta (botón <em>Ver → Reabrir</em>), y las
        ventas de una tienda se pueden volver a cargar: lo nuevo reemplaza lo anterior para ese día.</p>
        <p><strong>¿Dónde quedan guardados los datos?</strong><br>
        En este dispositivo. En <strong>💾 Datos</strong> puedes descargar un respaldo (guárdalo en el Drive)
        y exportar todo el historial a Excel/CSV. Nada se borra solo, a diferencia de los grupos de WhatsApp.</p>
        <p><strong>¿Puedo probar sin dañar nada?</strong><br>
        Sí: en <strong>💾 Datos</strong> está <em>Cargar datos de demostración</em> para explorar con un día de
        operación inventado, y <em>Reiniciar</em> para dejar todo limpio cuando vayas a empezar de verdad.</p>
      </div>
      <div class="card">
        <p class="ayuda">Piloto desarrollado por The Trust for the Americas a partir del diagnóstico del 2 de julio
        de 2026. Dudas o mejoras: escríbenos en el grupo de WhatsApp del proyecto.</p>
      </div>
    `;
  },
};
