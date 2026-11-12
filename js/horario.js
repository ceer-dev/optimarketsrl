/*
 * HORARIO Y RELOJ — Panel para Clientes (OPTIMARKET S.R.L.)
 * --------------------------------------------------------------------------------------------
 * Hora de BOLIVIA (Santa Cruz, UTC−4, sin horario de verano) calculada desde la hora mundial: aunque el celular del
 * cliente esté en otro país o con otra zona horaria, se ve y se usa la hora de la empresa.
 * Horario de atención (dueño 2026-11-12):
 *   Lunes a viernes: 8:30–12:30 y 14:00–19:00 · Sábado: 8:30–13:00 · Domingo: cerrado.
 * Expone window.HorarioOptimarket: ahora(), estado(), texto del horario. Lo usan panel.js (reloj y aviso al enviar el
 * pedido fuera de horario) y asistente.js («¿están abiertos?»). JavaScript simple (Android 11).
 * --------------------------------------------------------------------------------------------
 */
(function () {
  "use strict";

  var DESFASE_BOLIVIA = -4 * 60;   // minutos respecto de UTC
  // Turnos por día de la semana (0 = domingo … 6 = sábado), en minutos desde las 00:00
  var TURNOS = {
    0: [],
    1: [[510, 750], [840, 1140]], 2: [[510, 750], [840, 1140]], 3: [[510, 750], [840, 1140]],
    4: [[510, 750], [840, 1140]], 5: [[510, 750], [840, 1140]],
    6: [[510, 780]]
  };
  var DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  var TEXTO_HORARIO = "Lunes a viernes: 8:30–12:30 y 14:00–19:00 · Sábado: 8:30–13:00";
  var AVISO_CIERRE_MIN = 30;   // «cierra pronto» los últimos 30 minutos

  function dos(n) { return (n < 10 ? "0" : "") + n; }
  function hora(min) { return Math.floor(min / 60) + ":" + dos(min % 60); }

  /** Fecha/hora de Bolivia como campos (no depende de la zona horaria del celular). */
  function ahora() {
    var d = new Date(Date.now() + DESFASE_BOLIVIA * 60000);
    return {
      dia: d.getUTCDay(), fecha: d.getUTCDate(), mes: d.getUTCMonth() + 1, anio: d.getUTCFullYear(),
      h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds(),
      minutos: d.getUTCHours() * 60 + d.getUTCMinutes(),
      texto: dos(d.getUTCHours()) + ":" + dos(d.getUTCMinutes()),
      textoSeg: dos(d.getUTCHours()) + ":" + dos(d.getUTCMinutes()) + ":" + dos(d.getUTCSeconds())
    };
  }

  /** Próxima apertura desde ahora: { enDias, dia, min, texto } — «hoy a las 14:00», «mañana (viernes) a las 8:30»… */
  function proximaApertura(a) {
    for (var k = 0; k <= 7; k++) {
      var dia = (a.dia + k) % 7;
      var turnos = TURNOS[dia];
      for (var i = 0; i < turnos.length; i++) {
        if (k > 0 || turnos[i][0] > a.minutos) {
          var cuando = k === 0 ? "hoy" : k === 1 ? "mañana " + DIAS[dia] : "el " + DIAS[dia];
          return { enDias: k, dia: dia, min: turnos[i][0], texto: cuando + " a las " + hora(turnos[i][0]) };
        }
      }
    }
    return null;
  }

  /**
   * Estado de la empresa ahora:
   *   { abierto, cierraPronto, enPausa (mediodía), cierra: 'HH:MM', proxima: {…}, ahora: {…} }
   */
  function estado() {
    var a = ahora(); var turnos = TURNOS[a.dia];
    for (var i = 0; i < turnos.length; i++) {
      if (a.minutos >= turnos[i][0] && a.minutos < turnos[i][1]) {
        return { abierto: true, cierraPronto: turnos[i][1] - a.minutos <= AVISO_CIERRE_MIN, cierra: hora(turnos[i][1]), ahora: a };
      }
    }
    var p = proximaApertura(a);
    var enPausa = turnos.length > 1 && a.minutos >= turnos[0][1] && a.minutos < turnos[turnos.length - 1][0];
    return { abierto: false, enPausa: enPausa, proxima: p, ahora: a };
  }

  window.HorarioOptimarket = {
    ahora: ahora, estado: estado, texto: TEXTO_HORARIO, dias: DIAS,
    // Para «¿están abiertos?» del asistente
    frase: function () {
      var e = estado();
      if (e.abierto) return "Ahora son las " + e.ahora.texto + " (hora de Bolivia): estamos atendiendo hasta las " + e.cierra + ".";
      return "Ahora son las " + e.ahora.texto + " (hora de Bolivia): " + (e.enPausa ? "estamos en pausa de mediodía" : "estamos fuera de horario") +
        (e.proxima ? "; volvemos " + e.proxima.texto + "." : ".");
    }
  };
})();
