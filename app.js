/**
 * LP Opticas - Core Application Logic
 * Optimized for performance with 24,000+ entries
 */

let masterData = [];
let productNames = new Set();
let groupedData = {};

document.addEventListener("DOMContentLoaded", () => {
  if (
    window.location.pathname.endsWith("index.html") ||
    window.location.pathname.endsWith("/")
  ) {
    initCatalog();
  }
});

/**
 * Initializes the catalog: loads JSON and builds indexes
 */
async function initCatalog() {
  const loadingOverlay = document.getElementById("loadingOverlay");
  const productList = document.getElementById("productList");
  const productSearch = document.getElementById("productSearch");
  const measureFilter = document.getElementById("measureFilter");
  const resultsContainer = document.getElementById("results");

  try {
    const response = await fetch("precios.json");
    masterData = await response.json();

    // Build Index for Grouping by Nombre
    masterData.forEach((item) => {
      if (!groupedData[item.nombre]) {
        groupedData[item.nombre] = [];
        productNames.add(item.nombre);
      }
      groupedData[item.nombre].push(item);
    });

    // Fill Datalist for Autocomplete
    const sortedNames = Array.from(productNames).sort();
    const fragment = document.createDocumentFragment();
    sortedNames.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      fragment.appendChild(option);
    });
    productList.appendChild(fragment);

    hideLoading();

    // Event Listeners
    productSearch.addEventListener("input", handleProductSelection);
    measureFilter.addEventListener("change", handleMeasureFilter);
  } catch (error) {
    console.error("Error loading data:", error);
    if (loadingOverlay) {
      loadingOverlay.innerHTML = `<p style="color: #ef4444;">Error al cargar el catálogo. Por favor recarga la página.</p>`;
    }
  }
}

function hideLoading() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) {
    overlay.style.opacity = "0";
    setTimeout(() => (overlay.style.display = "none"), 500);
  }
}

/**
 * Handles product selection from search bar
 */
function handleProductSelection(e) {
  const selectedProduct = e.target.value;
  const measureFilter = document.getElementById("measureFilter");
  const resultsContainer = document.getElementById("results");

  if (groupedData[selectedProduct]) {
    // Enable and fill measures
    measureFilter.disabled = false;
    measureFilter.innerHTML = '<option value="">Selecciona Medida...</option>';

    const uniqueMeasures = groupedData[selectedProduct].map(
      (item) => item.medida,
    );
    uniqueMeasures.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      measureFilter.appendChild(opt);
    });

    // Clear if only one item or auto-select first? Better let user choose.
    resultsContainer.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <i class="fas fa-list-ul" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                <p>Producto seleccionado: <strong>${selectedProduct}</strong></p>
                <p>Ahora elige una medida.</p>
            </div>
        `;
  } else {
    measureFilter.disabled = true;
    measureFilter.innerHTML =
      '<option value="">Primero selecciona un producto</option>';
  }
}

/**
 * Handles measure selection and displays the final price card
 */
function handleMeasureFilter(e) {
  const productName = document.getElementById("productSearch").value;
  const measure = e.target.value;
  const resultsContainer = document.getElementById("results");

  if (!productName || !measure) return;

  const items = groupedData[productName];
  const match = items.find((i) => i.medida === measure);

  if (match) {
    renderResult(match);
  }
}

/**
 * Renders the product price card
 */
function renderResult(item) {
  const resultsContainer = document.getElementById("results");

  resultsContainer.innerHTML = `
        <div class="glass-card animate-fade-in" style="border-left: 4px solid var(--primary);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
                <div>
                    <h2 style="font-size: 1.5rem; margin-bottom: 0.25rem;">${item.nombre}</h2>
                    <p style="color: var(--text-muted); font-weight: 500;">${item.medida}</p>
                </div>
                <div class="glass" style="padding: 0.5rem; font-size: 0.75rem; color: var(--text-muted);">
                    ID: ${item.idPrecio}
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="glass" style="padding: 1.5rem; text-align: center;">
                    <span class="badge badge-cf" style="margin-bottom: 0.5rem;">Con Factura (CF)</span>
                    <div style="font-size: 2rem; font-weight: 700;">${item.cf} <small style="font-size: 1rem;">Bs.</small></div>
                </div>
                <div class="glass" style="padding: 1.5rem; text-align: center;">
                    <span class="badge badge-sf" style="margin-bottom: 0.5rem;">Sin Factura (SF)</span>
                    <div style="font-size: 2rem; font-weight: 700;">${item.sf} <small style="font-size: 1rem;">Bs.</small></div>
                </div>
            </div>

            <div style="margin-top: 2rem; display: flex; gap: 1rem;">
                <button class="btn btn-primary" style="flex: 1;" onclick="window.print()">
                    <i class="fas fa-print"></i> Imprimir
                </button>
                <button class="btn glass" style="flex: 1;" onclick="location.reload()">
                    <i class="fas fa-redo"></i> Nueva Consulta
                </button>
            </div>
        </div>
    `;
}
