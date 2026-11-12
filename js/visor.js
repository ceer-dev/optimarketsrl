/*
 * VISOR DE FOTOS «estilo Amazon» — Panel para Clientes (OPTIMARKET S.R.L.)
 * --------------------------------------------------------------------------------------------
 * Pantalla completa para ver mejor un producto:
 *   - Celular: pellizcar para acercar, doble toque para acercar en ese punto, arrastrar para recorrer la foto.
 *   - Computadora: al pasar el mouse sobre la foto se ve ampliada esa zona (lupa); la rueda también acerca.
 *   - Varias fotos del producto: miniaturas abajo; deslizar cambia de foto y, en la última, pasa al siguiente modelo.
 *   - Flechas ‹ › (y teclado ← →) para recorrer los modelos de la lista; contador «3 / 82».
 *   - Debajo: nombre, precio y el botón de la tienda («+ Agregar» o «Sin precio aún»).
 *   - El botón «atrás» del celular y Esc lo cierran.
 * Uso (panel.js): VisorFotos.abrir({ total, indice, obtener: function (i) { return { fotos: [url…], titulo, subtitulo,
 *   detalleHtml, boton: { texto, clase, alTocar } } } })
 * JavaScript simple (Android 11), sin librerías.
 * --------------------------------------------------------------------------------------------
 */
(function () {
  "use strict";

  var ZOOM_MAX = 5; var ZOOM_DOBLE = 2.5; var ZOOM_LUPA = 2.4;
  var capa = null; var cfg = null; var actual = 0; var fotoActual = 0; var item = null; var conHistorial = false; var alCerrarPendiente = null;
  var escala = 1; var tx = 0; var ty = 0;

  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(sel) { return capa ? capa.querySelector(sel) : null; }

  // ------------------------------------------------------------------ zoom y paneo
  function aplicar(animar) {
    var img = $(".visor-img"); if (!img) return;
    img.style.transition = animar ? "transform 0.2s ease" : "none";
    img.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + escala + ")";
    capa.classList.toggle("con-zoom", escala > 1.01);
  }
  function limitar() {
    var img = $(".visor-img"); var esc0 = $(".visor-escenario"); if (!img || !esc0) return;
    var w = img.offsetWidth * escala; var h = img.offsetHeight * escala;
    var mx = Math.max(0, (w - esc0.clientWidth) / 2); var my = Math.max(0, (h - esc0.clientHeight) / 2);
    tx = Math.max(-mx, Math.min(mx, tx)); ty = Math.max(-my, Math.min(my, ty));
  }
  function reiniciarZoom(animar) { escala = 1; tx = 0; ty = 0; aplicar(animar); }
  // Acerca en un punto de la pantalla (px, py) para que ese punto quede bajo el dedo / el mouse
  function zoomEn(nueva, px, py, animar) {
    var esc0 = $(".visor-escenario"); var r = esc0.getBoundingClientRect();
    var cx = r.left + r.width / 2; var cy = r.top + r.height / 2;
    var f = nueva / escala;
    tx = (px - cx) - f * ((px - cx) - tx); ty = (py - cy) - f * ((py - cy) - ty);
    escala = nueva; if (escala <= 1.01) { escala = 1; tx = 0; ty = 0; }
    limitar(); aplicar(animar);
  }

  function gestos(escenario) {
    var punteros = {}; var inicio = null; var pinza = null; var ultimoToque = 0; var lupa = false;
    function lista() { return Object.keys(punteros).map(function (k) { return punteros[k]; }); }
    function distancia(a, b) { return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2)); }

    escenario.addEventListener("pointerdown", function (e) {
      if (e.target.closest("button")) return;
      if (e.pointerType === "mouse") return;   // computadora: la lupa sigue al mouse (y la rueda acerca)
      try { if (escenario.setPointerCapture) escenario.setPointerCapture(e.pointerId); } catch (_) { /* sin captura igual funciona */ }
      punteros[e.pointerId] = { x: e.clientX, y: e.clientY };
      var p = lista();
      if (p.length === 2) { pinza = { d: distancia(p[0], p[1]), esc: escala, cx: (p[0].x + p[1].x) / 2, cy: (p[0].y + p[1].y) / 2 }; inicio = null; }
      else if (p.length === 1) inicio = { x: e.clientX, y: e.clientY, tx: tx, ty: ty, t: Date.now(), movio: false };
    });
    escenario.addEventListener("pointermove", function (e) {
      if (e.pointerType === "mouse") {   // lupa: la zona bajo el mouse se ve ampliada
        if (e.buttons) return;
        var img = $(".visor-img"); var r = img.getBoundingClientRect();
        var dentro = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (dentro && (lupa || escala <= 1.01)) {
          lupa = true; escala = ZOOM_LUPA; tx = 0; ty = 0;
          img.style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + "% " + ((e.clientY - r.top) / r.height * 100) + "%";
          aplicar(false);
        } else if (!dentro && lupa) { lupa = false; img.style.transformOrigin = "50% 50%"; reiniciarZoom(false); }
        return;
      }
      if (!punteros[e.pointerId]) return;
      punteros[e.pointerId] = { x: e.clientX, y: e.clientY };
      var p = lista();
      if (p.length === 2 && pinza) {
        var nueva = Math.max(1, Math.min(ZOOM_MAX, pinza.esc * distancia(p[0], p[1]) / pinza.d));
        zoomEn(nueva, pinza.cx, pinza.cy, false);
      } else if (p.length === 1 && inicio) {
        var dx = e.clientX - inicio.x; var dy = e.clientY - inicio.y;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) inicio.movio = true;
        if (escala > 1.01) { tx = inicio.tx + dx; ty = inicio.ty + dy; limitar(); aplicar(false); }
        else { var img2 = $(".visor-img"); img2.style.transition = "none"; img2.style.transform = "translateX(" + dx + "px)"; }
      }
    });
    function soltar(e) {
      if (e.pointerType === "mouse") return;
      var antes = inicio; delete punteros[e.pointerId];
      if (lista().length < 2) pinza = null;
      if (!antes || lista().length) return;
      var dx = e.clientX - antes.x; var dy = e.clientY - antes.y;
      inicio = null;
      if (!antes.movio && Date.now() - antes.t < 300) {   // toque corto: ¿doble toque?
        if (Date.now() - ultimoToque < 320) { ultimoToque = 0; if (escala > 1.01) reiniciarZoom(true); else zoomEn(ZOOM_DOBLE, e.clientX, e.clientY, true); }
        else ultimoToque = Date.now();
        return;
      }
      if (escala <= 1.01) {
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) { deslizar(dx < 0 ? 1 : -1); return; }
        reiniciarZoom(true);
      }
    }
    escenario.addEventListener("pointerup", soltar);
    escenario.addEventListener("pointercancel", soltar);
    escenario.addEventListener("pointerleave", function (e) {
      if (e.pointerType === "mouse" && lupa) { lupa = false; var img = $(".visor-img"); if (img) img.style.transformOrigin = "50% 50%"; reiniciarZoom(false); }
    });
    escenario.addEventListener("wheel", function (e) {
      e.preventDefault(); lupa = false; var img = $(".visor-img"); if (img) img.style.transformOrigin = "50% 50%";
      zoomEn(Math.max(1, Math.min(ZOOM_MAX, escala * (e.deltaY < 0 ? 1.25 : 0.8))), e.clientX, e.clientY, false);
    }, { passive: false });
  }

  // ------------------------------------------------------------------ contenido
  function deslizar(dir) {
    var n = item.fotos.length;
    if (n > 1 && fotoActual + dir >= 0 && fotoActual + dir < n) { mostrarFoto(fotoActual + dir); return; }
    irA(actual + dir);
  }
  function mostrarFoto(i) {
    fotoActual = i; reiniciarZoom(false);
    var img = $(".visor-img");
    img.style.opacity = "0.35";
    img.onload = function () { img.style.opacity = "1"; };
    img.onerror = function () { img.style.opacity = "1"; };
    img.src = item.fotos[i];
    capa.querySelectorAll(".visor-mini").forEach(function (b, k) { b.setAttribute("aria-pressed", String(k === i)); });
  }
  function irA(i) {
    if (!cfg || i < 0 || i >= cfg.total) return;
    actual = i; item = cfg.obtener(i);
    if (!item) return;
    if (!item.fotos || !item.fotos.length) item.fotos = ["images/optimarket_eye_logo.svg"];
    $(".visor-contador").textContent = cfg.total > 1 ? (i + 1) + " / " + cfg.total : "";
    $(".visor-anterior").hidden = i <= 0; $(".visor-siguiente").hidden = i >= cfg.total - 1;
    $(".visor-miniaturas").innerHTML = item.fotos.length > 1 ? item.fotos.map(function (u, k) {
      return '<button type="button" class="visor-mini" data-foto="' + k + '" aria-label="Foto ' + (k + 1) + '"><img src="' + esc(u) + '" alt="" loading="lazy"></button>';
    }).join("") : "";
    $(".visor-titulo").textContent = item.titulo || "";
    $(".visor-subtitulo").textContent = item.subtitulo || "";
    $(".visor-detalle").innerHTML = item.detalleHtml || "";
    var b = $(".visor-accion");
    if (item.boton) { b.hidden = false; b.textContent = item.boton.texto; b.className = "boton visor-accion " + (item.boton.clase || "boton-rojo"); }
    else b.hidden = true;
    mostrarFoto(0);
    // Precarga de los modelos vecinos (pasar rápido entre monturas)
    [i - 1, i + 1].forEach(function (k) { if (k >= 0 && k < cfg.total) { var v = cfg.obtener(k); if (v && v.fotos && v.fotos[0]) { var im = new Image(); im.src = v.fotos[0]; } } });
  }

  function teclas(e) {
    if (!capa) return;
    if (e.key === "Escape") cerrar();
    else if (e.key === "ArrowRight") deslizar(1);
    else if (e.key === "ArrowLeft") deslizar(-1);
  }
  function alVolver() { if (capa) { conHistorial = false; desmontar(); } }

  function desmontar() {
    if (!capa) return;
    capa.parentNode.removeChild(capa); capa = null; cfg = null;
    document.body.classList.remove("con-visor");
    document.removeEventListener("keydown", teclas);
    window.removeEventListener("popstate", alVolver);
    var fn = alCerrarPendiente; alCerrarPendiente = null;
    if (fn) setTimeout(fn, 30);
  }
  /** Cierra el visor; si se pasa una función, se ejecuta después (ej. abrir la ventana de cantidad). */
  function cerrar(despues) {
    alCerrarPendiente = despues || null;
    if (conHistorial) { conHistorial = false; window.removeEventListener("popstate", alVolver); try { history.back(); } catch (_) {} }
    desmontar();
  }

  function abrir(opciones) {
    if (capa) desmontar();
    cfg = opciones; escala = 1; tx = 0; ty = 0;
    capa = document.createElement("div");
    capa.className = "visor"; capa.setAttribute("role", "dialog"); capa.setAttribute("aria-modal", "true");
    capa.innerHTML =
      '<div class="visor-barra"><span class="visor-contador"></span><span class="visor-ayuda">Pellizca o toca dos veces para acercar</span>' +
      '<button type="button" class="visor-x" aria-label="Cerrar">✕</button></div>' +
      '<div class="visor-escenario"><img class="visor-img" alt="" draggable="false">' +
      '<button type="button" class="visor-flecha visor-anterior" aria-label="Modelo anterior">‹</button>' +
      '<button type="button" class="visor-flecha visor-siguiente" aria-label="Modelo siguiente">›</button></div>' +
      '<div class="visor-miniaturas"></div>' +
      '<div class="visor-pie"><div class="visor-textos"><b class="visor-titulo mono"></b><span class="visor-subtitulo"></span><div class="visor-detalle"></div></div>' +
      '<button type="button" class="boton boton-rojo visor-accion"></button></div>';
    document.body.appendChild(capa);
    document.body.classList.add("con-visor");
    gestos($(".visor-escenario"));
    $(".visor-x").addEventListener("click", function () { cerrar(); });
    $(".visor-anterior").addEventListener("click", function () { irA(actual - 1); });
    $(".visor-siguiente").addEventListener("click", function () { irA(actual + 1); });
    $(".visor-miniaturas").addEventListener("click", function (e) { var b = e.target.closest("[data-foto]"); if (b) mostrarFoto(Number(b.getAttribute("data-foto"))); });
    $(".visor-accion").addEventListener("click", function () { if (item && item.boton && item.boton.alTocar) item.boton.alTocar(); });
    document.addEventListener("keydown", teclas);
    // «Atrás» del celular cierra el visor (sin cambiar la página de fondo)
    try { history.pushState({ visor: true }, ""); conHistorial = true; window.addEventListener("popstate", alVolver); } catch (_) { conHistorial = false; }
    irA(Math.max(0, Math.min(cfg.total - 1, cfg.indice || 0)));
  }

  window.VisorFotos = { abrir: abrir, cerrar: cerrar, abierto: function () { return !!capa; } };
})();
