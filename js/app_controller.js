const Controller = {
  async init() {
    View.showLoading();
    console.log("Controller: Starting initialization...");

    const initTimeout = setTimeout(() => {
      console.error(
        "Controller: Initialization timeout! Forcing error display.",
      );
      View.showError(
        "El sistema está tardando demasiado en cargar. Por favor, recarga la página o revisa tu conexión.",
      );
    }, 8000);

    const success = await State.init();
    clearTimeout(initTimeout);

    if (success) {
      console.log("Controller: Initialization successful.");
      Events.bind();
      this.updateCartUI();
      this.checkIfNeedsLogVisit();
      this.initNovedadesSlideshow();
      View.hideLoading();
    } else {
      console.error("Controller: Initialization failed.");
      View.showError(
        "Error crítico al cargar datos. Comprueba tu conexión o memoria.",
      );
    }
  },

  handleCategorySelect(cat) {
    State.currentCategory = cat;

    if (cat === "Accesorios") {
      const standardSearch = document.getElementById("standardSearchSection");
      if (standardSearch) standardSearch.classList.add("hidden");
      const accSection = document.getElementById("accesoriosSection");
      if (accSection) accSection.classList.remove("hidden");
      const montSection = document.getElementById("monturasSection");
      if (montSection) montSection.classList.add("hidden");
      const kmToggle = document.getElementById("keepMaterialToggle");
      if (kmToggle) kmToggle.parentElement.classList.add("hidden");

      this.loadAndRenderAccesorios();
      View.goToStep(2);
      return;
    }

    if (cat === "Montura") {
      const standardSearch = document.getElementById("standardSearchSection");
      if (standardSearch) standardSearch.classList.add("hidden");
      const accSection = document.getElementById("accesoriosSection");
      if (accSection) accSection.classList.add("hidden");
      const montSection = document.getElementById("monturasSection");
      if (montSection) montSection.classList.remove("hidden");
      const kmToggle = document.getElementById("keepMaterialToggle");
      if (kmToggle) kmToggle.parentElement.classList.add("hidden");

      this.loadAndRenderMonturas();
      View.goToStep(2);
      return;
    }

    const standardSearch = document.getElementById("standardSearchSection");
    if (standardSearch) standardSearch.classList.remove("hidden");
    const accSection = document.getElementById("accesoriosSection");
    if (accSection) accSection.classList.add("hidden");
    const montSection = document.getElementById("monturasSection");
    if (montSection) montSection.classList.add("hidden");
    const kmToggle = document.getElementById("keepMaterialToggle");
    if (kmToggle) kmToggle.parentElement.classList.remove("hidden");

    const input = document.getElementById("productInput");
    input.value = "";
    input.placeholder = "Escribe el material (ej: Blanco)...";

    // UI Match: Show secondary inputs immediately
    View.renderSecondaryInputs(cat);
    document.getElementById("finalSearchAction").classList.remove("hidden");

    View.renderHelpGuide(cat);
    View.renderSearchAids(cat, (term) => {
      input.value = term;
      // Only focus if not on mobile
      if (!View.isMobile()) {
        input.focus();
      }
      this.handleSearchInput(term);
    });

    View.goToStep(2);

    // Only focus if not on mobile
    if (!View.isMobile()) {
      setTimeout(() => input.focus(), 100);
    }
  },

  handleSearchInput(val) {
    const term = val.toLowerCase().trim();
    if (term.length < 2) {
      document.getElementById("productResults").classList.remove("active");
      return;
    }

    let filtered = [];
    if (State.currentCategory === "Montura") {
      const items = State.indexedData["Montura"]?.["Monturas"] || [];
      const codes = new Set();
      items.forEach((item) => {
        const cleanCode = item.medida.replace(/^Codigo:\s*/i, "").trim();
        if (cleanCode.toLowerCase().includes(term)) {
          codes.add(cleanCode);
        }
      });
      filtered = Array.from(codes).sort();
    } else {
      const options = Object.keys(
        State.indexedData[State.currentCategory] || {},
      ).sort();
      filtered = options.filter((opt) => opt.toLowerCase().includes(term));
    }

    View.renderSearchResults(filtered, "productResults", (selected) => {
      document.getElementById("productInput").value = selected;
      this.handleProductSelected(selected);
    });
  },

  handleProductSelected(name) {
    View.renderSecondaryInputs(State.currentCategory);
    document.getElementById("finalSearchAction").classList.remove("hidden");
  },

  handleFinalSearch() {
    const productName = document.getElementById("productInput").value.trim();
    if (!productName) {
      alert(
        State.currentCategory === "Montura"
          ? "Por favor, selecciona un código de la lista de sugerencias."
          : "Por favor, selecciona un material de la lista de sugerencias.",
      );
      document.getElementById("productInput").focus();
      return;
    }

    let queryText = "";
    const cat = State.currentCategory;

    const normalize = (str) => {
      if (!str) return "";
      let val = str.replace(/,/g, ".");
      val = val.replace(/cil\s*\.\s*/gi, "cil ");
      val = val.replace(/\s+\.\s+/g, " ");
      val = val.replace(/\s+/g, "");
      val = val.replace(/(\d{3,})/g, (match) => {
        return match.slice(0, -2) + "." + match.slice(-2);
      });
      return val.toLowerCase();
    };

    try {
      let found = null;
      if (cat === "Montura") {
        const items = State.indexedData["Montura"]?.["Monturas"] || [];
        const cleanProduct = productName.toLowerCase().trim();
        found = items.find((i) => {
          const cleanCode = i.medida
            .replace(/^Codigo:\s*/i, "")
            .trim()
            .toLowerCase();
          return cleanCode === cleanProduct;
        });
      } else {
        if (cat === "Lentilla") {
          const med = normalize(document.getElementById("finalMeasure").value);
          if (!med) return alert("Ingresa la medida");
          queryText = `medida:${med}`;
        } else if (cat === "Material Listo") {
          const med = normalize(document.getElementById("finalMeasure").value);
          const add = normalize(document.getElementById("finalAdds").value);
          if (!med || !add) return alert("Completa todos los campos");
          queryText = `medida:${med}_adds:${add}`;
        } else if (cat === "Block") {
          const base = normalize(document.getElementById("finalBase").value);
          const add = normalize(document.getElementById("finalAdds").value);
          if (!base || !add) return alert("Completa todos los campos");
          queryText = `base:${base}_adds:${add}`;
        }

        const items = State.indexedData[cat][productName] || [];
        const normalizedQuery = queryText.toLowerCase().trim();

        found = items.find((i) => {
          const indexedMeasure = normalize(i.medida);
          return indexedMeasure === normalizedQuery;
        });
      }

      if (found) {
        State.currentItem = found;
        this.renderCalculationView(found);
        View.goToStep(3);
      } else {
        alert(
          cat === "Montura"
            ? "No se encontró esa montura con ese código exacto."
            : "No se encontró esa medida exacta para este material. Intentaste buscar: " +
                queryText,
        );
      }
    } catch (e) {
      alert("Error en la búsqueda. Revisa los campos.");
    }
  },

  renderCalculationView(item) {
    const display = document.getElementById("priceDisplay");

    // SF Box calculation logic (only if it exists)
    const sfRow = item.sf
      ? `<div class="calc-price-row">
          <span class="calc-label-text">Sin Factura (SF)</span>
          <span class="calc-value-text">${item.sf} Bs.</span>
      </div>`
      : "";

    let defaultQty = 1;
    if (item.categoria === "Accesorios") {
      let cat = item.parsedCategoria;
      if (cat === "montura") defaultQty = 3;
      if (cat === "estuche lente de contacto") defaultQty = 12;
    } else if (item.categoria === "Montura") {
      defaultQty = 3;
    }

    const labelText = this.getQtyLabel({ ...item, qty: defaultQty });
    const badgeClass = item.categoria === "Lentilla" ? "badge-lentilla" : "";
    const initTotal = (parseFloat(item.cf) * defaultQty).toFixed(1);

    let thumbnailHtml = "";
    let envelopeImgSrcs = [];
    if (window.productEnvelopeImages) {
      let entry = window.productEnvelopeImages[item.nombre];
      if (!entry) {
        const norm = (str) => (str || "").toLowerCase().replace(/\s+/g, " ").trim();
        const target = norm(item.nombre);
        const matchedKey = Object.keys(window.productEnvelopeImages).find(
          (key) => norm(key) === target
        );
        if (matchedKey) {
          entry = window.productEnvelopeImages[matchedKey];
        }
      }
      if (entry) {
        envelopeImgSrcs = Array.isArray(entry) ? entry : [entry];
      }
    }

    if (envelopeImgSrcs.length > 0) {
      const firstSrc = envelopeImgSrcs[0];
      const escapedMedida = (item.medida || "").replace(/'/g, "\\'");
      const escapedCategoria = (item.categoria || "").replace(/'/g, "\\'");
      const escapedNombre = (item.nombre || "").replace(/'/g, "\\'");

      let thumbnailsRowHtml = "";
      if (envelopeImgSrcs.length > 1) {
        thumbnailsRowHtml = `
          <div class="envelope-thumbnails-container">
            ${envelopeImgSrcs.map((src, idx) => {
              const escapedSrc = src.replace(/'/g, "\\'");
              return `
                <img 
                  class="envelope-thumbnail ${idx === 0 ? 'active' : ''}" 
                  src="${src}" 
                  alt="Sobre ${idx + 1}"
                  onclick="Controller.selectEnvelopeImage(${idx}, '${escapedSrc}')"
                >
              `;
            }).join("")}
          </div>
        `;
      }

      thumbnailHtml = `
          <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
            <div style="position: relative; cursor: pointer; display: inline-block; width: 100%; max-width: 280px;" onclick="Controller.handleEnvelopeMainImageClick('${escapedMedida}', '${escapedCategoria}', '${escapedNombre}')">
              <img id="calcMainEnvelopeImage" src="${firstSrc}" style="width: 100%; height: auto; aspect-ratio: 1 / 1; object-fit: contain; border-radius: 12px; border: 1px solid var(--border-glass); background: white; padding: 0.5rem; box-shadow: 0 4px 10px rgba(0,0,0,0.08);">
              
              <!-- Sticky Measurement Overlay Sticker -->
              <div style="position: absolute; top: 10%; left: 50%; transform: translateX(-50%); background: #ffffff; color: #000000; padding: 0.35rem 0.6rem; border-radius: 1px; border: 1.5px solid #222; box-shadow: 1px 2px 4px rgba(0,0,0,0.15); text-align: center; pointer-events: none; width: 85%; max-width: 250px; display: flex; flex-direction: column; gap: 2px;">
                <div style="font-size: 0.55rem; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1;">
                  ${item.categoria}
                </div>
                <div style="font-size: 0.65rem; font-weight: 800; color: #000; font-family: sans-serif; line-height: 1.15; word-wrap: break-word;">
                  ${item.nombre}
                </div>
                <div style="font-size: 0.7rem; font-weight: 700; font-family: 'Courier New', Courier, monospace; border-top: 1px dashed #ccc; padding-top: 2px; margin-top: 2px; word-wrap: break-word; letter-spacing: 0.2px;">
                  ${item.medida}
                </div>
              </div>

              <div style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.65); color: white; padding: 0.35rem 0.6rem; border-radius: 8px; font-size: 0.75rem; font-weight: 600;">
                 <i class="fas fa-search-plus"></i> Ampliar
              </div>
            </div>
            ${thumbnailsRowHtml}
          </div>
        `;
    } else if (item.categoria === "Accesorios" && item.imgSrc) {
      thumbnailHtml = `
          <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
            <div style="position: relative; cursor: pointer; display: inline-block; width: 100%; max-width: 280px;" onclick="Controller.openImageModal('${item.imgSrc}')">
              <img src="${item.imgSrc}" style="width: 100%; height: auto; aspect-ratio: 1 / 1; object-fit: contain; border-radius: 12px; border: 1px solid var(--border-glass); background: white; padding: 0.5rem; box-shadow: 0 4px 10px rgba(0,0,0,0.08);">
              <div style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.65); color: white; padding: 0.35rem 0.6rem; border-radius: 8px; font-size: 0.75rem; font-weight: 600;">
                 <i class="fas fa-search-plus"></i> Ampliar
              </div>
            </div>
          </div>
        `;
    } else if (item.categoria === "Montura") {
      const code = item.medida.replace(/^Codigo:\s*/i, "").trim();
      let imgSrc = "";
      if (window.monturaImages && window.monturaImages[code]) {
        imgSrc = window.monturaImages[code];
      } else {
        imgSrc = `images/productos/montura_${code.toLowerCase()}.jpg`;
      }
      thumbnailHtml = `
          <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
            <div style="position: relative; cursor: pointer; display: inline-block; width: 100%; max-width: 280px;" onclick="Controller.openImageModal('${imgSrc}')">
              <img src="${imgSrc}" onerror="this.onerror=null; this.src='images/placeholder-frame.svg';" style="width: 100%; height: auto; aspect-ratio: 1 / 1; object-fit: contain; border-radius: 12px; border: 1px solid var(--border-glass); background: white; padding: 0.5rem; box-shadow: 0 4px 10px rgba(0,0,0,0.08);">
              <div style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.65); color: white; padding: 0.35rem 0.6rem; border-radius: 8px; font-size: 0.75rem; font-weight: 600;">
                 <i class="fas fa-search-plus"></i> Ampliar
              </div>
            </div>
          </div>
        `;
    }

    const qty = item.cantidad ?? 0;
    const price = parseFloat(item.cf) ?? 0;
    const hasImage = !!thumbnailHtml;
    const containerClass = "calc-container";

    // Out of Stock condition (qty === 0 or price === 0)
    if (price === 0 || qty === 0) {
      display.innerHTML = `
        <div class="${hasImage ? 'calc-container calc-container-grid-active' : 'calc-container'}">
            ${hasImage ? `
              <div class="calc-header-row" style="display: flex; justify-content: flex-start; margin-bottom: 0.5rem;">
                <button class="btn glass" onclick="View.goToStep(2)" style="padding: 0.5rem 1.25rem; font-size: 0.9rem; border-radius: 50px; display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 600; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                    <i class="fas fa-arrow-left"></i> Volver
                </button>
              </div>
            ` : `
              <div class="calc-header-row">
                <div class="calc-title-group" style="flex: 1; text-align: left;">
                    <div style="font-size: 0.95rem; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 0.25rem;">
                      ${item.categoria}
                    </div>
                    <h1 style="font-size: 1.75rem; font-weight: 800; color: #1e293b; margin: 0; line-height: 1.2; letter-spacing: -0.5px;">
                      ${item.nombre}
                    </h1>
                    <p style="margin: 0.35rem 0 0; color: var(--text-muted); font-size: 0.95rem; font-weight: 500;">${item.medida}</p>
                </div>
                <button class="btn glass" onclick="View.goToStep(2)" style="padding: 0.5rem 1rem; font-size: 0.9rem;">
                    <i class="fas fa-arrow-left"></i> Volver
                </button>
              </div>
            `}
            
            <div class="${hasImage ? 'calc-layout-grid' : ''}">
              ${thumbnailHtml ? `<div class="calc-media-panel">${thumbnailHtml}</div>` : ''}
              
              <div class="calc-details-panel">
                <div class="glass-card" style="text-align: center; padding: 2.5rem 1.5rem; border: 1.5px solid #fecaca; background: #fffafb; border-radius: var(--radius);">
                    <div style="font-size: 2.5rem; color: #dc2626; margin-bottom: 1rem;">
                      <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3 style="color: #b91c1c; margin-bottom: 0.75rem; font-size: 1.25rem; font-weight: 700;">No hay existencias del producto</h3>
                    <p style="color: #4b5563; font-size: 0.95rem; line-height: 1.5; font-weight: 500; margin: 0 auto;">
                      Este producto se encuentra sin stock actualmente, pero puedes agregarlo a tu proforma para realizar una cotización directa.
                    </p>
                    <button class="btn btn-primary" onclick="Controller.handleAddToCart('continue')" style="margin-top: 1.5rem; width: 100%; font-size: 1rem; padding: 0.8rem;">
                      <i class="fas fa-check"></i> Agregar y Cotizar
                    </button>
                </div>
              </div>
            </div>
        </div>
      `;
      return;
    }

    // Low stock warning condition (< 30)
    let stockAlertHtml = "";
    if (qty < 30) {
      stockAlertHtml = `
        <div style="margin: 1rem 0; padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid #fde68a; background: #fffbeb; color: #b45309; display: flex; align-items: center; gap: 0.6rem; font-weight: 600; font-size: 0.95rem;">
          <i class="fas fa-exclamation-circle" style="color: #d97706; font-size: 1.1rem;"></i>
          <span>Quedan pocas en existencias</span>
        </div>
      `;
    }

    let bulkPriceHtml = "";
    if (item.categoria === "Montura") {
      const priceUnit = parseFloat(item.cf) || 0;
      const priceQuarter = (priceUnit * 3).toFixed(1);
      const priceDozen = (priceUnit * 12).toFixed(1);
      bulkPriceHtml = `
        <div style="margin-top: 1rem; border-top: 1px dashed var(--border-glass); padding-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
            <span style="color: var(--text-muted);">Precio por Cuarta (3 u.):</span>
            <span style="font-weight: 700; color: var(--primary);">${priceQuarter} Bs.</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.95rem;">
            <span style="color: var(--text-muted);">Precio por Docena (12 u.):</span>
            <span style="font-weight: 800; color: #10b981;">${priceDozen} Bs.</span>
          </div>
        </div>
      `;
    }

    display.innerHTML = `
      <div class="${hasImage ? 'calc-container calc-container-grid-active' : 'calc-container'}">
          ${hasImage ? `
            <div class="calc-header-row" style="display: flex; justify-content: flex-start; margin-bottom: 0.5rem;">
              <button class="btn glass" onclick="View.goToStep(2)" style="padding: 0.5rem 1.25rem; font-size: 0.9rem; border-radius: 50px; display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 600; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                  <i class="fas fa-arrow-left"></i> Volver
              </button>
            </div>
          ` : `
            <div class="calc-header-row">
              <div class="calc-title-group" style="flex: 1; text-align: left;">
                  <div style="font-size: 0.95rem; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 0.25rem;">
                    ${item.categoria}
                  </div>
                  <h1 style="font-size: 1.75rem; font-weight: 800; color: #1e293b; margin: 0; line-height: 1.2; letter-spacing: -0.5px;">
                    ${item.nombre}
                  </h1>
                  <p style="margin: 0.35rem 0 0; color: var(--text-muted); font-size: 0.95rem; font-weight: 500;">${item.medida}</p>
              </div>
              <button class="btn glass" onclick="View.goToStep(2)" style="padding: 0.5rem 1rem; font-size: 0.9rem;">
                  <i class="fas fa-arrow-left"></i> Volver
              </button>
            </div>
          `}
          
          <div class="${hasImage ? 'calc-layout-grid' : ''}">
              ${thumbnailHtml ? `<div class="calc-media-panel">${thumbnailHtml}</div>` : ''}
              
              <div class="calc-details-panel">
                  <div class="calc-premium-card" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem;">
                      <div class="calc-price-section" style="padding-top: 0;">
                          <!-- Centered blue quantity bar -->
                          <div style="margin-bottom: 0.75rem; background: #eff6ff; padding: 0.5rem 0.75rem; border-radius: 6px; border-left: 4px solid var(--primary); text-align: center;">
                              <span id="liveQtyLabel" style="font-size: 0.9rem; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px;">${labelText}</span>
                          </div>

                          <div class="calc-price-row">
                              <span class="calc-label-text">Precio Unitario</span>
                              <span class="calc-value-text">${item.cf} Bs.</span>
                          </div>
                          ${sfRow}
                          ${bulkPriceHtml}
                          
                          <div class="calc-price-row" style="border-top: 1px dashed var(--border-glass); padding-top: 0.5rem; margin-top: 0.25rem;">
                              <span class="calc-label-text" style="font-weight: 700; color: var(--primary);">Subtotal Cotizado</span>
                              <span id="liveTotal" class="calc-value-text" style="font-weight: 800; color: var(--primary); font-size: 1.15rem;">${initTotal} Bs.</span>
                          </div>
                      </div>

                      <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 0.5rem 0.75rem; border-radius: 8px; border: 1px solid var(--border-glass);">
                          <span style="font-weight: 700; font-size: 0.85rem; color: #475569;">Ajustar Cantidad</span>
                          <div class="modern-qty-control" style="margin: 0; scale: 0.85; transform-origin: right center;">
                              <button class="modern-qty-btn" onclick="Controller.updateQty(-1)"><i class="fas fa-minus"></i></button>
                              <input type="number" id="qtyInput" class="modern-qty-input" value="${defaultQty}" min="1" readonly>
                              <button class="modern-qty-btn" onclick="Controller.updateQty(1)"><i class="fas fa-plus"></i></button>
                          </div>
                      </div>

                      ${stockAlertHtml}
                  </div>

                  <div class="calc-actions" style="margin-top: 1rem;">
                      <button class="btn glass" style="width: 100%; border: 1px solid var(--primary); color: var(--primary); margin-bottom: 0.5rem;" onclick="Controller.handleAddToCart('continue')">
                          <i class="fas fa-cart-plus"></i> Agregar y Seguir Comprando
                      </button>
                       <button class="btn btn-primary" style="width: 100%;" onclick="Controller.handleAddToCart('finish')">
                          <i class="fas fa-check"></i> Agregar y Finalizar Pedido
                      </button>
                  </div>
              </div>
          </div>
      </div>
    `;
  },

  updateQty(delta) {
    const input = document.getElementById("qtyInput");

    let step = 1;
    let min = 1;

    if (State.currentCategory === "Accesorios" && State.currentItem) {
      let cat = State.currentItem.parsedCategoria || "";
      if (cat === "montura") {
        min = 3;
      } else if (cat === "estuche lente de contacto") {
        min = 12;
        step = 12;
      }
    }

    let actualDelta = delta > 0 ? step : -step;
    let val = parseInt(input.value || 1) + actualDelta;

    if (val < min) val = min;

    input.value = val;
    this.calculateLiveTotal(val);
  },

  calculateLiveTotal(qty) {
    const total = (parseFloat(State.currentItem.cf) * qty).toFixed(1);
    const label = this.getQtyLabel({ ...State.currentItem, qty });
    document.getElementById("liveTotal").textContent = `${total} Bs.`;
    document.getElementById("liveQtyLabel").textContent = label;
  },

  handleAddToCart(action) {
    const qty = parseInt(document.getElementById("qtyInput").value || 1);
    const existing = State.cart.find((i) => i.id === State.currentItem.id);
    if (existing) existing.qty += qty;
    else State.cart.push({ ...State.currentItem, qty });

    State.saveCart();
    this.updateCartUI();

    if (action === "finish") {
      this.handleViewCart();
      return;
    }

    if (State.currentCategory === "Accesorios") {
      View.goToStep(2);
      return;
    }

    const keepToggle = document.getElementById("keepMaterialToggle");
    const keep = keepToggle ? keepToggle.checked : false;

    if (keep) {
      document.getElementById("dynamicSecondaryInputs").innerHTML = "";
      this.handleProductSelected(State.currentItem.nombre);
      View.goToStep(2);
    } else {
      View.goToStep(1);
    }
  },

  updateCartUI() {
    const totalItems = State.cart.reduce((acc, i) => acc + i.qty, 0);
    View.updateCartBadge(totalItems);

    // Update floating cart specifically for Novedades view
    const floatBadge = document.getElementById("floatingCartCount");
    const floatContainer = document.getElementById("floatingCartContainer");
    if (floatBadge) floatBadge.textContent = totalItems;

    if (floatContainer) {
      if (totalItems > 0 && State.currentCategory === "Accesorios") {
        floatContainer.classList.remove("hidden");
      } else {
        floatContainer.classList.add("hidden");
      }
    }
  },

  handleViewCart() {
    this.renderStep4Cart();
    View.goToStep(4);
  },

  handleClearCart() {
    if (confirm("¿Vaciar carrito?")) {
      State.clearCart();
      this.updateCartUI();
      this.handleViewCart();
    }
  },

  async handleSendToWhatsApp() {
    const client = JSON.parse(localStorage.getItem("registeredClient"));
    const opticaName = (client.optica || "DESCONOCIDO").trim().toUpperCase(); // Normalize to avoid duplicates/messy data

    let message = `Hola, soy ${opticaName}.\n Este es mi Pedido:\n\n`;
    let detailLines = [];

    State.cart.forEach((item) => {
      let cleanMeasure = item.medida.replace(/^Medida:\s*/i, "").trim();
      const qLabel = this.getQtyLabel(item);
      const line = `Material: ${item.nombre}\nMedida: ${cleanMeasure}\nCant: ${item.qty} (${qLabel})\n------------------\n`;
      message += line;
      detailLines.push(
        `${item.nombre} | ${cleanMeasure} | Cant: ${item.qty} (${qLabel})`,
      );
    });

    const pm =
      document.querySelector('input[name="paymentMethod"]:checked')?.value ||
      "NO DEFINIDO";
    message += `\nMetodo Pago: ${pm}\nGracias.`;

    const total = document.getElementById("step4Total").textContent;
    const now = new Date().toLocaleString();

    // 1. OPEN WHATSAPP IMMEDIATELY (Safari Friendly)
    // We open it BEFORE the background fetch to ensure the browser doesn't block it
    window.open(
      `https://wa.me/59167724661?text=${encodeURIComponent(message)}`,
      "_blank",
    );

    // 2. Background submission to Netlify Forms (Non-blocking)
    const formData = new FormData();
    formData.append("form-name", "pedidos");
    formData.append("optica", opticaName);
    formData.append("detalles", detailLines.join("\n"));
    formData.append("metodo_pago", pm);
    formData.append("total", total);
    formData.append("fecha_hora", now);

    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(formData).toString(),
    }).catch((e) => console.warn("Background order log failed", e));

    // 3. Clear and reset
    State.clearCart();
    this.updateCartUI();
    View.goToStep(1);
  },

  renderStep4Cart() {
    const container = document.getElementById("step4CartItems");
    const totalDisplay = document.getElementById("step4Total");
    let total = 0;
    container.innerHTML = "";

    if (State.cart.length === 0) {
      container.innerHTML =
        '<p style="text-align: center; padding: 2rem;">Carrito vacío</p>';
      totalDisplay.textContent = "0 Bs.";
      return;
    }

    State.cart.forEach((item, index) => {
      const sub = (parseFloat(item.cf) * item.qty).toFixed(1);
      total += parseFloat(sub);

      let qtyLabel = this.getQtyLabel(item);

      const div = document.createElement("div");
      div.className = "cart-item-card glass animate-fade-in";
      div.innerHTML = `
        <div class="cart-item-inner">
          <div class="cart-item-details">
            <div style="font-weight: 700; color: #1e293b; font-size: 1.05rem; margin-bottom: 0.25rem;">${item.nombre}</div>
            <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem;">${item.medida}</div>
            
            <div class="cart-item-qty-row">
              <div class="cart-item-qty-control">
                <button onclick="Controller.updateCartItemQty(${index}, -1)" class="btn glass cart-item-qty-btn">
                  <i class="fas fa-minus" style="font-size: 0.7rem;"></i>
                </button>
                <span style="font-weight: 700; min-width: 30px; text-align: center; color: #1e293b; font-size: 0.9rem;">${item.qty}</span>
                <button onclick="Controller.updateCartItemQty(${index}, 1)" class="btn glass cart-item-qty-btn">
                  <i class="fas fa-plus" style="font-size: 0.7rem;"></i>
                </button>
              </div>
              <span class="help-badge" style="background: var(--primary); color: white; font-size: 0.75rem; padding: 0.25rem 0.6rem; border-radius: 6px;">${qtyLabel}</span>
            </div>
          </div>
          
          <div class="cart-item-actions">
            ${item.categoria === "Accesorios" && parseFloat(item.cf) === 0 ? '<div class="cart-item-subtotal" style="font-size: 1.1rem;">Ver imagen</div>' : `<div class="cart-item-subtotal">${sub} <span style="font-size: 0.8rem; font-weight: 600;">Bs.</span></div>`}
            <button class="btn glass cart-item-delete" onclick="Controller.handleRemoveFromCart(${index})">
              <i class="fas fa-trash-alt" style="font-size: 0.9rem;"></i>
            </button>
          </div>
        </div>
      `;
      container.appendChild(div);
    });
    totalDisplay.textContent = `${total.toFixed(1)} Bs.`;
  },

  updateCartItemQty(index, delta) {
    if (State.cart[index]) {
      let item = State.cart[index];

      let step = 1;
      let min = 1;
      if (item.categoria === "Accesorios") {
        let parsedCategoria = item.nombre.match(/Accesorio:\s*(.*?)\s*-/i);
        parsedCategoria = parsedCategoria
          ? parsedCategoria[1].trim().toLowerCase()
          : "";

        if (parsedCategoria === "montura") {
          min = 3;
        } else if (parsedCategoria === "estuchelentedecontacto") {
          min = 12;
          step = 12;
        }
      }

      // Calculate delta honoring step
      let actualDelta = delta > 0 ? step : -step;
      item.qty += actualDelta;

      if (item.qty < min) item.qty = min;

      State.saveCart();
      this.updateCartUI();
      this.renderStep4Cart();
    }
  },

  handleRemoveFromCart(index) {
    State.cart.splice(index, 1);
    State.saveCart();
    this.updateCartUI();
    this.renderStep4Cart();
  },

  checkIfNeedsLogVisit() {
    console.log("Controller: Checking if visit log is needed...");
    try {
      const client = JSON.parse(localStorage.getItem("registeredClient"));
      if (client && client.optica) {
        // Small Delay to ensure page is completely ready
        setTimeout(() => {
          console.log(
            "Controller: Triggering background visit log for",
            client.optica,
          );
          this.logVisit(client.optica);
        }, 2000);
      }
    } catch (e) {
      console.error("Controller: Error checking visit log", e);
    }
  },

  async logVisit(opticaName) {
    try {
      const normalized = (opticaName || "DESCONOCIDO").trim().toUpperCase();
      const now = new Date().toLocaleString();

      const formData = new FormData();
      formData.append("form-name", "visitas");
      formData.append("optica", normalized);
      formData.append("fecha_hora", now);

      await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(formData).toString(),
      });
    } catch (e) {
      console.warn("Visit log failed", e);
    }
  },

  getQtyLabel(item) {
    if (item.categoria === "Accesorios") {
      if (item.parsedCategoria === "estuche lente de contacto") {
        const docenas = item.qty / 12;
        return `Cantidad: ${docenas} DOCENA${docenas > 1 ? "S" : ""}`;
      }
      return `Cantidad: ${item.qty} unid${item.qty > 1 ? "s" : ""}`;
    }
    if (item.categoria === "Montura") {
      return `Cantidad: ${item.qty} unid${item.qty > 1 ? "s" : ""}`;
    }
    if (item.categoria === "Lentilla") {
      if (item.qty === 1) return "Cantidad 1/2 Par";
      if (item.qty === 2) return "Cantidad 1 Par";
      if (item.qty === 3) return "Cantidad 1 Par 1/2";
      if (item.qty === 4) return "Cantidad 2 Pares";
      const pares = Math.floor(item.qty / 2);
      const resto = item.qty % 2;
      return `Cantidad ${pares} par${pares > 1 ? "es" : ""}${resto ? " 1/2" : ""}`;
    }
    return `Cantidad ${item.qty} Par${item.qty > 1 ? "es" : ""}`;
  },

  loadAndRenderMonturas() {
    State.monturasPage = 1;
    State.monturasSearchQuery = "";

    const searchInput = document.getElementById("monturasSearchInput");
    if (searchInput) {
      searchInput.value = "";
      if (!searchInput.dataset.bound) {
        searchInput.dataset.bound = "true";
        searchInput.addEventListener("input", (e) => {
          State.monturasSearchQuery = e.target.value.trim().toLowerCase();
          State.monturasPage = 1;
          this.renderMonturasGrid();
        });
      }
    }

    this.renderMonturasGrid();
  },

  renderMonturasGrid() {
    const grid = document.getElementById("monturasGrid");
    const pagination = document.getElementById("monturasPagination");
    if (!grid || !pagination) return;

    grid.innerHTML = "";
    pagination.innerHTML = "";

    const items = State.indexedData["Montura"]?.["Monturas"] || [];

    // Filter items based on search query
    let filtered = items;
    if (State.monturasSearchQuery) {
      filtered = items.filter((item) => {
        const cleanCode = item.medida.replace(/^Codigo:\s*/i, "").trim().toLowerCase();
        return cleanCode.includes(State.monturasSearchQuery);
      });
    }

    // Sort items by code numerically/alphabetically
    filtered.sort((a, b) => {
      const codeA = a.medida.replace(/^Codigo:\s*/i, "").trim();
      const codeB = b.medida.replace(/^Codigo:\s*/i, "").trim();
      return codeA.localeCompare(codeB, undefined, { numeric: true });
    });

    const totalItems = filtered.length;
    const itemsPerPage = 12;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

    if (State.monturasPage > totalPages) {
      State.monturasPage = totalPages;
    }

    const startIndex = (State.monturasPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const pageItems = filtered.slice(startIndex, endIndex);

    if (pageItems.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
          <i class="fas fa-search" style="font-size: 2.5rem; margin-bottom: 1rem; display: block; color: var(--border-glass);"></i>
          No se encontraron monturas que coincidan con la búsqueda.
        </div>
      `;
      return;
    }

    pageItems.forEach((item) => {
      const code = item.medida.replace(/^Codigo:\s*/i, "").trim();
      const material = item.subcategoria || "Montura";
      const priceUnit = parseFloat(item.cf) || 0;
      const priceQuarter = (priceUnit * 3).toFixed(1);
      const priceDozen = (priceUnit * 12).toFixed(1);

      // Determine image source using the config variable window.monturaImages
      let imgSrc = "";
      if (window.monturaImages && window.monturaImages[code]) {
        imgSrc = window.monturaImages[code];
      } else {
        imgSrc = `images/productos/montura_${code.toLowerCase()}.jpg`;
      }

      const card = document.createElement("div");
      card.className = "glass-card product-card animate-fade-in";
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.justifyContent = "space-between";
      card.style.padding = "1.25rem";
      card.style.position = "relative";

      card.innerHTML = `
        <div>
          <!-- Image Container -->
          <div style="position: relative; height: 180px; display: flex; align-items: center; justify-content: center; background: #ffffff; border-radius: var(--radius-sm); border: 1px solid var(--border-glass); overflow: hidden; margin-bottom: 1rem; padding: 0.5rem;">
            <img 
              src="${imgSrc}" 
              alt="Código ${code}" 
              onerror="this.onerror=null; this.src='images/placeholder-frame.svg';" 
              loading="lazy"
              style="max-width: 100%; max-height: 100%; object-fit: contain; transition: transform 0.3s ease;"
            />
            <span class="badge" style="position: absolute; top: 8px; right: 8px; font-size: 0.75rem; background: var(--bg-header); color: #ffffff;">${material}</span>
          </div>

          <!-- Product Details -->
          <div style="margin-bottom: 1rem;">
            <h3 style="font-size: 1.25rem; color: var(--text-main); font-weight: 700; margin-bottom: 0.75rem;">
              Código: ${code}
            </h3>
            
            <!-- Pricing Grid -->
            <div style="background: rgba(0,0,0,0.02); border-radius: var(--radius-sm); padding: 0.75rem; border: 1px solid rgba(0,0,0,0.04); display: flex; flex-direction: column; gap: 0.45rem;">
              <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-muted);">
                <span>Por Unidad:</span>
                <strong style="color: var(--text-main); font-weight: 600;">${priceUnit.toFixed(1)} Bs.</strong>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: var(--text-muted); padding-top: 0.25rem; border-top: 1px dashed var(--border-glass);">
                <span>Por Cuarta (3 u.):</span>
                <strong style="color: var(--primary); font-weight: 700;">${priceQuarter} Bs.</strong>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.95rem; color: var(--text-muted); padding-top: 0.25rem; border-top: 1px solid var(--border-glass);">
                <span>Por Docena (12 u.):</span>
                <strong style="color: #10b981; font-weight: 800;">${priceDozen} Bs.</strong>
              </div>
            </div>
          </div>
        </div>

        <button 
          class="btn btn-primary" 
          style="width: 100%; font-size: 0.95rem; padding: 0.65rem 1rem; border-radius: var(--radius-sm); margin-top: 0.5rem;"
          onclick="Controller.handleSelectMonturaFromGallery('${code}')"
        >
          <i class="fas fa-shopping-cart"></i> Seleccionar y Cotizar
        </button>
      `;

      grid.appendChild(card);
    });

    // Render Pagination Controls
    if (totalPages > 1) {
      // Prev Button
      const prevBtn = document.createElement("button");
      prevBtn.className = "btn glass";
      prevBtn.style.padding = "0.5rem 1rem";
      prevBtn.disabled = State.monturasPage === 1;
      prevBtn.innerHTML = `<i class="fas fa-chevron-left"></i>`;
      prevBtn.onclick = () => {
        if (State.monturasPage > 1) {
          State.monturasPage--;
          this.renderMonturasGrid();
          document.getElementById("monturasSection").scrollIntoView({ behavior: "smooth" });
        }
      };
      pagination.appendChild(prevBtn);

      // Page Info text
      const pageInfo = document.createElement("span");
      pageInfo.style.fontWeight = "600";
      pageInfo.style.color = "var(--text-muted)";
      pageInfo.style.fontSize = "0.95rem";
      pageInfo.textContent = `Pág. ${State.monturasPage} de ${totalPages}`;
      pagination.appendChild(pageInfo);

      // Next Button
      const nextBtn = document.createElement("button");
      nextBtn.className = "btn glass";
      nextBtn.style.padding = "0.5rem 1rem";
      nextBtn.disabled = State.monturasPage === totalPages;
      nextBtn.innerHTML = `<i class="fas fa-chevron-right"></i>`;
      nextBtn.onclick = () => {
        if (State.monturasPage < totalPages) {
          State.monturasPage++;
          this.renderMonturasGrid();
          document.getElementById("monturasSection").scrollIntoView({ behavior: "smooth" });
        }
      };
      pagination.appendChild(nextBtn);
    }
  },

  handleSelectMonturaFromGallery(code) {
    const items = State.indexedData["Montura"]?.["Monturas"] || [];
    const found = items.find((i) => {
      const cleanCode = i.medida.replace(/^Codigo:\s*/i, "").trim().toLowerCase();
      return cleanCode === code.toLowerCase();
    });

    if (found) {
      State.currentItem = found;
      this.renderCalculationView(found);
      View.goToStep(3);
    } else {
      alert("No se encontró la montura seleccionada.");
    }
  },

  async loadAndRenderAccesorios() {
    State.accessoriesPage = 1;
    View.showLoading();
    try {
      // Usar variable global generada por actualizar_accesorios.bat en lugar de fetch
      // para evitar bloqueos CORS por abrir archivo local (file:///)
      const images = window.accesoriosData || [];

      const grid = document.getElementById("accesoriosGrid");
      const filterContainer = document.getElementById("accesoriosFilters");

      grid.innerHTML = "";
      if (filterContainer) filterContainer.innerHTML = "";

      if (images.length === 0) {
        grid.innerHTML = `<p style="text-align:center; grid-column: 1/-1;">No hay accesorios disponibles o no has ejecutado actualizar_accesorios.bat.</p>`;
      } else {
        // Extract unique categories
        const categorias = [
          ...new Set(images.map((img) => img.categoria || "Otros")),
        ].sort();

        // Render Filters
        if (filterContainer && categorias.length > 0) {
          const allBtn = document.createElement("button");
          allBtn.className = "btn btn-primary category-filter-btn active";
          allBtn.style.padding = "0.5rem 1rem";
          allBtn.style.borderRadius = "20px";
          allBtn.style.fontSize = "0.85rem";
          allBtn.textContent = "Todos";
          allBtn.onclick = () => Controller.filterAccesorios("Todos");
          filterContainer.appendChild(allBtn);

          categorias.forEach((cat) => {
            const btn = document.createElement("button");
            btn.className = "btn glass category-filter-btn";
            btn.style.padding = "0.5rem 1rem";
            btn.style.borderRadius = "20px";
            btn.style.fontSize = "0.85rem";
            btn.textContent =
              cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
            btn.onclick = () => Controller.filterAccesorios(cat);
            filterContainer.appendChild(btn);
          });
        }

        // Render initial view
        this.renderAccesoriosCards(images);
      }
    } catch (e) {
      console.error(e);
      document.getElementById("accesoriosGrid").innerHTML =
        `<p style="text-align:center; grid-column: 1/-1; color: red;">Error al cargar accesorios.</p>`;
    }
    View.hideLoading();
  },

  filterAccesorios(categoriaStr) {
    State.accessoriesPage = 1; // Reset to page 1 on filter change
    document.querySelectorAll(".category-filter-btn").forEach((btn) => {
      btn.className = "btn glass category-filter-btn";
      if (
        btn.textContent.toLowerCase() === categoriaStr.toLowerCase() ||
        (categoriaStr === "Todos" && btn.textContent === "Todos")
      ) {
        btn.className = "btn btn-primary category-filter-btn active";
      }
    });

    const images = window.accesoriosData || [];
    let filtered = images;
    if (categoriaStr !== "Todos") {
      filtered = images.filter(
        (img) =>
          (img.categoria || "Otros").toLowerCase() ===
          categoriaStr.toLowerCase(),
      );
    }
    this.renderAccesoriosCards(filtered);
  },

  renderAccesoriosCards(images) {
    const itemsPerPage = 5;
    const currentPage = State.accessoriesPage || 1;
    const totalPages = Math.ceil(images.length / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const pagedImages = images.slice(startIdx, startIdx + itemsPerPage);

    const grid = document.getElementById("accesoriosGrid");
    grid.innerHTML = "";

    if (pagedImages.length === 0) {
      grid.innerHTML = `<p style="text-align:center; grid-column: 1/-1;">No hay resultados para esta categoría.</p>`;
      return;
    }

    pagedImages.forEach((itemInfo) => {
      const card = document.createElement("div");
      card.className = "glass-card animate-fade-in";
      card.style.padding = "1rem";
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.gap = "0.75rem";

      const imgSrc = `images/productos/${encodeURIComponent(itemInfo.fileName)}`;

      let parsedCategoria = itemInfo.categoria || "Accesorio";
      let parsedCodigo = itemInfo.codigo || "";

      let isDozenCat =
        parsedCategoria.toLowerCase() === "montura" ||
        parsedCategoria.toLowerCase() === "estuche lente de contacto";

      let unitLabel = "Unidad";
      if (parsedCategoria.toLowerCase() === "estuche lente de contacto") {
        unitLabel = "DOCENA";
      } else if (parsedCategoria.toLowerCase() === "montura") {
        unitLabel = "Min 3 u.";
      }

      let labelHTML = itemInfo.fileName.replace(/\.[^/.]+$/, "");
      if (itemInfo.isValid) {
        const catFormatted =
          parsedCategoria.charAt(0).toUpperCase() +
          parsedCategoria.slice(1).toLowerCase();

        let priceHTML = "";
        if (itemInfo.precioBs) {
          let displayPrice = parseFloat(itemInfo.precioBs);
          if (isDozenCat) {
            priceHTML = `<span style="font-weight: 800; color: var(--primary); font-size: 1.05rem;">${displayPrice} Bs. <span style="font-size: 0.70rem; font-weight: normal; color: var(--text-muted)">(${unitLabel})</span></span>`;
          } else {
            priceHTML = `<span style="font-weight: 800; color: var(--primary); font-size: 1.05rem;">${displayPrice} Bs.</span>`;
          }
        } else {
          priceHTML = `<span style="font-weight: 800; color: var(--primary); font-size: 1.05rem;">Ver imagen</span>`;
        }

        labelHTML = `
          <div style="display: flex; flex-direction: column; gap: 0.35rem; width: 100%; text-align: left; font-size: 0.9rem; color: var(--text-main);">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--border-glass); padding-bottom: 0.25rem;">
              <span style="color: var(--text-muted); font-size: 0.8rem;">Categoría</span>
              <span style="font-weight: 600; text-transform: capitalize;">${catFormatted}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--border-glass); padding-bottom: 0.25rem;">
              <span style="color: var(--text-muted); font-size: 0.8rem;">Código</span>
              <span style="font-weight: 600;">${parsedCodigo}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.25rem;">
              <span style="color: var(--text-muted); font-size: 0.8rem;">Precio</span>
              ${priceHTML}
            </div>
          </div>
        `;
      } else {
        labelHTML = `<div style="font-weight: 600; text-align: center; font-size: 0.9rem; word-break: break-all;">${labelHTML}</div>`;
      }

      card.innerHTML = `
        <div style="width: 100%; aspect-ratio: 1; overflow: hidden; border-radius: 8px; cursor:pointer; background: transparent;" onclick="Controller.openImageModal('${imgSrc}')">
          <img src="${imgSrc}" loading="lazy" style="width: 100%; height: 100%; object-fit: contain;">
        </div>
        ${labelHTML}
        
        <div style="display:flex; gap: 0.5rem; margin-top: auto; padding-top: 0.5rem;">
          <button class="btn glass" style="flex: 1; font-size: 0.85rem; padding: 0.6rem 0.2rem;" onclick="Controller.openImageModal('${imgSrc}')">
            <i class="fas fa-search-plus"></i> Ampliar
          </button>
          <button class="btn btn-primary" style="flex: 1; font-size: 0.85rem; padding: 0.6rem 0.2rem;" onclick='Controller.goToAccesorioCalculation(${JSON.stringify(itemInfo)})'>
            <i class="fas fa-shopping-cart"></i> Comprar
          </button>
        </div>
      `;
      grid.appendChild(card);
    });

    // Pagination Controls
    if (totalPages > 1) {
      const pagination = document.createElement("div");
      pagination.style.gridColumn = "1/-1";
      pagination.style.display = "flex";
      pagination.style.justifyContent = "center";
      pagination.style.alignItems = "center";
      pagination.style.gap = "0.75rem";
      pagination.style.marginTop = "1.5rem";
      pagination.style.padding = "1rem";
      pagination.className = "pagination-container";

      const btnStyle =
        "padding: 0.6rem 1rem; border-radius: 12px; font-size: 0.9rem; min-width: 100px;";

      const prevBtn = document.createElement("button");
      prevBtn.className = "btn glass";
      prevBtn.style.cssText = btnStyle;
      prevBtn.innerHTML = `<i class="fas fa-chevron-left"></i> Anterior`;
      prevBtn.disabled = currentPage === 1;
      prevBtn.onclick = () => {
        State.accessoriesPage = currentPage - 1;
        this.renderAccesoriosCards(images);
        document
          .getElementById("accesoriosGrid")
          .scrollIntoView({ behavior: "smooth" });
      };

      const pageInfo = document.createElement("span");
      pageInfo.style.fontWeight = "600";
      pageInfo.style.fontSize = "0.9rem";
      pageInfo.style.color = "var(--text-muted)";
      pageInfo.textContent = `Pág. ${currentPage} de ${totalPages}`;

      const nextBtn = document.createElement("button");
      nextBtn.className = "btn glass";
      nextBtn.style.cssText = btnStyle;
      nextBtn.innerHTML = `Siguiente <i class="fas fa-chevron-right"></i>`;
      nextBtn.disabled = currentPage === totalPages;
      nextBtn.onclick = () => {
        State.accessoriesPage = currentPage + 1;
        this.renderAccesoriosCards(images);
        document
          .getElementById("accesoriosGrid")
          .scrollIntoView({ behavior: "smooth" });
      };

      pagination.appendChild(prevBtn);
      pagination.appendChild(pageInfo);
      pagination.appendChild(nextBtn);
      grid.appendChild(pagination);
    }
  },

  openImageModal(src, medida = "", categoria = "", nombre = "") {
    document.getElementById("modalImage").src = src;
    let labelEl = document.getElementById("modalImageLabel");
    if (!labelEl) {
      labelEl = document.createElement("div");
      labelEl.id = "modalImageLabel";
      labelEl.style.position = "absolute";
      labelEl.style.top = "10%";
      labelEl.style.left = "50%";
      labelEl.style.transform = "translateX(-50%)";
      labelEl.style.background = "#ffffff";
      labelEl.style.color = "#000000";
      labelEl.style.padding = "0.45rem 0.8rem";
      labelEl.style.borderRadius = "1px";
      labelEl.style.border = "1.5px solid #222";
      labelEl.style.boxShadow = "0 3px 6px rgba(0,0,0,0.25)";
      labelEl.style.textAlign = "center";
      labelEl.style.pointerEvents = "none";
      labelEl.style.width = "85%";
      labelEl.style.maxWidth = "300px";
      labelEl.style.display = "flex";
      labelEl.style.flexDirection = "column";
      labelEl.style.gap = "2px";
      const modalImage = document.getElementById("modalImage");
      modalImage.parentNode.insertBefore(labelEl, modalImage.nextSibling);
    }

    if (medida) {
      labelEl.innerHTML = `
        <div style="font-size: 0.55rem; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1;">
          ${categoria || ""}
        </div>
        <div style="font-size: 0.65rem; font-weight: 800; color: #000; font-family: sans-serif; line-height: 1.15; word-wrap: break-word;">
          ${nombre || ""}
        </div>
        <div style="font-size: 0.7rem; font-weight: 700; font-family: 'Courier New', Courier, monospace; border-top: 1px dashed #ccc; padding-top: 2px; margin-top: 2px; word-wrap: break-word; letter-spacing: 0.2px;">
          ${medida}
        </div>
      `;
      labelEl.style.display = "flex";
    } else {
      labelEl.style.display = "none";
    }

    document.getElementById("imageModal").classList.remove("hidden");
  },

  selectEnvelopeImage(thumbIndex, src) {
    const mainImg = document.getElementById("calcMainEnvelopeImage");
    if (mainImg) {
      mainImg.src = src;
    }
    const thumbnails = document.querySelectorAll(".envelope-thumbnail");
    thumbnails.forEach((thumb, idx) => {
      if (idx === thumbIndex) {
        thumb.classList.add("active");
      } else {
        thumb.classList.remove("active");
      }
    });
  },

  handleEnvelopeMainImageClick(medida, categoria, nombre) {
    const mainImg = document.getElementById("calcMainEnvelopeImage");
    if (mainImg) {
      this.openImageModal(mainImg.src, medida, categoria, nombre);
    }
  },

  initNovedadesSlideshow() {
    const container = document.getElementById("novedadesSlideshow");
    if (!container) return;

    let images = window.accesoriosData || [];
    if (images.length === 0) return;

    // Get valid image urls, limiting to the first 5 to avoid heavy memory and network loading
    const maxSlideImages = 5;
    const urls = images
      .filter((i) => i.isValid)
      .slice(0, maxSlideImages)
      .map((i) => `images/productos/${encodeURIComponent(i.fileName)}`);
    if (urls.length === 0) return;

    let currentIndex = 0;

    // Set first image
    container.style.backgroundImage = `url('${urls[currentIndex]}')`;

    // Change image every 4 seconds, only if Step 1 is active to reduce background workload
    setInterval(() => {
      const step1 = document.getElementById("step1");
      if (step1 && step1.classList.contains("active")) {
        currentIndex = (currentIndex + 1) % urls.length;
        container.style.backgroundImage = `url('${urls[currentIndex]}')`;
      }
    }, 4000);
  },

  goToAccesorioCalculation(itemInfo) {
    let parsedCategoria = itemInfo.categoria || "Accesorio";
    let parsedCodigo = itemInfo.codigo || "";
    let isDozenCat =
      parsedCategoria.toLowerCase() === "montura" ||
      parsedCategoria.toLowerCase() === "estuche lente de contacto";

    // Map for specific unit price overrides (Bs. per unit)
    const unitPriceOverrides = {
      200: 19,
      "2258t": 110,
      "2263a": 92,
      230: 22,
      "2326t": 101,
      "2331t": 101,
      85002: 120,
      85015: 120,
      91714: 110,
      95802: 110,
      95933: 42,
      95972: 110,
      97790: 110,
      "2C230": 21.5,
      "3C230": 21.5,
      "4C230": 21.5,
      Dest80: 88,
      Al390: 36,
    };

    // Compute base price per unit natively
    let basePrice = itemInfo.precioBs ? parseFloat(itemInfo.precioBs) : 0;
    let unitPrice = 0;

    if (unitPriceOverrides[parsedCodigo]) {
      unitPrice = unitPriceOverrides[parsedCodigo];
    } else if (isDozenCat && basePrice > 0) {
      let rawUnit = basePrice / 12;
      let fraction = rawUnit - Math.floor(rawUnit);
      if (Math.abs(fraction - 0.5) < 0.01) {
        unitPrice = Math.floor(rawUnit) + 0.5;
      } else {
        unitPrice = Math.round(rawUnit);
      }
    } else {
      unitPrice = basePrice;
    }

    let fullName = itemInfo.fileName.replace(/\.[^/.]+$/, "");
    if (itemInfo.isValid) {
      let rawCat = parsedCategoria;
      parsedCategoria =
        rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase();
      fullName = `${parsedCategoria} (Cód: ${parsedCodigo})`;
    }

    State.currentItem = {
      id:
        "acc_" +
        btoa(unescape(encodeURIComponent(itemInfo.fileName))).substring(0, 20),
      categoria: "Accesorios",
      parsedCategoria: parsedCategoria.toLowerCase(),
      nombre: fullName,
      medida: itemInfo.isValid
        ? "Código: " + parsedCodigo
        : "Precio según imagen",
      espejo: false, // Compatibility
      cf: unitPrice,
      imgSrc: `images/productos/${encodeURIComponent(itemInfo.fileName)}`,
    };

    View.renderSecondaryInputs(State.currentCategory);
    this.renderCalculationView(State.currentItem);
    View.goToStep(3);
  },
};

window.Controller = Controller;
