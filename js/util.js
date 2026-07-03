/* Utilidades generales */
'use strict';

const Util = {
  /** Fecha local en formato YYYY-MM-DD */
  hoyISO() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
  },

  /** Suma dias a una fecha YYYY-MM-DD */
  sumarDias(fechaISO, dias) {
    const [y, m, d] = fechaISO.split('-').map(Number);
    const dt = new Date(y, m - 1, d + dias);
    return [
      dt.getFullYear(),
      String(dt.getMonth() + 1).padStart(2, '0'),
      String(dt.getDate()).padStart(2, '0'),
    ].join('-');
  },

  /** Dias transcurridos entre dos fechas YYYY-MM-DD (b - a) */
  diasEntre(a, b) {
    const [ya, ma, da] = a.split('-').map(Number);
    const [yb, mb, db] = b.split('-').map(Number);
    return Math.round((new Date(yb, mb - 1, db) - new Date(ya, ma - 1, da)) / 86400000);
  },

  fechaBonita(fechaISO) {
    if (!fechaISO) return '—';
    const [y, m, d] = fechaISO.split('-').map(Number);
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${d} ${meses[m - 1]} ${y}`;
  },

  horaActual() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  /** Normaliza texto para comparar nombres: minusculas, sin acentos, espacios colapsados */
  normalizar(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  /** Formatea un numero como moneda RD$ */
  moneda(n) {
    return 'RD$ ' + Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  entero(n) {
    return Number(n || 0).toLocaleString('es-DO');
  },

  /** Escapa HTML para insertar texto de usuario en plantillas */
  esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  /** Descarga un texto como archivo */
  descargar(nombre, contenido, tipo) {
    const blob = new Blob([contenido], { type: tipo || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  /** Convierte filas [{...}] a CSV con las columnas dadas */
  aCSV(filas, columnas) {
    const celda = (v) => {
      const s = String(v == null ? '' : v);
      return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lineas = [columnas.map(celda).join(',')];
    for (const f of filas) lineas.push(columnas.map((c) => celda(f[c])).join(','));
    return lineas.join('\n');
  },
};
