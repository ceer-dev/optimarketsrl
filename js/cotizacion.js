/**
 * Cotizacion Logic
 * Handles Category Selection, Search, Cart Management.
 * Depends on: data.js, auth.js, ui.js
 */

let masterData = [];
window.cart = [];
let currentCategory = "Lentilla";
let currentSubCategory = "";
let paymentMethod = "QR"; // Default payment method

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Auth check is already done in HTML script, but double check safety
  if (!Auth.check()) return;

  loadMasterData();
  setupEventListeners();

  // Initialize with first category
  selectCategory("Lentilla");
});

const CACHE_KEY = "precios_cache_data";
const CACHE_TIME_KEY = "precios_cache_time";
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

async function loadMasterData() {
  // 1. Try Cache First
  const cachedData = localStorage.getItem(CACHE_KEY);
  const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
  const now = Date.now();

  if (cachedData && cachedTime && now - cachedTime < CACHE_EXPIRY) {
    try {
      masterData = JSON.parse(cachedData);
      console.log("Datos cargados desde CACHE (Rápido):", masterData.length);
      // Still refresh cart UI
      if (typeof updateFloatingCart === "function") updateFloatingCart();
      return; // Skip fetch
    } catch (e) {
      console.warn("Error parsing cache, fetching fresh data...");
    }
  }

  // 2. Fetch Fresh Data
  const searchBtn = document.getElementById("searchBtn");
  if (searchBtn) {
    searchBtn.disabled = true;
    searchBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Cargando datos...`;
  }

  try {
    // Try to use the local data.js first (for file:// protocol / local dev)
    if (typeof localMasterData !== "undefined") {
      masterData = localMasterData;
      console.log("Datos cargados desde local JS:", masterData.length);
    } else {
      // In server environments: fetch the JSON directly
      const response = await fetch("../precios.json");
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      masterData = await response.json();
      console.log("Datos cargados desde JSON (Lento):", masterData.length);

      // Save to Cache
      localStorage.setItem(CACHE_KEY, JSON.stringify(masterData));
      localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    }
  } catch (err) {
    console.error("Error loading data:", err);
    if (window.UI)
      UI.showToast("Error al cargar datos. Recarga la página.", "error");
  } finally {
    if (searchBtn) {
      searchBtn.disabled = false;
      searchBtn.innerHTML = `<i class="fas fa-search"></i> Buscar`;
    }
    if (typeof updateFloatingCart === "function") updateFloatingCart();
  }
}

// --- Category & Form Logic ---
function setupEventListeners() {
  // Category Buttons
  const cats = ["Lentilla", "Material Listo", "Block", "Montura"];
  cats.forEach((cat) => {
    const btn = document.getElementById(`btn-${cat}`);
    if (btn) btn.addEventListener("click", () => selectCategory(cat));
  });

  // Search Button
  const searchBtn = document.getElementById("searchBtn");
  if (searchBtn) searchBtn.addEventListener("click", performSearch);

  // WhatsApp Button
  const waBtn = document.getElementById("whatsappBtn");
  if (waBtn) waBtn.addEventListener("click", generateWhatsApp);

  // Payment Method Buttons
  const paymentQR = document.getElementById("paymentQR");
  const paymentEfectivo = document.getElementById("paymentEfectivo");

  if (paymentQR) {
    paymentQR.addEventListener("click", () => {
      paymentMethod = "QR";
      document
        .querySelectorAll(".payment-btn")
        .forEach((btn) => btn.classList.remove("active"));
      paymentQR.classList.add("active");
    });
  }

  if (paymentEfectivo) {
    paymentEfectivo.addEventListener("click", () => {
      paymentMethod = "EFECTIVO";
      document
        .querySelectorAll(".payment-btn")
        .forEach((btn) => btn.classList.remove("active"));
      paymentEfectivo.classList.add("active");
    });
  }

  // Enter key support for search (Delegation)
  const dynamicForm = document.getElementById("dynamicForm");
  if (dynamicForm) {
    dynamicForm.addEventListener("keypress", (e) => {
      if (e.key === "Enter") performSearch();
    });
  }
}

function selectSubCategory(sub) {
  currentSubCategory = sub;

  // Highlight list item
  document.querySelectorAll(".material-list-item").forEach((item) => {
    const text = item.querySelector("span").textContent.trim();
    item.classList.toggle("active", text === sub);
  });

  // Track
  if (window.Analytics)
    Analytics.trackAction("Click Subcategoria", `${currentCategory}: ${sub}`);

  // Visual feedback
  if (window.UI) UI.showToast(`Material: ${sub}`, "success");

  // Focus on measure input
  setTimeout(() => {
    const input = document.getElementById("inputMedida");
    if (input) input.focus();
  }, 100);
}

function selectCategory(cat) {
  currentCategory = cat;
  currentSubCategory = "";

  // Update Help Section
  updateHelpSection(cat);

  // Update UI buttons
  document.querySelectorAll(".cat-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.cat === cat);
  });

  // Render Subcategory Selector if NOT Montura
  renderSubCategorySelector(cat);

  // Render Inputs
  renderDynamicForm(cat);

  // Clear results
  document.getElementById("resultsSection").classList.add("hidden");
  document.getElementById("resultsGrid").innerHTML = "";

  // Set focus
  setTimeout(() => {
    const searchInput = document.getElementById("materialSearchInput");
    if (searchInput) searchInput.focus();
    else {
      const firstInput = document.querySelector("#dynamicForm input");
      if (firstInput) firstInput.focus();
    }
  }, 100);
}

function renderSubCategorySelector(cat) {
  const container = document.getElementById("subCategoryContainer");
  if (!container) return;

  container.innerHTML = "";
  container.classList.add("hidden");
  currentSubCategory = "";

  if (cat === "Montura") return;

  const allSubs = [
    ...new Set(
      masterData
        .filter((item) => item.Categoria === cat || item.categoria === cat)
        .map((item) => item.Subcategoria || item.subcategoria)
        .filter(Boolean),
    ),
  ].sort();

  if (allSubs.length === 0) return;

  // 1. Shortcut Buttons (Horizontal) - AT THE TOP
  let shortcuts = [];
  if (cat === "Lentilla") {
    shortcuts = ["Organico", "Vidrio"];
  } else if (cat === "Material Listo" || cat === "Block") {
    shortcuts = ["Bifocal", "Progresivo", "Invisible"];
  }

  const shortcutLabel = document.createElement("label");
  shortcutLabel.className = "form-label";
  shortcutLabel.style.fontSize = "0.85rem";
  shortcutLabel.style.opacity = "0.7";
  shortcutLabel.innerHTML = `<i class="fas fa-magic"></i> Sugerencias Rápidas:`;
  container.appendChild(shortcutLabel);

  const shortcutContainer = document.createElement("div");
  shortcutContainer.className = "search-aid-container material-shortcuts";
  shortcutContainer.style.justifyContent = "center";
  shortcutContainer.style.marginTop = "0.25rem";
  shortcutContainer.style.marginBottom = "1.25rem";

  shortcuts.forEach((term) => {
    const btn = document.createElement("button");
    btn.className = "search-aid-tag shortcut-tag";
    btn.innerHTML = `<i class="fas fa-bolt"></i> ${term}`;
    btn.onclick = () => {
      const searchInput = document.getElementById("materialSearchInput");
      if (searchInput) {
        searchInput.value = term;
        searchInput.focus();
        filterMaterialList(term, allSubs);
      }
    };
    shortcutContainer.appendChild(btn);
  });
  container.appendChild(shortcutContainer);

  // 2. Standard Material Search Input (Vertical)
  const formGroup = document.createElement("div");
  formGroup.className = "form-group material-form-group";
  formGroup.style.position = "relative"; // For list positioning

  const materialLabel = document.createElement("label");
  materialLabel.className = "form-label";
  materialLabel.innerHTML = `<i class="fas fa-search"></i> Busca el Material:`;
  formGroup.appendChild(materialLabel);

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.id = "materialSearchInput";
  searchInput.className = "form-input material-search-input";
  searchInput.placeholder = "Escribe para buscar material...";
  searchInput.autocomplete = "off";
  formGroup.appendChild(searchInput);

  // 3. Material List Container (Hidden initially)
  const listContainer = document.createElement("div");
  listContainer.id = "materialListContainer";
  listContainer.className = "material-list-container hidden";
  formGroup.appendChild(listContainer);

  container.appendChild(formGroup);

  container.classList.remove("hidden");

  // Input event to show and filter list
  searchInput.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    if (val.length > 0) {
      filterMaterialList(val, allSubs);
    } else {
      listContainer.classList.add("hidden");
    }
  });

  // Clicking outside hides the list
  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) {
      listContainer.classList.add("hidden");
    }
  });
}

function filterMaterialList(term, allSubs) {
  const container = document.getElementById("materialListContainer");
  if (!container) return;

  container.innerHTML = "";

  // Highlight shortcut button
  document.querySelectorAll(".shortcut-tag").forEach((btn) => {
    btn.classList.toggle("active", btn.textContent.includes(term));
  });

  const filtered = allSubs.filter((s) =>
    s.toLowerCase().includes(term.toLowerCase()),
  );

  if (filtered.length === 0) {
    container.classList.add("hidden");
    return;
  }

  filtered.forEach((sub) => {
    const item = document.createElement("div");
    item.className = "material-list-item";
    if (sub === currentSubCategory) item.classList.add("active");

    item.innerHTML = `
      <span>${sub}</span>
      <i class="fas fa-chevron-right"></i>
    `;
    item.onclick = () => {
      selectSubCategory(sub);
      container.classList.add("hidden");
      document.getElementById("materialSearchInput").value = sub;
    };
    container.appendChild(item);
  });

  container.classList.remove("hidden");
}

function renderDynamicForm(cat) {
  const container = document.getElementById("dynamicForm");
  if (!container) return;
  container.innerHTML = "";

  let html = "";

  switch (cat) {
    case "Lentilla":
      html = `
                <div class="form-group">
                    <label class="form-label"><i class="fas fa-ruler-horizontal"></i> Medida: </label>
                    <input type="text" id="inputMedida" class="form-input premium-input" placeholder="+0.00" autocomplete="off">
                </div>
            `;
      break;
    case "Material Listo":
      html = `
                <div class="dynamic-input-row">
                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-ruler-horizontal"></i> Medida (Ej: -2.75)</label>
                        <input type="text" id="inputMedida" class="form-input premium-input" placeholder="-2.75" autocomplete="off">
                    </div>
                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-plus-circle"></i> Adds (Ej: +1.25)</label>
                        <input type="text" id="inputAdds" class="form-input premium-input" placeholder="+1.25" autocomplete="off">
                    </div>
                </div>
            `;
      break;
    case "Block":
      html = `
                <div class="dynamic-input-row">
                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-layer-group"></i> Base (Ej: 4)</label>
                        <input type="text" id="inputBase" class="form-input premium-input" placeholder="4" autocomplete="off">
                    </div>
                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-plus-circle"></i> Adds (Ej: 100)</label>
                        <input type="text" id="inputAdds" class="form-input premium-input" placeholder="100" autocomplete="off">
                    </div>
                </div>
            `;
      break;
    case "Montura":
      html = `
                <div class="form-group">
                    <label class="form-label"><i class="fas fa-barcode"></i> Código (Ej: 8057)</label>
                    <input type="text" id="inputCodigo" class="form-input premium-input" placeholder="8057" autocomplete="off">
                </div>
            `;
      break;
  }

  container.innerHTML = html;

  // Auto focus first input
  const firstInput = container.querySelector("input");
  if (firstInput) firstInput.focus();
}

// --- Input Normalization ---
/**
 * Normalizes a user-typed medida string to match the format in the database.
 * Handles:
 *  - Commas → dots: "+1,50" → "+1.50"
 *  - Extra spaces: "+1.50 -4. 50" → "+1.50-4.50"
 *  - Missing decimals: "+150" → "+1.50", "-450" → "-4.50"
 *  - Cilindro keyword: "cilindro -0.25", "CILINDRO", "CIL" → "cil"
 */
function normalizeMedida(input) {
  if (!input) return "";

  let val = input.trim();

  // 1. Normalize "cilindro" / "CILINDRO" / "CIL" → "cil"
  val = val.replace(/\b(cilindro|CILINDRO|Cilindro|CIL|Cil)\b/g, "cil");

  // 2. Replace commas with dots (decimal separator)
  val = val.replace(/,/g, ".");

  // 3. Remove all spaces (handles "+1.50 -4. 50" → "+1.50-4.50")
  //    But preserve space between "cil" keyword and the number
  //    e.g. "cil -0.50" should stay as "cil -0.50"
  if (val.startsWith("cil")) {
    // Keep the space after "cil" but remove any other spaces
    const parts = val.match(/^(cil)\s*(.+)$/i);
    if (parts) {
      val = "cil " + parts[2].replace(/\s+/g, "");
    }
  } else {
    val = val.replace(/\s+/g, "");
  }

  // 4. Fix numbers missing decimal point: +150 → +1.50, -450 → -4.50
  //    Pattern: sign + 3 digits with no dot → insert dot after first digit
  val = val.replace(/([+-])(\d{3})(?!\d|\.)/g, (match, sign, digits) => {
    return `${sign}${digits[0]}.${digits[1]}${digits[2]}`;
  });

  return val;
}

// --- Search Logic ---
function performSearch() {
  const container = document.getElementById("dynamicForm");
  let queryMedida = "";
  let isMonturaSearch = currentCategory === "Montura";

  // Validate Subcategory
  if (!currentSubCategory) {
    if (window.UI)
      UI.showToast("⚠️ Por favor selecciona una subcategoría primero", "error");
    // Visually nudge the subcategory container
    const subCont = document.getElementById("subCategoryContainer");
    if (subCont) {
      subCont.style.transition = "transform 0.1s";
      subCont.style.transform = "translateX(5px)";
      setTimeout(() => (subCont.style.transform = "translateX(-5px)"), 100);
      setTimeout(() => (subCont.style.transform = "translateX(0)"), 200);
    }
    return;
  }

  // 1. Format Search Query (with normalization)
  if (currentCategory === "Lentilla") {
    const raw = document.getElementById("inputMedida").value.trim();
    if (!raw) return UI.showToast("Ingresa una medida");
    const medida = normalizeMedida(raw);
    queryMedida = `Medida: ${medida}`;
  } else if (currentCategory === "Material Listo") {
    const rawMedida = document.getElementById("inputMedida").value.trim();
    const rawAdds = document.getElementById("inputAdds").value.trim();
    if (!rawMedida || !rawAdds) return UI.showToast("Ingresa medida y adds");
    queryMedida = `Medida: ${normalizeMedida(rawMedida)}_Adds: ${normalizeMedida(rawAdds)}`;
  } else if (currentCategory === "Block") {
    const base = document.getElementById("inputBase").value.trim();
    let rawAdds = document.getElementById("inputAdds").value.trim();
    if (!base || !rawAdds) return UI.showToast("Ingresa base y adds");

    // Specific Block Addition Normalization: +1.50 -> 150
    // Remove signs, commas to dots, then remove dot to get integer
    let normalizedAdds = rawAdds.replace(/[+-]/g, "").replace(/,/g, ".");
    if (normalizedAdds.includes(".")) {
      // If it's a decimal like 1.50, convert to 150
      normalizedAdds = normalizedAdds.replace(".", "");
    }

    queryMedida = `Base: ${base}_Adds: ${normalizedAdds}`;
  } else if (currentCategory === "Montura") {
    const codigo = document.getElementById("inputCodigo").value.trim();
    if (!codigo) return UI.showToast("Ingresa un código");
    queryMedida = `Codigo:${codigo}`;
  }

  // 2. Perform Filtering
  let results = [];

  if (isMonturaSearch) {
    results = masterData.filter((item) => {
      const cat = item.Categoria || item.categoria;
      const medida = item.medida || "";
      return (
        cat === "Montura" &&
        medida.toLowerCase().includes(queryMedida.toLowerCase())
      );
    });
  } else {
    results = masterData.filter((item) => {
      const cat = item.Categoria || item.categoria;
      const sub = item.Subcategoria || item.subcategoria;
      const itemMedida = item.medida || "";

      return (
        cat === currentCategory &&
        sub === currentSubCategory &&
        itemMedida.trim() === queryMedida
      );
    });
  }

  renderResults(results);
}

function renderResults(results) {
  const grid = document.getElementById("resultsGrid");
  const section = document.getElementById("resultsSection");
  grid.innerHTML = "";

  if (results.length === 0) {
    grid.innerHTML =
      '<div class="glass-card" style="padding:1rem; text-align:center;">No se encontraron productos.</div>';
  } else {
    results.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "product-card animate-fade-in";

      // Hint logic
      let hint = "";
      if (currentCategory === "Lentilla") {
        hint = "Precio por unidad";
      } else if (
        currentCategory === "Material Listo" ||
        currentCategory === "Block"
      ) {
        hint = "2 unidades = 1 par";
      }

      const nombre = item.Subcategoria || item.nombre;
      const precio = item.CF || item.cf || 0;
      const medida = item.medida;
      const sub = item.Subcategoria || "";
      const itemId = `item-${index}`;

      // Subtotal label logic for initial display
      const unitLabel = currentCategory === "Lentilla" ? "unidad" : "par";

      card.innerHTML = `
            <div class="product-header">
                <div class="product-info">
                    <h4>${sub}</h4>
                    <p>${medida}</p>
                    ${hint ? `<span class="pair-hint"><i class="fas fa-info-circle"></i> ${hint}</span>` : ""}
                </div>
                <div class="product-price-container">
                    <div class="product-price">${precio} Bs.</div>
                    <div class="header-subtotal" id="subtotal-${itemId}">
                        Subtotal: 1 ${unitLabel} = <strong>${precio}</strong> Bs.
                    </div>
                </div>
            </div>
            
            <div class="card-actions">
                <div class="qty-selector">
                    <button class="qty-btn" onclick="changeQty('${itemId}', -1)">-</button>
                    <span id="${itemId}" class="qty-val" data-price="${precio}">1</span>
                    <button class="qty-btn" onclick="changeQty('${itemId}', 1)">+</button>
                </div>
                <button class="btn-add" id="btn-${itemId}">
                    Agregar <i class="fas fa-cart-plus"></i>
                </button>
            </div>
      `;

      grid.appendChild(card);

      // Attach event listener properly to avoid inline JS escaping issues
      document.getElementById(`btn-${itemId}`).addEventListener("click", () => {
        addToCartWithQty(item, itemId);
      });
    });
  }

  section.classList.remove("hidden");
}

// Global helpers for inline onclicks/calls
window.changeQty = function (id, delta) {
  const el = document.getElementById(id);
  if (!el) return;

  let val = parseInt(el.textContent, 10); // Added radix for parseInt
  val += delta;
  if (val < 1) val = 1;
  el.textContent = val;

  // Real-time Autosum in Header
  const price = parseFloat(el.getAttribute("data-price") || 0);
  const subtotalEl = document.getElementById(`subtotal-${id}`);
  if (subtotalEl) {
    const total = (val * price).toFixed(2);
    // Smart units based on global category
    const unit = currentCategory === "Lentilla" ? "unidad" : "par";
    const totalUnit =
      val > 1 ? (unit === "unidad" ? "unidades" : "pares") : unit;

    subtotalEl.innerHTML = `${price}x${val} ${totalUnit} = <strong>${total}</strong> Bs.`;
  }
};

window.addToCartWithQty = function (item, qtyId) {
  const el = document.getElementById(qtyId);
  if (!el) return;
  const qty = parseInt(el.textContent);
  addToCart(item, qty);
};

// --- Cart Logic ---
// --- Cart Logic ---
function addToCart(item, quantity = 1) {
  // Check if exists
  const existing = cart.find(
    (i) =>
      (i["# idPrecio"] && i["# idPrecio"] === item["# idPrecio"]) ||
      (i.Subcategoria === item.Subcategoria && i.medida === item.medida),
  );

  if (existing) {
    existing.qty += quantity;
  } else {
    cart.push({
      ...item,
      qty: quantity,
    });
  }

  // --- Auto-Clear Measures ---
  const dynamicForm = document.getElementById("dynamicForm");
  if (dynamicForm) {
    const inputs = dynamicForm.querySelectorAll("input");
    inputs.forEach((input) => (input.value = ""));
    if (inputs.length > 0) inputs[0].focus();
  }

  // --- Clear Search Results ---
  const resultsSection = document.getElementById("resultsSection");
  const resultsGrid = document.getElementById("resultsGrid");
  if (resultsSection) resultsSection.classList.add("hidden");
  if (resultsGrid) resultsGrid.innerHTML = "";

  renderCart();
  if (window.UI) UI.updateCartBadge(window.cart.length);
  if (window.UI) UI.showToast("Producto agregado al pedido");
}

window.scrollToQuotation = function () {
  const target = document.querySelector(".category-selector-wrapper");
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};

function updateCartQty(index, delta) {
  if (window.cart[index]) {
    window.cart[index].qty += delta;
    if (window.cart[index].qty < 1) window.cart[index].qty = 1;
    renderCart();
    if (window.UI) UI.updateCartBadge(window.cart.length);
  }
}

function removeFromCart(index) {
  window.cart.splice(index, 1);
  renderCart();
  if (window.UI) UI.updateCartBadge(window.cart.length);
}

function renderCart() {
  const container = document.getElementById("cartItems");
  const section = document.getElementById("cartSection");
  const totalEl = document.getElementById("grandTotal");

  if (!container) return;
  container.innerHTML = "";

  // -- Proforma Header for Cart --
  const user = Auth ? Auth.getUser() : null;
  const dateStr = new Date().toLocaleDateString("es-ES");

  if (user) {
    const headerDiv = document.createElement("div");
    headerDiv.id = "cartHeader";
    headerDiv.className = "cart-proforma-header";
    headerDiv.innerHTML = `
        <div class="proforma-title"><i class="fas fa-shopping-basket"></i> Detalle del Pedido</div>
        <div class="proforma-meta">
            <div><strong>Cliente:</strong> ${user.name}</div>
            <div><strong>Fecha:</strong> ${dateStr}</div>
            ${user.nit ? `<div><strong>NIT:</strong> ${user.nit}</div>` : ""}
        </div>
        <hr class="proforma-divider">
      `;
    container.appendChild(headerDiv);
  }

  let total = 0;

  window.cart.forEach((item, index) => {
    const precio = parseFloat(item.CF || item.cf || 0);
    const subtotal = precio * item.qty;
    total += subtotal;
    const nombre = item.Subcategoria || item.nombre;
    const categoria = item.Categoria || item.categoria || "";

    // --- Smart quantity label ---
    let qtyLabel = "";
    if (categoria === "Lentilla") {
      if (item.qty === 1) {
        qtyLabel = `<span class="qty-label lentilla">1/2 (1 und)</span>`;
      } else if (item.qty % 2 === 0) {
        const pares = item.qty / 2;
        qtyLabel = `<span class="qty-label lentilla">${pares} Par${pares > 1 ? "es" : ""} (${item.qty} und)</span>`;
      } else {
        const pares = Math.floor(item.qty / 2);
        qtyLabel = `<span class="qty-label lentilla">${pares} Par${pares > 1 ? "es" : ""} y medio (${item.qty} und)</span>`;
      }
    } else if (categoria === "Material Listo" || categoria === "Block") {
      qtyLabel = `<span class="qty-label par">${item.qty} PAR${item.qty > 1 ? "ES" : ""}</span>`;
    }

    // --- Category badge ---
    const catLabel =
      categoria === "Lentilla"
        ? "Organico / Vidrio"
        : categoria === "Material Listo"
          ? "Material Listo"
          : categoria === "Block"
            ? "Block"
            : categoria;

    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
            <div class="cart-item-details">
                <div class="cart-cat-badge">${catLabel}</div>
                <h4>${nombre}</h4>
                <p>${item.medida}</p>
                <div class="item-price-unit">${precio} Bs. c/u</div>
                ${qtyLabel}
            </div>
            <div class="cart-controls">
                <div class="cart-qty-editor">
                    <button class="qty-btn-mini" onclick="updateCartQty(${index}, -1)">-</button>
                    <span class="qty-display">${item.qty}</span>
                    <button class="qty-btn-mini" onclick="updateCartQty(${index}, 1)">+</button>
                </div>
                <div class="item-subtotal">${subtotal.toFixed(2)} Bs.</div>
                <button class="delete-link" onclick="removeFromCart(${index})">Eliminar</button>
            </div>
        `;
    container.appendChild(div);
  });

  // --- Add More Products Button ---
  if (window.cart.length > 0) {
    const addMoreDiv = document.createElement("div");
    addMoreDiv.className = "cart-nav-actions";
    addMoreDiv.innerHTML = `
        <button class="btn-add-more" onclick="scrollToQuotation()">
            <i class="fas fa-plus-circle"></i> Agregar más productos
        </button>
    `;
    container.appendChild(addMoreDiv);
  }

  // Note: We used inline onclicks for simplicity here, but ensure functions are global
  // global helpers are added below

  totalEl.textContent = `${total.toFixed(2)} Bs.`;

  // Update Floating Button
  updateFloatingCart(cart.length);

  if (cart.length > 0) {
    section.classList.remove("hidden");
  } else {
    section.classList.add("hidden");
  }
}

function updateFloatingCart(count) {
  if (window.UI)
    UI.updateCartBadge(count !== undefined ? count : window.cart.length);
}

window.scrollToCart = function () {
  if (!window.cart || window.cart.length === 0) {
    if (window.UI)
      UI.showToast("Debe tener al menos un producto en su pedido", "error");
    return;
  }
  const section = document.getElementById("cartSection");
  if (section) {
    section.scrollIntoView({ behavior: "smooth" });
  }
};

function toggleHelp() {
  const help = document.getElementById("helpSection");
  if (!help) return;
  const isCollapsed = help.classList.contains("collapsed");

  if (isCollapsed) {
    help.classList.remove("collapsed");
    localStorage.setItem("helpCollapsed", "false");
  } else {
    help.classList.add("collapsed");
    localStorage.setItem("helpCollapsed", "true");
  }
}

function updateHelpSection(cat) {
  const help = document.getElementById("helpSection");
  if (!help) return;

  // Default to collapsed if not set, or use saved preference
  let isCollapsed = localStorage.getItem("helpCollapsed");
  if (isCollapsed === null) {
    isCollapsed = "true";
    localStorage.setItem("helpCollapsed", "true");
  }

  if (isCollapsed === "true") {
    help.classList.add("collapsed");
  } else {
    help.classList.remove("collapsed");
  }

  let contentHtml = "";

  if (cat === "Lentilla") {
    contentHtml = `
      <ul class="help-list">
        <li>Selecciona el material (ej. Organico Blanco).</li>
        <li>Si es esferico positivo usa <span class="help-example">+1.25</span></li>
        <li>Si es esferico negativo usa <span class="help-example">-1.25</span></li>
        <li>Si es neutro usa <span class="help-example">+0.00</span></li>
        <li>Para medida combinada positivo/negativo <span class="help-example">+1.25-1.50</span> o <span class="help-example">-1.50-1.50</span></li>
        <li>Si solo es cilindro usa <span class="help-example">cil -0.50</span></li>
      </ul>
    `;
  } else if (cat === "Material Listo") {
    contentHtml = `
      <ul class="help-list">
        <li>Ingresa el valor esférico en el primer campo (ej. <span class="help-example">+1.50</span>).</li>
        <li>Ingresa la adición (adds) en el segundo campo (ej. <span class="help-example">+1.25</span>).</li>
      </ul>
    `;
  } else if (cat === "Block") {
    contentHtml = `
      <ul class="help-list">
        <li>Las bases disponibles son únicamente <span class="help-example">4</span> y <span class="help-example">6</span>.</li>
        <li>En adición escribe el valor entero (ej. <span class="help-example">225</span> para 2.25).</li>
        <li>No te preocupes por los signos, el sistema los corrige automáticamente.</li>
      </ul>
    `;
  }

  const title =
    cat === "Lentilla"
      ? "Orgánicos / Vidrios"
      : cat === "Material Listo"
        ? "Material Listo"
        : cat === "Block"
          ? "Blocks"
          : cat;

  help.innerHTML = `
    <div class="help-header" onclick="toggleHelp()">
      <div class="help-title-row">
        <i class="fas fa-question-circle pulse-icon"></i>
        <span>¿Necesitas ayuda con <strong>${title}</strong>?</span>
      </div>
      <i class="fas fa-chevron-down toggle-icon"></i>
    </div>
    <div class="help-content">
      ${contentHtml}
    </div>
  `;
}

// Global helpers for cart actions
window.updateCartQty = updateCartQty;
window.removeFromCart = removeFromCart;

// --- WhatsApp Logic ---
function generateWhatsApp() {
  if (cart.length === 0) {
    if (window.UI)
      UI.showToast(
        "🛒 Tu pedido está vacío. Agregá productos primero.",
        "error",
      );
    return;
  }

  const user = Auth.getUser();
  if (!user) return UI.showToast("Error de usuario");

  const date = new Date().toLocaleDateString("es-ES");

  let message = `*Óptica:* ${user.name}\n`;
  message += `*Fecha:* ${date}\n`;
  message += `*Método de Pago:* ${paymentMethod}\n`;
  message += `Este es mi Pedido:\n\n`;

  cart.forEach((item) => {
    const nombre = item.Subcategoria || item.nombre;
    const categoria = item.Categoria || item.categoria || currentCategory;

    // Format quantity based on category
    let cantidadTexto = "";

    if (categoria === "Lentilla") {
      // For Lentilla: 1 = "1/2", 2 = "1 Par", 3 = "1 Par y medio", etc.
      if (item.qty === 1) {
        cantidadTexto = "1/2 (1 unidad)";
      } else if (item.qty % 2 === 0) {
        const pares = item.qty / 2;
        cantidadTexto = `${pares} Par${pares > 1 ? "es" : ""} (${item.qty} Unidades)`;
      } else {
        const pares = Math.floor(item.qty / 2);
        cantidadTexto = `${pares} Par${pares > 1 ? "es" : ""} y medio (${item.qty} Unidades)`;
      }
    } else if (categoria === "Material Listo" || categoria === "Block") {
      // For Material Listo and Block: 1 unit = 1 Par (already comes as pair)
      cantidadTexto = `${item.qty} Par${item.qty > 1 ? "es" : ""}`;
    } else {
      // For Montura or others: just show quantity
      cantidadTexto = `${item.qty}`;
    }

    message += `*Material:* ${nombre}\n`;
    message += `${item.medida}\n`;
    message += `*Cantidad:* ${cantidadTexto}\n`;
    message += `-------------------------------------------\n`;
  });

  message += `Gracias, Espero Confirmacion`;

  const whatsappUrl = `https://wa.me/59167724661?text=${encodeURIComponent(message)}`;

  window.open(whatsappUrl, "_blank");

  // Clear cart after sending
  window.cart = [];
  renderCart();
  if (window.UI) {
    UI.updateCartBadge(0);
    UI.showToast("Pedido enviado. Carrito limpiado.");
  }
}
