/**
 * OPTIMARKET S.R.L. - Catálogo Visual y Selector de Proformas
 * ============================================================
 * Diseñado para máximo rendimiento y compatibilidad (ES5 estricto).
 * Sin frameworks ni dependencias pesadas.
 * Apto para dispositivos móviles de bajos recursos y conexiones lentas.
 */

(function(root) {
  'use strict';

  var CatalogView = {
    activeCategory: 'Lentilla',
    searchQuery: '',
    searchTimeout: null,
    activeMaterialItem: null,
    activeSelectionMode: 'pair', // 'pair' (OD+OI) o 'single' (1/2 par)
    pageSize: 12,
    currentPage: 1,

    categories: [
      { id: 'Lentilla', name: 'Lentilla', icon: 'fa-glasses', desc: 'Cristales Monofocales' },
      { id: 'Material Listo', name: 'Material Listo', icon: 'fa-eye', desc: 'Bifocales y Progresivos' },
      { id: 'Block', name: 'Block', icon: 'fa-cube', desc: 'Bloques para Laboratorio' },
      { id: 'Montura', name: 'Monturas', icon: 'fa-tag', desc: 'Armazones y Marcos' },
      { id: 'Accesorios', name: 'Accesorios', icon: 'fa-box-open', desc: 'Estuches y Herramientas' }
    ],

    init: function() {
      this.bindEvents();
      this.renderCategoryNav();
      this.renderCatalogGrid();
    },

    bindEvents: function() {
      var self = this;
      var searchInput = document.getElementById('catalogSearchInput');
      if (searchInput) {
        searchInput.oninput = function() {
          var val = this.value;
          clearTimeout(self.searchTimeout);
          self.searchTimeout = setTimeout(function() {
            self.searchQuery = val.trim().toLowerCase();
            self.currentPage = 1;
            self.renderCatalogGrid();
          }, 250);
        };
      }
    },

    setCategory: function(catId) {
      this.activeCategory = catId;
      this.currentPage = 1;
      this.searchQuery = '';
      var input = document.getElementById('catalogSearchInput');
      if (input) input.value = '';
      this.renderCategoryNav();
      this.renderCatalogGrid();
    },

    renderCategoryNav: function() {
      var navDesk = document.getElementById('catalogSideCategories');
      var navMobile = document.getElementById('catalogMobileCategories');

      var self = this;
      var htmlDesk = '';
      var htmlMobile = '';

      for (var i = 0; i < this.categories.length; i++) {
        var cat = this.categories[i];
        var isActive = (cat.id === this.activeCategory);
        var activeClass = isActive ? ' active' : '';

        // Desktop item
        htmlDesk += '<button type="button" class="catalog-cat-btn' + activeClass + '" onclick="CatalogView.setCategory(\'' + cat.id + '\')">';
        htmlDesk += '<i class="fas ' + cat.icon + '"></i>';
        htmlDesk += '<span>' + cat.name + '</span>';
        htmlDesk += '</button>';

        // Mobile pill
        htmlMobile += '<button type="button" class="catalog-mobile-pill' + activeClass + '" onclick="CatalogView.setCategory(\'' + cat.id + '\')">';
        htmlMobile += '<span>' + cat.name + '</span>';
        htmlMobile += '</button>';
      }

      if (navDesk) navDesk.innerHTML = htmlDesk;
      if (navMobile) navMobile.innerHTML = htmlMobile;
    },

    getProductsForCategory: function(cat) {
      if (!window.State || !window.State.indexedData || !window.State.indexedData[cat]) {
        return [];
      }

      var map = window.State.indexedData[cat];
      var productNames = Object.keys(map);
      var result = [];

      for (var i = 0; i < productNames.length; i++) {
        var pName = productNames[i];
        var variants = map[pName] || [];
        if (variants.length === 0) continue;

        // Si es Montura, separar por códigos si vienen dentro de 'Monturas'
        if (cat === 'Montura' && pName === 'Monturas') {
          // Filtrar monturas agrupadas por código
          for (var m = 0; m < variants.length; m++) {
            var v = variants[m];
            var code = (v.medida || '').replace(/^Codigo:\s*/i, '').trim();
            result.push({
              id: v.id,
              nombre: 'Montura ' + code,
              codigo: code,
              categoria: 'Montura',
              precioMin: parseFloat(v.cf) || 0,
              medidaUnica: v.medida,
              esMontura: true,
              itemData: v,
              variantsCount: 1
            });
          }
          continue;
        }

        // Calcular precio mínimo y representativo
        var minPrice = Infinity;
        for (var vIdx = 0; vIdx < variants.length; vIdx++) {
          var pVal = parseFloat(variants[vIdx].cf) || 0;
          if (pVal > 0 && pVal < minPrice) minPrice = pVal;
        }
        if (minPrice === Infinity) minPrice = parseFloat(variants[0].cf) || 0;

        result.push({
          id: variants[0].id,
          nombre: pName,
          categoria: cat,
          precioMin: minPrice,
          variantsCount: variants.length,
          esMontura: false,
          variants: variants
        });
      }

      return result;
    },

    renderCatalogGrid: function() {
      var grid = document.getElementById('catalogProductsGrid');
      var countBadge = document.getElementById('catalogResultsCount');
      if (!grid) return;

      var allItems = this.getProductsForCategory(this.activeCategory);

      // Filtro de búsqueda
      var q = this.searchQuery;
      var filtered = [];
      if (q) {
        for (var i = 0; i < allItems.length; i++) {
          var item = allItems[i];
          var matchName = item.nombre.toLowerCase().indexOf(q) !== -1;
          var matchCat = item.categoria.toLowerCase().indexOf(q) !== -1;
          var matchCode = item.codigo && item.codigo.toLowerCase().indexOf(q) !== -1;
          var matchMedida = false;

          if (!matchName && !matchCat && !matchCode && item.variants) {
            for (var mIdx = 0; mIdx < Math.min(item.variants.length, 50); mIdx++) {
              if ((item.variants[mIdx].medida || '').toLowerCase().indexOf(q) !== -1) {
                matchMedida = true;
                break;
              }
            }
          }

          if (matchName || matchCat || matchCode || matchMedida) {
            filtered.push(item);
          }
        }
      } else {
        filtered = allItems;
      }

      if (countBadge) {
        countBadge.textContent = filtered.length + ' producto' + (filtered.length === 1 ? '' : 's');
      }

      if (filtered.length === 0) {
        grid.innerHTML = '<div class="catalog-empty-notice">' +
          '<i class="fas fa-search" style="font-size: 2rem; color: #94a3b8; margin-bottom: 0.5rem;"></i>' +
          '<p>No se encontraron productos para "<strong>' + q + '</strong>".</p>' +
          '</div>';
        return;
      }

      // Paginación para no sobrecargar el DOM
      var startIdx = (this.currentPage - 1) * this.pageSize;
      var pageItems = filtered.slice(startIdx, startIdx + this.pageSize);

      var html = '';
      for (var p = 0; p < pageItems.length; p++) {
        var prod = pageItems[p];
        var imgRes = window.ImageService ? window.ImageService.resolve(prod.nombre, prod.categoria) : null;
        var thumbSrc = imgRes ? imgRes.thumb : 'images/optimarket_eye_logo.svg';
        var zoomSrc = imgRes ? imgRes.zoom : thumbSrc;
        var escName = prod.nombre.replace(/'/g, "\\'");
        var escCat = prod.categoria.replace(/'/g, "\\'");

        var priceLabel = 'Desde ' + prod.precioMin.toFixed(2) + ' Bs.';
        if (prod.categoria === 'Lentilla') {
          priceLabel = 'Desde ' + prod.precioMin.toFixed(2) + ' Bs. (1/2 Par)';
        } else if (prod.esMontura) {
          priceLabel = prod.precioMin.toFixed(2) + ' Bs.';
        }

        html += '<div class="catalog-card">';
        // Imagen con reserva de aspecto fija
        html += '<div class="catalog-card-img-wrap">';
        html += '<img src="' + thumbSrc + '" alt="' + prod.nombre + '" loading="lazy" decoding="async" width="140" height="140" class="catalog-card-img" onerror="if(window.ImageService) ImageService.handleError(this)">';
        html += '<button type="button" class="catalog-btn-zoom" title="Ver foto ampliada" onclick="Controller.openImageModal(\'' + zoomSrc + '\', \'\', \'' + escCat + '\', \'' + escName + '\')"><i class="fas fa-search-plus"></i></button>';
        html += '</div>';

        // Cuerpo de la tarjeta
        html += '<div class="catalog-card-body">';
        html += '<span class="catalog-card-cat">' + prod.categoria + '</span>';
        html += '<h4 class="catalog-card-title" title="' + prod.nombre + '">' + prod.nombre + '</h4>';
        html += '<div class="catalog-card-price">' + priceLabel + '</div>';

        if (prod.esMontura) {
          html += '<button type="button" class="catalog-card-btn" onclick="CatalogView.openSelectionModal(\'' + escCat + '\', \'' + escName + '\', \'' + prod.id + '\')"><i class="fas fa-plus"></i> Cotizar</button>';
        } else {
          html += '<button type="button" class="catalog-card-btn" onclick="CatalogView.openSelectionModal(\'' + escCat + '\', \'' + escName + '\')"><i class="fas fa-sliders-h"></i> Medidas</button>';
        }

        html += '</div>'; // card-body
        html += '</div>'; // card
      }

      // Paginación si hay más de una página
      var totalPages = Math.ceil(filtered.length / this.pageSize);
      if (totalPages > 1) {
        html += '<div class="catalog-pagination-row">';
        html += '<button type="button" class="catalog-page-btn" ' + (this.currentPage <= 1 ? 'disabled' : '') + ' onclick="CatalogView.changePage(' + (this.currentPage - 1) + ')"><i class="fas fa-chevron-left"></i> Anterior</button>';
        html += '<span class="catalog-page-indicator">Página ' + this.currentPage + ' de ' + totalPages + '</span>';
        html += '<button type="button" class="catalog-page-btn" ' + (this.currentPage >= totalPages ? 'disabled' : '') + ' onclick="CatalogView.changePage(' + (this.currentPage + 1) + ')">Siguiente <i class="fas fa-chevron-right"></i></button>';
        html += '</div>';
      }

      grid.innerHTML = html;
    },

    changePage: function(page) {
      this.currentPage = page;
      this.renderCatalogGrid();
      var mainSection = document.getElementById('catalogMainSection');
      if (mainSection && mainSection.scrollIntoView) {
        mainSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },

    /**
     * Abre el modal/dock de selección de medidas y graduaciones
     */
    openSelectionModal: function(categoria, nombre, specificId) {
      var modal = document.getElementById('catalogSelectionModal');
      var content = document.getElementById('catalogSelectionContent');
      if (!modal || !content) return;

      var products = this.getProductsForCategory(categoria);
      var currentProd = null;
      for (var i = 0; i < products.length; i++) {
        if (products[i].nombre === nombre) {
          currentProd = products[i];
          break;
        }
      }

      if (!currentProd) return;
      this.activeMaterialItem = currentProd;
      this.activeSelectionMode = (categoria === 'Lentilla') ? 'pair' : 'single';

      this.renderSelectionContent();
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    },

    closeSelectionModal: function() {
      var modal = document.getElementById('catalogSelectionModal');
      if (modal) modal.classList.add('hidden');
      document.body.style.overflow = '';
      this.activeMaterialItem = null;
    },

    renderSelectionContent: function() {
      var content = document.getElementById('catalogSelectionContent');
      var prod = this.activeMaterialItem;
      if (!content || !prod) return;

      var imgRes = window.ImageService ? window.ImageService.resolve(prod.nombre, prod.categoria) : null;
      var cardImg = imgRes ? imgRes.card : 'images/optimarket_eye_logo.svg';
      var zoomImg = imgRes ? imgRes.zoom : cardImg;
      var escName = prod.nombre.replace(/'/g, "\\'");
      var escCat = prod.categoria.replace(/'/g, "\\'");

      var html = '';

      // Encabezado con foto y nombre
      html += '<div class="csm-header">';
      html += '<div class="csm-thumb-wrap" onclick="Controller.openImageModal(\'' + zoomImg + '\', \'\', \'' + escCat + '\', \'' + escName + '\')">';
      html += '<img src="' + cardImg + '" alt="' + prod.nombre + '" class="csm-thumb-img" onerror="if(window.ImageService) ImageService.handleError(this)">';
      html += '<span class="csm-thumb-zoom"><i class="fas fa-search-plus"></i></span>';
      html += '</div>';
      html += '<div class="csm-title-box">';
      html += '<span class="csm-cat-badge">' + prod.categoria + '</span>';
      html += '<h3 class="csm-prod-name">' + prod.nombre + '</h3>';
      html += '<div class="csm-base-price">Precio base: <strong>' + prod.precioMin.toFixed(2) + ' Bs.</strong></div>';
      html += '</div>';
      html += '<button type="button" class="csm-btn-close" onclick="CatalogView.closeSelectionModal()">&times;</button>';
      html += '</div>';

      // Cuerpo según categoría
      html += '<div class="csm-body">';

      if (prod.categoria === 'Lentilla') {
        // Selector de Modo: Par completo (OD + OI) vs Medio Par
        html += '<div class="csm-mode-switch">';
        html += '<button type="button" class="csm-mode-btn' + (this.activeSelectionMode === 'pair' ? ' active' : '') + '" onclick="CatalogView.setSelectionMode(\'pair\')"><i class="fas fa-glasses"></i> Par Completo (OD + OI)</button>';
        html += '<button type="button" class="csm-mode-btn' + (this.activeSelectionMode === 'single' ? ' active' : '') + '" onclick="CatalogView.setSelectionMode(\'single\')"><i class="fas fa-dot-circle"></i> Un Solo Ojo (1/2 Par)</button>';
        html += '</div>';

        if (this.activeSelectionMode === 'pair') {
          // Ojo Derecho (OD)
          html += '<div class="csm-eye-box">';
          html += '<div class="csm-eye-title"><span class="csm-eye-badge">OD</span> Ojo Derecho</div>';
          html += '<div class="csm-field-row">';
          html += '<label class="csm-label">Graduación (Esfera / Cilindro):</label>';
          html += '<input type="text" id="csmInputOD" class="csm-input" placeholder="ej: +1.50 o cil -0.50" oninput="CatalogView.recalculateSelection()">';
          html += '</div>';
          html += '<div class="csm-price-note" id="csmPriceNoteOD">P.U: ' + prod.precioMin.toFixed(2) + ' Bs. (1/2 Par)</div>';
          html += '</div>';

          // Ojo Izquierdo (OI)
          html += '<div class="csm-eye-box">';
          html += '<div class="csm-eye-title"><span class="csm-eye-badge oi">OI</span> Ojo Izquierdo</div>';
          html += '<div class="csm-field-row">';
          html += '<label class="csm-label">Graduación (Esfera / Cilindro):</label>';
          html += '<input type="text" id="csmInputOI" class="csm-input" placeholder="ej: +2.00 o cil -0.75" oninput="CatalogView.recalculateSelection()">';
          html += '</div>';
          html += '<div class="csm-price-note" id="csmPriceNoteOI">P.U: ' + prod.precioMin.toFixed(2) + ' Bs. (1/2 Par)</div>';
          html += '</div>';

          // Stepper de Pares
          html += '<div class="csm-qty-row">';
          html += '<span class="csm-qty-label">Pares completos:</span>';
          html += '<div class="csm-stepper">';
          html += '<button type="button" class="csm-step-btn" onclick="CatalogView.stepQty(-1)">-</button>';
          html += '<input type="number" id="csmQtyInput" class="csm-step-val" value="1" min="1" readonly>';
          html += '<button type="button" class="csm-step-btn" onclick="CatalogView.stepQty(1)">+</button>';
          html += '</div>';
          html += '</div>';

        } else {
          // Modo Graduación Única / 1/2 Par
          html += '<div class="csm-single-box">';
          html += '<div class="csm-field-row">';
          html += '<label class="csm-label">Graduación única (ej: +1.50):</label>';
          html += '<input type="text" id="csmInputSingle" class="csm-input" placeholder="ej: +1.50 o cil -0.50" oninput="CatalogView.recalculateSelection()">';
          html += '</div>';

          html += '<div class="csm-qty-row">';
          html += '<span class="csm-qty-label">Cantidad:</span>';
          html += '<div class="csm-stepper">';
          html += '<button type="button" class="csm-step-btn" onclick="CatalogView.stepQty(-1)">-</button>';
          html += '<input type="number" id="csmQtyInput" class="csm-step-val" value="1" min="1" readonly>';
          html += '<button type="button" class="csm-step-btn" onclick="CatalogView.stepQty(1)">+</button>';
          html += '</div>';
          html += '<span id="csmSingleQtyText" class="csm-qty-caption">1/2 Par</span>';
          html += '</div>';
          html += '</div>';
        }

      } else if (prod.categoria === 'Material Listo') {
        html += '<div class="csm-field-row">';
        html += '<label class="csm-label">Medida / Esfera:</label>';
        html += '<input type="text" id="csmInputMedida" class="csm-input" placeholder="ej: +1.50" oninput="CatalogView.recalculateSelection()">';
        html += '</div>';
        html += '<div class="csm-field-row">';
        html += '<label class="csm-label">Adición (Adds):</label>';
        html += '<input type="text" id="csmInputAdds" class="csm-input" placeholder="ej: 2.00" oninput="CatalogView.recalculateSelection()">';
        html += '</div>';
        html += '<div class="csm-qty-row">';
        html += '<span class="csm-qty-label">Cantidad (Pares):</span>';
        html += '<div class="csm-stepper">';
        html += '<button type="button" class="csm-step-btn" onclick="CatalogView.stepQty(-1)">-</button>';
        html += '<input type="number" id="csmQtyInput" class="csm-step-val" value="1" min="1" readonly>';
        html += '<button type="button" class="csm-step-btn" onclick="CatalogView.stepQty(1)">+</button>';
        html += '</div>';
        html += '</div>';

      } else if (prod.categoria === 'Block') {
        html += '<div class="csm-field-row">';
        html += '<label class="csm-label">Base:</label>';
        html += '<input type="text" id="csmInputBase" class="csm-input" placeholder="ej: 6.00" oninput="CatalogView.recalculateSelection()">';
        html += '</div>';
        html += '<div class="csm-field-row">';
        html += '<label class="csm-label">Adición (Adds):</label>';
        html += '<input type="text" id="csmInputAdds" class="csm-input" placeholder="ej: 2.00" oninput="CatalogView.recalculateSelection()">';
        html += '</div>';
        html += '<div class="csm-qty-row">';
        html += '<span class="csm-qty-label">Cantidad (Pares):</span>';
        html += '<div class="csm-stepper">';
        html += '<button type="button" class="csm-step-btn" onclick="CatalogView.stepQty(-1)">-</button>';
        html += '<input type="number" id="csmQtyInput" class="csm-step-val" value="1" min="1" readonly>';
        html += '<button type="button" class="csm-step-btn" onclick="CatalogView.stepQty(1)">+</button>';
        html += '</div>';
        html += '</div>';

      } else if (prod.esMontura) {
        html += '<div class="csm-field-row">';
        html += '<div style="font-weight: 700; color: #1e293b;">Código: ' + (prod.codigo || prod.nombre) + '</div>';
        html += '<div style="color: #64748b; font-size: 0.9rem;">Precio por unidad: ' + prod.precioMin.toFixed(2) + ' Bs.</div>';
        html += '</div>';
        html += '<div class="csm-qty-row">';
        html += '<span class="csm-qty-label">Cantidad (mín. 3):</span>';
        html += '<div class="csm-stepper">';
        html += '<button type="button" class="csm-step-btn" onclick="CatalogView.stepQty(-1)">-</button>';
        html += '<input type="number" id="csmQtyInput" class="csm-step-val" value="3" min="3" readonly>';
        html += '<button type="button" class="csm-step-btn" onclick="CatalogView.stepQty(1)">+</button>';
        html += '</div>';
        html += '</div>';
      }

      // Resumen y botón de adición
      html += '<div class="csm-footer">';
      html += '<div class="csm-total-line">';
      html += '<span>Subtotal:</span>';
      html += '<strong id="csmSubtotalText" class="csm-total-val">' + prod.precioMin.toFixed(2) + ' Bs.</strong>';
      html += '</div>';
      html += '<button type="button" class="csm-btn-submit" onclick="CatalogView.handleAddSelectionToProforma()"><i class="fas fa-check"></i> Agregar a la Proforma</button>';
      html += '</div>';

      html += '</div>'; // csm-body

      content.innerHTML = html;
      this.recalculateSelection();
    },

    setSelectionMode: function(mode) {
      this.activeSelectionMode = mode;
      this.renderSelectionContent();
    },

    stepQty: function(delta) {
      var input = document.getElementById('csmQtyInput');
      if (!input) return;
      var prod = this.activeMaterialItem;
      var min = 1;
      var step = 1;

      if (prod && prod.esMontura) min = 3;

      var current = parseInt(input.value || min, 10);
      var newVal = current + (delta * step);
      if (newVal < min) newVal = min;
      input.value = newVal;

      var singleCaption = document.getElementById('csmSingleQtyText');
      if (singleCaption && prod && prod.categoria === 'Lentilla') {
        if (newVal === 1) singleCaption.textContent = '1/2 Par';
        else if (newVal === 2) singleCaption.textContent = '1 Par';
        else if (newVal === 3) singleCaption.textContent = '1 Par 1/2';
        else if (newVal === 4) singleCaption.textContent = '2 Pares';
        else {
          var pares = Math.floor(newVal / 2);
          var resto = newVal % 2;
          singleCaption.textContent = pares + ' par' + (pares > 1 ? 'es' : '') + (resto ? ' 1/2' : '');
        }
      }

      this.recalculateSelection();
    },

    recalculateSelection: function() {
      var prod = this.activeMaterialItem;
      if (!prod) return;

      var subtotalEl = document.getElementById('csmSubtotalText');
      var qtyInput = document.getElementById('csmQtyInput');
      var qty = qtyInput ? parseInt(qtyInput.value || 1, 10) : 1;

      var total = 0;

      if (prod.categoria === 'Lentilla') {
        if (this.activeSelectionMode === 'pair') {
          // Sumar precio OD + precio OI multiplicado por cantidad de pares
          var priceOD = this.findPriceForLentilla(prod.nombre, document.getElementById('csmInputOD') ? document.getElementById('csmInputOD').value : '');
          var priceOI = this.findPriceForLentilla(prod.nombre, document.getElementById('csmInputOI') ? document.getElementById('csmInputOI').value : '');

          var noteOD = document.getElementById('csmPriceNoteOD');
          if (noteOD) noteOD.textContent = 'P.U: ' + priceOD.toFixed(2) + ' Bs. (1/2 Par)';
          var noteOI = document.getElementById('csmPriceNoteOI');
          if (noteOI) noteOI.textContent = 'P.U: ' + priceOI.toFixed(2) + ' Bs. (1/2 Par)';

          total = (priceOD + priceOI) * qty;
        } else {
          var priceSingle = this.findPriceForLentilla(prod.nombre, document.getElementById('csmInputSingle') ? document.getElementById('csmInputSingle').value : '');
          total = priceSingle * qty;
        }
      } else if (prod.esMontura) {
        total = prod.precioMin * qty;
      } else {
        total = prod.precioMin * qty;
      }

      if (subtotalEl) subtotalEl.textContent = total.toFixed(2) + ' Bs.';
    },

    findPriceForLentilla: function(materialName, inputMedida) {
      var prod = this.activeMaterialItem;
      var defaultPrice = prod ? prod.precioMin : 8.50;
      if (!inputMedida || !prod || !prod.variants) return defaultPrice;

      var normInput = this.normalizeMedida(inputMedida);
      for (var i = 0; i < prod.variants.length; i++) {
        var v = prod.variants[i];
        var vMed = this.normalizeMedida(v.medida);
        if (vMed === normInput) {
          return parseFloat(v.cf) || defaultPrice;
        }
      }
      return defaultPrice;
    },

    normalizeMedida: function(str) {
      if (!str) return '';
      var val = str.toString().replace(/,/g, '.');
      val = val.replace(/cil\s*\.\s*/gi, 'cil ');
      val = val.replace(/\s+\.\s+/g, ' ');
      val = val.replace(/\s+/g, '');
      val = val.replace(/(\d{3,})/g, function(match) {
        return match.slice(0, -2) + '.' + match.slice(-2);
      });
      return val.toLowerCase();
    },

    handleAddSelectionToProforma: function() {
      var prod = this.activeMaterialItem;
      if (!prod) return;

      var qtyInput = document.getElementById('csmQtyInput');
      var qty = qtyInput ? parseInt(qtyInput.value || 1, 10) : 1;

      if (prod.categoria === 'Lentilla') {
        if (this.activeSelectionMode === 'pair') {
          var medOD = (document.getElementById('csmInputOD') ? document.getElementById('csmInputOD').value : '').trim();
          var medOI = (document.getElementById('csmInputOI') ? document.getElementById('csmInputOI').value : '').trim();

          if (!medOD || !medOI) {
            alert('Por favor ingresa la graduación para ambos ojos (OD y OI).');
            return;
          }

          var priceOD = this.findPriceForLentilla(prod.nombre, medOD);
          var priceOI = this.findPriceForLentilla(prod.nombre, medOI);

          // Agregar OD a la proforma
          var itemOD = {
            id: 'len_' + Math.random().toString(36).substr(2, 9),
            categoria: 'Lentilla',
            nombre: prod.nombre,
            medida: 'OD: ' + medOD,
            cf: priceOD,
            qty: qty // número de medios pares
          };
          window.State.cart.push(itemOD);

          // Agregar OI a la proforma
          var itemOI = {
            id: 'len_' + Math.random().toString(36).substr(2, 9),
            categoria: 'Lentilla',
            nombre: prod.nombre,
            medida: 'OI: ' + medOI,
            cf: priceOI,
            qty: qty // número de medios pares
          };
          window.State.cart.push(itemOI);

        } else {
          var medSingle = (document.getElementById('csmInputSingle') ? document.getElementById('csmInputSingle').value : '').trim();
          if (!medSingle) {
            alert('Por favor ingresa la graduación.');
            return;
          }

          var priceSingle = this.findPriceForLentilla(prod.nombre, medSingle);
          var itemSingle = {
            id: 'len_' + Math.random().toString(36).substr(2, 9),
            categoria: 'Lentilla',
            nombre: prod.nombre,
            medida: 'Medida: ' + medSingle,
            cf: priceSingle,
            qty: qty
          };
          window.State.cart.push(itemSingle);
        }

      } else if (prod.categoria === 'Material Listo') {
        var medML = (document.getElementById('csmInputMedida') ? document.getElementById('csmInputMedida').value : '').trim();
        var addML = (document.getElementById('csmInputAdds') ? document.getElementById('csmInputAdds').value : '').trim();

        if (!medML || !addML) {
          alert('Por favor completa la medida y la adición.');
          return;
        }

        window.State.cart.push({
          id: 'ml_' + Math.random().toString(36).substr(2, 9),
          categoria: 'Material Listo',
          nombre: prod.nombre,
          medida: 'Medida: ' + medML + ' | Add: ' + addML,
          cf: prod.precioMin,
          qty: qty
        });

      } else if (prod.categoria === 'Block') {
        var baseB = (document.getElementById('csmInputBase') ? document.getElementById('csmInputBase').value : '').trim();
        var addB = (document.getElementById('csmInputAdds') ? document.getElementById('csmInputAdds').value : '').trim();

        if (!baseB || !addB) {
          alert('Por favor completa la base y la adición.');
          return;
        }

        window.State.cart.push({
          id: 'blk_' + Math.random().toString(36).substr(2, 9),
          categoria: 'Block',
          nombre: prod.nombre,
          medida: 'Base: ' + baseB + ' | Add: ' + addB,
          cf: prod.precioMin,
          qty: qty
        });

      } else if (prod.esMontura) {
        window.State.cart.push({
          id: 'mon_' + Math.random().toString(36).substr(2, 9),
          categoria: 'Montura',
          nombre: prod.nombre,
          medida: 'Código: ' + (prod.codigo || prod.nombre),
          cf: prod.precioMin,
          qty: qty
        });
      }

      window.State.saveCart();
      if (window.Controller && typeof Controller.updateCartUI === 'function') {
        Controller.updateCartUI();
      }
      this.renderProformaSidebar();
      this.closeSelectionModal();

      // Feedback discreto
      this.showToast('¡Producto agregado a la proforma!');
    },

    renderProformaSidebar: function() {
      var container = document.getElementById('catalogProformaItems');
      var totalEl = document.getElementById('catalogProformaTotal');
      var countEl = document.getElementById('catalogProformaCount');
      var floatingCount = document.getElementById('floatingCartCount');
      var floatingTotal = document.getElementById('floatingCartTotal');

      if (!window.State || !window.State.cart) return;
      var cart = window.State.cart;

      var total = 0;
      var totalItems = 0;
      var html = '';

      if (cart.length === 0) {
        html = '<div class="proforma-empty-box"><i class="fas fa-shopping-cart"></i><p>Tu proforma está vacía.<br>Selecciona un material para cotizar.</p></div>';
      } else {
        for (var i = 0; i < cart.length; i++) {
          var item = cart[i];
          var itemSub = (parseFloat(item.cf) || 0) * (parseInt(item.qty, 10) || 1);
          total += itemSub;
          totalItems += (parseInt(item.qty, 10) || 1);

          var qLabel = (window.Controller && typeof Controller.getQtyLabel === 'function')
            ? Controller.getQtyLabel(item)
            : 'Cant: ' + item.qty;

          html += '<div class="proforma-sidebar-item">';
          html += '<div class="proforma-item-info">';
          html += '<strong class="proforma-item-name">' + item.nombre + '</strong>';
          html += '<span class="proforma-item-medida">' + item.medida + '</span>';
          html += '<span class="proforma-item-qty">' + qLabel + ' &times; ' + parseFloat(item.cf).toFixed(2) + ' Bs.</span>';
          html += '</div>';
          html += '<div class="proforma-item-subtotal">';
          html += '<strong>' + itemSub.toFixed(2) + ' Bs.</strong>';
          html += '<button type="button" class="proforma-item-del" onclick="CatalogView.removeItemFromProforma(' + i + ')" title="Quitar item">&times;</button>';
          html += '</div>';
          html += '</div>';
        }
      }

      if (container) container.innerHTML = html;
      if (totalEl) totalEl.textContent = total.toFixed(2) + ' Bs.';
      if (countEl) countEl.textContent = cart.length;
      var mobCount = document.getElementById('catalogMobileBarCount');
      if (mobCount) mobCount.textContent = totalItems;
      var mobTotal = document.getElementById('catalogMobileBarTotal');
      if (mobTotal) mobTotal.textContent = total.toFixed(2) + ' Bs.';
      if (floatingCount) floatingCount.textContent = cart.length;
      if (floatingTotal) floatingTotal.textContent = total.toFixed(2) + ' Bs.';
    },

    removeItemFromProforma: function(idx) {
      if (!window.State || !window.State.cart) return;
      window.State.cart.splice(idx, 1);
      window.State.saveCart();
      if (window.Controller && typeof Controller.updateCartUI === 'function') {
        Controller.updateCartUI();
      }
      this.renderProformaSidebar();
    },

    clearProforma: function() {
      if (!confirm('¿Deseas vaciar toda la proforma?')) return;
      if (!window.State) return;
      window.State.clearCart();
      if (window.Controller && typeof Controller.updateCartUI === 'function') {
        Controller.updateCartUI();
      }
      this.renderProformaSidebar();
    },

    showToast: function(msg) {
      var toast = document.getElementById('catalogToast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'catalogToast';
        toast.className = 'catalog-toast';
        document.body.appendChild(toast);
      }
      toast.textContent = msg;
      toast.classList.add('visible');
      setTimeout(function() {
        toast.classList.remove('visible');
      }, 2500);
    }
  };

  root.CatalogView = CatalogView;
})(typeof window !== 'undefined' ? window : this);
