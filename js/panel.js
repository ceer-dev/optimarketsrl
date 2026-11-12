/*
 * PANEL PARA CLIENTES — catálogo y pedido (OPTIMARKET S.R.L.)
 * --------------------------------------------------------------------------------------------
 * Funciona como el catálogo del ERP (Optiweb: registrar-venta/CatalogoProductos.jsx):
 *   - Lentilla, Block y Material Listo: se toca la subcategoría y se abre «Medida y cantidad». Se ESCRIBE la medida
 *     (Lentilla: +1.50-0.50 · Material Listo: Esfera + ADD · Block: Base + ADD), se ve si existe y su precio,
 *     se elige la cantidad y «Agregar al pedido». La ventana QUEDA ABIERTA para la siguiente medida (como en el ERP);
 *     se cierra con «Listo, cerrar». Extra para celular: sugerencias de medidas existentes mientras se escribe.
 *   - Demás categorías (monturas, accesorios…): se toca la subcategoría y se ven las tarjetas de cada producto con
 *     «+ Agregar» (ventana de cantidad).
 * Stock: NO se muestra (el del sistema no siempre está al día, decisión del dueño 2026-10-08). Se puede pedir toda medida
 *   que exista en el catálogo; OPTIMARKET confirma la disponibilidad al recibir el pedido.
 * Datos: carpeta catalogo/ (la genera el ERP con scripts/exportar-catalogo-clientes.js); cada categoría se baja al abrirla.
 * Tabla de precios (2026-11-11): en lentes, tocar la subcategoría abre primero sus PRECIOS POR RANGOS a la vista
 *   (js/tabla-precios.js: Esférico, Cilindro, Combinados / Esfera × ADD / Base × ADD, precio con la unidad: Lentilla ½ par y 1 par; Material Listo y Block 1 par) con las fotos
 *   de la subcategoría; «Hacer pedido» abre la ventana de medida de siempre.
 * Reloj y horario (2026-11-12, js/horario.js): hora de Bolivia en la cabecera con «Abierto / Cerrado»; al enviar el pedido
 *   fuera de horario, aviso con la próxima apertura y opción de enviarlo igual (se atiende al abrir).
 * Rutas (botón «atrás» del celular): #/ · #/c/<cat> · #/c/<cat>/t/<sub> (tabla de precios) · #/c/<cat>/m/<sub> (medidas) · #/c/<cat>/s/<sub> (productos)
 *   · #/c/<cat>/s/<sub>/p/<id> (cantidad) · #/pedido
 * Pensado para Android 11: JavaScript simple (sin sintaxis nueva), imágenes livianas que cargan al verse.
 * --------------------------------------------------------------------------------------------
 */
(function () {
  "use strict";

  var WHATSAPP = "59167724661";
  var CLAVE_PEDIDO = "pedidoPanel_v1";
  var LOGO = "images/optimarket_eye_logo.svg";
  var MAX_SUGERENCIAS = 8;
  // Versión que está corriendo = el ?v= con que index.html cargó este archivo (no hay que mantenerla a mano)
  var VERSION_ARCHIVOS = (function () {
    var tag = document.querySelector('script[src*="js/panel.js"]');
    var m = tag && /[?&]v=([^&]+)/.exec(tag.getAttribute("src"));
    return m ? m[1] : "";
  })();

  var vista = document.getElementById("vista");
  var cliente = leerJson(localStorage, "registeredClient") || {};
  var indice = null;
  var categorias = {};          // slug → datos de cat-<slug>.json
  var pedido = leerJson(localStorage, CLAVE_PEDIDO) || {};   // id → { id, cat, catSlug, sub, subId, medida, cf, qty }
  var vistaPintada = "";        // para no repintar la grilla al abrir/cerrar una ventana encima

  // ------------------------------------------------------------------ utilidades
  function leerJson(almacen, clave) { try { return JSON.parse(almacen.getItem(clave) || "null"); } catch (_) { return null; } }
  function guardarPedido() { try { localStorage.setItem(CLAVE_PEDIDO, JSON.stringify(pedido)); } catch (_) {} }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function bs(n) { return n == null ? "Sin precio aún" : "Bs " + Number(n).toFixed(2); }
  // Precio 0.00 en el sistema = todavía no definido: se ve, pero no se puede pedir (dueño 2026-11-12)
  var TITULO_SIN_PRECIO = "Precio en preparación";
  var TEXTO_SIN_PRECIO = "Todavía no tiene un precio definido, por eso aún no se puede pedir. Estará disponible muy pronto.";
  function avisoSinPrecio(nombre, rutaAlCerrar) {
    var wa = "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent("Hola, quisiera consultar por " + nombre + " (aún no tiene precio en la página).");
    abrirVentana(
      '<header class="ventana-cabecera"><div class="textos"><h2>⏳ ' + TITULO_SIN_PRECIO + "</h2><span>" + esc(nombre) + "</span></div>" +
      '<button type="button" class="ventana-x" data-cerrar aria-label="Cerrar">✕</button></header>' +
      '<div class="ventana-cuerpo"><p class="aviso-sin-precio">' + TEXTO_SIN_PRECIO + "</p></div>" +
      '<footer class="ventana-pie"><a class="boton boton-gris-chico" href="' + wa + '" target="_blank" rel="noopener">Consultar por WhatsApp</a>' +
      '<button type="button" class="boton boton-rojo" data-cerrar>Entendido</button></footer>', rutaAlCerrar || location.hash);
  }
  function normalizar(t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function aviso(texto) {
    var el = document.getElementById("aviso");
    el.textContent = texto; el.hidden = false;
    clearTimeout(aviso.t); aviso.t = setTimeout(function () { el.hidden = true; }, 2200);
  }
  function img(src, alt, clase) {
    var c = (clase || "") + (src ? "" : " sin-imagen");
    return '<img src="' + esc(src || LOGO) + '" alt="' + esc(alt) + '" loading="lazy" decoding="async"' +
      (c.trim() ? ' class="' + c.trim() + '"' : "") +
      ' onerror="this.onerror=null;this.src=\'' + LOGO + '\';this.className+=\' sin-imagen\'">';
  }
  function cargarJson(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }

  // Tipo de formulario de medida (igual que el ERP: utilidades/busquedaOptica.js determinarTipoBusquedaOptica)
  function tipoOptico(cat) {
    var c = normalizar(cat.nombre);
    if (c.indexOf("material listo") >= 0) return "materiallisto";
    if (c === "block") return "block";
    if (c.indexOf("lentilla") >= 0 || c.indexOf("lentes de contacto") >= 0) return "lentilla";
    return null;   // producto directo
  }
  // Material Listo y Block se venden SIEMPRE por PAR: cantidad 1 = 1 par (los 2 lentes) y el precio es el del par.
  // Lentilla: cantidad 1 = ½ par (un lente). (Confusión real 2026-11-12: un cliente puso 2 creyendo que era un par.)
  function vendePorPar(tipo) { return tipo === "materiallisto" || tipo === "block"; }
  // Por PAQUETE o DOCENA (estuches de monturas, dueño 2026-11-12): cantidad = paquetes/docenas; precio = el del paquete
  function presentacionDe(catSlug, id) {
    var d = categorias[catSlug];
    return d && d.presentaciones && d.presentaciones[id] ? d.presentaciones[id] : null;
  }
  function nombrePres(pres, qty) {
    var docena = pres.n === "Docena";
    return qty === 1 ? (docena ? "docena" : "paquete") : (docena ? "docenas" : "paquetes");
  }
  function tituloPres(pres) { return pres.n === "Docena" ? "Docena (12 unidades)" : "Paquete de " + pres.u + " unidades"; }
  // «10 unidades × Bs 10 = Bs 100»
  function cuentaPres(pres) {
    var pu = Number(pres.pu); var total = Math.round(pres.u * pu * 100) / 100;
    var m = function (v) { return Math.round(v * 100) % 100 ? v.toFixed(2) : v.toFixed(0); };
    return pres.u + " unidades × Bs " + m(pu) + " = Bs " + m(total);
  }
  function textoUnidad(qty, tipo, pres) {
    if (pres) return qty + " " + nombrePres(pres, qty) + " (" + qty * pres.u + " unid.)";
    if (!tipo) return qty + (qty === 1 ? " unid." : " unids.");
    if (vendePorPar(tipo)) return qty + (qty === 1 ? " par" : " pares");
    if (qty === 1) return "½ par";
    var pares = Math.floor(qty / 2); var medio = qty % 2 ? " ½" : "";
    return pares + medio + (pares === 1 && !medio ? " par" : " pares");
  }

  /*
   * Clave de comparación de medidas = misma normalización que el ERP
   * (registrar-venta/utilidades/comparadorMedidasEstricto.js normalizarMedidaCompleta), así «+1.5-0.5», «+1.50 -0.50»
   * y «+1.50-0.50» son la misma medida. El texto del catálogo viene «bonito» («+1.25 ADD +2.25», «Base 6 ADD 200»):
   * primero se lo devuelve a la forma del sistema y luego se normaliza igual que lo que escribe el cliente.
   */
  function claveMedida(texto) {
    var s = String(texto || "").trim();
    if (!s) return "";
    s = s.replace(/\s+ADD\s+/i, "_Adds: ").replace(/^Base\s+(?=\d)/i, "Base: ");
    s = s.replace(/^(medida|base)[:\s]*/i, "").trim();
    s = s.replace(/\s+(?=[+-]\d)/g, "");                                           // «+1.50 -0.50» → «+1.50-0.50»
    s = s.replace(/([+-])(\d+(?:\.\d+)?)/g, function (_, signo, num) { var p = parseFloat(num); return isNaN(p) ? signo + num : signo + p.toFixed(2); });
    s = s.replace(/\b(\d+\.\d+)\b/g, function (m) { var p = parseFloat(m); return isNaN(p) ? m : p.toFixed(2); });
    s = s.toLowerCase().replace(/adds?[:\s]*/g, "adds ").replace(/[_:]+/g, " ").replace(/\s+/g, " ").trim();
    s = s.replace(/\badds\s+([+-]?)(\d+(?:\.\d+)?)\b/g, function (_, signo, v) {
      var n = parseFloat(v); if (isNaN(n)) return "adds " + v;
      return n >= 50 && n <= 500 ? "adds +" + (n / 100).toFixed(2) : "adds +" + n.toFixed(2);
    });
    return s;
  }
  // Lo que escribe el cliente en el formulario → texto de medida (como obtenerMedidaVisualTexto del ERP)
  function medidaEscrita(tipo, campos) {
    if (tipo === "materiallisto") return campos.esfera && campos.add ? campos.esfera + "_Adds: " + campos.add : "";
    if (tipo === "block") return campos.base && campos.add ? "Base: " + campos.base + "_Adds: " + campos.add : "";
    return campos.medida || "";
  }
  /*
   * Dioptrías escritas sin punto, como en el ERP: «+250» → «+2.50», «-050» → «-0.50», «1000» → «10.00».
   * (Solo números de 3–4 cifras sin punto; «+2», «-1.5» quedan igual.)
   */
  function dioptriasSinPunto(texto) {
    return String(texto || "").replace(/,/g, ".").replace(/(^|[^\d.])(\d{3,4})(?![\d.])/g, function (_, antes, n) { return antes + n.slice(0, -2) + "." + n.slice(-2); });
  }
  // ¿Todavía está escribiendo? «+25» puede ser el inicio de «+250»: una dioptría entera mayor a 20 no existe
  function aMedioEscribir(texto) {
    var numeros = String(texto || "").match(/\d+(?:\.\d*)?/g) || [];
    for (var i = 0; i < numeros.length; i++) if (numeros[i].indexOf(".") < 0 && numeros[i].length === 2 && parseInt(numeros[i], 10) > 20) return true;
    return /[+\-.]$/.test(String(texto || "").trim());
  }
  function medidaCompleta(tipo, campos) {
    if (tipo === "materiallisto") return campos.esfera.length >= 2 && campos.add.length >= 1 && !aMedioEscribir(campos.esfera) && !aMedioEscribir(campos.add);
    if (tipo === "block") return campos.base.length >= 1 && campos.add.length >= 1 && !aMedioEscribir(campos.add);
    var m = campos.medida; return m.length >= 2 && !aMedioEscribir(m);
  }

  // ------------------------------------------------------------------ pedido
  function totales() {
    var lineas = 0; var total = 0; var consultar = 0;
    Object.keys(pedido).forEach(function (id) {
      var p = pedido[id]; lineas++;
      if (p.cf == null) consultar++; else total += p.cf * p.qty;
    });
    return { lineas: lineas, total: Math.round(total * 100) / 100, consultar: consultar };
  }
  function pintarBarra() {
    var t = totales();
    var cont = document.getElementById("contadorCarrito");
    cont.textContent = t.lineas; cont.hidden = t.lineas === 0;
    var sinBarra = t.lineas === 0 || location.hash === "#/pedido";
    document.getElementById("barraPedido").hidden = sinBarra;
    document.body.classList.toggle("sin-barra", sinBarra);
    document.body.classList.toggle("en-pedido", location.hash === "#/pedido");
    document.getElementById("barraCantidad").textContent = t.lineas + (t.lineas === 1 ? " producto" : " productos") + (t.consultar ? " · " + t.consultar + " a consultar" : "");
    document.getElementById("barraTotal").textContent = bs(t.total);
  }
  // reemplazar = true (Material Listo / Block): la medida queda con la cantidad elegida, no se suma a lo que ya había
  function sumarAlPedido(item, cantidad, reemplazar) {
    var actual = pedido[item.id] && !reemplazar ? pedido[item.id].qty : 0;
    pedido[item.id] = { id: item.id, cat: item.cat, catSlug: item.catSlug, sub: item.sub, subId: item.subId, medida: item.medida, cf: item.cf, tipo: item.tipo || null, pres: item.pres || null, qty: Math.min(999, actual + cantidad) };
    guardarPedido(); pintarBarra();
  }
  function cambiarEnPedido(id, delta) {
    var p = pedido[id]; if (!p) return;
    p.qty = Math.max(0, Math.min(999, p.qty + delta));
    if (!p.qty) delete pedido[id];
    guardarPedido(); pintarBarra();
  }
  function enPedidoDeSub(subId) { var n = 0; Object.keys(pedido).forEach(function (id) { if (pedido[id].subId === subId) n++; }); return n; }

  // ------------------------------------------------------------------ datos
  var diccionario = [];   // sinónimos de búsqueda: config/diccionario-busqueda.json («cr39» → Organico Blanco…)
  function asegurarIndice() {
    if (indice) return Promise.resolve(indice);
    var dic = cargarJson("config/diccionario-busqueda.json")
      .then(function (d) { diccionario = (d && d.sinonimos) || []; })
      .catch(function () { diccionario = []; });   // sin diccionario la búsqueda funciona igual
    return Promise.all([cargarJson("catalogo/indice.json"), dic]).then(function (x) { indice = x[0]; return indice; });
  }
  function textoBusqueda(t) { return normalizar(t).replace(/\s+/g, " ").trim(); }
  /* Entrada del diccionario para lo buscado: igual a una de sus palabras (o su comienzo, si ya escribió 2+ palabras) */
  function entradaDiccionario(q) {
    var b = textoBusqueda(q); if (!b) return null;
    var porComienzo = null;
    for (var i = 0; i < diccionario.length; i++) {
      var palabras = diccionario[i].palabras || [];
      for (var j = 0; j < palabras.length; j++) {
        var p = textoBusqueda(palabras[j]);
        if (p === b) return diccionario[i];
        // Comienzo solo con 2+ palabras («boca de» → «boca de pescado»); así «prog» o «blue» siguen buscando normal
        if (!porComienzo && b.indexOf(" ") > 0 && b.length >= 4 && p.indexOf(b) === 0) porComienzo = diccionario[i];
      }
    }
    return porComienzo;
  }
  function modeloEnEntrada(entrada, sub, fila) {
    return (entrada.modelos || []).some(function (m) { return textoBusqueda(m.subcategoria) === textoBusqueda(sub.nombre) && normalizar(fila[1]).indexOf(normalizar(m.modelo)) >= 0; });
  }
  // Otro nombre del modelo (ej. CUERINA → «Boca de Pescado»), para mostrarlo en la tarjeta
  function aliasDeModelo(sub, fila) {
    for (var i = 0; i < diccionario.length; i++) if (diccionario[i].etiqueta && modeloEnEntrada(diccionario[i], sub, fila)) return diccionario[i].etiqueta;
    return "";
  }
  function categoriaPorSlug(slug) {
    for (var i = 0; i < indice.categorias.length; i++) if (indice.categorias[i].slug === slug) return indice.categorias[i];
    return null;
  }
  function subDe(cat, subId) {
    for (var i = 0; i < cat.subcategorias.length; i++) if (String(cat.subcategorias[i].id) === String(subId)) return cat.subcategorias[i];
    return null;
  }
  function asegurarCategoria(cat) {
    if (categorias[cat.slug]) return Promise.resolve(categorias[cat.slug]);
    return cargarJson("catalogo/" + cat.archivo).then(function (d) {
      // Claves de comparación calculadas una sola vez por categoría
      Object.keys(d.subcategorias).forEach(function (k) { d.subcategorias[k].forEach(function (r) { r.clave = claveMedida(r[1]); }); });
      categorias[cat.slug] = d; return d;
    });
  }

  // ------------------------------------------------------------------ piezas comunes
  var ICONO_BUSCAR = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M10 2a8 8 0 0 1 6.3 12.9l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 1 1 10 2Zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z"/></svg>';
  function pastillasCategorias(slugActivo) {
    return '<nav class="filtros pastillas" aria-label="Categorías">' + indice.categorias.map(function (c) {
      return '<a class="chip" href="#/c/' + esc(c.slug) + '" aria-pressed="' + (c.slug === slugActivo) + '">' + esc(c.nombre) + "</a>";
    }).join("") + "</nav>";
  }
  function precioTarjeta(desde, prefijo) {
    return desde != null
      ? '<span class="precio">' + (prefijo ? prefijo + " " : "") + "<b>" + bs(desde) + "</b></span>"
      : '<span class="precio sin-precio">⏳ Próximamente</span>';
  }

  // ------------------------------------------------------------------ búsqueda global
  /*
   * ¿Lo escrito es una medida? «+2.50-0.50», «+250-050», «-1.5», «cil -0.25», «+1.25 add 200»…
   * Devuelve la medida ordenada (como la escribiría el ERP) o null si es texto normal.
   * Números de 3–4 cifras sin punto se leen como dioptrías: 250 → 2.50, 050 → 0.50 (igual que busquedaOptica.js del ERP).
   */
  function medidaDeBusqueda(q) {
    var t = normalizar(q).replace(/\s+/g, "").replace(/,/g, ".");
    if (!t) return null;
    var add = null; var m = /^(.*?)adds?:?(.*)$/.exec(t);
    if (m) { t = m[1]; add = m[2]; }
    var cil = false;
    if (t.indexOf("cil") === 0) { cil = true; t = t.slice(3); }
    if (!/^[+-]?\d+(\.\d+)?([+-]\d+(\.\d+)?)?$/.test(t)) return null;
    if (!cil && add == null && !/[+\-.]/.test(t)) return null;   // un número suelto (ej. un código) no es medida
    function dioptria(p, signoPorDefecto) {
      var signo = /^[+-]/.test(p) ? p.charAt(0) : signoPorDefecto;
      var n = p.replace(/^[+-]/, "");
      if (n.indexOf(".") < 0 && n.length >= 3) n = n.slice(0, -2) + "." + n.slice(-2);
      var v = parseFloat(n);
      return isNaN(v) || v > 40 ? null : signo + v.toFixed(2);
    }
    var partes = t.match(/[+-]?\d+(?:\.\d+)?/g) || [];
    if (add != null) {
      var esf = dioptria(partes[0], "+"); var ad = add ? dioptria(add.replace(/^\+/, ""), "+") : null;
      if (!esf || partes.length > 1) return null;
      return { tipo: "materiallisto", texto: esf + (ad ? " ADD " + ad : " ADD …"), campos: { esfera: esf, add: ad || "" } };
    }
    if (cil) {
      var c = dioptria(partes[0], "-"); if (!c || partes.length > 1) return null;
      return { tipo: "lentilla", texto: "cil " + c, campos: { medida: "cil " + c } };
    }
    var e = dioptria(partes[0], "+"); var ci = partes[1] ? dioptria(partes[1], "-") : null;
    if (!e || (partes[1] && !ci)) return null;
    return { tipo: "lentilla", texto: e + (ci ? " " + ci : ""), campos: { medida: e + (ci || "") } };
  }

  // Categorías de productos directos (son livianas): se bajan para poder buscar por código o modelo
  function asegurarDirectas() {
    return Promise.all(indice.categorias.filter(function (c) { return !tipoOptico(c); }).map(function (c) {
      return asegurarCategoria(c).catch(function () { return null; });
    }));
  }

  function tarjetaProducto(cat, sub, r, href) {
    var q = pedido[r[0]] ? pedido[r[0]].qty : 0;
    var accion = r[2] == null
      ? '<button type="button" class="boton boton-gris-chico boton-chico" data-sin-precio="' + esc(sub.nombre + " " + r[1]) + '">Sin precio aún</button>'
      : href
      ? '<a class="boton boton-rojo boton-chico" href="' + href + '">+ Agregar</a>'
      : '<button type="button" class="boton boton-rojo boton-chico" data-agregar="' + r[0] + '" data-cat="' + esc(cat.slug) + '" data-sub="' + sub.id + '">+ Agregar</button>';
    var pres = presentacionDe(cat.slug, r[0]);
    return '<div class="tarjeta-sub tarjeta-producto"><div class="foto">' + img(r[4], r[1]) + "</div>" +
      '<div class="info"><span class="nombre mono">' + esc(r[1]) + "</span>" +
      (pres ? '<span class="presentacion">📦 ' + tituloPres(pres) + "</span>" : "") +
      (aliasDeModelo(sub, r) ? '<span class="alias">También: ' + esc(aliasDeModelo(sub, r)) + "</span>" : "") +
      (pres && r[2] != null ? '<span class="cuenta-pres">' + cuentaPres(pres).replace(/ = (Bs [\d.]+)$/, " = <b>$1</b>") + "</span>" : precioTarjeta(r[2], "")) +
      (q ? '<span class="elegidos">' + textoUnidad(q, null, pres) + " en tu pedido</span>" : "") + accion + "</div></div>";
  }

  var MAX_MODELOS_BUSQUEDA = 12;
  function resultadosBusqueda(q, cont) {
    var medida = medidaDeBusqueda(q);
    if (medida) { resultadosMedida(medida, cont); return; }
    var palabras = normalizar(q).split(/\s+/).filter(Boolean);
    function coincide(texto) { var t = normalizar(texto); for (var i = 0; i < palabras.length; i++) if (t.indexOf(palabras[i]) < 0) return false; return true; }
    // Diccionario: si lo buscado es una de sus palabras, se muestran SOLO los productos que indica
    var dic = entradaDiccionario(q);
    var nombresDic = dic ? (dic.subcategorias || []).map(textoBusqueda) : [];
    function subDelDiccionario(s) { return nombresDic.indexOf(textoBusqueda(s.nombre)) >= 0; }
    // Relevancia: nombre igual a lo buscado > empieza igual > solo lo contiene
    var buscado = normalizar(q).replace(/\s+/g, " ");
    function puntaje(nombre) { var n = normalizar(nombre).replace(/\s+/g, " ").trim(); return n === buscado ? 3 : n.indexOf(buscado) === 0 ? 2 : 1; }
    var grupos = []; var hay = 0;
    indice.categorias.forEach(function (c, orden) {
      var optico = tipoOptico(c); var datos = categorias[c.slug]; var bloque = ""; var mejor = puntaje(c.nombre);
      var catCoincide = !dic && coincide(c.nombre);
      if (optico) {
        var subs = c.subcategorias.filter(function (s) { return dic ? subDelDiccionario(s) : catCoincide || coincide(c.nombre + " " + s.nombre); })
          .sort(function (a, b) { return dic ? nombresDic.indexOf(textoBusqueda(a.nombre)) - nombresDic.indexOf(textoBusqueda(b.nombre)) : puntaje(b.nombre) - puntaje(a.nombre); });
        subs.forEach(function (s) { mejor = Math.max(mejor, puntaje(s.nombre)); });
        if (subs.length) bloque = '<div class="grilla-subcategorias">' + subs.map(function (s) { return tarjetaSub(c, s, false); }).join("") + "</div>";
        hay += subs.length;
      } else {
        c.subcategorias.forEach(function (s) {
          var filas = datos ? datos.subcategorias[s.id] || [] : [];
          var subCoincide = dic ? subDelDiccionario(s) : catCoincide || coincide(c.nombre + " " + s.nombre);
          var modelos = subCoincide ? filas : filas.filter(function (r) { return dic ? modeloEnEntrada(dic, s, r) : coincide(s.nombre + " " + r[1]); });
          if (!subCoincide && !modelos.length) return;
          hay++; mejor = Math.max(mejor, puntaje(s.nombre));
          bloque += '<div class="sub-resultado"><a class="sub-resultado-titulo" href="#/c/' + esc(c.slug) + "/s/" + s.id + '">' + esc(s.nombre) +
            " <span>" + filas.length + (filas.length === 1 ? " modelo" : " modelos") + " ›</span></a>" +
            (modelos.length ? '<div class="grilla-subcategorias">' + modelos.slice(0, MAX_MODELOS_BUSQUEDA).map(function (r) { return tarjetaProducto(c, s, r, null); }).join("") + "</div>"
              : datos ? "" : '<div class="grilla-subcategorias">' + tarjetaSub(c, s, false) + "</div>") +
            (modelos.length > MAX_MODELOS_BUSQUEDA ? '<a class="ver-todos" href="#/c/' + esc(c.slug) + "/s/" + s.id + '">Ver los ' + modelos.length + " modelos ›</a>" : "") + "</div>";
        });
      }
      if (bloque) grupos.push({ puntaje: mejor, orden: orden, html: '<section class="grupo-resultado"><a class="grupo-resultado-titulo" href="#/c/' + esc(c.slug) + '"><span class="cat-mini">Categoría</span>' + esc(c.nombre) + " ›</a>" + bloque + "</section>" });
    });
    grupos.sort(function (a, b) { return b.puntaje - a.puntaje || a.orden - b.orden; });
    var html = grupos.map(function (g) { return g.html; }).join("");
    cont.innerHTML = hay ? html : '<div class="tarjeta vacio">No encontramos «' + esc(q) + "».<br>Prueba con otra palabra, por ejemplo <b>blanco</b>, <b>cartilla</b> o <b>bifocal</b>." +
      "<br>Si buscas una medida escríbela así: <b>+2.50-0.50</b>.</div>";
  }

  // Búsqueda de una medida: no se listan medidas; se sugiere la categoría y sus materiales (con el precio de ESA medida)
  function resultadosMedida(medida, cont, catActual) {
    // Dentro de una categoría óptica se busca en ella misma (si la medida es de ese tipo)
    var slug = catActual && tipoOptico(catActual) === medida.tipo ? catActual.slug : medida.tipo === "materiallisto" ? "material-listo" : "lentilla";
    var cat = categoriaPorSlug(slug);
    if (!cat) { cont.innerHTML = ""; return; }
    var otras = indice.categorias.filter(function (c) { return tipoOptico(c) && c.slug !== slug; });
    cont.innerHTML = '<div class="sugerencia-medida"><b>Quizás quieres buscar la medida <span class="mono">' + esc(medida.texto) + "</span> en " + esc(cat.nombre) + ".</b>" +
      "<span>Elige el material y se abre con tu medida ya escrita.</span></div>" +
      '<div class="grilla-subcategorias" id="materialesMedida">' + cat.subcategorias.map(function (s) {
        return tarjetaSub(cat, s, false).replace('class="tarjeta-sub"', 'class="tarjeta-sub" data-con-medida="1" data-sub="' + s.id + '"');
      }).join("") + "</div>" +
      (otras.length ? '<p class="otras-categorias">¿Es bifocal o progresivo? Búscala en ' + otras.map(function (c) { return '<a href="#/c/' + esc(c.slug) + '">' + esc(c.nombre) + "</a>"; }).join(" · ") + "</p>" : "");
    // Precio de esa medida en cada material (si la medida está completa)
    if (medida.tipo === "materiallisto" && !medida.campos.add) return;
    var clave = claveMedida(medidaEscrita(medida.tipo, medida.campos));
    asegurarCategoria(cat).then(function (d) {
      if (!document.getElementById("materialesMedida")) return;
      cat.subcategorias.forEach(function (s) {
        var r = null;
        (d.subcategorias[s.id] || []).forEach(function (x) { if (x.clave === clave && (!r || (!r[3] && x[3]))) r = x; });
        var tarjeta = cont.querySelector('[data-con-medida][data-sub="' + s.id + '"]');
        if (!tarjeta) return;
        var precio = tarjeta.querySelector(".precio"); var stock = tarjeta.querySelector(".stock");
        if (r) {
          precio.innerHTML = "<b>" + bs(r[2]) + '</b> <span class="sello-cf">esta medida</span>';
          stock.hidden = true;
        } else {
          tarjeta.classList.add("sin-medida");
          stock.hidden = false; stock.className = "stock agotado"; stock.textContent = "No hay esta medida";
        }
      });
    }).catch(function () {});
  }

  // ------------------------------------------------------------------ vistas
  var medidaPendiente = null;   // medida buscada que se escribe sola al abrir el material
  var regresoVentana = null;    // a dónde volver al cerrar una ventana abierta desde la búsqueda

  function vistaInicio(consulta) {
    var fecha = indice.generado ? new Date(indice.generado).toLocaleDateString("es-BO") : "";
    var html = '<div class="encabezado-vista"><div class="textos"><h1 class="titulo">¿Qué necesitas hoy?</h1>' +
      '<p class="subtitulo">' + (fecha ? "Precios al " + esc(fecha) + ". " : "") + "Busca o elige una categoría.</p></div></div>" +
      '<label class="buscador">' + ICONO_BUSCAR + '<input id="buscarGlobal" type="search" placeholder="Ej: blanco, cartilla o +2.50-0.50" autocomplete="off" aria-label="Buscar en el catálogo"></label>' +
      '<div id="resultadosGlobal"></div><div class="grilla-categorias" id="grillaCategorias">';
    indice.categorias.forEach(function (c) {
      var foto = null; var disp = 0;
      c.subcategorias.forEach(function (s) { if (!foto && s.imagen) foto = s.imagen; disp += s.medidas; });
      html += '<a class="tarjeta-categoria" href="#/c/' + esc(c.slug) + '">' + (foto ? img(foto, "") : "") +
        '<span class="nombre">' + esc(c.nombre) + "</span>" +
        '<span class="detalle">' + c.subcategorias.length + (c.subcategorias.length === 1 ? " producto" : " productos") + " · " + disp + (disp === 1 ? " opción" : " opciones") + "</span></a>";
    });
    html += "</div>" +
      '<div class="horario" id="horario"><b>Horario de atención</b><br>Lunes a viernes: 8:30–12:30 y 14:00–19:00 · Sábado: 8:30–13:00</div>';
    vista.innerHTML = html;

    var entrada = document.getElementById("buscarGlobal");
    var res = document.getElementById("resultadosGlobal");
    var grilla = document.getElementById("grillaCategorias"); var horario = document.getElementById("horario");
    var espera = null; var directasListas = false;
    function buscar() {
      var q = entrada.value.trim();
      // La búsqueda queda en la dirección: el botón «atrás» del celular vuelve a estos resultados
      try { history.replaceState(null, "", q ? "#/buscar/" + encodeURIComponent(q) : "#/"); } catch (_) {}
      grilla.hidden = horario.hidden = !!q;
      if (!q) { res.innerHTML = ""; return; }
      if (directasListas || medidaDeBusqueda(q)) { resultadosBusqueda(q, res); return; }
      res.innerHTML = '<div class="cargando"><span class="girando"></span>Buscando…</div>';
      asegurarDirectas().then(function () { directasListas = true; if (entrada.value.trim() === q) resultadosBusqueda(q, res); });
    }
    entrada.addEventListener("input", function () { clearTimeout(espera); espera = setTimeout(buscar, 180); });
    res.addEventListener("click", function (e) {
      var agregar = e.target.closest("[data-agregar]");
      if (agregar) {
        e.preventDefault();
        var c = categoriaPorSlug(agregar.getAttribute("data-cat")); var s = c && subDe(c, agregar.getAttribute("data-sub"));
        if (c && s) ventanaCantidad(c, categorias[c.slug], s, agregar.getAttribute("data-agregar"), location.hash, function () { resultadosBusqueda(entrada.value.trim(), res); });
        return;
      }
      var enlace = e.target.closest("a[href]");
      if (!enlace) return;
      // Solo la ventana de medidas vuelve a la búsqueda al cerrarse
      regresoVentana = /\/m\//.test(enlace.getAttribute("href")) ? location.hash : null;
      medidaPendiente = enlace.hasAttribute("data-con-medida") ? medidaDeBusqueda(entrada.value) : null;
    });
    if (consulta) { entrada.value = consulta; buscar(); }
  }

  function tarjetaSub(cat, s, conCategoria) {
    var n = enPedidoDeSub(s.id); var optico = tipoOptico(cat);
    var destino = "#/c/" + esc(cat.slug) + (optico ? "/t/" : "/s/") + s.id;
    return '<a class="tarjeta-sub" href="' + destino + '"><div class="foto">' + img(s.imagen, s.nombre) + "</div>" +
      '<div class="info">' + (conCategoria ? '<span class="cat-mini">' + esc(cat.nombre) + "</span>" : "") +
      '<span class="nombre">' + esc(s.nombre) + "</span>" + precioTarjeta(s.desde, s.medidas > 1 ? "desde" : "") +
      '<span class="stock" hidden></span>' +
      '<span class="accion-tarjeta">' + (optico ? "Ver precios" : "Ver productos") + " ›</span>" +
      (n ? '<span class="elegidos">' + n + " en tu pedido</span>" : "") + "</div></a>";
  }

  function vistaCategoria(cat) {
    vista.innerHTML = '<div class="encabezado-vista"><a class="volver" href="#/">← Inicio</a><div class="textos">' +
      '<h1 class="titulo">' + esc(cat.nombre) + '</h1><p class="subtitulo">' + cat.subcategorias.length + " productos · " +
      (tipoOptico(cat) ? "toca uno para ver sus precios" : "toca uno para ver sus modelos") + "</p></div></div>" +
      pastillasCategorias(cat.slug) +
      '<label class="buscador">' + ICONO_BUSCAR + '<input id="buscarSub" type="search" placeholder="Buscar en ' + esc(cat.nombre) +
      (tipoOptico(cat) ? " (nombre o medida)" : "") + '…" autocomplete="off" aria-label="Buscar producto"></label>' +
      '<div id="medidaSub"></div><div class="grilla-subcategorias" id="grillaSub"></div>';
    var grilla = document.getElementById("grillaSub"); var porMedida = document.getElementById("medidaSub");
    // Una medida escrita aquí («+3,75», «+250-050») muestra su precio en cada material, igual que el buscador del inicio
    porMedida.addEventListener("click", function (e) {
      var enlace = e.target.closest("a[data-con-medida]");
      if (enlace) medidaPendiente = medidaDeBusqueda(document.getElementById("buscarSub").value);
    });
    function pintar(filtro) {
      var medida = tipoOptico(cat) ? medidaDeBusqueda(filtro) : null;
      grilla.hidden = !!medida;
      if (medida) { resultadosMedida(medida, porMedida, cat); return; }
      porMedida.innerHTML = "";
      var f = normalizar(filtro);
      var lista = cat.subcategorias.filter(function (s) { return !f || normalizar(s.nombre).indexOf(f) >= 0; });
      grilla.innerHTML = lista.length ? lista.map(function (s) { return tarjetaSub(cat, s, false); }).join("") : '<p class="vacio">No hay productos con ese nombre.</p>';
    }
    pintar("");
    document.getElementById("buscarSub").addEventListener("input", function (e) { pintar(e.target.value); });
    var activa = vista.querySelector('.pastillas [aria-pressed="true"]');
    if (activa && activa.scrollIntoView) activa.scrollIntoView({ block: "nearest", inline: "center" });
  }

  // ------------------------------------------------------------------ tabla de precios (lentes)
  // Pensada para CELULAR: sin tablas anchas. Cada rango con su precio va en su propio recuadro, con el precio grande;
  // los combinados se agrupan por esfera (o base) y cada precio distinto lleva su color. Precio (el del catálogo, nunca se dice «facturado»)
  // con la unidad: Lentilla «½ par» (1 lente) y «1 par» (×2); Material Listo y Block «1 par».
  var TONOS = ["#34d399", "#22d3ee", "#60a5fa", "#a78bfa", "#fbbf24", "#fb7185"];
  function montoPrecio(v) { return Math.round(v * 100) % 100 ? v.toFixed(2) : v.toFixed(0); }
  function textoDesdeHasta(desde, hasta, quitar) {
    var a = String(desde).replace(quitar || /^$/, ""); var b = String(hasta).replace(quitar || /^$/, "");
    return a === b ? esc(a) : esc(a) + ' <span class="tp-a">a</span> ' + esc(b);
  }
  function cajaPrecio(etiqueta, rangoHtml, cf, ctx, especial) {
    var tono = cf == null ? "#64748b" : ctx.tono(cf);
    var precios = cf == null ? '<span class="tp-consultar">⏳ Próximamente</span>'
      : ctx.porPar
        ? '<span class="tp-monto"><b>' + montoPrecio(cf) + "</b> Bs<small>1 par</small></span>"
        : '<span class="tp-monto"><b>' + montoPrecio(cf) + "</b> Bs<small>½ par</small></span>" +
          '<span class="tp-monto tp-monto-par"><b>' + montoPrecio(cf * 2) + "</b> Bs<small>1 par</small></span>";
    return '<div class="tp-box' + (especial ? " tp-box-especial" : "") + '" style="--tono:' + tono + '">' +
      '<div class="tp-box-rango"><small>' + esc(etiqueta) + "</small><b>" + rangoHtml + "</b></div>" +
      '<div class="tp-box-precios">' + precios + "</div></div>";
  }
  function htmlSeccion(sec, i, ctx, plegable) {
    var cuerpo = "";
    if (sec.tipo === "lista") {
      var eje = /cilindro/i.test(sec.titulo) ? "Cilindro" : /esf/i.test(sec.titulo) ? "Esfera" : "Medida";
      cuerpo = '<div class="tp-cajas">' + sec.rangos.map(function (r) { return cajaPrecio(eje, textoDesdeHasta(r.desde, r.hasta), r.cf, ctx); }).join("") + "</div>";
    } else {
      var ejeFila = sec.filaTitulo.replace(/\s*\(.*\)\s*/, ""); var ejeCol = sec.colTitulo.replace(/\s*\(.*\)\s*/, "");
      var quitarBase = /^Base\s+/i;
      cuerpo = sec.filas.map(function (f) {
        // En la fila, columnas seguidas con el mismo precio van en un solo recuadro
        var cajas = [];
        f.precios.forEach(function (p, j) {
          var cf = p ? p.cf : null; var col = sec.columnas[j]; var ult = cajas[cajas.length - 1];
          if (ult && ult.cf === cf) ult.hasta = col.hasta; else cajas.push({ cf: cf, desde: col.desde, hasta: col.hasta });
        });
        cajas = cajas.filter(function (c) { return c.cf != null; });
        if (!cajas.length) return "";
        return '<div class="tp-grupo"><div class="tp-grupo-titulo">' + esc(ejeFila) + " <b>" + textoDesdeHasta(f.rango.desde, f.rango.hasta, quitarBase) + "</b></div>" +
          '<div class="tp-cajas">' + cajas.map(function (c) { return cajaPrecio(ejeCol, textoDesdeHasta(c.desde, c.hasta), c.cf, ctx); }).join("") + "</div></div>";
      }).join("");
      if (sec.excepciones && sec.excepciones.length) {
        cuerpo += '<div class="tp-grupo"><div class="tp-grupo-titulo tp-titulo-especial">⚠ Medidas con precio especial</div><div class="tp-cajas">' +
          sec.excepciones.map(function (e) { return cajaPrecio("Medida", esc(e.medida), e.cf, ctx, true); }).join("") + "</div></div>";
      }
    }
    if (plegable) {
      return '<details class="tp-sec tp-sec-plegable"' + (i === 0 ? " open" : "") + '><summary><span class="tp-sec-titulo">' + esc(sec.titulo) + "</span></summary>" + cuerpo + "</details>";
    }
    return '<section class="tp-sec" id="tpSec' + i + '"><h2 class="tp-sec-titulo">' + esc(sec.titulo) + "</h2>" + cuerpo + "</section>";
  }
  function ventanaBuscarMaterial() {
    var lista = [];
    indice.categorias.forEach(function (c) {
      if (!tipoOptico(c)) return;
      c.subcategorias.forEach(function (s) { lista.push({ cat: c, sub: s }); });
    });
    var capa = abrirVentana(
      '<header class="ventana-cabecera"><div class="textos"><h2>Buscar material</h2><span>Lentilla, Material Listo y Block</span></div>' +
      '<button type="button" class="ventana-x" data-cerrar aria-label="Cerrar">✕</button></header>' +
      '<div class="ventana-cuerpo"><label class="buscador">' + ICONO_BUSCAR +
      '<input id="tpBuscarTexto" type="search" placeholder="Ej: blue cut, progresivo, bifocal…" autocomplete="off" aria-label="Buscar material"></label>' +
      '<div id="tpBuscarLista" class="tp-buscar-lista"></div></div>', location.hash);
    var entrada = capa.querySelector("#tpBuscarTexto"); var cont = capa.querySelector("#tpBuscarLista");
    function pintar() {
      var palabras = normalizar(entrada.value).split(/\s+/).filter(Boolean);
      var hallados = lista.filter(function (x) {
        var t = normalizar(x.cat.nombre + " " + x.sub.nombre);
        return palabras.every(function (p) { return t.indexOf(p) >= 0; });
      });
      cont.innerHTML = hallados.length ? hallados.map(function (x) {
        return '<a class="tp-buscar-item" href="#/c/' + esc(x.cat.slug) + "/t/" + x.sub.id + '">' + img(x.sub.imagen, x.sub.nombre) +
          '<span class="textos"><b>' + esc(x.sub.nombre) + "</b><small>" + esc(x.cat.nombre) +
          (x.sub.desde != null ? " · desde " + bs(x.sub.desde) : "") + "</small></span><span class=\"flecha\">›</span></a>";
      }).join("") : '<p class="vacio">No hay materiales con ese nombre.</p>';
    }
    entrada.addEventListener("input", pintar);
    pintar();
    setTimeout(function () { entrada.focus(); }, 60);
  }
  function tituloCorto(t) { return String(t).replace(/^Combinados · esfera/, "Combinado").replace(/ con ADD$/, " + ADD"); }
  function armarPrecios(cat, datos, sub) {
    var tipo = tipoOptico(cat);
    // Solo el precio del catálogo (CF): los rangos se arman con él (el SF, si el catálogo lo trae, no se usa ni se muestra)
    var secciones = window.TablaPrecios ? window.TablaPrecios.construir(tipo, datos.subcategorias[sub.id] || [], { conSF: false }) : [];
    // Color por precio (del más barato al más caro) para ver de un vistazo dónde cambia
    var montos = {};
    secciones.forEach(function (s) {
      (s.rangos || []).forEach(function (r) { if (r.cf != null) montos[r.cf] = 1; });
      (s.filas || []).forEach(function (f) { f.precios.forEach(function (p) { if (p && p.cf != null) montos[p.cf] = 1; }); });
    });
    var orden = Object.keys(montos).map(Number).sort(function (a, b) { return a - b; });
    var ctx = {
      porPar: vendePorPar(tipo),
      tono: function (cf) {
        var i = orden.indexOf(cf); if (i < 0) return TONOS[TONOS.length - 1];
        return TONOS[orden.length <= 1 ? 0 : Math.round(i * (TONOS.length - 1) / (orden.length - 1))];
      }
    };
    return { tipo: tipo, secciones: secciones, ctx: ctx };
  }
  function leyendaPrecios(porPar) {
    return porPar ? "<b>Se vende por PAR</b> (1 par = los 2 lentes)" : "<b>½ par</b> = 1 lente · <b>1 par</b> = 2 lentes";
  }
  /** Los precios de un material en recuadros plegables, para mostrarlos dentro del chat del asistente. */
  function preciosParaChat(cat, datos, sub) {
    var p = armarPrecios(cat, datos, sub);
    if (!p.secciones.length) return "";
    return '<div class="tp-chat"><p class="tp-leyenda">' + leyendaPrecios(p.ctx.porPar) + "</p>" +
      p.secciones.map(function (s, i) { return htmlSeccion(s, i, p.ctx, true); }).join("") + "</div>";
  }
  function vistaTabla(cat, datos, sub) {
    var armado = armarPrecios(cat, datos, sub);
    var sinPrecio = (datos.subcategorias[sub.id] || []).some(function (r) { return r[2] == null; });
    var tipo = armado.tipo; var secciones = armado.secciones; var ctx = armado.ctx;
    var palabras = String(sub.nombre).trim().split(/\s+/);
    var arriba = palabras.length > 1 ? palabras.shift() : cat.nombre;
    var fotos = sub.galeria && sub.galeria.length ? sub.galeria : (sub.imagen ? [{ thumb: sub.imagen, zoom: sub.zoom || sub.imagen }] : []);
    var n = enPedidoDeSub(sub.id);
    function botonPedir(clase) {
      return '<div class="tp-pedir' + clase + '"><a class="boton boton-rojo"' + (clase ? "" : ' id="tpPedir"') + ' data-pedir href="#/c/' + esc(cat.slug) + "/m/" + sub.id + '">🛒 Hacer pedido</a>' +
        (n ? '<span class="elegidos">' + n + " en tu pedido</span>" : "") + "</div>";
    }
    vista.innerHTML =
      '<div class="tp-cabecera">' +
      (fotos.length ? '<div class="tp-fotos">' + fotos.map(function (f, i) {
        return '<button type="button" class="tp-foto" data-foto="' + i + '" aria-label="Ver foto">' + img(f.thumb, sub.nombre) + "</button>";
      }).join("") + "</div>" : "") +
      '<div class="tp-titulos"><span class="tp-sobretitulo">' + esc(arriba) + '</span><h1 class="tp-titulo">' + esc(palabras.join(" ")) + "</h1></div></div>" +
      '<div class="tp-controles"><a class="volver" href="#/c/' + esc(cat.slug) + '" aria-label="Volver">←</a>' +
      '<button type="button" id="tpBuscar" class="tp-buscar">' + ICONO_BUSCAR + "<span>Buscar otro material…</span></button></div>" +
      // Los demás materiales de la categoría, a un toque (el actual marcado)
      '<nav class="tp-hermanos" aria-label="Materiales de ' + esc(cat.nombre) + '">' + cat.subcategorias.map(function (s) {
        return '<a class="chip" href="#/c/' + esc(cat.slug) + "/t/" + s.id + '" aria-pressed="' + (s.id === sub.id) + '">' + esc(s.nombre) + "</a>";
      }).join("") + "</nav>" +
      '<p class="tp-leyenda">' + leyendaPrecios(ctx.porPar) + "</p>" +
      botonPedir('') +
      (secciones.length > 1 ? '<nav class="tp-indice" aria-label="Ir a">' + secciones.map(function (s, i) {
        return '<button type="button" class="chip" data-ir="tpSec' + i + '">' + esc(tituloCorto(s.titulo)) + "</button>";
      }).join("") + "</nav>" : "") +
      (secciones.length ? '<div class="tp-secciones">' + secciones.map(function (s, i) { return htmlSeccion(s, i, ctx); }).join("") + "</div>"
        : '<div class="tarjeta aviso-sin-precio-grande"><b>⏳ ' + TITULO_SIN_PRECIO + "</b><p>" + esc(sub.nombre) + ": " + TEXTO_SIN_PRECIO + "</p></div>") +
      (secciones.length && sinPrecio ? '<p class="tp-nota-sin-precio">⏳ Las medidas que no aparecen todavía no tienen precio definido: estarán disponibles muy pronto.</p>' : "") +
      botonPedir(' tp-pedir-final');
    document.getElementById("tpBuscar").addEventListener("click", ventanaBuscarMaterial);
    var actual = vista.querySelector('.tp-hermanos [aria-pressed="true"]');
    if (actual && actual.scrollIntoView) actual.scrollIntoView({ block: "nearest", inline: "center" });
    vista.querySelectorAll("[data-pedir]").forEach(function (a) { a.addEventListener("click", function () { regresoVentana = location.hash; }); });
    vista.querySelectorAll("[data-ir]").forEach(function (b) {
      b.addEventListener("click", function () {
        var destino = document.getElementById(b.getAttribute("data-ir"));
        var indice = vista.querySelector(".tp-indice");
        if (destino) window.scrollTo({ top: destino.getBoundingClientRect().top + window.pageYOffset - (indice ? indice.offsetHeight : 0) - 70, behavior: "smooth" });
      });
    });
    vista.querySelectorAll("[data-foto]").forEach(function (b) {
      b.addEventListener("click", function () {
        var f = fotos[Number(b.getAttribute("data-foto"))];
        abrirVentana('<div class="tp-ventana-foto"><button type="button" class="boton-icono tp-cerrar-foto" data-cerrar aria-label="Cerrar">✕</button>' +
          img(f.zoom || f.thumb, sub.nombre) + "</div>", location.hash);
      });
    });
  }

  // Productos directos de una subcategoría (monturas, accesorios…): tarjeta por producto
  function vistaProductos(cat, datos, sub) {
    var filas = datos.subcategorias[sub.id] || [];
    vista.innerHTML = '<div class="encabezado-vista"><a class="volver" href="#/c/' + esc(cat.slug) + '">← Volver</a><div class="textos">' +
      '<h1 class="titulo">' + esc(sub.nombre) + '</h1><p class="subtitulo">' + esc(cat.nombre) + " · " + filas.length + (filas.length === 1 ? " modelo" : " modelos") + "</p></div></div>" +
      // Las demás subcategorías de la categoría, a un toque (igual que en los lentes; la actual marcada)
      (cat.subcategorias.length > 1 ? '<nav class="tp-hermanos" aria-label="Productos de ' + esc(cat.nombre) + '">' + cat.subcategorias.map(function (s) {
        return '<a class="chip" href="#/c/' + esc(cat.slug) + "/s/" + s.id + '" aria-pressed="' + (s.id === sub.id) + '">' + esc(s.nombre) + "</a>";
      }).join("") + "</nav>" : "") +
      '<label class="buscador">' + ICONO_BUSCAR + '<input id="buscarProd" type="search" placeholder="Buscar código o modelo…" autocomplete="off" aria-label="Buscar modelo"></label>' +
      '<div class="grilla-subcategorias" id="grillaProd"></div>';
    var grilla = document.getElementById("grillaProd"); var texto = "";
    function pintar() {
      var f = normalizar(texto);
      var lista = filas.filter(function (r) { return !f || normalizar(r[1]).indexOf(f) >= 0; });
      grilla.innerHTML = lista.length ? lista.map(function (r) {
        return tarjetaProducto(cat, sub, r, "#/c/" + esc(cat.slug) + "/s/" + sub.id + "/p/" + r[0]);
      }).join("") : '<p class="vacio">No hay modelos con ese nombre.</p>';
    }
    pintar();
    document.getElementById("buscarProd").addEventListener("input", function (e) { texto = e.target.value.trim(); pintar(); });
    var actual = vista.querySelector('.tp-hermanos [aria-pressed="true"]');
    if (actual && actual.scrollIntoView) actual.scrollIntoView({ block: "nearest", inline: "center" });
  }

  // ------------------------------------------------------------------ ventanas (como los modales del ERP)
  function abrirVentana(html, rutaAlCerrar) {
    cerrarVentana(true);
    var capa = document.createElement("div");
    capa.className = "capa-ventana"; capa.id = "capaVentana";
    capa.innerHTML = '<section class="ventana" role="dialog" aria-modal="true">' + html + "</section>";
    capa.salir = function () { if (location.hash === rutaAlCerrar) cerrarVentana(); else location.hash = rutaAlCerrar; };
    capa.addEventListener("click", function (e) { if (e.target === capa) capa.salir(); });
    document.body.appendChild(capa);
    document.body.classList.add("con-ventana");
    capa.querySelectorAll("[data-cerrar]").forEach(function (b) { b.addEventListener("click", capa.salir); });
    return capa;
  }
  function cerrarVentana(silencioso) {
    var capa = document.getElementById("capaVentana");
    if (capa) capa.parentNode.removeChild(capa);
    document.body.classList.remove("con-ventana");
    if (!silencioso) pintarBarra();
  }

  /* «Medida y cantidad» (Lentilla, Block, Material Listo) — igual que ModalCantidadProductoOptico del ERP */
  function ventanaMedidas(cat, datos, sub) {
    var tipo = tipoOptico(cat);
    var filas = datos.subcategorias[sub.id] || [];
    // Medidas repetidas en el sistema (mismo producto con dos códigos): se queda la que tiene stock
    var porClave = {}; filas.forEach(function (r) { var y = porClave[r.clave]; if (!y || (!y[3] && r[3])) porClave[r.clave] = r; });
    var rutaCategoria = regresoVentana || "#/c/" + cat.slug;
    var pendiente = medidaPendiente && medidaPendiente.tipo === tipo ? medidaPendiente : null;
    regresoVentana = null; medidaPendiente = null;
    var agregados = 0;

    var campos;
    if (tipo === "materiallisto") {
      campos = '<div class="campos-dos"><label class="campo-medida"><span>Esfera</span><input id="fEsfera" inputmode="text" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off" placeholder="ej: +0.25, -1.50"></label>' +
        '<label class="campo-medida"><span>ADD</span><input id="fAdd" inputmode="text" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off" placeholder="ej: +1.50, +2.00"></label></div>';
    } else if (tipo === "block") {
      campos = '<div class="campos-dos"><label class="campo-medida"><span>Base</span><input id="fBase" inputmode="text" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off" placeholder="ej: 4, 6"></label>' +
        '<label class="campo-medida"><span>ADD</span><input id="fAdd" inputmode="text" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off" placeholder="ej: +1.50, 150"></label></div>';
    } else {
      campos = '<label class="campo-medida"><span>Medida</span><input id="fMedida" inputmode="text" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off" placeholder="Ej: +2.50-0.25, -1.50, cil -0.25"></label>';
    }

    var porPar = vendePorPar(tipo);
    var capa = abrirVentana(
      '<header class="ventana-cabecera">' + img(sub.imagen, sub.nombre, "ventana-foto") +
      '<div class="textos"><h2>' + esc(sub.nombre) + "</h2><span>" + esc(cat.nombre) + (porPar ? " · se vende por par" : " · Medida y cantidad") + "</span></div>" +
      '<button type="button" class="ventana-x" data-cerrar aria-label="Cerrar">✕</button></header>' +
      '<div class="ventana-cuerpo">' +
      '<div id="agregado" class="agregado" role="status" hidden></div>' +
      '<div class="bloque"><span class="etiqueta">Medida / graduación</span>' + campos +
      '<div id="sugerencias" class="sugerencias" aria-label="Medidas sugeridas"></div>' +
      '<p id="estado" class="estado-medida" role="status" hidden></p></div>' +
      '<div class="bloque fila"><span class="etiqueta">' + (porPar ? "Precio del PAR" : "Precio") + '</span><strong id="precio" class="mono">--</strong></div>' +
      '<div class="bloque' + (porPar ? " bloque-par" : "") + '"><div class="fila"><span class="etiqueta">' + (porPar ? "Cantidad de PARES" : "Cantidad") + '</span><div class="contador-cant grande"><button type="button" id="cMenos" aria-label="Quitar uno">−</button>' +
      '<input id="cNum" class="num" inputmode="numeric" value="1" aria-label="' + (porPar ? "Cantidad de pares" : "Cantidad") + '"><button type="button" id="cMas" aria-label="Agregar uno">+</button></div></div>' +
      (porPar ? '<p class="aviso-par"><b>1 = 1 PAR</b> (los 2 lentes). Para un par deja <b>1</b>; pon 2 solo si quieres 2 pares.</p>' : "") + "</div>" +
      '<div class="bloque fila resumen"><span><span class="etiqueta">Subtotal</span> <small id="unidad" class="tenue"></small></span><strong id="subtotal" class="mono verde">--</strong></div>' +
      "</div>" +
      '<footer class="ventana-pie"><button type="button" class="boton boton-gris-chico" data-cerrar id="btnCerrar">Cancelar</button>' +
      '<button type="button" class="boton boton-rojo" id="btnAgregar" disabled>✓ Agregar al pedido</button></footer>',
      rutaCategoria);

    var $ = function (id) { return capa.querySelector("#" + id); };
    var entradas = ["fMedida", "fEsfera", "fBase", "fAdd"].map($).filter(Boolean);
    var resuelta = null; var cantidad = 1;

    function leerCampos() {
      function valor(id) { var e = $(id); return e ? e.value.trim() : ""; }
      // Sin signo = positiva («0.50» → «+0.50»): el teclado del celular a veces no muestra el «+»
      function conSigno(t) { return /^[\d.,]/.test(t) ? "+" + t : t; }
      // «+250» se entiende +2.50 en medida, esfera y ADD (la base del block es un número entero: queda igual)
      return { medida: dioptriasSinPunto(conSigno(valor("fMedida"))), esfera: dioptriasSinPunto(conSigno(valor("fEsfera"))),
        base: valor("fBase"), add: dioptriasSinPunto(conSigno(valor("fAdd"))) };
    }
    function pintarResumen() {
      var precio = resuelta ? resuelta[2] : null;
      $("cNum").value = cantidad;
      $("unidad").textContent = resuelta ? "(" + textoUnidad(cantidad, tipo) + ")" : "";
      $("subtotal").textContent = resuelta && precio != null ? bs(precio * cantidad) : "--";
      $("btnAgregar").disabled = !resuelta || resuelta[2] == null;
    }
    // Texto compacto para sugerir mientras se escribe a medias: «+1.25 ADD +2.25» → «+1.25add+2.25»
    function compacto(t) { return String(t || "").toLowerCase().replace(/^medida:\s*/, "").replace(/_?adds?:?/g, "add").replace(/base:?/g, "base").replace(/\s+/g, ""); }
    filas.forEach(function (r) { r.compacto = compacto(r[1]); r.sinPunto = r.compacto.replace(/\./g, ""); });   // «+250add+200»: para sugerir mientras escribe «+25…»
    function sugerir(campos) {
      // Medidas existentes (con stock) que empiezan como lo escrito: un toque y listo
      var escrito = tipo === "materiallisto" ? (campos.add ? campos.esfera + "_Adds: " + campos.add : campos.esfera)
        : tipo === "block" ? (campos.base ? "Base: " + campos.base + (campos.add ? "_Adds: " + campos.add : "") : "")
        : campos.medida;
      var parcial = compacto(escrito); var parcialClave = claveMedida(escrito); var parcialSinPunto = parcial.replace(/\./g, "");
      var cont = $("sugerencias");
      if (!parcial || resuelta) { cont.innerHTML = ""; return; }
      var lista = [];
      for (var i = 0; i < filas.length && lista.length < MAX_SUGERENCIAS; i++) {
        var r = filas[i];
        if (porClave[r.clave] === r && (r.compacto.indexOf(parcial) === 0 || r.clave.indexOf(parcialClave) === 0 || r.sinPunto.indexOf(parcialSinPunto) === 0)) lista.push(r);
      }
      cont.innerHTML = lista.map(function (r) { return '<button type="button" class="chip chip-medida" data-id="' + r[0] + '">' + esc(r[1]) + "</button>"; }).join("");
    }
    // Solo se avisa cuando la medida no existe; si existe, no se muestra nada
    function mostrarEstado(clase, texto) { var e = $("estado"); e.className = "estado-medida " + clase; e.textContent = texto; e.hidden = !texto; }
    function resolver() {
      var c = leerCampos();
      if (!medidaCompleta(tipo, c)) { resuelta = null; mostrarEstado("", ""); $("precio").textContent = "--"; sugerir(c); pintarResumen(); return; }
      resuelta = porClave[claveMedida(medidaEscrita(tipo, c))] || null;
      sugerir(c);
      if (!resuelta) { mostrarEstado("ambar", $("sugerencias").children.length ? "" : "Esta medida no existe en este producto"); $("precio").textContent = "--"; }
      else if (resuelta[2] == null) { mostrarEstado("ambar", "⏳ " + TEXTO_SIN_PRECIO); $("precio").textContent = "Sin precio aún"; }
      else {
        var ya = porPar && pedido[resuelta[0]] ? pedido[resuelta[0]].qty : 0;
        mostrarEstado(ya ? "ambar" : "", ya ? "Ya tienes " + textoUnidad(ya, tipo) + " de esta medida en tu pedido. Si agregas, queda la cantidad que elijas abajo (no se suma)." : "");
        $("precio").textContent = bs(resuelta[2]);
      }
      pintarResumen();
    }
    function vaciarCampos() { entradas.forEach(function (e) { e.value = ""; }); cantidad = 1; resolver(); if (entradas[0]) entradas[0].focus(); }

    entradas.forEach(function (e) {
      e.addEventListener("input", resolver);
      e.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); $("btnAgregar").click(); } });
    });
    $("sugerencias").addEventListener("click", function (e) {
      var b = e.target.closest("[data-id]"); if (!b) return;
      var r = null; for (var i = 0; i < filas.length; i++) if (String(filas[i][0]) === b.getAttribute("data-id")) { r = filas[i]; break; }
      if (!r) return;
      // Rellena los campos con la medida elegida (al revés de medidaEscrita)
      if (tipo === "materiallisto") { var m = /^(.*?)\s+ADD\s+(.*)$/i.exec(r[1]); if (m) { $("fEsfera").value = m[1]; $("fAdd").value = m[2]; } }
      else if (tipo === "block") { var b2 = /^Base\s+(\S+)\s+ADD\s+(.*)$/i.exec(r[1]); if (b2) { $("fBase").value = b2[1]; $("fAdd").value = b2[2]; } }
      else $("fMedida").value = r[1].replace(/\s+(?=[+-]\d)/g, "");
      resolver();
    });
    $("cMenos").addEventListener("click", function () { if (cantidad > 1) { cantidad--; pintarResumen(); } });
    $("cMas").addEventListener("click", function () { if (cantidad < 999) { cantidad++; pintarResumen(); } });
    $("cNum").addEventListener("input", function () { var n = parseInt($("cNum").value.replace(/\D/g, ""), 10); cantidad = isNaN(n) || n < 1 ? 1 : Math.min(999, n); $("unidad").textContent = resuelta ? "(" + textoUnidad(cantidad, tipo) + ")" : ""; $("subtotal").textContent = resuelta && resuelta[2] != null ? bs(resuelta[2] * cantidad) : "--"; });
    var agregando = false;   // un doble toque (o Enter + toque) agrega una sola vez
    $("btnAgregar").addEventListener("click", function () {
      if (!resuelta || resuelta[2] == null || agregando) return;
      agregando = true; setTimeout(function () { agregando = false; }, 900);
      var habia = porPar && pedido[resuelta[0]] ? pedido[resuelta[0]].qty : 0;
      sumarAlPedido({ id: resuelta[0], cat: cat.nombre, catSlug: cat.slug, sub: sub.nombre, subId: sub.id, medida: resuelta[1], cf: resuelta[2], tipo: tipo }, cantidad, porPar);
      agregados += porPar ? cantidad - habia : cantidad;
      var ag = $("agregado");
      ag.innerHTML = porPar
        ? "<b>✓ " + (habia ? "Actualizado" : "Agregado") + ":</b> <span class=\"mono\">" + esc(resuelta[1]) + " — " + textoUnidad(cantidad, tipo) + " = " + bs(resuelta[2] != null ? resuelta[2] * cantidad : null) + "</span><span>escribe otra medida o toca «Listo, cerrar»</span>"
        : "<b>✓ Agregado:</b> <span class=\"mono\">" + esc(resuelta[1]) + " × " + cantidad + "</span><span>" + agregados + " en total · escribe otra medida</span>";
      ag.hidden = false;
      $("btnCerrar").textContent = "Listo, cerrar";
      vaciarCampos();   // la ventana sigue abierta para la siguiente medida
    });
    if (pendiente) {   // medida que el cliente escribió en la búsqueda
      if ($("fMedida")) $("fMedida").value = pendiente.campos.medida || "";
      if ($("fEsfera")) $("fEsfera").value = pendiente.campos.esfera || "";
      if ($("fAdd")) $("fAdd").value = pendiente.campos.add || "";
      if ($("fBase")) $("fBase").value = pendiente.campos.base || "";
    }
    resolver();
    setTimeout(function () { var vacia = entradas.filter(function (x) { return !x.value; })[0]; if (vacia || entradas[0]) (vacia || entradas[0]).focus(); }, 60);
  }

  /* Cantidad de un producto directo (como ModalCantidadProductoDirecto del ERP) */
  function ventanaCantidad(cat, datos, sub, idProd, rutaRegreso, alAgregar) {
    var r = null; (datos.subcategorias[sub.id] || []).forEach(function (x) { if (String(x[0]) === String(idProd)) r = x; });
    var rutaProductos = rutaRegreso || "#/c/" + cat.slug + "/s/" + sub.id;
    if (!r) { location.replace(rutaProductos); return; }
    if (r[2] == null) { avisoSinPrecio(sub.nombre + " " + r[1], rutaProductos); return; }
    var cantidad = 1;
    var pres = presentacionDe(cat.slug, r[0]);
    var capa = abrirVentana(
      '<header class="ventana-cabecera">' + img(r[4], r[1], "ventana-foto") +
      '<div class="textos"><h2 class="mono">' + esc(r[1]) + "</h2><span>" + esc(sub.nombre) + " · " + esc(cat.nombre) + "</span></div>" +
      '<button type="button" class="ventana-x" data-cerrar aria-label="Cerrar">✕</button></header>' +
      '<div class="ventana-cuerpo">' +
      (pres ? '<div class="bloque bloque-par"><div class="fila"><span class="etiqueta">Precio ' + (pres.n === "Docena" ? "de la docena" : "del paquete") + '</span><strong class="mono">' + bs(r[2]) + "</strong></div>" +
        '<p class="aviso-par">📦 ' + tituloPres(pres) + ": <b>" + cuentaPres(pres) + "</b></p></div>"
        : '<div class="bloque fila"><span class="etiqueta">Precio</span><strong class="mono">' + bs(r[2]) + "</strong></div>") +
      '<div class="bloque fila"><span class="etiqueta">' + (pres ? "Cantidad de " + nombrePres(pres, 2) : "Cantidad") + '</span><div class="contador-cant grande"><button type="button" id="cMenos" aria-label="Quitar uno">−</button>' +
      '<input id="cNum" class="num" inputmode="numeric" value="1" aria-label="Cantidad"><button type="button" id="cMas" aria-label="Agregar uno">+</button></div></div>' +
      '<div class="bloque fila resumen"><span><span class="etiqueta">Subtotal</span> <small id="unidadPres" class="tenue">' + (pres ? "(" + textoUnidad(1, null, pres) + ")" : "") + '</small></span><strong id="subtotal" class="mono verde">' + bs(r[2]) + "</strong></div></div>" +
      '<footer class="ventana-pie"><button type="button" class="boton boton-gris-chico" data-cerrar>Cancelar</button>' +
      '<button type="button" class="boton boton-rojo" id="btnAgregar">✓ Agregar al pedido</button></footer>',
      rutaProductos);
    var $ = function (id) { return capa.querySelector("#" + id); };
    function pintar() {
      $("cNum").value = cantidad; $("subtotal").textContent = r[2] != null ? bs(r[2] * cantidad) : "Consultar";
      if (pres) $("unidadPres").textContent = "(" + textoUnidad(cantidad, null, pres) + ")";
    }
    $("cMenos").addEventListener("click", function () { if (cantidad > 1) { cantidad--; pintar(); } });
    $("cMas").addEventListener("click", function () { if (cantidad < 999) { cantidad++; pintar(); } });
    $("cNum").addEventListener("input", function () { var n = parseInt($("cNum").value.replace(/\D/g, ""), 10); cantidad = isNaN(n) || n < 1 ? 1 : Math.min(999, n); $("subtotal").textContent = r[2] != null ? bs(r[2] * cantidad) : "Consultar"; if (pres) $("unidadPres").textContent = "(" + textoUnidad(cantidad, null, pres) + ")"; });
    $("btnAgregar").addEventListener("click", function () {
      sumarAlPedido({ id: r[0], cat: cat.nombre, catSlug: cat.slug, sub: sub.nombre, subId: sub.id, medida: r[1], cf: r[2], tipo: null, pres: pres }, cantidad);
      aviso("✓ Agregado: " + r[1] + " — " + (pres ? textoUnidad(cantidad, null, pres) : "× " + cantidad));
      capa.salir();
      if (alAgregar) alAgregar();
    });
  }

  // ------------------------------------------------------------------ pedido
  /* El pedido queda guardado en el celular: al abrirlo se ponen los precios del catálogo vigente (si cambiaron desde que se agregó) */
  function actualizarPreciosPedido() {
    var slugs = {};
    Object.keys(pedido).forEach(function (id) { if (pedido[id].catSlug) slugs[pedido[id].catSlug] = 1; });
    return Promise.all(Object.keys(slugs).map(function (slug) {
      var cat = categoriaPorSlug(slug); if (!cat) return null;
      return asegurarCategoria(cat).then(function (d) {
        Object.keys(pedido).forEach(function (id) {
          var p = pedido[id]; if (p.catSlug !== slug) return;
          (d.subcategorias[p.subId] || []).forEach(function (r) { if (String(r[0]) === String(id)) p.cf = r[2]; });
        });
      }).catch(function () { return null; });
    })).then(function () { guardarPedido(); pintarBarra(); });
  }

  function vistaPedido() {
    var ids = Object.keys(pedido);
    if (!ids.length) {
      vista.innerHTML = '<div class="encabezado-vista"><a class="volver" href="#/">← Catálogo</a><div class="textos"><h1 class="titulo">Mi pedido</h1></div></div>' +
        '<div class="tarjeta vacio">Tu pedido está vacío. Entra a una categoría y agrega productos.</div>';
      return;
    }
    var grupos = {};
    ids.forEach(function (id) { var p = pedido[id]; var k = p.cat + " · " + p.sub; (grupos[k] = grupos[k] || []).push(p); });
    var t = totales();
    var html = '<div class="encabezado-vista"><a class="volver" href="#/">← Seguir eligiendo</a><div class="textos"><h1 class="titulo">Mi pedido</h1>' +
      '<p class="subtitulo">' + t.lineas + " productos · " + esc(cliente.optica || "") + "</p></div></div><div class=\"tarjeta\" id=\"tarjetaPedido\">";
    Object.keys(grupos).sort().forEach(function (k) {
      var g = grupos[k]; var p0 = g[0];
      var ruta = "#/c/" + esc(p0.catSlug) + (p0.tipo ? "/m/" : "/s/") + p0.subId;
      html += '<div class="grupo-pedido"><h3><a href="' + ruta + '">' + esc(k) + " ›</a></h3>";
      g.sort(function (a, b) { return a.medida.localeCompare(b.medida, "es", { numeric: true }); }).forEach(function (p) {
        html += '<div class="item-pedido" data-id="' + p.id + '"><div><div class="medida">' + esc(p.medida) + "</div>" +
          '<div class="linea">' + textoUnidad(p.qty, p.tipo, p.pres) + " · " + bs(p.cf) + (p.cf != null ? (p.pres ? (p.pres.n === "Docena" ? " la docena" : " el paquete") : vendePorPar(p.tipo) ? " el par" : " c/u") + " = <b>" + bs(p.cf * p.qty) + "</b>" : "") + "</div>" +
          (p.pres ? '<div class="linea tenue">' + cuentaPres(p.pres) + " c/" + (p.pres.n === "Docena" ? "docena" : "paquete") + "</div>" : "") + "</div>" +
          '<div class="contador-cant"><button type="button" class="menos" data-accion="menos" aria-label="Quitar uno">−</button><span class="num activo">' + p.qty + "</span>" +
          '<button type="button" data-accion="mas" aria-label="Agregar uno">+</button></div></div>';
      });
      html += "</div>";
    });
    html += '<div class="total-pedido"><span>Total' + (t.consultar ? " (sin los " + t.consultar + " a consultar)" : "") + "</span><strong>" + bs(t.total) + "</strong></div>" +
      '<div class="pagos" role="radiogroup" aria-label="Método de pago">' +
      '<label><input type="radio" name="pago" value="QR" checked> QR</label><label><input type="radio" name="pago" value="EFECTIVO"> Efectivo</label></div>' +
      '<button type="button" id="enviarPedido" class="boton boton-verde">Enviar pedido por WhatsApp</button>' +
      '<button type="button" id="vaciarPedido" class="boton boton-gris">Vaciar pedido</button>' +
      '<p class="nota">El stock y el precio final los confirma OPTIMARKET al recibir tu pedido.</p></div>';
    vista.innerHTML = html;
    document.getElementById("tarjetaPedido").addEventListener("click", function (e) {
      var b = e.target.closest("[data-accion]"); if (!b) return;
      cambiarEnPedido(b.closest(".item-pedido").getAttribute("data-id"), b.getAttribute("data-accion") === "mas" ? 1 : -1);
      vistaPedido();
    });
    document.getElementById("vaciarPedido").addEventListener("click", function () {
      if (!confirm("¿Vaciar todo el pedido?")) return;
      pedido = {}; guardarPedido(); pintarBarra(); vistaPedido();
    });
    document.getElementById("enviarPedido").addEventListener("click", function () {
      var e = window.HorarioOptimarket ? window.HorarioOptimarket.estado() : null;
      if (!e || e.abierto) { enviarPedido(null); return; }
      avisoFueraDeHorario(e);
    });
  }

  /** Pedido fuera de horario: se avisa y se puede enviar igual (se atiende en la próxima apertura). */
  function avisoFueraDeHorario(e) {
    var cuando = e.proxima ? e.proxima.texto : "en nuestro próximo horario de atención";
    var capa = abrirVentana(
      '<header class="ventana-cabecera"><div class="textos"><h2>' + (e.enPausa ? "☕ Estamos en pausa de mediodía" : "🌙 Estamos fuera de horario") + "</h2>" +
      "<span>Ahora son las " + e.ahora.texto + " (hora de Bolivia)</span></div>" +
      '<button type="button" class="ventana-x" data-cerrar aria-label="Cerrar">✕</button></header>' +
      '<div class="ventana-cuerpo"><p class="aviso-sin-precio">Puedes enviar tu pedido igual: <b>lo recibimos y lo atendemos ' + esc(cuando) + "</b>.</p>" +
      '<div class="bloque horario-lista"><span class="etiqueta">Nuestro horario</span>' +
      "<p><b>Lunes a viernes</b><br>Mañana: 8:30 – 12:30 · Tarde: 14:00 – 19:00</p><p><b>Sábados</b><br>8:30 – 13:00</p><p class=\"tenue\">Domingos y feriados: cerrado</p></div></div>" +
      '<footer class="ventana-pie"><button type="button" class="boton boton-gris-chico" data-cerrar>Cancelar</button>' +
      '<button type="button" class="boton boton-verde" id="enviarIgual">Enviar igual</button></footer>', location.hash);
    capa.querySelector("#enviarIgual").addEventListener("click", function () {
      cerrarVentana();
      enviarPedido("⏰ Pedido enviado fuera de horario (" + e.ahora.texto + "). Atender " + cuando + ".");
    });
  }
  function enviarPedido(notaHorario) {
    var t = totales();
    var pago = (document.querySelector('input[name="pago"]:checked') || {}).value || "NO DEFINIDO";
    var optica = (cliente.optica || "ÓPTICA").toUpperCase();
    var lineas = []; var mensaje = "Hola, soy " + optica + ".\nEste es mi pedido:\n\n";
    var grupos = {};
    Object.keys(pedido).forEach(function (id) { var p = pedido[id]; (grupos[p.sub] = grupos[p.sub] || []).push(p); });
    Object.keys(grupos).sort().forEach(function (sub) {
      mensaje += "*" + sub + "*\n";
      grupos[sub].forEach(function (p) {
        var par = vendePorPar(p.tipo); var pq = p.pres;
        var unidadVenta = pq ? (pq.n === "Docena" ? " la docena" : " el paquete") : par ? " el par" : "";
        mensaje += "• " + p.medida + " — " + textoUnidad(p.qty, p.tipo, pq) + (par || pq ? "" : " (" + p.qty + ")") +
          (p.cf != null ? " × " + bs(p.cf) + unidadVenta : " — precio a consultar") + "\n";
        lineas.push(sub + " | " + p.medida + " | Cant: " + (par || pq ? textoUnidad(p.qty, p.tipo, pq) : p.qty) + " | P.U" + (pq ? " (" + pq.n.toLowerCase() + ")" : par ? " (par)" : "") + ": " + (p.cf != null ? p.cf : "consultar"));
      });
      mensaje += "\n";
    });
    mensaje += "Total: " + bs(t.total) + (t.consultar ? " (+ " + t.consultar + " a consultar)" : "") + "\nPago: " + pago +
      (notaHorario ? "\n" + notaHorario : "") + "\nGracias.";
    // 1) WhatsApp de inmediato (abrirlo dentro del toque evita que el celular lo bloquee)
    window.open("https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(mensaje), "_blank");
    // 2) Registro del pedido en Netlify Forms, en segundo plano
    var datos = new URLSearchParams({ "form-name": "pedidos", optica: optica, celular: cliente.phone || "", detalles: lineas.join("\n"),
      metodo_pago: pago, total: bs(t.total), fecha_hora: horaBolivia() + (notaHorario ? " (fuera de horario)" : "") });
    fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: datos.toString() }).catch(function () {});
    pedido = {}; guardarPedido(); pintarBarra();
    aviso("Pedido enviado. Gracias.");
    location.hash = "#/";
  }

  // ------------------------------------------------------------------ navegación
  function error(msg) {
    cerrarVentana();
    vista.innerHTML = '<div class="tarjeta vacio">' + esc(msg) + '<br><br><button type="button" class="boton boton-rojo" onclick="location.reload()">Reintentar</button></div>';
  }
  function rutear() {
    var p = location.hash.replace(/^#\/?/, "").split("/");
    pintarBarra();
    asegurarIndice().then(function () {
      if (p[0] === "pedido") { cerrarVentana(); vistaPintada = "pedido"; return actualizarPreciosPedido().then(vistaPedido); }
      if (p[0] === "buscar") { cerrarVentana(); vistaPintada = "buscar"; return vistaInicio(decodeURIComponent(p.slice(1).join("/"))); }
      if (p[0] !== "c") { cerrarVentana(); vistaPintada = "inicio"; return vistaInicio(""); }
      var cat = categoriaPorSlug(p[1]);
      if (!cat) { location.replace("#/"); return; }
      var sub = p[3] ? subDe(cat, p[3]) : null;
      // Grilla de fondo: categoría (para «m/») o productos de la subcategoría (para «s/»)
      if (p[2] === "t" && sub) {
        // Al cerrar «Hacer pedido» o una foto se vuelve a la misma tabla: se deja donde estaba (sin subir al inicio)
        if (vistaPintada === "t/" + cat.slug + "/" + sub.id && document.getElementById("tpBuscar")) { cerrarVentana(); return "igual"; }
        return asegurarCategoria(cat).then(function (d) { cerrarVentana(true); vistaTabla(cat, d, sub); vistaPintada = "t/" + cat.slug + "/" + sub.id; });
      }
      if (p[2] === "m" && sub) {
        // Fondo: la tabla de precios si se viene de ahí; si no, la categoría
        if (vistaPintada !== "c/" + cat.slug && vistaPintada !== "t/" + cat.slug + "/" + sub.id) { vistaCategoria(cat); vistaPintada = "c/" + cat.slug; }
        return asegurarCategoria(cat).then(function (d) { ventanaMedidas(cat, d, sub); });
      }
      if (p[2] === "s" && sub) {
        return asegurarCategoria(cat).then(function (d) {
          var clave = "s/" + cat.slug + "/" + sub.id;
          if (vistaPintada !== clave || !p[4]) { cerrarVentana(true); vistaProductos(cat, d, sub); vistaPintada = clave; }
          if (p[4] === "p" && p[5]) ventanaCantidad(cat, d, sub, p[5]);
          else cerrarVentana();
        });
      }
      // Al cerrar una ventana se vuelve a la misma categoría: se deja como estaba (búsqueda y posición)
      if (vistaPintada === "c/" + cat.slug && document.getElementById("buscarSub")) { cerrarVentana(); return "igual"; }
      cerrarVentana(); vistaCategoria(cat); vistaPintada = "c/" + cat.slug;
    }).then(function (r) { if (r !== "igual" && !document.getElementById("capaVentana")) window.scrollTo(0, 0); })
      .catch(function () { error("No se pudo cargar el catálogo. Revisa tu conexión a internet."); });
  }

  document.getElementById("nombreOptica").textContent = cliente.optica || "";
  function horaBolivia() {
    if (!window.HorarioOptimarket) return new Date().toLocaleString("es-BO");
    var a = window.HorarioOptimarket.ahora();
    return (a.fecha < 10 ? "0" : "") + a.fecha + "/" + (a.mes < 10 ? "0" : "") + a.mes + "/" + a.anio + " " + a.textoSeg;
  }
  // Reloj (hora de Bolivia) + estado de atención, cada segundo
  (function iniciarReloj() {
    var el = document.getElementById("relojHorario");
    if (!el || !window.HorarioOptimarket) return;
    var H = window.HorarioOptimarket; var ultimoEstado = "";
    function pintarReloj() {
      var e = H.estado(); var a = e.ahora;
      var clase = e.abierto ? (e.cierraPronto ? "pronto" : "abierto") : (e.enPausa ? "pausa" : "cerrado");
      var texto = e.abierto ? (e.cierraPronto ? "Cierra pronto · " + e.cierra : "Abierto · cierra " + e.cierra)
        : (e.enPausa ? "Pausa · vuelve " : "Cerrado · abre ") + (e.proxima ? e.proxima.texto.replace(/^hoy a las /, "").replace(/ a las /, " ") : "");
      var clave = clase + texto;
      if (clave !== ultimoEstado) {
        el.innerHTML = '<span class="reloj-hora mono" id="relojHora"></span><span class="reloj-estado ' + clase + '"><i></i>' + esc(texto) + "</span>";
        el.title = "Hora de Bolivia. Horario: " + H.texto;
        ultimoEstado = clave;
      }
      document.getElementById("relojHora").textContent = a.textoSeg;
    }
    pintarReloj();
    setInterval(pintarReloj, 1000);
    // Alto de la cabecera (con el reloj) para lo que queda fijo debajo de ella
    function medir() { var c = document.querySelector(".cabecera"); if (c) document.documentElement.style.setProperty("--alto-cabecera", c.offsetHeight + "px"); }
    medir(); window.addEventListener("resize", medir);
  })();
  document.getElementById("botonSalir").addEventListener("click", function () {
    if (!confirm("¿Cerrar sesión en este dispositivo?")) return;
    try { localStorage.removeItem("registeredClient"); localStorage.removeItem(CLAVE_PEDIDO); } catch (_) {}
    location.replace("form.html");
  });
  window.addEventListener("hashchange", rutear);
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-sin-precio]");
    if (b) { e.preventDefault(); e.stopPropagation(); avisoSinPrecio(b.getAttribute("data-sin-precio"), location.hash); }
  }, true);

  // ------------------------------------------------------------------ asistente (js/asistente.js, se baja al tocarlo)
  window.PanelCatalogo = {
    listo: function () { return asegurarIndice().then(asegurarDirectas); },
    indice: function () { return indice; },
    diccionario: function () { return diccionario; },
    cargarCategoria: asegurarCategoria,
    categoriaCargada: function (cat) { return categorias[cat.slug] || null; },
    tipoOptico: tipoOptico, claveMedida: claveMedida, medidaEscrita: medidaEscrita,
    normalizar: normalizar, textoBusqueda: textoBusqueda, aliasDeModelo: aliasDeModelo, esc: esc, bs: bs,
    whatsapp: WHATSAPP,
    cliente: function () { return cliente; },
    abrirMedida: function (cat, sub, medida) {
      var destino = "#/c/" + cat.slug + "/m/" + sub.id;
      regresoVentana = location.hash === destino ? null : location.hash;
      medidaPendiente = medida;
      if (location.hash === destino) rutear(); else location.hash = destino;
    },
    preciosParaChat: preciosParaChat,
    textoPresentacion: function (cat, id) { var p = presentacionDe(cat.slug, id); return p ? tituloPres(p) + ": " + cuentaPres(p) : ""; },
    verPrecios: function (cat, sub) { location.hash = "#/c/" + cat.slug + "/t/" + sub.id; },
    agregarModelo: function (cat, sub, id) {
      asegurarCategoria(cat).then(function (d) { ventanaCantidad(cat, d, sub, id, location.hash); });
    }
  };
  var botonAsistente = document.createElement("button");
  botonAsistente.type = "button"; botonAsistente.className = "boton-asistente";
  botonAsistente.setAttribute("aria-label", "Abrir el asistente");
  botonAsistente.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2Zm3 6.5a1.5 1.5 0 1 0 0 .01Zm5 0a1.5 1.5 0 1 0 0 .01Zm5 0a1.5 1.5 0 1 0 0 .01Z"/></svg><span>Asistente</span>';
  document.body.appendChild(botonAsistente);
  botonAsistente.addEventListener("click", function () {
    if (window.AsistenteOptimarket) { window.AsistenteOptimarket.abrir(); return; }
    botonAsistente.disabled = true;
    var script = document.createElement("script");
    script.src = "js/asistente.js?v=" + VERSION_ARCHIVOS;
    script.onload = function () { botonAsistente.disabled = false; if (window.AsistenteOptimarket) window.AsistenteOptimarket.abrir(); };
    script.onerror = function () { botonAsistente.disabled = false; aviso("No se pudo abrir el asistente. Revisa tu conexión."); };
    document.head.appendChild(script);
  });

  // Visita (una vez por sesión del navegador) para las estadísticas de Netlify
  try {
    if (!sessionStorage.getItem("visitaRegistrada")) {
      sessionStorage.setItem("visitaRegistrada", "1");
      fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ "form-name": "visitas", optica: cliente.optica || "", fecha_hora: new Date().toLocaleString("es-BO") }).toString() }).catch(function () {});
    }
  } catch (_) {}

  // ------------------------------------------------------------------ actualización automática
  /*
   * Los clientes casi nunca recargan: el celular deja la pestaña abierta días. Cuando vuelven a ella (y cada 15 min si la
   * tienen a la vista) se compara con lo publicado en Netlify:
   *   - index.html trae otro ?v= de panel.js  → hay una versión nueva del panel
   *   - catalogo/indice.json tiene otra fecha → se exportó un catálogo nuevo (precios)
   * Si cambió algo, la página se recarga sola (el pedido está guardado en el celular, no se pierde). Si el cliente está en
   * medio de algo (ventana abierta, asistente o escribiendo), se muestra un aviso con «Actualizar» en vez de recargar.
   */
  var ultimaRevision = Date.now();
  var revisando = false;
  function hayVersionNueva() {
    var panel = fetch("index.html?_=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.text() : ""; })
      .then(function (html) { var m = /js\/panel\.js\?v=([^"'&\s]+)/.exec(html); return !!(m && VERSION_ARCHIVOS && m[1] !== VERSION_ARCHIVOS); });
    var catalogo = !indice ? Promise.resolve(false) : fetch("catalogo/indice.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return !!(d && d.generado && d.generado !== indice.generado); });
    return Promise.all([panel, catalogo]).then(function (x) { return x[0] || x[1]; });
  }
  function ocupado() {
    var foco = document.activeElement;
    return !!(document.getElementById("capaVentana") || document.body.classList.contains("con-asistente") ||
      (foco && /^(INPUT|TEXTAREA|SELECT)$/.test(foco.tagName) && foco.value));
  }
  function avisoActualizar() {
    if (document.getElementById("avisoVersion")) return;
    var barra = document.createElement("div");
    barra.id = "avisoVersion"; barra.className = "aviso-version"; barra.setAttribute("role", "status");
    barra.innerHTML = "<span>Hay una versión nueva del catálogo.</span>";
    var b = document.createElement("button"); b.type = "button"; b.className = "boton boton-rojo boton-chico"; b.textContent = "Actualizar";
    b.addEventListener("click", function () { location.reload(); });
    barra.appendChild(b);
    document.body.appendChild(barra);
  }
  function revisarVersion() {
    if (revisando || document.hidden || (navigator.onLine === false)) return;
    revisando = true; ultimaRevision = Date.now();
    hayVersionNueva().then(function (nueva) {
      if (!nueva) return;
      // Si ya se recargó por esto en esta visita y sigue igual (caché del celular), no insistir: solo el aviso
      var ya = null; try { ya = sessionStorage.getItem("recargaPorVersion"); } catch (_) {}
      if (ocupado() || ya === VERSION_ARCHIVOS + "|" + (indice && indice.generado)) { avisoActualizar(); return; }
      try { sessionStorage.setItem("recargaPorVersion", VERSION_ARCHIVOS + "|" + (indice && indice.generado)); } catch (_) {}
      location.reload();
    }).catch(function () {}).then(function () { revisando = false; });
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden && Date.now() - ultimaRevision > 60000) revisarVersion(); });
  window.addEventListener("pageshow", function (e) { if (e.persisted) revisarVersion(); });   // volvió con «atrás» desde la caché del navegador
  window.addEventListener("online", revisarVersion);
  setInterval(function () { if (Date.now() - ultimaRevision >= 15 * 60000) revisarVersion(); }, 60000);

  rutear();
})();
