
// State
let masterData = [];
let indexedData = {}; // { Category: { ProductName: [Items] } }
let cart = JSON.parse(localStorage.getItem("proforma")) || [];
let currentItem = null;
let currentCategory = null;

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

async function initApp() {
  try {
    const response = await fetch("precios.json");
    masterData = await response.json();

    // Build Advanced Index
    masterData.forEach((item) => {
      const cat = item.Categoria || item.categoria || "Otros";
      const name = item.Subcategoria || item.nombre || "Sin Nombre";

      if (!indexedData[cat]) indexedData[cat] = {};
      if (!indexedData[cat][name]) indexedData[cat][name] = [];

      const normalized = {
        id: item["# idPrecio"] || item.idPrecio || Math.random(),
        categoria: cat,
        nombre: name,
        medida: item.medida || "Única",
        cf:
          item.CF !== undefined ? item.CF : item.cf !== undefined ? item.cf : 0,
        sf:
          item.SF !== undefined
            ? item.SF
            : item.sf !== undefined
              ? item.sf
              : null,
      };
      indexedData[cat][name].push(normalized);
    });

    setupEventListeners();
    updateCartUI();
    hideLoading();
  } catch (err) {
    console.error("Initialization error:", err);
    const overlay = document.getElementById("loadingOverlay");
    if (overlay)
      overlay.innerHTML =
        '<p style="color:red; padding: 2rem;">Error al cargar datos. Recarga la página.</p>';
  }
}

function setupEventListeners() {
  document.querySelectorAll(".category-btn").forEach((btn) => {
    btn.addEventListener("click", () => selectCategory(btn.dataset.cat));
  });

  // Search Product
  const searchProductBtn = document.getElementById("searchProductBtn");
  const productInput = document.getElementById("productInput");
  searchProductBtn.addEventListener("click", () => {
    const val = productInput.value.toLowerCase().trim();
    const options = Object.keys(indexedData[currentCategory] || {}).sort();
    const filtered = options.filter((opt) => opt.toLowerCase().includes(val));
    renderResults(filtered, "productResults", (selected) => {
      productInput.value = selected;
      selectProduct(selected);
    });
  });

  // Search Measure
  const searchMeasureBtn = document.getElementById("searchMeasureBtn");
  const measureInput = document.getElementById("measureInput");

  searchMeasureBtn.addEventListener("click", () => {
    const val = measureInput.value.toLowerCase().trim();
    const productName = productInput.value;

    const options = indexedData[currentCategory][productName]
      .map((i) => i.medida)
      .sort();

    const filtered = options.filter((opt) => opt.toLowerCase().includes(val));

    renderResults(filtered, "measureResults", (selected) => {
      measureInput.value = selected;
      selectMeasure(selected);
    });
  });

  // Step 4 Buttons
  document
    .getElementById("step4ClearCart")
    .addEventListener("click", clearCart);
  document
    .getElementById("step4SendWhatsApp")
    .addEventListener("click", sendToWhatsApp);

  // Floating Cart Button -> Go to Step 4
  document.getElementById("proformaBtn").addEventListener("click", () => {
    updateStep4Cart();
    goToStep(4);
  });
}

function renderResults(filtered, containerId, onSelect) {
  const list = document.getElementById(containerId);
  list.innerHTML = "";

  if (filtered.length === 0) {
    list.innerHTML =
      '<div class="result-item">No se encontraron resultados</div>';
  } else {
    filtered.forEach((text) => {
      const div = document.createElement("div");
      div.className = "result-item";
      div.innerHTML = `<span>${text}</span> <i class="fas fa-chevron-right"></i>`;
      div.addEventListener("click", () => {
        onSelect(text);
        list.classList.remove("active");
      });
      list.appendChild(div);
    });
  }
  list.classList.add("active");
  list.scrollIntoView({ behavior: "smooth", block: "nearest" });

  // Mobile Fix: Scroll the input and list into view above keyboard
  setTimeout(() => {
    const inputId = containerId.replace("Results", "Input");
    document
      .getElementById(inputId)
      .scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);
}

// NAVIGATION & FLOW
function goToStep(step) {
  document
    .querySelectorAll(".step-content")
    .forEach((s) => s.classList.remove("active"));
  document
    .querySelectorAll(".step")
    .forEach((s) => s.classList.remove("active"));

  document.getElementById(`step${step}`).classList.add("active");
  document.getElementById(`step${step}-indicator`).classList.add("active");

  for (let i = 1; i < step; i++) {
    document.getElementById(`step${i}-indicator`).classList.add("active");
  }
}

function selectCategory(cat) {
  currentCategory = cat;
  document.getElementById("productInput").value = "";
  document.getElementById("measureInput").value = "";
  document.getElementById("measureInput").disabled = true;
  document.getElementById("searchMeasureBtn").disabled = true;
  document.getElementById("productResults").classList.remove("active");
  document.getElementById("measureResults").classList.remove("active");
  document.getElementById("measureAidSection").classList.add("hidden");

  renderSearchAids(cat);
  goToStep(2);
}

function renderSearchAids(cat) {
  const container = document.getElementById("searchAids");
  const section = document.getElementById("searchAidSection");
  container.innerHTML = "";

  const aids = {
    Lentilla: ["Organico", "Vidrio"],
    "Material Listo": ["Bifocal", "Progresivo", "Invisible"],
    Block: ["Bifocal", "Progresivo", "Invisible"],
  };

  const terms = aids[cat] || [];
  if (terms.length > 0) {
    terms.forEach((term) => {
      const btn = document.createElement("button");
      btn.className = "search-aid-tag";
      btn.innerHTML = `<i class="fas fa-search"></i> ${term}`;
      btn.onclick = () => {
        const input = document.getElementById("productInput");
        input.value = term;
        // Trigger search
        document.getElementById("searchProductBtn").click();
      };
      container.appendChild(btn);
    });
    section.classList.remove("hidden");
  } else {
    section.classList.add("hidden");
  }
}

function selectProduct(name) {
  const measureInput = document.getElementById("measureInput");
  const searchMeasureBtn = document.getElementById("searchMeasureBtn");
  measureInput.value = "";
  measureInput.disabled = !name;
  searchMeasureBtn.disabled = !name;
  document.getElementById("productResults").classList.remove("active");

  if (name) {
    renderMeasureAids(currentCategory);
  } else {
    document.getElementById("measureAidSection").classList.add("hidden");
  }
}

function renderMeasureAids(cat) {
  const container = document.getElementById("measureAids");
  const section = document.getElementById("measureAidSection");
  container.innerHTML = "";

  const aids = {
    Lentilla: ["cil", "+1.50", "-1.50", "+1.50-1.50", "-1.50-1.50"],
    "Material Listo": ["+1.00_Adds"],
    Block: ["225", "250", "275"],
  };

  const terms = aids[cat] || [];
  if (terms.length > 0) {
    terms.forEach((term) => {
      const btn = document.createElement("button");
      btn.className = "search-aid-tag";
      btn.innerHTML = `<i class="fas fa-magic"></i> ${term}`;
      btn.onclick = () => {
        const input = document.getElementById("measureInput");
        input.value = term;
        // Trigger search
        document.getElementById("searchMeasureBtn").click();
      };
      container.appendChild(btn);
    });
    section.classList.remove("hidden");
  } else {
    section.classList.add("hidden");
  }
}

function selectMeasure(measure) {
  const productName = document.getElementById("productInput").value;
  const item = indexedData[currentCategory][productName].find(
    (i) => i.medida === measure,
  );

  if (item) {
    currentItem = item;
    renderCalculationView(item);
    document.getElementById("measureResults").classList.remove("active");
    goToStep(3);
  }
}

// CALCULATION VIEW
function renderCalculationView(item) {
  const display = document.getElementById("priceDisplay");
  const sfBadge =
    item.sf !== null
      ? `<div class="glass" style="padding: 1rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: var(--text-muted);">Sin Factura (SF)</div>
                    <div style="font-size: 1.5rem; font-weight: 700;">${item.sf} Bs.</div>
                </div>`
      : "";

  display.innerHTML = `
        <div class="glass-card animate-fade-in" style="border-left: 4px solid var(--primary);">
            <button class="btn glass" onclick="goToStep(2)" style="margin-bottom: 1.5rem; padding: 0.5rem 1rem;">
                <i class="fas fa-arrow-left"></i> Volver
            </button>
            <div style="margin-bottom: 1.5rem;">
                <span class="badge badge-cf" style="margin-bottom: 0.5rem;">${item.categoria}</span>
                <h2 style="font-size: 1.5rem;">${item.nombre}</h2>
                <p style="color: var(--text-muted); font-weight: 500;">${item.medida}</p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div class="glass" style="padding: 1rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: var(--text-muted);">Precio Unitario (CF)</div>
                    <div style="font-size: 1.5rem; font-weight: 700;">${item.cf} Bs.</div>
                </div>
                ${sfBadge}
                <div class="glass" style="padding: 1rem; text-align: center; border: 1px solid var(--primary);">
                    <div style="font-size: 0.75rem; color: var(--text-muted);">Total Cotizado</div>
                    <div id="liveTotal" style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">${item.cf} Bs.</div>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Cantidad a solicitar</label>
                <div class="quantity-control">
                    <button class="qty-btn" onclick="updateQty(-1)"><i class="fas fa-minus"></i></button>
                    <input type="number" id="qtyInput" value="1" min="1" style="width: 60px; text-align: center; border: none; background: transparent; color: var(--text-main); font-weight: 700; font-size: 1.25rem;">
                    <button class="qty-btn" onclick="updateQty(1)"><i class="fas fa-plus"></i></button>
                </div>
            </div>

            <div style="display: grid; gap: 1rem;">
                <button class="btn glass" style="width: 100%; border: 1px solid var(--primary); color: var(--primary);" onclick="addToCart('continue')">
                    <i class="fas fa-cart-plus"></i> Agregar y Seguir Comprando
                </button>
                 <button class="btn btn-primary" style="width: 100%;" onclick="addToCart('finish')">
                    <i class="fas fa-check"></i> Agregar y Finalizar Pedido
                </button>
            </div>
        </div>
    `;

  document
    .getElementById("qtyInput")
    .addEventListener("input", (e) => calculateLiveTotal(e.target.value));
}

function updateQty(delta) {
  const input = document.getElementById("qtyInput");
  let val = parseInt(input.value) + delta;
  if (val < 1) val = 1;
  input.value = val;
  calculateLiveTotal(val);
}

function calculateLiveTotal(qty) {
  if (!currentItem) return;
  const total = (parseFloat(currentItem.cf) * qty).toFixed(1);
  document.getElementById("liveTotal").textContent = `${total} Bs.`;
}

// CART
function addToCart(action) {
  const qtyInput = document.getElementById("qtyInput");
  const qty = parseInt(qtyInput.value);
  const existingIndex = cart.findIndex((i) => i.id === currentItem.id);

  if (existingIndex > -1) {
    cart[existingIndex].qty += qty;
  } else {
    cart.push({ ...currentItem, qty: qty });
  }

  saveCart();
  updateCartUI();

  if (action === "finish") {
    updateStep4Cart();
    goToStep(4);
    return;
  }

  const keepMaterial = document.getElementById("keepMaterialToggle").checked;
  if (keepMaterial) {
    // Stay in Step 2, clear measure but keep product
    document.getElementById("measureInput").value = "";
    document.getElementById("measureResults").classList.remove("active");
    goToStep(2);
  } else {
    goToStep(1);
  }
}

function saveCart() {
  localStorage.setItem("proforma", JSON.stringify(cart));
}

function updateCartUI() {
  const totalItems = cart.reduce((acc, item) => acc + item.qty, 0);
  document.getElementById("cartCount").textContent = totalItems;
  const btn = document.getElementById("proformaBtn");
  if (totalItems > 0) btn.classList.remove("hidden");
  else btn.classList.add("hidden");
}

function renderCart() {
  const container = document.getElementById("cartItems");
  const totalDisplay = document.getElementById("cartTotal");
  let total = 0;
  container.innerHTML = "";

  if (cart.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; padding: 2rem; color: var(--text-muted); opacity: 0.6;">Tu carrito está vacío.</p>';
    totalDisplay.textContent = "0 Bs.";
    return;
  }

  cart.forEach((item, index) => {
    const subtotal = (parseFloat(item.cf) * item.qty).toFixed(1);
    total += parseFloat(subtotal);
    const div = document.createElement("div");
    div.className = "glass";
    div.style.padding = "1rem";
    div.style.marginBottom = "1rem";
    div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <div style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">${item.categoria}</div>
                    <div style="font-weight: 600; font-size: 1rem;">${item.nombre}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">${item.medida}</div>
                    <div style="margin-top: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 0.9rem; font-weight: 500;">Cant.</span>
                        <div style="display: flex; align-items: center; gap: 0.5rem; background: var(--border-glass); padding: 0.2rem 0.5rem; border-radius: 8px;">
                            <button onclick="updateCartItemQty(${index}, -1)" style="background: var(--primary); border: none; color: white; border-radius: 4px; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                                <i class="fas fa-minus" style="font-size: 0.7rem;"></i>
                            </button>
                            <span style="font-weight: 700; min-width: 20px; text-align: center;">${item.qty}</span>
                            <button onclick="updateCartItemQty(${index}, 1)" style="background: var(--primary); border: none; color: white; border-radius: 4px; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                                <i class="fas fa-plus" style="font-size: 0.7rem;"></i>
                            </button>
                        </div>
                        <span style="font-size: 0.9rem; font-weight: 500;">| P.U. ${item.cf} Bs.</span>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                    <button class="glass" onclick="removeFromCart(${index})" style="padding: 0.4rem; color: #ef4444; border: none; font-size: 0.8rem; border-radius: 8px;"><i class="fas fa-trash-alt"></i></button>
                    <div style="font-weight: 700; color: var(--primary); font-size: 1.1rem;">${subtotal} Bs.</div>
                </div>
            </div>
        `;
    container.appendChild(div);
  });
  totalDisplay.textContent = `${total.toFixed(1)} Bs.`;
}

function updateCartItemQty(index, delta) {
  if (cart[index]) {
    cart[index].qty += delta;
    if (cart[index].qty < 1) cart[index].qty = 1;
    saveCart();
    renderCart();
    updateCartUI();
  }
}

function removeFromCart(index) {
  cart.splice(index, 1);
  saveCart();
  renderCart();
  updateCartUI();
  if (cart.length === 0)
    document.getElementById("proformaModal").style.display = "none";
}

function clearCart() {
  if (confirm("¿Deseas vaciar el carrito?")) {
    cart = [];
    saveCart();
    updateCartUI();
    document.getElementById("proformaModal").style.display = "none";
  }
}

function sendToWhatsApp() {
  const client = JSON.parse(localStorage.getItem("registeredClient"));
  let message = `Hola, soy ${client.optica.toUpperCase()}.\n Este es mi Pedido:\n\n`;
  cart.forEach((item) => {
    message += `Material:${item.nombre}\n${item.medida}\nCantidad: ${item.qty}\n-------------------------------------------\n`;
  });
  message += `Gracias, Espero Confirmacion`;
  window.open(
    `https://wa.me/59167724661?text=${encodeURIComponent(message)}`,
    "_blank",
  );

  // Clear cart after sending
  cart = [];
  saveCart();
  updateCartUI();
  updateStep4Cart();
  goToStep(1);
}

function updateStep4Cart() {
  const container = document.getElementById("step4CartItems");
  const totalDisplay = document.getElementById("step4Total");
  let total = 0;
  container.innerHTML = "";

  if (cart.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; padding: 2rem; color: var(--text-muted); opacity: 0.6;">Tu carrito está vacío.</p>';
    totalDisplay.textContent = "0 Bs.";
    return;
  }

  cart.forEach((item, index) => {
    const subtotal = (parseFloat(item.cf) * item.qty).toFixed(1);
    total += parseFloat(subtotal);
    const div = document.createElement("div");
    div.className = "glass";
    div.style.padding = "1rem";
    div.style.marginBottom = "1rem";
    div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <div style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">${item.categoria}</div>
                    <div style="font-weight: 600; font-size: 1rem;">${item.nombre}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">${item.medida}</div>
                    <div style="margin-top: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 0.9rem; font-weight: 500;">Cant.</span>
                        <div style="display: flex; align-items: center; gap: 0.5rem; background: var(--border-glass); padding: 0.2rem 0.6rem; border-radius: 8px;">
                            <button onclick="updateCartItemQty(${index}, -1)" style="background: var(--primary); border: none; color: white; border-radius: 4px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                                <i class="fas fa-minus" style="font-size: 0.7rem;"></i>
                            </button>
                            <span style="font-weight: 700; min-width: 24px; text-align: center;">${item.qty}</span>
                            <button onclick="updateCartItemQty(${index}, 1)" style="background: var(--primary); border: none; color: white; border-radius: 4px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                                <i class="fas fa-plus" style="font-size: 0.7rem;"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                    <div style="font-weight: 700; color: var(--primary); font-size: 1.1rem;">${subtotal} Bs.</div>
                     <button class="glass" onclick="removeFromCart(${index})" style="padding: 0.5rem; color: #ef4444; border: none; font-size: 0.9rem; border-radius: 8px;"><i class="fas fa-trash-alt"></i> Eliminar</button>
                </div>
            </div>
        `;
    container.appendChild(div);
  });
  totalDisplay.textContent = `${total.toFixed(1)} Bs.`;
}

// Override original update/remove to also refresh step 4
const originalUpdateQty = updateCartItemQty;
updateCartItemQty = function (index, delta) {
  originalUpdateQty(index, delta);
  updateStep4Cart();
};

const originalRemove = removeFromCart;
removeFromCart = function (index) {
  originalRemove(index);
  updateStep4Cart();
};

function hideLoading() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) {
    overlay.style.opacity = "0";
    setTimeout(() => (overlay.style.display = "none"), 500);
  }
}
