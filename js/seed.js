/*
 * Datos de ejemplo para el piloto.
 * IMPORTANTE: son datos ilustrativos. Los productos, precios, tiendas y rutas
 * reales se cargan/ajustan en la pestana "Configuracion" antes de usar el sistema.
 *
 * Segun el diagnostico:
 *  - 18 productos se despachan a diario.
 *  - 13 de esos productos son los que el chofer cuenta en tienda (conteoChofer).
 *  - 28 supermercados a nivel nacional, repartidos en rutas por chofer.
 */
'use strict';

const Seed = {
  crear() {
    const productos = [
      // Los primeros 13 son los que cuenta el chofer en tienda.
      { codigo: 'P01', nombre: 'Dulce de leche en corte',      precio: 145, par: 12, conteoChofer: true },
      { codigo: 'P02', nombre: 'Dulce de coco con leche',      precio: 135, par: 12, conteoChofer: true },
      { codigo: 'P03', nombre: 'Dulce de naranja',             precio: 130, par: 10, conteoChofer: true },
      { codigo: 'P04', nombre: 'Jalea de batata',              precio: 140, par: 10, conteoChofer: true },
      { codigo: 'P05', nombre: 'Dulce de guayaba',             precio: 130, par: 10, conteoChofer: true },
      { codigo: 'P06', nombre: 'Dulce de lechosa',             precio: 130, par: 8,  conteoChofer: true },
      { codigo: 'P07', nombre: 'Majarete',                     precio: 120, par: 8,  conteoChofer: true },
      { codigo: 'P08', nombre: 'Flan de coco',                 precio: 150, par: 8,  conteoChofer: true },
      { codigo: 'P09', nombre: 'Arroz con leche',              precio: 120, par: 8,  conteoChofer: true },
      { codigo: 'P10', nombre: 'Mini cheesecake de fresa',     precio: 195, par: 6,  conteoChofer: true },
      { codigo: 'P11', nombre: 'Mini cheesecake de chinola',   precio: 195, par: 6,  conteoChofer: true },
      { codigo: 'P12', nombre: 'Palitos de coco',              precio: 95,  par: 15, conteoChofer: true },
      { codigo: 'P13', nombre: 'Besitos de coco',              precio: 95,  par: 15, conteoChofer: true },
      // Los 5 restantes se despachan pero no entran en el conteo del chofer.
      { codigo: 'P14', nombre: 'Suspiritos',                   precio: 85,  par: 15, conteoChofer: false },
      { codigo: 'P15', nombre: 'Turron de mani',               precio: 90,  par: 12, conteoChofer: false },
      { codigo: 'P16', nombre: 'Canquina',                     precio: 75,  par: 12, conteoChofer: false },
      { codigo: 'P17', nombre: 'Dulce de platano',             precio: 110, par: 8,  conteoChofer: false },
      { codigo: 'P18', nombre: 'Gofio artesanal',              precio: 70,  par: 10, conteoChofer: false },
    ].map((p, i) => ({ id: i + 1, activo: true, ...p }));

    const choferes = [
      { id: 1, nombre: 'Ruta 1 — Distrito Nacional', activo: true },
      { id: 2, nombre: 'Ruta 2 — Santo Domingo Este/Norte', activo: true },
      { id: 3, nombre: 'Ruta 3 — Santiago y Cibao', activo: true },
      { id: 4, nombre: 'Ruta 4 — Este y Sur', activo: true },
    ];

    const nombresTiendas = [
      // Ruta 1
      ['Bravo Núñez de Cáceres', 1], ['Bravo 27 de Febrero', 1], ['Nacional Bella Vista', 1],
      ['Nacional Arroyo Hondo', 1], ['Jumbo Luperón', 1], ['La Sirena Churchill', 1], ['Plaza Lama Duarte', 1],
      // Ruta 2
      ['Bravo Charles de Gaulle', 2], ['Jumbo San Isidro', 2], ['La Sirena Megacentro', 2],
      ['Olé Las Américas', 2], ['Bravo Villa Mella', 2], ['Aprezio Sabana Perdida', 2], ['La Sirena Carretera Mella', 2],
      // Ruta 3
      ['Nacional Santiago', 3], ['La Sirena Estrella Sadhalá', 3], ['Bravo Santiago', 3],
      ['Jumbo Las Colinas', 3], ['Plaza Lama Santiago', 3], ['La Sirena Moca', 3], ['Nacional La Vega', 3],
      // Ruta 4
      ['Jumbo La Romana', 4], ['La Sirena Higüey', 4], ['Bravo San Pedro', 4],
      ['Olé San Cristóbal', 4], ['La Sirena Baní', 4], ['Jumbo Azua', 4], ['Nacional Punta Cana', 4],
    ];

    const tiendas = nombresTiendas.map(([nombre, choferId], i) => ({
      id: i + 1,
      nombre,
      choferId,
      activo: true,
      // Sobreescrituras de nivel par por producto para esta tienda: { productoId: par }
      parOverride: {},
    }));

    return {
      version: 1,
      productos,
      choferes,
      tiendas,
      // Ventas diarias reportadas por los supermercados: {fecha, tiendaId, productoId, cantidad}
      ventas: [],
      // Visitas de chofer (Componente B): {id, fecha, hora, tiendaId, choferId, conteos, notas, cerrada}
      visitas: [],
      // Despachos generados (Componente A): {id, fechaVenta, fechaDespacho, generadoEl, lineas, estado}
      despachos: [],
      secuencias: { visita: 1, despacho: 1 },
    };
  },

  /**
   * Datos de demostracion: catalogos de ejemplo + un dia de operacion completo
   * (ventas de ayer, despacho entregado hoy, visitas de chofer y ventas de hoy),
   * para que el equipo vea la herramienta funcionando con un solo clic.
   * Las cantidades son deterministas (dependen de los ids) para que la demo
   * sea coherente: stock = conteo + despacho de hoy.
   */
  demo() {
    const datos = this.crear();
    const hoy = Util.hoyISO();
    const ayer = Util.sumarDias(hoy, -1);
    const cant = (t, p, base) => Math.max(0, ((t.id * 3 + p.id * 5 + base) % 6) - 1); // 0..4

    // Ventas de AYER en todas las tiendas
    for (const t of datos.tiendas) {
      for (const p of datos.productos) {
        const c = cant(t, p, 1);
        if (c > 0) datos.ventas.push({ fecha: ayer, tiendaId: t.id, productoId: p.id, cantidad: c });
      }
    }

    // Despacho ENTREGADO HOY, calculado de las ventas de ayer (reponer lo vendido)
    const lineas = datos.ventas
      .filter((v) => v.fecha === ayer)
      .map((v) => ({ tiendaId: v.tiendaId, productoId: v.productoId, cantidad: v.cantidad }));
    datos.despachos.push({
      id: datos.secuencias.despacho++,
      fechaVenta: ayer,
      fechaDespacho: hoy,
      generadoEl: `${ayer} 18:30`,
      lineas,
    });

    // Visitas de chofer cerradas HOY en las rutas 1 y 2 (las demas quedan pendientes,
    // para que se vea la diferencia en el Panel)
    const conteo = datos.productos.filter((p) => p.conteoChofer);
    for (const t of datos.tiendas.filter((x) => x.choferId <= 2)) {
      const visita = {
        id: datos.secuencias.visita++,
        fecha: hoy,
        hora: `0${7 + (t.id % 3)}:${String(10 + t.id).slice(-2)}`,
        tiendaId: t.id,
        choferId: t.choferId,
        conteos: {},
        notas: '',
        cerrada: true,
      };
      for (const p of conteo) visita.conteos[p.id] = cant(t, p, 3);
      datos.visitas.push(visita);
    }

    // Ventas de HOY reportadas por las tiendas de las rutas 1 y 2
    for (const t of datos.tiendas.filter((x) => x.choferId <= 2)) {
      for (const p of datos.productos) {
        const c = cant(t, p, 2);
        if (c > 0) datos.ventas.push({ fecha: hoy, tiendaId: t.id, productoId: p.id, cantidad: c });
      }
    }
    return datos;
  },
};
