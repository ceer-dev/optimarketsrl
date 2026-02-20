const Controller = {
  async init() {
    View.showLoading();
    console.log("Controller: Starting initialization...");

    // Safety timeout for initialization
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
    const input = document.getElementById("productInput");
    input.value = "";

    // UI Match: Show secondary inputs immediately
    View.renderSecondaryInputs(cat);
    document.getElementById("finalSearchAction").classList.remove("hidden");

    View.renderHelpGuide(cat);
    View.renderSearchAids(cat, (term) => {
      input.value = term;
      input.focus();
      this.handleSearchInput(term);
    });

    View.goToStep(2);
    setTimeout(() => input.focus(), 100);
  },

  handleSearchInput(val) {
    const term = val.toLowerCase().trim();
    if (term.length < 2) {
      document.getElementById("productResults").classList.remove("active");
      return;
    }
    const options = Object.keys(
      State.indexedData[State.currentCategory] || {},
    ).sort();
    const filtered = options.filter((opt) => opt.toLowerCase().includes(term));

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
      alert("Por favor, selecciona un material de la lista de sugerencias.");
      document.getElementById("productInput").focus();
      return;
    }

    let queryText = "";
    const cat = State.currentCategory;

    const normalize = (str) => {
      if (!str) return "";
      // 1. Swap comma for dot
      let val = str.replace(/,/g, ".");
      // 2. Remove stray dots (e.g., "cil . -0.25" -> "cil -0.25")
      // Remove dot if it's isolated by spaces or follows "cil" without a number immediately after
      val = val.replace(/cil\s*\.\s*/gi, "cil ");
      val = val.replace(/\s+\.\s+/g, " ");
      // 3. Remove all spaces
      val = val.replace(/\s+/g, "");
      // 4. Smart decimal: if a numeric chunk is 3+ digits, insert a dot (e.g., 450 -> 4.50)
      val = val.replace(/(\d{3,})/g, (match) => {
        return match.slice(0, -2) + "." + match.slice(-2);
      });
      return val.toLowerCase();
    };

    try {
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

      const found = items.find((i) => {
        // We normalize the indexed measure too for comparison
        const indexedMeasure = normalize(i.medida);
        return indexedMeasure === normalizedQuery;
      });

      if (found) {
        State.currentItem = found;
        this.renderCalculationView(found);
        View.goToStep(3);
      } else {
        alert(
          "No se encontró esa medida exacta para este material. Intentaste buscar: " +
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

    const labelText = this.getQtyLabel({ ...item, qty: 1 });
    const badgeClass = item.categoria === "Lentilla" ? "badge-lentilla" : "";

    display.innerHTML = `
      <div class="calc-container">
          <div class="calc-header-row">
            <div class="calc-title-group">
                <span class="badge ${badgeClass}">${item.categoria}</span>
                <h2>${item.nombre}</h2>
                <p>${item.medida}</p>
            </div>
            <button class="btn glass" onclick="View.goToStep(2)" style="padding: 0.5rem 1rem; font-size: 0.9rem;">
                <i class="fas fa-arrow-left"></i> Volver
            </button>
          </div>

          <div class="calc-premium-card">
              <div class="calc-price-section">
                  <div class="calc-price-row">
                      <span class="calc-label-text">Precio Unitario (${labelText})</span>
                      <span class="calc-value-text">${item.cf} Bs.</span>
                  </div>
                  ${sfRow}
              </div>

              <div class="calc-total-row">
                  <span class="calc-total-label">Total Cotizado</span>
                  <div id="liveTotal" class="calc-total-value">${item.cf} Bs.</div>
                  <span id="liveQtyLabel" class="calc-total-badge">${labelText}</span>
              </div>

              <div class="calc-qty-bar">
                  <h3>Cantidad</h3>
                  <div class="modern-qty-control">
                      <button class="modern-qty-btn" onclick="Controller.updateQty(-1)"><i class="fas fa-minus"></i></button>
                      <input type="number" id="qtyInput" class="modern-qty-input" value="1" min="1" readonly>
                      <button class="modern-qty-btn" onclick="Controller.updateQty(1)"><i class="fas fa-plus"></i></button>
                  </div>
              </div>
          </div>

          <div class="calc-actions">
              <button class="btn glass" style="width: 100%; border: 1px solid var(--primary); color: var(--primary);" onclick="Controller.handleAddToCart('continue')">
                  <i class="fas fa-cart-plus"></i> Agregar y Seguir Comprando
              </button>
               <button class="btn btn-primary" style="width: 100%;" onclick="Controller.handleAddToCart('finish')">
                  <i class="fas fa-check"></i> Agregar y Finalizar Pedido
              </button>
          </div>
      </div>
    `;
  },

  updateQty(delta) {
    const input = document.getElementById("qtyInput");
    let val = parseInt(input.value || 1) + delta;
    if (val < 1) val = 1;
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

    const keep = document.getElementById("keepMaterialToggle").checked;
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

    // 1. Background submission to Netlify Forms
    try {
      const formData = new FormData();
      formData.append("form-name", "pedidos");
      formData.append("optica", opticaName);
      formData.append("detalles", detailLines.join("\n"));
      formData.append("metodo_pago", pm);
      formData.append("total", total);
      formData.append("fecha_hora", now);

      await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(formData).toString(),
      });
    } catch (e) {
      console.warn(
        "Netlify Form submission failed, but continuing with WhatsApp",
        e,
      );
    }

    // 2. Open WhatsApp
    window.open(
      `https://wa.me/59167724661?text=${encodeURIComponent(message)}`,
      "_blank",
    );

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

      let qtyLabel = "";
      if (item.categoria === "Lentilla") {
        if (item.qty === 1) qtyLabel = "1/2";
        else if (item.qty === 2) qtyLabel = "1 par";
        else if (item.qty === 3) qtyLabel = "1 par 1/2";
        else if (item.qty === 4) qtyLabel = "2 pares";
        else {
          const pares = Math.floor(item.qty / 2);
          const resto = item.qty % 2;
          qtyLabel = `${pares} par${pares > 1 ? "es" : ""}${resto ? " 1/2" : ""}`;
        }
      } else {
        qtyLabel = `${item.qty} par${item.qty > 1 ? "es" : ""}`;
      }

      const div = document.createElement("div");
      div.className = "glass animate-fade-in";
      div.style.padding = "1.25rem";
      div.style.marginBottom = "1rem";
      div.style.borderRadius = "12px";
      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="flex: 1;">
            <div style="font-weight: 700; color: #1e293b; font-size: 1.05rem; margin-bottom: 0.25rem;">${item.nombre}</div>
            <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem;">${item.medida}</div>
            
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="display: flex; align-items: center; background: rgba(0,0,0,0.05); border-radius: 8px; padding: 2px;">
                <button onclick="Controller.updateCartItemQty(${index}, -1)" class="btn glass" style="padding: 0.3rem 0.6rem; min-width: 32px; border: none; box-shadow: none; background: transparent;">
                  <i class="fas fa-minus" style="font-size: 0.7rem;"></i>
                </button>
                <span style="font-weight: 700; min-width: 30px; text-align: center; color: #1e293b; font-size: 0.9rem;">${item.qty}</span>
                <button onclick="Controller.updateCartItemQty(${index}, 1)" class="btn glass" style="padding: 0.3rem 0.6rem; min-width: 32px; border: none; box-shadow: none; background: transparent;">
                  <i class="fas fa-plus" style="font-size: 0.7rem;"></i>
                </button>
              </div>
              <span class="help-badge" style="background: var(--primary); color: white; font-size: 0.75rem; padding: 0.25rem 0.6rem; border-radius: 6px;">${qtyLabel}</span>
            </div>
          </div>
          
          <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 0.75rem;">
            <div style="color: var(--primary); font-weight: 800; font-size: 1.25rem; letter-spacing: -0.5px;">${sub} <span style="font-size: 0.8rem; font-weight: 600;">Bs.</span></div>
            <button class="btn glass" onclick="Controller.handleRemoveFromCart(${index})" style="color: #ef4444; border-color: #fee2e2; padding: 0.5rem; border-radius: 10px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: #fff1f2;">
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
      State.cart[index].qty += delta;
      if (State.cart[index].qty < 1) State.cart[index].qty = 1;
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
  getQtyLabel(item) {
    if (item.categoria === "Lentilla") {
      if (item.qty === 1) return "1/2";
      if (item.qty === 2) return "1 par";
      if (item.qty === 3) return "1 par 1/2";
      if (item.qty === 4) return "2 pares";
      const pares = Math.floor(item.qty / 2);
      const resto = item.qty % 2;
      return `${pares} par${pares > 1 ? "es" : ""}${resto ? " 1/2" : ""}`;
    }
    return `${item.qty} par${item.qty > 1 ? "es" : ""}`;
  },
};

window.Controller = Controller;
