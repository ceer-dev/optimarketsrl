/*
 * ASISTENTE OPTIMARKET — Panel para Clientes
 * --------------------------------------------------------------------------------------------
 * Un «agente» simple que responde con los datos REALES del catálogo (catalogo/*.json), sin internet extra ni IA de pago:
 *   - Precio de una medida en uno o varios materiales: «+2.50-0.50 blanco», «cuánto cuesta -1.75 ar», «+250-050»,
 *     «bifocal blanco +1.25 add 2», «block base 6 add 200», «cil -0.50».
 *   - Si esa medida EXISTE en el catálogo (nunca promete stock: el stock del sistema no siempre está al día).
 *   - Precios de productos directos: «cartilla», «estuche cuerina», «350ACE».
 *   - Horario, formas de pago, cómo pedir y contacto con un asesor (WhatsApp).
 * Usa el diccionario de búsqueda (config/diccionario-busqueda.json): «cr39», «blanco», «ar», «boca de pescado»…
 * Lo carga panel.js recién cuando el cliente toca «Asistente» (no pesa en la carga inicial). JavaScript simple (Android 11).
 * --------------------------------------------------------------------------------------------
 */
(function () {
  "use strict";
  var api = window.PanelCatalogo;
  if (!api) return;

  var HORARIO = "Lunes a viernes: 8:30–12:30 y 14:00–19:00 · Sábado: 8:30–13:00";
  var MAX_LINEAS = 8;
  var NOTA_PRECIOS = "Precios facturados. La disponibilidad la confirma OPTIMARKET al recibir tu pedido.";
  // Palabras que no ayudan a encontrar el producto
  var VACIAS = ("a al algo alguna alguno amigo buen buena buenas buenos busco busca cuanto cuesta cuestan costo costaria cotizar cotizacion " +
    "de del dime decirme el en es esa ese eso esta este esto estos estas favor hay hola la las le lo los me medida medidas mi mis " +
    "necesito o para por porfa porfavor precio precios que quiero quisiera sale salen se si su sus tiene tienen tienes tendran tu un una " +
    "uno unos unas vale valen y ya lente lentes luna lunas par pares saber consulta consultar existe existen graduacion disponible " +
    "disponibles stock cual cuales esfera cilindro cuantos cuantas con sin muy mas tambien ademas ok gracias pls plis").split(" ");

  var mensajes = [];      // historial de esta visita (no se guarda)
  var acciones = {};      // botones de las respuestas → qué hacen
  var nAccion = 0;
  var capa = null;

  function esc(t) { return api.esc(t); }
  function bs(n) { return api.bs(n); }
  function norm(t) { return api.textoBusqueda(t); }
  // Sin signos de puntuación: «¿tienen ar?» → «tienen ar» (lo mismo para las palabras del diccionario, ej. «a.r.» → «a r»)
  function limpio(t) { return norm(String(t || "").replace(/[¿?¡!,;:()"'.]/g, " ")); }
  function escRe(t) { return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function accion(fn) { var id = "a" + (++nAccion); acciones[id] = fn; return id; }
  function boton(texto, fn, clase) { return '<button type="button" class="as-boton ' + (clase || "") + '" data-accion="' + accion(fn) + '">' + texto + "</button>"; }

  // ------------------------------------------------------------------ entender la medida
  // «250» → «+2.50», «-050» → «-0.50», «2» → «+2.00» (igual que el ERP)
  function dioptria(texto, signoPorDefecto) {
    var s = String(texto || "").replace(/\s+/g, "");
    var signo = /^[+-]/.test(s) ? s.charAt(0) : signoPorDefecto;
    var n = s.replace(/^[+-]/, "");
    if (n.indexOf(".") < 0 && n.length >= 3) n = n.slice(0, -2) + "." + n.slice(-2);
    var v = parseFloat(n);
    return isNaN(v) || v > 40 ? null : signo + v.toFixed(2);
  }
  var NUM = "([+-]?\\s*\\d+(?:\\.\\d+)?)";
  var ADD = "\\s*(?:add|adds|adicion|adi)\\s*:?\\s*\\+?\\s*(\\d+(?:\\.\\d+)?)";
  /** Busca una medida dentro de la frase. Devuelve { tipo, campos, texto, resto } o null. */
  function extraerMedida(frase) {
    var t = " " + api.normalizar(frase).replace(/,/g, ".") + " ";
    var m, a, e, c;
    m = new RegExp("\\bbase\\s*:?\\s*(\\d{1,2})" + ADD).exec(t);
    if (m && (a = dioptria(m[2], "+"))) {
      return { tipo: "block", campos: { base: m[1], add: a }, texto: "Base " + m[1] + " ADD " + a, resto: t.replace(m[0], " ") };
    }
    m = new RegExp("(^|[^a-z0-9.])" + NUM + ADD).exec(t);
    if (m && (e = dioptria(m[2], "+")) && (a = dioptria(m[3], "+"))) {
      return { tipo: "materiallisto", campos: { esfera: e, add: a }, texto: e + " ADD " + a, resto: t.replace(m[0], " ") };
    }
    m = new RegExp("(?:(^|[^a-z0-9.])([+-]\\s*\\d+(?:\\.\\d+)?)\\s*)?(?:cil|cilindro)\\s*:?\\s*" + NUM).exec(t);
    if (m && (c = dioptria(m[3], "-"))) {
      e = m[2] ? dioptria(m[2], "+") : null;
      return { tipo: "lentilla", campos: { medida: e ? e + c : "cil " + c }, texto: e ? e + " " + c : "cil " + c, resto: t.replace(m[0], " ") };
    }
    m = /(^|[^a-z0-9.])([+-]\s*\d+(?:\.\d+)?)(\s*[+-]\s*\d+(?:\.\d+)?)?(?![\d.])/.exec(t);
    if (m && (e = dioptria(m[2], "+"))) {
      c = m[3] ? dioptria(m[3], "-") : null;
      if (m[3] && !c) return null;
      return { tipo: "lentilla", campos: { medida: e + (c || "") }, texto: e + (c ? " " + c : ""), resto: t.replace(m[0], " ") };
    }
    return null;
  }

  // ------------------------------------------------------------------ entender el producto
  function todasLasSubs() {
    var lista = [];
    api.indice().categorias.forEach(function (c) { c.subcategorias.forEach(function (s) { lista.push({ cat: c, sub: s }); }); });
    return lista;
  }
  function raiz(w) { return w.length > 4 ? w.slice(0, -1) : w; }   // «blanca» ~ «blanco», «cartillas» ~ «cartilla»
  function encaja(nombre, palabras) {
    var n = norm(nombre);
    for (var i = 0; i < palabras.length; i++) if (n.indexOf(raiz(palabras[i])) < 0) return false;
    return true;
  }
  /** Productos que menciona la frase: { subs: [{cat, sub}], modelos: [{cat, sub, fila}] } */
  function buscarProductos(texto) {
    var b = " " + limpio(texto) + " ";
    var resultado = { subs: [], modelos: [] };
    var candidatos = []; var modelosDic = [];
    function quitar(frase) { b = b.replace(new RegExp(" " + escRe(frase) + " ", "g"), " "); }
    // 1) Nombre del producto escrito completo («bifocal invisible blanco»): gana el nombre más largo que calce
    var mayor = 0;
    todasLasSubs().forEach(function (x) {
      var partes = norm(x.sub.nombre).split(" ");
      var calza = partes.every(function (w) { return new RegExp(" " + escRe(raiz(w))).test(b); });
      if (!calza) return;
      if (partes.length > mayor) { mayor = partes.length; candidatos = [x]; } else if (partes.length === mayor) candidatos.push(x);
    });
    if (candidatos.length) {
      candidatos.forEach(function (x) { norm(x.sub.nombre).split(" ").forEach(function (w) { b = b.replace(new RegExp(" " + escRe(raiz(w)) + "\\S* ", "g"), " "); }); });
    } else {
      // 2) Diccionario («blanco», «cr39», «ar», «org blanco», «boca de pescado»…): primero las frases más largas,
      //    así «bif invisible blanco» no se confunde con «blanco»
      var frases = [];
      api.diccionario().forEach(function (entrada) {
        (entrada.palabras || []).forEach(function (p) { var f = limpio(p); if (f) frases.push({ frase: f, entrada: entrada }); });
      });
      frases.sort(function (x, y) { return y.frase.length - x.frase.length; });
      frases.forEach(function (f) {
        if (!new RegExp(" " + escRe(f.frase) + " ").test(b)) return;
        quitar(f.frase);
        (f.entrada.subcategorias || []).forEach(function (n) {
          todasLasSubs().forEach(function (x) { if (norm(x.sub.nombre) === norm(n) && candidatos.indexOf(x) < 0) candidatos.push(x); });
        });
        (f.entrada.modelos || []).forEach(function (m) { modelosDic.push(m); });
      });
    }
    var palabras = b.split(" ").filter(function (w) { return w && VACIAS.indexOf(w) < 0 && !/^[+\-\d.]+$/.test(w); });

    // Subcategorías con todas las palabras en «categoría + nombre» (todas cuentan si no hubo diccionario)
    var todas = candidatos.length ? candidatos : todasLasSubs();
    if (palabras.length) {
      var filtradas = todas.filter(function (x) { return encaja(x.cat.nombre + " " + x.sub.nombre, palabras); });
      if (filtradas.length || !candidatos.length) todas = filtradas;
    } else if (!candidatos.length) todas = [];
    // «estuche cuerina»: el diccionario ya apunta al modelo exacto; no hace falta listar todos los estuches
    resultado.subs = modelosDic.length && !candidatos.length ? [] : todas;

    // Modelos de productos directos (monturas, estuches, cartillas…): por código o nombre, y los del diccionario
    api.indice().categorias.forEach(function (c) {
      if (api.tipoOptico(c)) return;
      var datos = api.categoriaCargada(c); if (!datos) return;
      c.subcategorias.forEach(function (s) {
        (datos.subcategorias[s.id] || []).forEach(function (fila) {
          var porDiccionario = modelosDic.some(function (m) { return norm(m.subcategoria) === norm(s.nombre) && norm(fila[1]).indexOf(norm(m.modelo)) >= 0; });
          var porTexto = palabras.length && !resultado.subs.length && !modelosDic.length && encaja(s.nombre + " " + fila[1], palabras);
          if (porDiccionario || porTexto) resultado.modelos.push({ cat: c, sub: s, fila: fila });
        });
      });
    });
    // Mejor esfuerzo: si no hubo nada exacto, lo que comparta más palabras
    if (!resultado.subs.length && !resultado.modelos.length && palabras.length > 1) {
      var mejor = 0; var lista = [];
      todasLasSubs().forEach(function (x) {
        var n = 0; palabras.forEach(function (w) { if (encaja(x.cat.nombre + " " + x.sub.nombre, [w])) n++; });
        if (n > mejor) { mejor = n; lista = [x]; } else if (n && n === mejor) lista.push(x);
      });
      resultado.subs = lista;
    }
    return resultado;
  }

  // ------------------------------------------------------------------ respuestas
  function saludo() {
    var c = api.cliente();
    return "<p>¡Hola" + (c.optica ? " <b>" + esc(c.optica) + "</b>" : "") + "! Soy el asistente de OPTIMARKET.</p>" +
      "<p>Te digo el <b>precio</b> de una medida y si la <b>tenemos en el catálogo</b>. Escríbeme, por ejemplo:</p>" +
      '<ul class="as-ejemplos"><li><span class="mono">+2.50-0.50 blanco</span></li><li><span class="mono">-1.75 ar</span></li>' +
      '<li><span class="mono">bifocal blanco +1.25 add 2</span></li><li><span class="mono">cartillas</span></li></ul>';
  }
  function contacto() {
    var c = api.cliente();
    var texto = "Hola, soy " + (c.optica || "una óptica") + ". Tengo una consulta sobre el catálogo.";
    return "<p>Con gusto. Escríbenos por WhatsApp y un asesor te atiende:</p>" +
      '<a class="as-boton as-verde" target="_blank" rel="noopener" href="https://wa.me/' + api.whatsapp + "?text=" + encodeURIComponent(texto) + '">Abrir WhatsApp</a>' +
      '<p class="as-nota">Horario: ' + HORARIO + "</p>";
  }
  function noEntendi() {
    return "<p>No encontré eso en el catálogo. Prueba así:</p>" +
      '<ul class="as-ejemplos"><li>Una medida y el material: <span class="mono">+2.50-0.50 blanco</span></li>' +
      '<li>Bifocal o progresivo con ADD: <span class="mono">+1.25 add 2</span></li><li>Un producto: <span class="mono">cartilla</span>, <span class="mono">estuche</span></li></ul>' +
      "<p>O si prefieres, " + boton("habla con un asesor", function () { decir(contacto()); }, "as-enlace") + ".</p>";
  }

  /** Abre la ventana de medida del catálogo con la medida ya escrita */
  function botonAgregarMedida(x, medida) {
    return boton("Agregar", function () { cerrar(); api.abrirMedida(x.cat, x.sub, medida ? { tipo: medida.tipo, campos: medida.campos } : null); }, "as-rojo");
  }
  function filaRespuesta(nombre, detalle, botonHtml, apagada) {
    return '<li class="as-fila' + (apagada ? " apagada" : "") + '"><span><b>' + esc(nombre) + "</b>" + (detalle ? "<small>" + detalle + "</small>" : "") + "</span>" + (botonHtml || "") + "</li>";
  }
  function categoriaDeTipo(tipo) {
    var cats = api.indice().categorias;
    for (var i = 0; i < cats.length; i++) if (api.tipoOptico(cats[i]) === tipo) return cats[i];
    return null;
  }

  function responderMedida(medida, productos, preguntaStock) {
    var delTipo = productos.subs.filter(function (x) { return api.tipoOptico(x.cat) === medida.tipo; });
    var mencionoOtros = productos.subs.length && !delTipo.length;
    // Medida de lentilla (sin ADD) pero pidió bifocal/progresivo: falta el ADD → mostramos los ADD que hay para esa esfera
    if (mencionoOtros && medida.tipo === "lentilla") {
      var conAdd = productos.subs.filter(function (x) { return api.tipoOptico(x.cat) === "materiallisto"; });
      if (conAdd.length) return responderFaltaAdd(medida, conAdd);
    }
    var cat = categoriaDeTipo(medida.tipo);
    if (!cat) return Promise.resolve(noEntendi());
    var lista = delTipo.length ? delTipo : cat.subcategorias.map(function (s) { return { cat: cat, sub: s }; });
    var clave = api.claveMedida(api.medidaEscrita(medida.tipo, medida.campos));
    return api.cargarCategoria(cat).then(function (datos) {
      var hay = []; var no = [];
      lista.forEach(function (x) {
        var r = null;
        (datos.subcategorias[x.sub.id] || []).forEach(function (f) { if (f.clave === clave && (!r || (!r[3] && f[3]))) r = f; });
        if (r) hay.push({ x: x, r: r }); else no.push(x);
      });
      hay.sort(function (a, b) { return (a.r[2] == null ? 1e9 : a.r[2]) - (b.r[2] == null ? 1e9 : b.r[2]); });
      var html = "<p>Medida <b class=\"mono\">" + esc(medida.texto) + "</b> en <b>" + esc(cat.nombre) + "</b>" +
        (mencionoOtros ? " (esa medida es de " + esc(cat.nombre) + ")" : "") + ":</p>";
      if (!hay.length) {
        return html + "<p>No tenemos esa medida" + (delTipo.length === 1 ? " en <b>" + esc(delTipo[0].sub.nombre) + "</b>" : " en el catálogo") +
          ". Revisa que esté bien escrita (ej. <span class=\"mono\">+2.50-0.50</span>).</p>" +
          (delTipo.length ? "<p>¿Quieres que la busque en todos los materiales? " + boton("Sí, buscar", function () { enviar(medida.texto); }, "as-enlace") + "</p>" : "") +
          "<p>" + boton("Hablar con un asesor", function () { decir(contacto()); }, "as-enlace") + "</p>";
      }
      html += '<ul class="as-lista">' + hay.slice(0, MAX_LINEAS).map(function (h) {
        return filaRespuesta(h.x.sub.nombre, '<span class="mono">' + esc(h.r[1]) + "</span> · <b>" + bs(h.r[2]) + "</b>", botonAgregarMedida(h.x, medida));
      }).join("") + "</ul>";
      if (hay.length > MAX_LINEAS) html += '<p class="as-nota">… y ' + (hay.length - MAX_LINEAS) + " materiales más. Dime cuál buscas (ej. «blue cut»).</p>";
      if (no.length && delTipo.length) html += '<p class="as-nota">Sin esta medida: ' + no.map(function (x) { return esc(x.sub.nombre); }).join(", ") + ".</p>";
      if (!delTipo.length && hay.length > 1) html += "<p>¿Cuál material quieres? Toca «Agregar» o escríbeme el nombre (ej. <span class=\"mono\">" + esc(medida.texto) + " blanco</span>).</p>";
      html += '<p class="as-nota">' + (preguntaStock ? "Precios facturados. Sobre el stock: no te lo puedo asegurar desde aquí; te lo confirmamos al recibir tu pedido." : NOTA_PRECIOS) + "</p>";
      return html;
    });
  }

  function responderFaltaAdd(medida, subs) {
    var esfera = (medida.campos.medida || "").replace(/^cil.*/, "").match(/^[+-]\d+(?:\.\d+)?/);
    if (!esfera) return Promise.resolve("<p>Para bifocal o progresivo necesito la <b>esfera y el ADD</b>, por ejemplo: <span class=\"mono\">+1.25 add +2.00</span>.</p>");
    var cat = subs[0].cat; var prefijo = api.claveMedida(esfera[0]) + " adds";
    return api.cargarCategoria(cat).then(function (datos) {
      var html = "<p>Para <b>" + esc(cat.nombre) + "</b> también necesito el <b>ADD</b>. Con esfera <b class=\"mono\">" + esc(esfera[0]) + "</b> tenemos:</p><ul class=\"as-lista\">";
      subs.slice(0, MAX_LINEAS).forEach(function (x) {
        var filas = (datos.subcategorias[x.sub.id] || []).filter(function (f) { return f.clave.indexOf(prefijo) === 0; });
        if (!filas.length) { html += filaRespuesta(x.sub.nombre, "No hay esa esfera", "", true); return; }
        var adds = filas.map(function (f) { return parseFloat((f.clave.split("adds ")[1] || "0")); }).sort(function (a, b) { return a - b; });
        var precios = filas.map(function (f) { return f[2]; }).filter(function (p) { return p != null; });
        html += filaRespuesta(x.sub.nombre, "ADD +" + adds[0].toFixed(2) + " a +" + adds[adds.length - 1].toFixed(2) +
          (precios.length ? " · <b>" + bs(Math.min.apply(null, precios)) + "</b>" : ""), botonAgregarMedida(x, { tipo: "materiallisto", campos: { esfera: esfera[0], add: "" } }));
      });
      return html + "</ul><p>Escríbeme el ADD, por ejemplo: <span class=\"mono\">" + esc(esfera[0]) + " add +2.00</span>.</p><p class=\"as-nota\">" + NOTA_PRECIOS + "</p>";
    });
  }

  function responderProductos(productos) {
    var html = ""; var opticos = []; var directos = [];
    productos.subs.forEach(function (x) { (api.tipoOptico(x.cat) ? opticos : directos).push(x); });
    if (opticos.length) {
      html += "<p>Esto encontré" + (opticos.length > 1 ? " (" + opticos.length + ")" : "") + ". El precio depende de la medida:</p><ul class=\"as-lista\">" +
        opticos.slice(0, MAX_LINEAS).map(function (x) {
          return filaRespuesta(x.sub.nombre, esc(x.cat.nombre) + (x.sub.desde != null ? " · desde <b>" + bs(x.sub.desde) + "</b>" : ""), botonAgregarMedida(x, null));
        }).join("") + "</ul>" +
        (opticos.length > MAX_LINEAS ? '<p class="as-nota">… y ' + (opticos.length - MAX_LINEAS) + " más.</p>" : "") +
        "<p>Escríbeme la medida y te digo el precio exacto, por ejemplo: <span class=\"mono\">+2.50-0.50 " + esc(opticos[0].sub.nombre.toLowerCase()) + "</span>.</p>";
    }
    // Productos directos: sus modelos con precio
    var modelos = productos.modelos.slice();
    directos.forEach(function (x) {
      var datos = api.categoriaCargada(x.cat);
      (datos ? datos.subcategorias[x.sub.id] || [] : []).forEach(function (f) { modelos.push({ cat: x.cat, sub: x.sub, fila: f }); });
    });
    if (modelos.length) {
      html += "<p>" + (opticos.length ? "Y también:" : "Esto encontré:") + "</p><ul class=\"as-lista\">" + modelos.slice(0, MAX_LINEAS).map(function (m) {
        var alias = api.aliasDeModelo(m.sub, m.fila);
        return filaRespuesta(m.fila[1] + (alias ? " (" + alias + ")" : ""), esc(m.sub.nombre) + " · <b>" + bs(m.fila[2]) + "</b>",
          boton("Agregar", function () { cerrar(); api.agregarModelo(m.cat, m.sub, m.fila[0]); }, "as-rojo"));
      }).join("") + "</ul>";
      if (modelos.length > MAX_LINEAS) {
        var x0 = modelos[0];
        html += '<p class="as-nota">… y ' + (modelos.length - MAX_LINEAS) + " modelos más. " +
          boton("Ver todos", function () { cerrar(); location.hash = "#/c/" + x0.cat.slug + "/s/" + x0.sub.id; }, "as-enlace") + "</p>";
      }
    }
    return html + '<p class="as-nota">' + NOTA_PRECIOS + "</p>";
  }

  /** Cerebro del asistente: frase del cliente → respuesta (HTML) */
  function responder(frase) {
    var t = api.normalizar(frase);
    var medida = extraerMedida(frase);
    var preguntaStock = /\b(stock|hay|tienen|tienes|disponib\w*|queda|quedan)\b/.test(t);
    if (!medida) {
      if (/horario|atienden|atencion|abren|cierran|a que hora/.test(t)) return Promise.resolve("<p>Nuestro horario de atención:</p><p><b>" + HORARIO + "</b></p>");
      if (/\b(pago|pagos|pagar|qr|efectivo|transferencia|deposito)\b/.test(t)) {
        return Promise.resolve("<p>Puedes pagar con <b>QR</b> o en <b>efectivo</b>. Lo eliges al enviar tu pedido (en «Mi pedido»).</p>");
      }
      if (/(como|donde)\b.*\b(pido|pedir|compro|comprar|pedido|ordeno|ordenar|cotizo|cotizar)|hacer (un |mi )?pedido/.test(t)) {
        return Promise.resolve("<p>Así de fácil:</p><ol class=\"as-ejemplos\"><li>Busca el producto o escríbeme la medida.</li><li>Toca <b>Agregar</b> y elige la cantidad.</li>" +
          "<li>Abre <b>Mi pedido</b> (arriba a la derecha), elige QR o efectivo y toca <b>Enviar pedido por WhatsApp</b>.</li></ol>" +
          '<p class="as-nota">Te confirmamos disponibilidad y precio final al recibirlo.</p>');
      }
      if (/\b(asesor|humano|persona|whatsapp|wsp|llamar|telefono|celular|contacto|vendedor|hablar)\b/.test(t)) return Promise.resolve(contacto());
      if (/\b(envio|envios|enviar|envian|delivery|domicilio|mandan|provincia)\b/.test(t)) {
        return Promise.resolve("<p>Los envíos se coordinan con un asesor al confirmar tu pedido.</p>" + contacto());
      }
      if (/^\s*(hola|buen[oa]s?|hey|saludos|que tal)\b/.test(t) && t.split(/\s+/).length <= 4) return Promise.resolve(saludo());
      if (/^\s*(gracias|muchas gracias|ok|okey|listo|perfecto|genial|vale)\b/.test(t) && t.split(/\s+/).length <= 4) {
        return Promise.resolve("<p>¡Con gusto! Si necesitas otra medida, escríbemela.</p>");
      }
    }
    var productos = buscarProductos(medida ? medida.resto : frase);
    if (medida) return responderMedida(medida, productos, preguntaStock);
    if (productos.subs.length || productos.modelos.length) return Promise.resolve(responderProductos(productos));
    return Promise.resolve(noEntendi());
  }

  // ------------------------------------------------------------------ ventana del chat
  function pintarMensaje(m) {
    var lista = capa.querySelector(".as-mensajes");
    var div = document.createElement("div");
    div.className = "as-msj " + (m.de === "cliente" ? "as-cliente" : "as-bot");
    div.innerHTML = m.de === "cliente" ? esc(m.texto) : m.html;
    lista.appendChild(div);
    lista.scrollTop = lista.scrollHeight;
    return div;
  }
  function decir(html) { var m = { de: "bot", html: html }; mensajes.push(m); if (capa) pintarMensaje(m); }
  function enviar(texto) {
    texto = String(texto || "").trim(); if (!texto) return;
    var m = { de: "cliente", texto: texto }; mensajes.push(m); pintarMensaje(m);
    var escribiendo = pintarMensaje({ de: "bot", html: '<span class="as-escribiendo"><i></i><i></i><i></i></span>' });
    api.listo().then(function () { return responder(texto); })
      .catch(function () { return "<p>No pude revisar el catálogo ahora. Revisa tu conexión e intenta otra vez.</p>"; })
      .then(function (html) {
        setTimeout(function () { escribiendo.parentNode && escribiendo.parentNode.removeChild(escribiendo); decir(html); }, 250);
      });
  }

  function crear() {
    capa = document.createElement("div");
    capa.className = "as-capa"; capa.hidden = true;
    capa.innerHTML = '<section class="as-ventana" role="dialog" aria-modal="true" aria-label="Asistente OPTIMARKET">' +
      '<header class="as-cabecera"><img src="images/optimarket_eye_logo.svg" alt="" width="34" height="34">' +
      '<div><b>Asistente OPTIMARKET</b><span>Precios y medidas del catálogo</span></div>' +
      '<button type="button" class="ventana-x" data-cerrar-as aria-label="Cerrar">✕</button></header>' +
      '<div class="as-mensajes" aria-live="polite"></div>' +
      '<div class="as-rapidos">' + ["+2.50-0.50 blanco", "-1.75 ar", "Bifocal blanco +1.25 add 2", "Cartillas", "Horario", "¿Cómo hago mi pedido?", "Hablar con un asesor"]
        .map(function (t) { return '<button type="button" class="chip" data-rapido="' + esc(t) + '">' + esc(t) + "</button>"; }).join("") + "</div>" +
      '<form class="as-entrada" autocomplete="off"><input type="text" enterkeyhint="send" placeholder="Escribe tu consulta… ej: +2.50-0.50 blanco" aria-label="Tu consulta">' +
      '<button type="submit" class="boton boton-rojo" aria-label="Enviar">➤</button></form></section>';
    document.body.appendChild(capa);
    var entrada = capa.querySelector(".as-entrada input");
    capa.querySelector(".as-entrada").addEventListener("submit", function (e) { e.preventDefault(); var v = entrada.value; entrada.value = ""; enviar(v); });
    capa.addEventListener("click", function (e) {
      if (e.target === capa || e.target.closest("[data-cerrar-as]")) { cerrar(); return; }
      var r = e.target.closest("[data-rapido]"); if (r) { enviar(r.getAttribute("data-rapido")); return; }
      var a = e.target.closest("[data-accion]"); if (a && acciones[a.getAttribute("data-accion")]) acciones[a.getAttribute("data-accion")]();
    });
    mensajes.forEach(pintarMensaje);
  }
  function abrir() {
    if (!capa) crear();
    if (!mensajes.length) decir(saludo());
    capa.hidden = false;
    document.body.classList.add("con-asistente");
    setTimeout(function () { var l = capa.querySelector(".as-mensajes"); l.scrollTop = l.scrollHeight; }, 0);
  }
  function cerrar() {
    if (capa) capa.hidden = true;
    document.body.classList.remove("con-asistente");
  }

  window.AsistenteOptimarket = { abrir: abrir, cerrar: cerrar, responder: responder, extraerMedida: extraerMedida, buscarProductos: buscarProductos };
})();
