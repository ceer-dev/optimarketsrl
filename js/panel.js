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
 * Rutas (botón «atrás» del celular): #/ · #/c/<cat> · #/c/<cat>/m/<sub> (medidas) · #/c/<cat>/s/<sub> (productos)
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
  var VERSION_ARCHIVOS = "20261008j";   // igual que el ?v= de index.html

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
  function bs(n) { return n == null ? "Consultar" : "Bs " + Number(n).toFixed(2); }
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
  function textoUnidad(qty, tipo) {
    if (!tipo) return qty + (qty === 1 ? " unid." : " unids.");
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
  function sumarAlPedido(item, cantidad) {
    var actual = pedido[item.id] ? pedido[item.id].qty : 0;
    pedido[item.id] = { id: item.id, cat: item.cat, catSlug: item.catSlug, sub: item.sub, subId: item.subId, medida: item.medida, cf: item.cf, tipo: item.tipo || null, qty: Math.min(999, actual + cantidad) };
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
      ? '<span class="precio">' + (prefijo ? prefijo + " " : "") + "<b>" + bs(desde) + '</b> <span class="sello-cf">Facturado</span></span>'
      : '<span class="precio">Precio a consultar</span>';
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
    var accion = href
      ? '<a class="boton boton-rojo boton-chico" href="' + href + '">+ Agregar</a>'
      : '<button type="button" class="boton boton-rojo boton-chico" data-agregar="' + r[0] + '" data-cat="' + esc(cat.slug) + '" data-sub="' + sub.id + '">+ Agregar</button>';
    return '<div class="tarjeta-sub tarjeta-producto"><div class="foto">' + img(r[4] || sub.imagen, r[1]) + "</div>" +
      '<div class="info"><span class="nombre mono">' + esc(r[1]) + "</span>" +
      (aliasDeModelo(sub, r) ? '<span class="alias">También: ' + esc(aliasDeModelo(sub, r)) + "</span>" : "") + precioTarjeta(r[2], "") +
      (q ? '<span class="elegidos">' + textoUnidad(q, null) + " en tu pedido</span>" : "") + accion + "</div></div>";
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
      '<p class="subtitulo">Precios facturados' + (fecha ? " al " + esc(fecha) : "") + ". Busca o elige una categoría.</p></div></div>" +
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
    var destino = "#/c/" + esc(cat.slug) + (optico ? "/m/" : "/s/") + s.id;
    return '<a class="tarjeta-sub" href="' + destino + '"><div class="foto">' + img(s.imagen, s.nombre) + "</div>" +
      '<div class="info">' + (conCategoria ? '<span class="cat-mini">' + esc(cat.nombre) + "</span>" : "") +
      '<span class="nombre">' + esc(s.nombre) + "</span>" + precioTarjeta(s.desde, s.medidas > 1 ? "desde" : "") +
      '<span class="stock" hidden></span>' +
      '<span class="accion-tarjeta">' + (optico ? "Elegir medida" : "Ver productos") + " ›</span>" +
      (n ? '<span class="elegidos">' + n + " en tu pedido</span>" : "") + "</div></a>";
  }

  function vistaCategoria(cat) {
    vista.innerHTML = '<div class="encabezado-vista"><a class="volver" href="#/">← Inicio</a><div class="textos">' +
      '<h1 class="titulo">' + esc(cat.nombre) + '</h1><p class="subtitulo">' + cat.subcategorias.length + " productos · " +
      (tipoOptico(cat) ? "toca uno para escribir la medida" : "toca uno para ver sus modelos") + "</p></div></div>" +
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

  // Productos directos de una subcategoría (monturas, accesorios…): tarjeta por producto
  function vistaProductos(cat, datos, sub) {
    var filas = datos.subcategorias[sub.id] || [];
    vista.innerHTML = '<div class="encabezado-vista"><a class="volver" href="#/c/' + esc(cat.slug) + '">← Volver</a><div class="textos">' +
      '<h1 class="titulo">' + esc(sub.nombre) + '</h1><p class="subtitulo">' + esc(cat.nombre) + " · " + filas.length + (filas.length === 1 ? " modelo" : " modelos") + "</p></div></div>" +
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
      campos = '<div class="campos-dos"><label class="campo-medida"><span>Esfera</span><input id="fEsfera" inputmode="decimal" autocomplete="off" placeholder="ej: +0.25, -1.50"></label>' +
        '<label class="campo-medida"><span>ADD</span><input id="fAdd" inputmode="decimal" autocomplete="off" placeholder="ej: +1.50, +2.00"></label></div>';
    } else if (tipo === "block") {
      campos = '<div class="campos-dos"><label class="campo-medida"><span>Base</span><input id="fBase" inputmode="numeric" autocomplete="off" placeholder="ej: 4, 6"></label>' +
        '<label class="campo-medida"><span>ADD</span><input id="fAdd" inputmode="decimal" autocomplete="off" placeholder="ej: +1.50, 150"></label></div>';
    } else {
      campos = '<label class="campo-medida"><span>Medida</span><input id="fMedida" inputmode="text" autocomplete="off" placeholder="Ej: +2.50-0.25, -1.50, cil -0.25"></label>';
    }

    var capa = abrirVentana(
      '<header class="ventana-cabecera">' + img(sub.imagen, sub.nombre, "ventana-foto") +
      '<div class="textos"><h2>' + esc(sub.nombre) + "</h2><span>" + esc(cat.nombre) + " · Medida y cantidad</span></div>" +
      '<button type="button" class="ventana-x" data-cerrar aria-label="Cerrar">✕</button></header>' +
      '<div class="ventana-cuerpo">' +
      '<div id="agregado" class="agregado" role="status" hidden></div>' +
      '<div class="bloque"><span class="etiqueta">Medida / graduación</span>' + campos +
      '<div id="sugerencias" class="sugerencias" aria-label="Medidas sugeridas"></div>' +
      '<p id="estado" class="estado-medida" role="status" hidden></p></div>' +
      '<div class="bloque fila"><span class="etiqueta">Precio facturado</span><strong id="precio" class="mono">--</strong></div>' +
      '<div class="bloque fila"><span class="etiqueta">Cantidad</span><div class="contador-cant grande"><button type="button" id="cMenos" aria-label="Quitar uno">−</button>' +
      '<input id="cNum" class="num" inputmode="numeric" value="1" aria-label="Cantidad"><button type="button" id="cMas" aria-label="Agregar uno">+</button></div></div>' +
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
      // «+250» se entiende +2.50 en medida, esfera y ADD (la base del block es un número entero: queda igual)
      return { medida: dioptriasSinPunto(valor("fMedida")), esfera: dioptriasSinPunto(valor("fEsfera")), base: valor("fBase"), add: dioptriasSinPunto(valor("fAdd")) };
    }
    function pintarResumen() {
      var precio = resuelta ? resuelta[2] : null;
      $("cNum").value = cantidad;
      $("unidad").textContent = resuelta ? "(" + textoUnidad(cantidad, tipo) + ")" : "";
      $("subtotal").textContent = resuelta && precio != null ? bs(precio * cantidad) : "--";
      $("btnAgregar").disabled = !resuelta;
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
      else { mostrarEstado("", ""); $("precio").textContent = bs(resuelta[2]); }
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
    $("btnAgregar").addEventListener("click", function () {
      if (!resuelta) return;
      sumarAlPedido({ id: resuelta[0], cat: cat.nombre, catSlug: cat.slug, sub: sub.nombre, subId: sub.id, medida: resuelta[1], cf: resuelta[2], tipo: tipo }, cantidad);
      agregados += cantidad;
      var ag = $("agregado");
      ag.innerHTML = "<b>✓ Agregado:</b> <span class=\"mono\">" + esc(resuelta[1]) + " × " + cantidad + "</span><span>" + agregados + " en total · escribe otra medida</span>";
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
    var cantidad = 1;
    var capa = abrirVentana(
      '<header class="ventana-cabecera">' + img(r[4] || sub.imagen, r[1], "ventana-foto") +
      '<div class="textos"><h2 class="mono">' + esc(r[1]) + "</h2><span>" + esc(sub.nombre) + " · " + esc(cat.nombre) + "</span></div>" +
      '<button type="button" class="ventana-x" data-cerrar aria-label="Cerrar">✕</button></header>' +
      '<div class="ventana-cuerpo">' +
      '<div class="bloque fila"><span class="etiqueta">Precio facturado</span><strong class="mono">' + bs(r[2]) + "</strong></div>" +
      '<div class="bloque fila"><span class="etiqueta">Cantidad</span><div class="contador-cant grande"><button type="button" id="cMenos" aria-label="Quitar uno">−</button>' +
      '<input id="cNum" class="num" inputmode="numeric" value="1" aria-label="Cantidad"><button type="button" id="cMas" aria-label="Agregar uno">+</button></div></div>' +
      '<div class="bloque fila resumen"><span class="etiqueta">Subtotal</span><strong id="subtotal" class="mono verde">' + bs(r[2]) + "</strong></div></div>" +
      '<footer class="ventana-pie"><button type="button" class="boton boton-gris-chico" data-cerrar>Cancelar</button>' +
      '<button type="button" class="boton boton-rojo" id="btnAgregar">✓ Agregar al pedido</button></footer>',
      rutaProductos);
    var $ = function (id) { return capa.querySelector("#" + id); };
    function pintar() { $("cNum").value = cantidad; $("subtotal").textContent = r[2] != null ? bs(r[2] * cantidad) : "Consultar"; }
    $("cMenos").addEventListener("click", function () { if (cantidad > 1) { cantidad--; pintar(); } });
    $("cMas").addEventListener("click", function () { if (cantidad < 999) { cantidad++; pintar(); } });
    $("cNum").addEventListener("input", function () { var n = parseInt($("cNum").value.replace(/\D/g, ""), 10); cantidad = isNaN(n) || n < 1 ? 1 : Math.min(999, n); $("subtotal").textContent = r[2] != null ? bs(r[2] * cantidad) : "Consultar"; });
    $("btnAgregar").addEventListener("click", function () {
      sumarAlPedido({ id: r[0], cat: cat.nombre, catSlug: cat.slug, sub: sub.nombre, subId: sub.id, medida: r[1], cf: r[2], tipo: null }, cantidad);
      aviso("✓ Agregado: " + r[1] + " × " + cantidad);
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
          '<div class="linea">' + textoUnidad(p.qty, p.tipo) + " · " + bs(p.cf) + (p.cf != null ? " c/u = <b>" + bs(p.cf * p.qty) + "</b>" : "") + "</div></div>" +
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
      '<p class="nota">Precios facturados. El stock y el precio final los confirma OPTIMARKET al recibir tu pedido.</p></div>';
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
    document.getElementById("enviarPedido").addEventListener("click", enviarPedido);
  }

  function enviarPedido() {
    var t = totales();
    var pago = (document.querySelector('input[name="pago"]:checked') || {}).value || "NO DEFINIDO";
    var optica = (cliente.optica || "ÓPTICA").toUpperCase();
    var lineas = []; var mensaje = "Hola, soy " + optica + ".\nEste es mi pedido:\n\n";
    var grupos = {};
    Object.keys(pedido).forEach(function (id) { var p = pedido[id]; (grupos[p.sub] = grupos[p.sub] || []).push(p); });
    Object.keys(grupos).sort().forEach(function (sub) {
      mensaje += "*" + sub + "*\n";
      grupos[sub].forEach(function (p) {
        mensaje += "• " + p.medida + " — " + textoUnidad(p.qty, p.tipo) + " (" + p.qty + ")" + (p.cf != null ? " × " + bs(p.cf) : " — precio a consultar") + "\n";
        lineas.push(sub + " | " + p.medida + " | Cant: " + p.qty + " | P.U: " + (p.cf != null ? p.cf : "consultar"));
      });
      mensaje += "\n";
    });
    mensaje += "Total: " + bs(t.total) + (t.consultar ? " (+ " + t.consultar + " a consultar)" : "") + "\nPago: " + pago + "\nGracias.";
    // 1) WhatsApp de inmediato (abrirlo dentro del toque evita que el celular lo bloquee)
    window.open("https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(mensaje), "_blank");
    // 2) Registro del pedido en Netlify Forms, en segundo plano
    var datos = new URLSearchParams({ "form-name": "pedidos", optica: optica, celular: cliente.phone || "", detalles: lineas.join("\n"),
      metodo_pago: pago, total: bs(t.total), fecha_hora: new Date().toLocaleString("es-BO") });
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
      if (p[2] === "m" && sub) {
        if (vistaPintada !== "c/" + cat.slug) { vistaCategoria(cat); vistaPintada = "c/" + cat.slug; }
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
  document.getElementById("botonSalir").addEventListener("click", function () {
    if (!confirm("¿Cerrar sesión en este dispositivo?")) return;
    try { localStorage.removeItem("registeredClient"); localStorage.removeItem(CLAVE_PEDIDO); } catch (_) {}
    location.replace("form.html");
  });
  window.addEventListener("hashchange", rutear);

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

  rutear();
})();
