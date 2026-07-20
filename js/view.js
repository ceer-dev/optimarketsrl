const View = {
  loader: document.getElementById("loadingOverlay"),

  isMobile() {
    return (
      window.matchMedia("(max-width: 768px)").matches ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    );
  },

  showLoading() {
    if (this.loader) {
      this.loader.style.display = "flex";
      this.loader.style.opacity = "1";
    }
  },

  hideLoading() {
    if (this.loader) {
      this.loader.style.opacity = "0";
      setTimeout(() => (this.loader.style.display = "none"), 500);
    }
  },

  showError(msg) {
    if (this.loader) {
      this.loader.innerHTML = `<p style="color:red; padding: 2rem;">${msg}</p>`;
    } else {
      alert(msg);
    }
  },

  goToStep(step) {
    document
      .querySelectorAll(".step-content")
      .forEach((s) => s.classList.remove("active"));
    document
      .querySelectorAll(".step")
      .forEach((s) => s.classList.remove("active"));

    const content = document.getElementById(`step${step}`);
    const indicator = document.getElementById(`step${step}-indicator`);

    if (content) content.classList.add("active");
    if (indicator) {
      indicator.classList.add("active");
      // Highlight previous steps
      for (let i = 1; i < step; i++) {
        const prev = document.getElementById(`step${i}-indicator`);
        if (prev) prev.classList.add("active");
      }
    }
  },

  renderSearchResults(filtered, containerId, onSelect) {
    const list = document.getElementById(containerId);
    if (!list) return;
    list.innerHTML = "";

    if (filtered.length === 0) {
      list.innerHTML = '<div class="result-item">Sin resultados</div>';
    } else {
      const limit = 12;
      const sliced = filtered.slice(0, limit);
      sliced.forEach((text) => {
        const div = document.createElement("div");
        div.className = "result-item";
        div.innerHTML = `<span>${text}</span> <i class="fas fa-chevron-right"></i>`;
        div.onclick = (e) => {
          e.stopPropagation();
          onSelect(text);
          list.classList.remove("active");
        };
        list.appendChild(div);
      });
      if (filtered.length > limit) {
        const div = document.createElement("div");
        div.className = "result-item";
        div.style.justifyContent = "center";
        div.style.fontSize = "0.85rem";
        div.style.color = "var(--text-muted)";
        div.style.pointerEvents = "none";
        div.style.background = "var(--primary-light)";
        div.style.fontWeight = "600";
        div.textContent = `+ ${filtered.length - limit} coincidencias más...`;
        list.appendChild(div);
      }
    }
    list.classList.add("active");
  },

  renderSearchAids(cat, onAidClick) {
    const container = document.getElementById("searchAids");
    if (!container) return;

    let shortcutContainer = document.getElementById("shortcutContainer");
    if (!shortcutContainer) {
      shortcutContainer = document.createElement("div");
      shortcutContainer.id = "shortcutContainer";
      shortcutContainer.className = "search-aid-container Material-shortcuts";
      shortcutContainer.style.justifyContent = "center";
      shortcutContainer.style.marginBottom = "1rem";
      container.appendChild(shortcutContainer);
    }
    shortcutContainer.innerHTML = "";

    const aids = {
      Lentilla: ["Organico", "Vidrio"],
      "Material Listo": ["Bifocal", "Progresivo", "Invisible"],
      Block: ["Bifocal", "Progresivo", "Invisible"],
    };

    const terms = aids[cat] || [];
    terms.forEach((term) => {
      const btn = document.createElement("button");
      btn.className = "search-aid-tag shortcut-tag";
      btn.innerHTML = `<i class="fas fa-bolt" style="color: var(--primary)"></i> ${term}`;
      btn.onclick = (e) => {
        e.stopPropagation();
        onAidClick(term);
      };
      shortcutContainer.appendChild(btn);
    });
  },

  renderHelpGuide(cat) {
    const section = document.getElementById("searchAidSection");
    const container = document.getElementById("searchAids");
    if (!container || !section) return;

    container.innerHTML = "";
    let html = "";

    if (cat === "Lentilla") {
      html = `
        <div class="help-guide-card animate-fade-in collapsed">
          <div class="help-guide-header" onclick="View.toggleHelpGuide()">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="help-icon-circle"><i class="fas fa-question"></i></div>
              <h3 class="help-guide-title">¿Necesitas ayuda con Orgánicos / Vidrios?</h3>
            </div>
            <i class="fas fa-chevron-down help-chevron"></i>
          </div>
          <div class="help-guide-body">
            <ul class="help-list">
              <li>Selecciona el material (ej. Organico Blanco).</li>
              <li>Si es esferico positivo usa <span class="help-badge">+1.25</span></li>
              <li>Si es esferico negativo usa <span class="help-badge">-1.25</span></li>
              <li>Si es neutro usa <span class="help-badge">+0.00</span></li>
              <li>Para medida combinada positivo/negativo <div style="margin-top:0.5rem"><span class="help-badge">+1.25-1.50</span> o <span class="help-badge">-1.50-1.50</span></div></li>
              <li>Si solo es cilindro usa <span class="help-badge">cil -0.50</span></li>
            </ul>
          </div>
        </div>
      `;
    } else if (cat === "Material Listo") {
      html = `
        <div class="help-guide-card animate-fade-in collapsed">
          <div class="help-guide-header" onclick="View.toggleHelpGuide()">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="help-icon-circle"><i class="fas fa-question"></i></div>
              <h3 class="help-guide-title">¿Necesitas ayuda con Material Listo?</h3>
            </div>
            <i class="fas fa-chevron-down help-chevron"></i>
          </div>
          <div class="help-guide-body">
            <ul class="help-list">
              <li>Ingresa el valor esférico en el primer campo (ej. <span class="help-badge">+1.50</span>).</li>
              <li>Ingresa la adición (adds) en el segundo campo (ej. <span class="help-badge">+1.25</span>).</li>
            </ul>
          </div>
        </div>
      `;
    } else if (cat === "Block") {
      html = `
        <div class="help-guide-card animate-fade-in collapsed">
          <div class="help-guide-header" onclick="View.toggleHelpGuide()">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="help-icon-circle"><i class="fas fa-question"></i></div>
              <h3 class="help-guide-title">¿Necesitas ayuda con Blocks?</h3>
            </div>
            <i class="fas fa-chevron-down help-chevron"></i>
          </div>
          <div class="help-guide-body">
            <ul class="help-list">
              <li>Las bases disponibles son únicamente <span class="help-badge">4</span> y <span class="help-badge">6</span>.</li>
              <li>En adición escribe el valor entero (ej. <span class="help-badge">225</span> para 2.25).</li>
              <li>No te preocupes por los signos, el sistema los corrige automáticamente.</li>
            </ul>
          </div>
        </div>
      `;
    } else if (cat === "Montura") {
      html = `
        <div class="help-guide-card animate-fade-in collapsed">
          <div class="help-guide-header" onclick="View.toggleHelpGuide()">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="help-icon-circle"><i class="fas fa-question"></i></div>
              <h3 class="help-guide-title">¿Necesitas ayuda con Monturas?</h3>
            </div>
            <i class="fas fa-chevron-down help-chevron"></i>
          </div>
          <div class="help-guide-body">
            <ul class="help-list">
              <li>Ingresa el código de la montura en el buscador (ej. <span class="help-badge">8057</span> o <span class="help-badge">5034</span>).</li>
              <li>Selecciona la montura correspondiente de la lista de sugerencias.</li>
            </ul>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
    section.classList.remove("hidden");
  },

  toggleHelpGuide() {
    const card = document.querySelector(".help-guide-card");
    if (card) card.classList.toggle("collapsed");
  },

  applyMeasure(val) {
    const fm = document.getElementById("finalMeasure");
    if (!fm) return;

    if (val === "cil") {
      fm.value = "cil " + fm.value.replace(/^cil\s*/i, "");
    } else {
      fm.value = val;
    }

    if (!this.isMobile()) {
      fm.focus();
    }
  },

  renderSecondaryInputs(cat) {
    const container = document.getElementById("dynamicSecondaryInputs");
    if (!container) return;
    container.innerHTML = "";

    let html = "";
    if (cat === "Lentilla") {
      html = `
        <div class="form-group animate-fade-in">
          <label class="form-label"><i class="fas fa-ruler-horizontal"></i> Medida:</label>
          <input type="text" id="finalMeasure" class="form-input" placeholder="+0.00" autocomplete="off" required>
          <div style="margin-top: 0.75rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
            <button class="search-aid-tag" onclick="View.applyMeasure('cil')">
              <i class="fas fa-pen" style="font-size: 0.75rem; opacity: 0.7;"></i> cil
            </button>
            <button class="search-aid-tag" onclick="View.applyMeasure('+1.50')">
              <i class="fas fa-pen" style="font-size: 0.75rem; opacity: 0.7;"></i> +1.50
            </button>
            <button class="search-aid-tag" onclick="View.applyMeasure('-1.50')">
              <i class="fas fa-pen" style="font-size: 0.75rem; opacity: 0.7;"></i> -1.50
            </button>
            <button class="search-aid-tag" onclick="View.applyMeasure('+1.50-1.50')">
              <i class="fas fa-pen" style="font-size: 0.75rem; opacity: 0.7;"></i> +1.50-1.50
            </button>
            <button class="search-aid-tag" onclick="View.applyMeasure('-1.50-1.50')">
              <i class="fas fa-pen" style="font-size: 0.75rem; opacity: 0.7;"></i> -1.50-1.50
            </button>
          </div>
        </div>
      `;
    } else if (cat === "Material Listo") {
      html = `
        <div class="form-group animate-fade-in">
          <label class="form-label"><i class="fas fa-minus-square"></i> Medida (Ej: -2.75):</label>
          <input type="text" id="finalMeasure" class="form-input" placeholder="-2.75" autocomplete="off" required>
        </div>
        <div class="form-group animate-fade-in">
          <label class="form-label"><i class="fas fa-plus-circle"></i> Adds (Ej: +1.25):</label>
          <input type="text" id="finalAdds" class="form-input" placeholder="+1.25" autocomplete="off" required>
        </div>
      `;
    } else if (cat === "Block") {
      html = `
        <div class="form-group animate-fade-in">
          <label class="form-label"><i class="fas fa-layer-group"></i> Base (Ej: 4):</label>
          <input type="text" id="finalBase" class="form-input" placeholder="4" autocomplete="off" required>
        </div>
        <div class="form-group animate-fade-in">
          <label class="form-label"><i class="fas fa-plus-circle"></i> Adds (Ej: 100):</label>
          <input type="text" id="finalAdds" class="form-input" placeholder="100" autocomplete="off" required>
        </div>
      `;
    }
    container.innerHTML = html;
    setTimeout(() => {
      if (this.isMobile()) return;

      const first = container.querySelector("input");
      if (first) first.focus();
    }, 100);
  },

  updateCartBadge(count) {
    const badge = document.getElementById("cartCount");
    if (badge) badge.textContent = count;
    const btn = document.getElementById("proformaBtn");
    if (btn) {
      if (count > 0) btn.classList.remove("hidden");
      else btn.classList.add("hidden");
    }
  },
};

window.View = View;
