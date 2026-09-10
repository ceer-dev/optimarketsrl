/**
 * OPTIMARKET S.R.L. - Servicio de Optimización de Imágenes
 * =========================================================
 * - Resuelve miniaturas ultraligeras (~2 KB) para cuadrículas.
 * - Resuelve imágenes optimizadas (~18 KB) para tarjetas y vistas de cálculo.
 * - Carga la imagen de alta resolución SOLO al solicitar zoom.
 * - Detecta soporte WebP con fallback automático a JPG / PNG.
 * - Evita recargas y redecodificaciones innecesarias si la imagen no cambia.
 * - 100% sintaxis ES5 compatible con navegadores antiguos.
 */

(function(root) {
  'use strict';

  var _webpSupported = null;

  function checkWebpSupport() {
    if (_webpSupported !== null) return _webpSupported;
    try {
      var canvas = document.createElement('canvas');
      if (canvas.getContext && canvas.getContext('2d')) {
        _webpSupported = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
      } else {
        _webpSupported = false;
      }
    } catch (e) {
      _webpSupported = false;
    }
    return _webpSupported;
  }

  function canonicalize(str) {
    if (!str) return '';
    return str.toString()
      .toLowerCase()
      .replace(/[áàäâ]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöô]/g, 'o')
      .replace(/[úùüû]/g, 'u')
      .replace(/ñ/g, 'n')
      .replace(/[^a-z0-9]/g, '');
  }

  var ImageService = {
    canonicalize: canonicalize,

    isWebpSupported: function() {
      return checkWebpSupport();
    },

    /**
     * Resuelve las rutas optimizadas para un producto dado
     * @param {string} nombre - Nombre del producto / material
     * @param {string} categoria - Categoría (Lentilla, Material Listo, Block, Montura, Accesorios)
     * @returns {Object} { thumb, card, zoom }
     */
    resolve: function(nombre, categoria) {
      var cat = (categoria || '').toLowerCase().replace(/\s+/g, '');
      var cName = canonicalize(nombre);
      var ext = checkWebpSupport() ? '.webp' : '.jpg';
      var folder = 'lentilla';

      if (cat === 'materiallisto') folder = 'materiallisto';
      else if (cat === 'block') folder = 'materiallisto';
      else if (cat === 'montura') folder = 'productos';
      else if (cat === 'accesorios') folder = 'productos';

      // 1. Consultar diccionario oficial de sobres si existe
      var envMap = window.productEnvelopeImages || {};
      var normKey = (nombre || '').replace(/\s+/g, ' ').trim();
      var known = envMap[nombre] || envMap[normKey] || null;
      if (known) {
        var firstImg = (typeof known === 'object' && known.length !== undefined) ? known[0] : known;
        if (typeof firstImg === 'string') {
          var parts = firstImg.split('/');
          if (parts.length >= 3) {
            folder = parts[1];
            cName = parts[parts.length - 1].replace(/\.[a-zA-Z0-9]+$/, '');
          }
        }
      }

      // Construir galería con miniaturas y tarjetas optimizadas
      var gallery = [];
      if (known) {
        var list = (typeof known === 'object' && known.length !== undefined) ? known : [known];
        for (var g = 0; g < list.length; g++) {
          var itemStr = list[g];
          if (typeof itemStr === 'string') {
            var gParts = itemStr.split('/');
            var gFolder = gParts.length >= 3 ? gParts[1] : folder;
            var gBase = gParts[gParts.length - 1].replace(/\.[a-zA-Z0-9]+$/, '');
            gallery.push({
              thumb: 'images/thumbs/' + gFolder + '/' + gBase + ext,
              card: 'images/optimizadas/' + gFolder + '/' + gBase + ext,
              zoom: itemStr,
              label: 'Sobre ' + (g + 1)
            });
          }
        }
      }
      if (gallery.length === 0) {
        gallery.push({
          thumb: 'images/thumbs/' + folder + '/' + cName + ext,
          card: 'images/optimizadas/' + folder + '/' + cName + ext,
          zoom: 'images/' + folder + '/' + cName + '.png',
          label: 'Sobre 1'
        });
      }

      // Si es Montura específica por código
      if (cat === 'montura') {
        var code = (nombre || '').replace(/^Codigo:\s*/i, '').replace(/^Montura\s*/i, '').trim().toLowerCase();
        return {
          thumb: 'images/thumbs/productos/' + code + ext,
          card: 'images/optimizadas/productos/' + code + ext,
          zoom: 'images/productos/' + code + '.png',
          gallery: gallery
        };
      }

      return {
        thumb: 'images/thumbs/' + folder + '/' + cName + ext,
        card: 'images/optimizadas/' + folder + '/' + cName + ext,
        zoom: 'images/' + folder + '/' + cName + '.png',
        gallery: gallery
      };
    },

    /**
     * Maneja errores de carga de imágenes aplicando fallback progresivo
     * .webp -> .jpg -> .png -> logo placeholder
     */
    handleError: function(imgEl) {
      if (!imgEl) return;
      var src = imgEl.getAttribute('src') || '';

      if (src.indexOf('.webp') !== -1) {
        imgEl.src = src.replace('.webp', '.jpg');
      } else if (src.indexOf('.jpg') !== -1) {
        imgEl.src = src.replace('.jpg', '.png');
      } else if (src.indexOf('.png') !== -1) {
        // Fallback final a logo de Optimarket
        imgEl.onerror = null;
        imgEl.src = 'images/optimarket_eye_logo.svg';
      } else {
        imgEl.onerror = null;
      }
    },

    /**
     * Actualiza el src de un elemento <img> SOLO si la URL cambia,
     * evitando re-peticiones a la red y decodificaciones repetidas de mapa de bits.
     */
    updateImgSafely: function(imgEl, newSrc) {
      if (!imgEl || !newSrc) return;
      var currentSrc = imgEl.getAttribute('src');
      if (currentSrc !== newSrc) {
        imgEl.src = newSrc;
      }
    }
  };

  root.ImageService = ImageService;
})(typeof window !== 'undefined' ? window : this);
