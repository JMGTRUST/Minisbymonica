/*
 * Capa de datos del sistema.
 *
 * Para el piloto la persistencia es localStorage (funciona sin servidor y sin
 * internet). Toda lectura/escritura pasa por este modulo, de modo que migrar a
 * un backend compartido (Google Sheets / Airtable via n8n, u Odoo) solo
 * requiere reemplazar `cargar()` y `guardar()`.
 */
'use strict';

const Store = {
  CLAVE: 'minis_reparto_v1',
  datos: null,

  init() {
    const crudo = localStorage.getItem(this.CLAVE);
    if (crudo) {
      try {
        this.datos = JSON.parse(crudo);
      } catch (e) {
        console.error('Datos corruptos en localStorage, se reinicia con datos de ejemplo', e);
        this.datos = null;
      }
    }
    if (!this.datos) {
      this.datos = Seed.crear();
      this.guardar();
    }
  },

  guardar() {
    localStorage.setItem(this.CLAVE, JSON.stringify(this.datos));
  },

  reiniciarConEjemplo() {
    this.datos = Seed.crear();
    this.guardar();
  },

  cargarDemo() {
    this.datos = Seed.demo();
    this.guardar();
  },

  /** true mientras no se haya registrado ningun movimiento (para mostrar la guia de inicio) */
  sinMovimientos() {
    return !this.datos.ventas.length && !this.datos.visitas.length && !this.datos.despachos.length;
  },

  importarJSON(texto) {
    const obj = JSON.parse(texto);
    if (!obj || !Array.isArray(obj.productos) || !Array.isArray(obj.tiendas)) {
      throw new Error('El archivo no tiene el formato de respaldo esperado.');
    }
    this.datos = obj;
    this.guardar();
  },

  /* ---------- Catalogos ---------- */

  productos(soloActivos = true) {
    return this.datos.productos.filter((p) => !soloActivos || p.activo);
  },

  productosConteo() {
    return this.productos().filter((p) => p.conteoChofer);
  },

  producto(id) {
    return this.datos.productos.find((p) => p.id === id);
  },

  tiendas(soloActivas = true) {
    return this.datos.tiendas.filter((t) => !soloActivas || t.activo);
  },

  tienda(id) {
    return this.datos.tiendas.find((t) => t.id === id);
  },

  choferes(soloActivos = true) {
    return this.datos.choferes.filter((c) => !soloActivos || c.activo);
  },

  chofer(id) {
    return this.datos.choferes.find((c) => c.id === id);
  },

  tiendasDeChofer(choferId) {
    return this.tiendas().filter((t) => t.choferId === choferId);
  },

  /** Nivel par (stock objetivo) de un producto en una tienda */
  par(tiendaId, productoId) {
    const t = this.tienda(tiendaId);
    if (t && t.parOverride && t.parOverride[productoId] != null) return Number(t.parOverride[productoId]);
    const p = this.producto(productoId);
    return p ? Number(p.par || 0) : 0;
  },

  /* ---------- Busqueda por nombre/codigo (para importar ventas) ---------- */

  buscarProducto(texto) {
    const n = Util.normalizar(texto);
    if (!n) return null;
    return (
      this.productos(false).find((p) => Util.normalizar(p.codigo) === n) ||
      this.productos(false).find((p) => Util.normalizar(p.nombre) === n) ||
      this.productos(false).find((p) => Util.normalizar(p.nombre).includes(n) || n.includes(Util.normalizar(p.nombre))) ||
      null
    );
  },

  buscarTienda(texto) {
    const n = Util.normalizar(texto);
    if (!n) return null;
    return (
      this.tiendas(false).find((t) => Util.normalizar(t.nombre) === n) ||
      this.tiendas(false).find((t) => Util.normalizar(t.nombre).includes(n) || n.includes(Util.normalizar(t.nombre))) ||
      null
    );
  },

  /* ---------- Ventas ---------- */

  /** Reemplaza las ventas de una tienda para una fecha */
  registrarVentasTienda(fecha, tiendaId, cantidades /* {productoId: cantidad} */) {
    this.datos.ventas = this.datos.ventas.filter((v) => !(v.fecha === fecha && v.tiendaId === tiendaId));
    for (const [productoId, cantidad] of Object.entries(cantidades)) {
      const c = Number(cantidad);
      if (Number.isFinite(c) && c > 0) {
        this.datos.ventas.push({ fecha, tiendaId, productoId: Number(productoId), cantidad: c });
      }
    }
    this.guardar();
  },

  ventasDe(fecha, tiendaId) {
    const mapa = {};
    for (const v of this.datos.ventas) {
      if (v.fecha === fecha && v.tiendaId === tiendaId) mapa[v.productoId] = (mapa[v.productoId] || 0) + v.cantidad;
    }
    return mapa;
  },

  tiendasConVentas(fecha) {
    return new Set(this.datos.ventas.filter((v) => v.fecha === fecha).map((v) => v.tiendaId));
  },

  /* ---------- Visitas (Componente B) ---------- */

  crearVisita(tiendaId, choferId, fecha) {
    // Limpia visitas que quedaron abiertas de dias anteriores para esta tienda
    // (el chofer empezo y no cerro): no aportan al stock y solo acumulan basura.
    this.datos.visitas = this.datos.visitas.filter((x) => x.cerrada || x.tiendaId !== tiendaId);
    const v = {
      id: this.datos.secuencias.visita++,
      fecha,
      hora: null,
      tiendaId,
      choferId,
      conteos: {}, // {productoId: cantidad} — solo cuenta como completo si TODOS los productos de conteo tienen valor
      notas: '',
      cerrada: false,
    };
    this.datos.visitas.push(v);
    this.guardar();
    return v;
  },

  visita(id) {
    return this.datos.visitas.find((v) => v.id === id);
  },

  visitaAbierta(tiendaId, fecha) {
    return this.datos.visitas.find((v) => v.tiendaId === tiendaId && v.fecha === fecha && !v.cerrada);
  },

  visitaCerrada(tiendaId, fecha) {
    return this.datos.visitas.find((v) => v.tiendaId === tiendaId && v.fecha === fecha && v.cerrada);
  },

  /** Productos de conteo que aun no tienen valor en la visita */
  faltantesDeVisita(visita) {
    return this.productosConteo().filter((p) => {
      const c = visita.conteos[p.id];
      return c === undefined || c === null || c === '';
    });
  },

  /** Cierra la visita SOLO si los 13 productos de conteo tienen valor. Regla central del Componente B. */
  cerrarVisita(id) {
    const v = this.visita(id);
    if (!v) throw new Error('Visita no encontrada');
    const faltan = this.faltantesDeVisita(v);
    if (faltan.length > 0) {
      return { ok: false, faltan };
    }
    v.cerrada = true;
    v.hora = Util.horaActual();
    this.guardar();
    return { ok: true };
  },

  ultimaVisitaCerrada(tiendaId, hastaFecha) {
    let mejor = null;
    for (const v of this.datos.visitas) {
      if (v.tiendaId !== tiendaId || !v.cerrada) continue;
      if (hastaFecha && v.fecha > hastaFecha) continue;
      if (!mejor || v.fecha > mejor.fecha || (v.fecha === mejor.fecha && v.id > mejor.id)) mejor = v;
    }
    return mejor;
  },

  /* ---------- Despachos (Componente A) ---------- */

  guardarDespacho(fechaVenta, lineas /* [{tiendaId, productoId, cantidad}] */) {
    const fechaDespacho = Util.sumarDias(fechaVenta, 1);
    // Un despacho por fecha de despacho: si se regenera, se reemplaza.
    this.datos.despachos = this.datos.despachos.filter((d) => d.fechaDespacho !== fechaDespacho);
    const d = {
      id: this.datos.secuencias.despacho++,
      fechaVenta,
      fechaDespacho,
      generadoEl: `${Util.hoyISO()} ${Util.horaActual()}`,
      lineas: lineas.filter((l) => Number(l.cantidad) > 0),
    };
    this.datos.despachos.push(d);
    this.guardar();
    return d;
  },

  despachoPorFecha(fechaDespacho) {
    return this.datos.despachos.find((d) => d.fechaDespacho === fechaDespacho);
  },

  despachosOrdenados() {
    return [...this.datos.despachos].sort((a, b) => (a.fechaDespacho < b.fechaDespacho ? 1 : -1));
  },

  /* ---------- Stock estimado (corazon de la visibilidad en tiempo real) ---------- */

  /**
   * Estima el stock de un producto en una tienda a una fecha dada.
   *
   * Modelo: el conteo del chofer es la foto mas confiable, y ocurre en la
   * manana, ANTES de las ventas y de la reposicion de ese dia. A partir de ahi:
   *   stock = conteo
   *         + despachos entregados desde el dia de la visita (inclusive: el
   *           chofer cuenta lo que queda y LUEGO repone)
   *         - ventas desde el dia de la visita (inclusive: la venta del dia
   *           ocurre despues del conteo de la manana).
   *
   * Devuelve null si nunca ha habido un conteo cerrado para la tienda.
   */
  stockEstimado(tiendaId, productoId, hastaFecha) {
    const visita = this.ultimaVisitaCerrada(tiendaId, hastaFecha);
    if (!visita) return null;
    let stock = Number(visita.conteos[productoId] || 0);
    for (const d of this.datos.despachos) {
      if (d.fechaDespacho >= visita.fecha && d.fechaDespacho <= hastaFecha) {
        for (const l of d.lineas) {
          if (l.tiendaId === tiendaId && l.productoId === productoId) stock += Number(l.cantidad);
        }
      }
    }
    for (const v of this.datos.ventas) {
      if (v.tiendaId === tiendaId && v.productoId === productoId && v.fecha >= visita.fecha && v.fecha <= hastaFecha) {
        stock -= Number(v.cantidad);
      }
    }
    return Math.max(0, stock);
  },

  /** Stock estimado de todos los productos de una tienda. null si no hay conteo. */
  stockTienda(tiendaId, hastaFecha) {
    const visita = this.ultimaVisitaCerrada(tiendaId, hastaFecha);
    if (!visita) return null;
    const res = { visita, porProducto: {}, totalUnidades: 0, valor: 0 };
    for (const p of this.productos()) {
      const s = this.stockEstimado(tiendaId, p.id, hastaFecha);
      res.porProducto[p.id] = s;
      res.totalUnidades += s || 0;
      res.valor += (s || 0) * Number(p.precio || 0);
    }
    return res;
  },

  /**
   * Calcula el despacho sugerido para la fecha de venta dada (a entregar al
   * dia siguiente). Logica:
   *  - Si hay conteo de chofer: llevar la tienda a su nivel par
   *    (sugerido = par - stock estimado).
   *  - Si el producto no tiene conteo o la tienda nunca ha sido contada:
   *    reponer lo vendido (el criterio del Excel actual).
   */
  calcularDespacho(fechaVenta) {
    const lineas = [];
    for (const t of this.tiendas()) {
      const ventas = this.ventasDe(fechaVenta, t.id);
      const stock = this.stockTienda(t.id, fechaVenta);
      for (const p of this.productos()) {
        const vendido = Number(ventas[p.id] || 0);
        const par = this.par(t.id, p.id);
        let sugerido;
        let criterio;
        if (stock && p.conteoChofer && par > 0) {
          sugerido = Math.max(0, par - (stock.porProducto[p.id] || 0));
          criterio = 'par';
        } else {
          sugerido = vendido;
          criterio = 'venta';
        }
        lineas.push({ tiendaId: t.id, productoId: p.id, vendido, sugerido, criterio });
      }
    }
    return lineas;
  },
};
