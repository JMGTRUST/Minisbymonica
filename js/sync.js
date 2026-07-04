/*
 * Sincronizacion con la base compartida (Supabase).
 *
 * Diseño: localStorage sigue siendo la cache de trabajo (la app entera es
 * sincrona y funciona sin internet). Esta capa la espeja contra Supabase:
 *
 *   - Al iniciar: si la base tiene catalogos, se descarga todo (la base manda);
 *     si la base esta vacia, se sube el estado local (primer dispositivo la
 *     siembra).
 *   - Cada mutacion local se empuja a la base (con debounce).
 *   - Una suscripcion realtime recarga los datos ante cualquier cambio ajeno
 *     (otro dispositivo, el agente de WhatsApp) y refresca la vista.
 *
 * Si js/supabase-config.js no esta configurado, nada de esto se activa y la
 * app queda en modo local puro.
 */
'use strict';

const Sync = {
  cliente: null,
  estado: 'local', // 'local' | 'conectando' | 'enlinea' | 'error'
  timers: {},

  disponible() {
    return !!(window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey);
  },

  activo() {
    return this.estado === 'enlinea';
  },

  /** La libreria de Supabase solo se descarga si hay base configurada: el modo local no toca la red */
  cargarLibreria() {
    if (window.supabase) return Promise.resolve();
    return new Promise((listo) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
      s.onload = listo;
      s.onerror = listo; // sin internet: init() lo detecta y marca estado de error
      document.head.appendChild(s);
    });
  },

  async init() {
    if (!this.disponible()) return;
    this.estado = 'conectando';
    App.pintarEstadoSync();
    await this.cargarLibreria();
    if (!window.supabase) {
      this.estado = 'error';
      App.pintarEstadoSync();
      return;
    }
    try {
      this.cliente = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
      const { data: productos, error } = await this.cliente.from('productos').select('id').limit(1);
      if (error) throw error;
      if (!productos.length) {
        // Base recien creada sin seed: este dispositivo la siembra
        this.estado = 'enlinea';
        await this.subirTodo();
      } else {
        await this.recargar();
        this.estado = 'enlinea';
      }
      this.cliente
        .channel('cambios-minis')
        .on('postgres_changes', { event: '*', schema: 'public' }, () => this.programarRecarga())
        .subscribe();
    } catch (e) {
      console.error('Sync: no se pudo conectar a la base compartida', e);
      this.estado = 'error';
    }
    App.pintarEstadoSync();
  },

  /* ---------- Descarga (la base -> la app) ---------- */

  programarRecarga() {
    clearTimeout(this.timers.recarga);
    this.timers.recarga = setTimeout(async () => {
      try {
        await this.recargar();
        App.refrescar();
      } catch (e) {
        console.error('Sync: recarga fallida', e);
      }
    }, 800);
  },

  async recargar() {
    const q = (tabla) => this.cliente.from(tabla).select('*').then(({ data, error }) => {
      if (error) throw error;
      return data;
    });
    const [choferes, tiendas, productos, ventas, visitas, inventario, despachos, lineas] = await Promise.all([
      q('choferes'), q('tiendas'), q('productos'), q('ventas'),
      q('visitas'), q('inventario_visita'), q('despachos'), q('despacho_lineas'),
    ]);

    const conteosPorVisita = {};
    for (const r of inventario) {
      if (r.cantidad_encontrada == null) continue;
      (conteosPorVisita[r.visita_id] = conteosPorVisita[r.visita_id] || {})[r.producto_id] = Number(r.cantidad_encontrada);
    }
    const lineasPorDespacho = {};
    for (const r of lineas) {
      (lineasPorDespacho[r.despacho_id] = lineasPorDespacho[r.despacho_id] || []).push({
        tiendaId: Number(r.tienda_id), productoId: Number(r.producto_id), cantidad: Number(r.cantidad),
      });
    }

    const d = Store.datos;
    d.choferes = choferes.map((c) => ({ id: Number(c.id), nombre: c.nombre, activo: c.activo }));
    d.tiendas = tiendas.map((t) => ({
      id: Number(t.id), nombre: t.nombre, choferId: Number(t.chofer_id), activo: t.activo,
      parOverride: t.par_override || {},
    }));
    d.productos = productos.map((p) => ({
      id: Number(p.id), codigo: p.codigo || '', nombre: p.nombre, precio: Number(p.precio),
      par: Number(p.par), conteoChofer: p.es_producto_tienda, activo: p.activo,
    }));
    d.ventas = ventas.map((v) => ({
      fecha: v.fecha, tiendaId: Number(v.tienda_id), productoId: Number(v.producto_id), cantidad: Number(v.cantidad),
    }));
    d.visitas = visitas.map((v) => ({
      id: Number(v.id), fecha: v.fecha, hora: v.hora, tiendaId: Number(v.tienda_id),
      choferId: v.chofer_id == null ? null : Number(v.chofer_id),
      notas: v.notas || '', cerrada: v.cerrada, conteos: conteosPorVisita[v.id] || {},
    }));
    d.despachos = despachos.map((x) => ({
      id: Number(x.id), fechaVenta: x.fecha_venta, fechaDespacho: x.fecha_despacho,
      generadoEl: x.generado_el || '', lineas: lineasPorDespacho[x.id] || [],
    }));

    // Si el chofer tiene una visita abierta en pantalla, su copia local manda
    // (evita perder digitaciones que aun no llegaron a la base)
    if (typeof Visitas !== 'undefined' && Visitas.visitaActivaId) {
      const local = this._visitaLocalActiva;
      if (local && local.id === Visitas.visitaActivaId && !local.cerrada) {
        d.visitas = d.visitas.filter((v) => v.id !== local.id);
        d.visitas.push(local);
      }
    }
    Store.guardarSoloLocal();
  },

  /* ---------- Subida (la app -> la base) ---------- */

  _error(paso) {
    return (res) => {
      if (res && res.error) console.error(`Sync: fallo al subir ${paso}`, res.error);
      return res;
    };
  },

  async subirTodo() {
    if (!this.activo()) return;
    await this.pushCatalogos();
    const porFechaTienda = {};
    for (const v of Store.datos.ventas) (porFechaTienda[`${v.fecha}|${v.tiendaId}`] = porFechaTienda[`${v.fecha}|${v.tiendaId}`] || []).push(v);
    for (const grupo of Object.values(porFechaTienda)) {
      const mapa = {};
      for (const v of grupo) mapa[v.productoId] = v.cantidad;
      await this.pushVentas(grupo[0].fecha, grupo[0].tiendaId, mapa);
    }
    for (const v of Store.datos.visitas) await this.pushVisita(v);
    for (const d of Store.datos.despachos) await this.pushDespacho(d);
  },

  /** Catalogos completos (pocas filas): upsert + borrado de los eliminados */
  pushCatalogos() {
    if (!this.activo()) return;
    clearTimeout(this.timers.catalogos);
    this.timers.catalogos = setTimeout(async () => {
      const d = Store.datos;
      await this.cliente.from('choferes').upsert(d.choferes.map((c) => ({ id: c.id, nombre: c.nombre, activo: c.activo }))).then(this._error('choferes'));
      await this.cliente.from('tiendas').upsert(d.tiendas.map((t) => ({
        id: t.id, nombre: t.nombre, chofer_id: t.choferId, activo: t.activo, par_override: t.parOverride || {},
      }))).then(this._error('tiendas'));
      await this.cliente.from('productos').upsert(d.productos.map((p) => ({
        id: p.id, codigo: p.codigo, nombre: p.nombre, precio: p.precio, par: p.par,
        es_producto_tienda: p.conteoChofer, activo: p.activo,
      }))).then(this._error('productos'));
      // Borrados (solo pueden borrarse sin historial, asi que es seguro)
      const ids = (arr) => `(${arr.map((x) => x.id).join(',')})`;
      if (d.productos.length) await this.cliente.from('productos').delete().not('id', 'in', ids(d.productos)).then(this._error('productos-borrar'));
      if (d.choferes.length) await this.cliente.from('choferes').delete().not('id', 'in', ids(d.choferes)).then(this._error('choferes-borrar'));
    }, 1200);
  },

  async pushVentas(fecha, tiendaId, cantidades) {
    if (!this.activo()) return;
    await this.cliente.from('ventas').delete().eq('fecha', fecha).eq('tienda_id', tiendaId).then(this._error('ventas-limpiar'));
    const filas = Object.entries(cantidades)
      .filter(([, c]) => Number(c) > 0)
      .map(([productoId, cantidad]) => ({ fecha, tienda_id: tiendaId, producto_id: Number(productoId), cantidad: Number(cantidad) }));
    if (filas.length) await this.cliente.from('ventas').insert(filas).then(this._error('ventas'));
  },

  /** Con debounce por visita: se llama en cada digitacion del chofer */
  programarPushVisita(visita) {
    if (!this.activo()) return;
    this._visitaLocalActiva = visita;
    clearTimeout(this.timers['visita' + visita.id]);
    this.timers['visita' + visita.id] = setTimeout(() => this.pushVisita(visita), 700);
  },

  async pushVisita(v) {
    if (!this.activo()) return;
    await this.cliente.from('visitas').upsert({
      id: v.id, fecha: v.fecha, hora: v.hora, tienda_id: v.tiendaId,
      chofer_id: v.choferId, notas: v.notas || '', cerrada: v.cerrada, origen: 'app',
    }).then(this._error('visita'));
    await this.cliente.from('inventario_visita').delete().eq('visita_id', v.id).then(this._error('inventario-limpiar'));
    const filas = Object.entries(v.conteos).map(([productoId, cantidad]) => ({
      visita_id: v.id, producto_id: Number(productoId), cantidad_encontrada: Number(cantidad),
    }));
    if (filas.length) await this.cliente.from('inventario_visita').insert(filas).then(this._error('inventario'));
  },

  async pushDespacho(d) {
    if (!this.activo()) return;
    // Un despacho por fecha de entrega: se reemplaza igual que localmente
    await this.cliente.from('despachos').delete().eq('fecha_despacho', d.fechaDespacho).then(this._error('despacho-limpiar'));
    await this.cliente.from('despachos').insert({
      id: d.id, fecha_venta: d.fechaVenta, fecha_despacho: d.fechaDespacho, generado_el: d.generadoEl,
    }).then(this._error('despacho'));
    const filas = d.lineas.map((l) => ({
      despacho_id: d.id, tienda_id: l.tiendaId, producto_id: l.productoId, cantidad: l.cantidad,
    }));
    if (filas.length) await this.cliente.from('despacho_lineas').insert(filas).then(this._error('despacho-lineas'));
  },
};
