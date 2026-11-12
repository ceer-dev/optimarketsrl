/*
 * TABLA DE PRECIOS POR RANGOS — Panel para Clientes (OPTIMARKET S.R.L.)
 * --------------------------------------------------------------------------------------------
 * Convierte las medidas de una subcategoría de lentes (catalogo/cat-*.json) en tablas de rangos para VER los precios
 * de un vistazo, sin escribir nada:
 *   Lentilla:       Esférico (+ y −) · Cilindro (−) · Combinados (esfera + / esfera −) × cilindro
 *   Material Listo: Esfera (+ / −) × ADD
 *   Block:          Base × ADD
 * Los rangos salen de los PRECIOS REALES de cada medida (no de una tabla escrita a mano): medidas seguidas con el
 * mismo precio (facturado y sin factura) forman un rango. En las matrices se corta una fila/columna solo donde
 * algún precio cambia, así cada bloque tiene un único precio.
 * Fila del catálogo: [id, medida, CF, disponible, imagen, SF]. Por defecto solo cuenta el CF (lo que se muestra).
 * JavaScript simple (Android 11). Expone window.TablaPrecios.construir(tipo, filas) → [secciones].
 * --------------------------------------------------------------------------------------------
 */
(function () {
  "use strict";

  var NUM = "([+-]?\\d+(?:\\.\\d+)?)";
  var RE_CIL = new RegExp("^cil\\s+" + NUM + "$", "i");
  var RE_ESF = new RegExp("^" + NUM + "$");
  var RE_COMB = new RegExp("^" + NUM + "\\s+" + NUM + "$");
  var RE_ADD = new RegExp("^" + NUM + "\\s+ADD\\s+" + NUM + "$", "i");
  var RE_BASE = new RegExp("^Base\\s+" + NUM + "\\s+ADD\\s+" + NUM + "$", "i");

  function precio(v) { var n = Number(v); return v == null || !isFinite(n) || n <= 0 ? null : Math.round(n * 100) / 100; }
  function clavePrecio(cf, sf) { return (cf == null ? "-" : cf.toFixed(2)) + "|" + (sf == null ? "-" : sf.toFixed(2)); }
  function dioptria(v) { var n = Number(v); return (n < 0 ? "-" : "+") + Math.abs(n).toFixed(2); }
  function addBlock(v) { var n = Number(v); return "+" + (n >= 10 ? n / 100 : n).toFixed(2); }   // «ADD 200» = +2.00

  /** Una lista de valores con precio → rangos de precio igual. valores: [{ v, etiqueta, cf, sf }] */
  function rangosLista(valores) {
    var ord = valores.slice().sort(function (a, b) { return Math.abs(a.v) - Math.abs(b.v); });
    var rangos = [];
    ord.forEach(function (x) {
      var k = clavePrecio(x.cf, x.sf); var ult = rangos[rangos.length - 1];
      if (ult && ult.clave === k) { ult.hasta = x.etiqueta; ult.n++; }
      else rangos.push({ clave: k, desde: x.etiqueta, hasta: x.etiqueta, cf: x.cf, sf: x.sf, n: 1 });
    });
    return rangos;
  }

  /**
   * Matriz fila × columna → bloques de precio igual.
   * celdas: [{ f, fe, c, ce, cf, sf }] (f/c valor numérico, fe/ce etiqueta)
   */
  function rangosMatriz(celdas) {
    var filas = {}; var cols = {}; var mapa = {};
    celdas.forEach(function (x) {
      filas[x.f] = x.fe; cols[x.c] = x.ce;
      mapa[x.f + "|" + x.c] = clavePrecio(x.cf, x.sf);
      mapa["p" + clavePrecio(x.cf, x.sf)] = { cf: x.cf, sf: x.sf };
    });
    function orden(o) { return Object.keys(o).map(Number).sort(function (a, b) { return Math.abs(a) - Math.abs(b); }); }
    var F = orden(filas); var C = orden(cols);
    // Celdas sueltas: una medida con precio distinto a TODAS sus vecinas (que entre sí coinciden) es un precio especial
    // (o un error de carga); se muestra aparte y no parte la tabla en pedazos.
    var especiales = {}; var excepciones = [];
    F.forEach(function (f, i) {
      C.forEach(function (c, j) {
        var propia = mapa[f + "|" + c]; if (!propia) return;
        var vecinas = [];
        if (i > 0) vecinas.push(mapa[F[i - 1] + "|" + c]); if (i < F.length - 1) vecinas.push(mapa[F[i + 1] + "|" + c]);
        if (j > 0) vecinas.push(mapa[f + "|" + C[j - 1]]); if (j < C.length - 1) vecinas.push(mapa[f + "|" + C[j + 1]]);
        vecinas = vecinas.filter(Boolean);
        if (vecinas.length >= 2 && vecinas.every(function (v) { return v === vecinas[0] && v !== propia; })) {
          especiales[f + "|" + c] = 1;
          var pr = mapa["p" + propia]; excepciones.push({ medida: filas[f] + " " + cols[c], cf: pr.cf, sf: pr.sf });
        }
      });
    });
    function k(f, c) { return especiales[f + "|" + c] ? undefined : mapa[f + "|" + c]; }
    // Cortes: entre dos columnas vecinas si en alguna fila (con las dos medidas) el precio cambia; igual para filas
    function cortes(ejes, otros, invertir) {
      var grupos = [[ejes[0]]];
      for (var i = 1; i < ejes.length; i++) {
        var cambia = otros.some(function (o) {
          var a = invertir ? k(o, ejes[i - 1]) : k(ejes[i - 1], o);
          var b = invertir ? k(o, ejes[i]) : k(ejes[i], o);
          return a && b && a !== b;
        });
        if (cambia) grupos.push([ejes[i]]); else grupos[grupos.length - 1].push(ejes[i]);
      }
      return grupos;
    }
    var gF = cortes(F, C, false); var gC = cortes(C, F, true);
    var etiqueta = function (g, nombres) { var a = nombres[g[0]]; var b = nombres[g[g.length - 1]]; return { desde: a, hasta: b }; };
    var columnas = gC.map(function (g) { return etiqueta(g, cols); });
    var cuerpo = gF.map(function (gf) {
      return {
        rango: etiqueta(gf, filas),
        precios: gC.map(function (gc) {
          var cuenta = {}; var mejor = null;
          gf.forEach(function (f) { gc.forEach(function (c) { var x = k(f, c); if (x) { cuenta[x] = (cuenta[x] || 0) + 1; if (!mejor || cuenta[x] > cuenta[mejor]) mejor = x; } }); });
          return mejor ? mapa["p" + mejor] : null;
        })
      };
    });
    return { columnas: columnas, filas: cuerpo, excepciones: excepciones };
  }

  function seccionLista(titulo, valores) { return valores.length ? { tipo: "lista", titulo: titulo, rangos: rangosLista(valores) } : null; }
  function seccionMatriz(titulo, filaTitulo, colTitulo, celdas) {
    if (!celdas.length) return null;
    var m = rangosMatriz(celdas);
    return { tipo: "matriz", titulo: titulo, filaTitulo: filaTitulo, colTitulo: colTitulo, columnas: m.columnas, filas: m.filas, excepciones: m.excepciones };
  }

  // opciones.conSF: false (por defecto) = solo el precio facturado arma los rangos; el SF se ignora
  function construir(tipo, filas, opciones) {
    var conSF = !!(opciones && opciones.conSF);
    var esf = []; var cil = []; var combP = []; var combN = []; var addP = []; var addN = []; var base = []; var otras = [];
    (filas || []).forEach(function (r) {
      var t = String(r[1] || "").trim(); var cf = precio(r[2]); var sf = conSF ? precio(r[5]) : null; var m;
      if (cf == null && sf == null) return;
      if (tipo === "lentilla" && (m = RE_CIL.exec(t))) cil.push({ v: Number(m[1]), etiqueta: dioptria(m[1]), cf: cf, sf: sf });
      else if (tipo === "lentilla" && (m = RE_ESF.exec(t))) esf.push({ v: Number(m[1]), etiqueta: dioptria(m[1]), cf: cf, sf: sf });
      else if (tipo === "lentilla" && (m = RE_COMB.exec(t))) {
        (Number(m[1]) >= 0 ? combP : combN).push({ f: Number(m[1]), fe: dioptria(m[1]), c: Number(m[2]), ce: dioptria(m[2]), cf: cf, sf: sf });
      } else if (tipo === "materiallisto" && (m = RE_ADD.exec(t))) {
        (Number(m[1]) >= 0 ? addP : addN).push({ f: Number(m[1]), fe: dioptria(m[1]), c: Number(m[2]), ce: dioptria(m[2]), cf: cf, sf: sf });
      } else if (tipo === "block" && (m = RE_BASE.exec(t))) {
        base.push({ f: Number(m[1]), fe: "Base " + m[1], c: Number(m[2]), ce: addBlock(m[2]), cf: cf, sf: sf });
      } else otras.push({ v: otras.length, etiqueta: t, cf: cf, sf: sf });
    });
    var esfP = esf.filter(function (x) { return x.v >= 0; }); var esfN = esf.filter(function (x) { return x.v < 0; });
    var secciones = [
      seccionLista("Esférico (+)", esfP),
      seccionLista("Esférico (−)", esfN),
      seccionLista("Cilindro (−)", cil),
      seccionMatriz("Combinados · esfera (+)", "Esfera (+)", "Cilindro (−)", combP),
      seccionMatriz("Combinados · esfera (−)", "Esfera (−)", "Cilindro (−)", combN),
      seccionMatriz("Esfera (+) con ADD", "Esfera (+)", "ADD", addP),
      seccionMatriz("Esfera (−) con ADD", "Esfera (−)", "ADD", addN),
      seccionMatriz("Base con ADD", "Base", "ADD", base),
      otras.length ? { tipo: "lista", titulo: "Otras medidas", rangos: otras.map(function (x) { return { desde: x.etiqueta, hasta: x.etiqueta, cf: x.cf, sf: x.sf, n: 1 }; }) } : null
    ];
    return secciones.filter(Boolean);
  }

  window.TablaPrecios = { construir: construir, _rangosLista: rangosLista, _rangosMatriz: rangosMatriz };
})();
