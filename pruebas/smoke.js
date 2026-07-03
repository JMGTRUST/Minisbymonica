/*
 * Prueba de humo end-to-end de la app estatica.
 * Uso:  npm i playwright-core  y luego  node pruebas/smoke.js
 * Si Chromium no esta donde Playwright lo busca por defecto, apuntar CHROME_BIN
 * al ejecutable (p. ej. CHROME_BIN=/usr/bin/chromium node pruebas/smoke.js).
 */
const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const browser = await chromium.launch(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errores = [];
  page.on('pageerror', (e) => errores.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push('console: ' + m.text()); });

  const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
  page.on('dialog', (d) => d.accept());
  await page.goto(url);

  const assert = (cond, msg) => { if (!cond) throw new Error('FALLO: ' + msg); console.log('OK  ' + msg); };

  // Primera vez: guia de bienvenida en lugar de panel vacio
  assert(await page.locator('.bienvenida').count() === 1, 'Primera apertura muestra la guía de bienvenida');

  // Demo de un clic
  await page.click('#bienv-demo');
  await page.waitForSelector('.kpi');
  assert(await page.locator('.kpi').count() === 4, 'Demo carga el Panel con 4 KPIs');
  const kpiDemo = await page.locator('.kpi-valor').first().innerText();
  assert(kpiDemo !== 'RD$ 0.00', 'KPI de consignación con datos de demo: ' + kpiDemo);

  // Despacho: detalle de tiendas a las que faltan ventas (demo: 14 de 28)
  await page.click('[data-vista="despacho"]');
  assert(await page.locator('.detalle-faltantes').count() === 1, 'Despacho lista las tiendas sin ventas registradas');

  // Memoria de pestana tras recargar
  await page.reload();
  assert((await page.locator('#nav .tab.activo').innerText()).includes('Despacho'), 'La app recuerda la última pestaña');

  // Reiniciar para probar el flujo real desde cero
  await page.click('[data-vista="datos"]');
  await page.click('#dat-reiniciar');
  await page.click('[data-vista="panel"]');
  assert(await page.locator('.bienvenida').count() === 1, 'Reiniciar vuelve a la guía de bienvenida');
  await page.click('#bienv-demo'); // vuelve a poblar
  await page.click('[data-vista="datos"]');
  await page.click('#dat-reiniciar'); // y limpio otra vez: quedo en estado inicial
  await page.click('[data-vista="panel"]');
  // Visita de chofer (Componente B): no cierra incompleta
  await page.click('[data-vista="visitas"]');
  await page.click('[data-iniciar="1"]');
  assert(await page.locator('.vis-conteo').count() === 13, 'Formulario de visita tiene 13 productos');
  assert(await page.locator('.btn-cero').count() === 13, 'Cada producto tiene botón rápido de 0');
  // Llenar solo 7 (el caso real del diagnóstico): 5 digitados + 2 con el botón "0"
  const inputs = page.locator('.vis-conteo');
  for (let i = 0; i < 5; i++) await inputs.nth(i).fill(String(i + 1));
  await page.locator('.btn-cero').nth(5).click();
  await page.locator('.btn-cero').nth(6).click();
  assert((await page.locator('#vis-progreso-texto').innerText()).includes('7 de 13'), 'Progreso marca 7 de 13 (botón 0 cuenta)');
  await page.click('#vis-cerrar');
  assert(!(await page.locator('#vis-error').isHidden()), 'Visita con 7/13 NO se puede cerrar (muestra error)');
  for (let i = 7; i < 13; i++) await inputs.nth(i).fill('0');
  await page.click('#vis-cerrar');
  await page.waitForSelector('[data-ver]');
  assert(await page.locator('[data-ver]').count() >= 1, 'Visita con 13/13 se cierra correctamente');

  // Despacho (Componente A): pegar ventas en formato matriz
  await page.click('[data-vista="despacho"]');
  await page.click('[data-metodo="pegar"]');
  const pegado = [
    'Tienda\tDulce de leche en corte\tPalitos de coco',
    'Bravo Núñez de Cáceres\t4\t6',
    'Jumbo San Isidro\t3\t5',
    'Tienda Fantasma\t9\t9',
  ].join('\n');
  await page.fill('#desp-pegar', pegado);
  await page.click('#desp-btn-pegar');
  let res = await page.locator('#desp-import-resultado').innerText();
  assert(res.includes('2') && res.includes('tiendas'), 'Importación registró 2 tiendas: ' + res.split('\n')[0]);
  assert(res.includes('Tienda Fantasma'), 'Tienda no reconocida se reporta como error');

  // Calcular y confirmar despacho
  await page.click('#desp-calcular');
  assert(await page.locator('.desp-cant').count() > 0, 'Tabla de despacho generada');
  // La tienda 1 tiene conteo → criterio par en productos de conteo
  assert(await page.locator('.criterio-par').count() > 0, 'Hay celdas calculadas por nivel par (tienda con conteo)');
  // Regresión del cálculo: conteo de la mañana 1 unid., venta del día 4 unid.
  // → stock 0 (no 1) → sugerido = par 12. Con venta ignorada saldría 11.
  const p01 = await page.locator('.desp-cant[data-tienda="1"][data-producto="1"]').inputValue();
  assert(p01 === '12', `Venta del día del conteo se descuenta del stock (sugerido P01 = ${p01}, esperado 12)`);
  // Producto contado (2 unid.) y sin venta hoy → sugerido = 12 - 2 = 10
  const p02 = await page.locator('.desp-cant[data-tienda="1"][data-producto="2"]').inputValue();
  assert(p02 === '10', `Producto sin venta repone hasta par (sugerido P02 = ${p02}, esperado 10)`);
  await page.click('#desp-confirmar');
  await page.waitForSelector('[data-imprimir]');
  assert(await page.locator('[data-imprimir]').count() >= 1, 'Despacho guardado aparece en historial');
  const hojas = await page.locator('#area-impresion .hoja').count();
  assert(hojas >= 2, `Hojas de reparto + producción generadas (${hojas})`);

  // Panel refleja el movimiento
  await page.click('[data-vista="panel"]');
  const kpi = await page.locator('.kpi-valor').first().innerText();
  assert(kpi.includes('RD$'), 'KPI de consignación en RD$: ' + kpi);
  assert((await page.locator('#vista tbody tr').count()) === 28, 'Panel lista 28 tiendas');
  const primeraFila = await page.locator('#vista tbody tr').first().innerText();
  assert(primeraFila.includes('Visitada hoy'), 'Tienda 1 aparece como visitada hoy');

  // Persistencia: recargar y verificar que el despacho sigue
  await page.reload();
  await page.click('[data-vista="despacho"]');
  assert(await page.locator('[data-imprimir]').count() >= 1, 'Datos persisten tras recargar');

  // Configuración carga
  await page.click('[data-vista="config"]');
  assert((await page.locator('#conf-cuerpo tbody tr').count()) === 18, 'Configuración lista 18 productos');
  await page.click('[data-vista="datos"]');
  assert((await page.locator('#dat-exportar').count()) === 1, 'Pestaña Datos carga');

  const erroresReales = errores.filter((e) => !e.includes('favicon'));
  if (erroresReales.length) throw new Error('Errores de consola/página:\n' + erroresReales.join('\n'));
  console.log('\n✅ Prueba de humo completa sin errores');
  await browser.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
