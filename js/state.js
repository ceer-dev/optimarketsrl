const State = {
  CACHE_KEY: "opti_precios_cache",
  CACHE_TIME: "opti_precios_time",
  EXPIRY: 24 * 60 * 60 * 1000,

  masterData: [],
  indexedData: {},
  cart: JSON.parse(localStorage.getItem("proforma")) || [],
  currentCategory: null,
  currentItem: null,

  async init(dataUrl = "precios.json") {
    try {
      // Tiny delay to ensure browser finished parsing js/data.js if it was huge
      await new Promise((r) => setTimeout(r, 100));
      await this.loadData(dataUrl);
      this.indexData();
      return true;
    } catch (err) {
      console.error("State Init Error:", err);
      return false;
    }
  },

  async loadData(url) {
    console.log("State: Initializing data load...");

    // 1. Check for local JS bypass (Standard for offline/local-file mode)
    const localData =
      window.localMasterData ||
      (typeof localMasterData !== "undefined" ? localMasterData : null);

    if (localData && Array.isArray(localData) && localData.length > 0) {
      this.masterData = localData;
      console.log(
        `State: Data loaded from local JS (CORS Bypass). Items: ${localData.length}`,
      );
      return;
    } else {
      console.log(
        "State: localMasterData not found or empty. Checking cache...",
      );
    }

    // 2. Check Cache
    const cached = localStorage.getItem(this.CACHE_KEY);
    const time = localStorage.getItem(this.CACHE_TIME);
    const now = Date.now();

    if (cached && time && now - parseInt(time) < this.EXPIRY) {
      try {
        this.masterData = JSON.parse(cached);
        console.log("State: Data loaded from cache");
        return;
      } catch (e) {
        console.warn("State: Cache corruption, clearing...");
        localStorage.removeItem(this.CACHE_KEY);
        localStorage.removeItem(this.CACHE_TIME);
      }
    }

    // 3. Last Resort: Fetch
    try {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      this.masterData = await response.json();

      // Protective caching
      try {
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(this.masterData));
        localStorage.setItem(this.CACHE_TIME, now.toString());
      } catch (e) {
        console.warn("State: Caching failed (likely quota exceeded)");
      }
    } catch (e) {
      console.error("State: Fetch failed (CORS or network error)", e);
      throw e;
    }
  },

  indexData() {
    this.indexedData = {};
    let count = 0;
    
    // Cache for subcategory to category resolution to avoid expensive string operations on 30k+ items
    const catCache = {};
    const nameCache = {};

    this.masterData.forEach((item) => {
      let cat = item.Categoria || item.categoria;
      let name = item.Subcategoria || item.nombre || "Sin Nombre";

      if (!cat) {
        const cacheKey = name + "|" + (item.medida || "");
        if (catCache[cacheKey] !== undefined) {
          cat = catCache[cacheKey];
          name = nameCache[cacheKey];
        } else {
          const subLower = name.toLowerCase().trim();
          const med = (item.medida || "").toString().toLowerCase();

          if (["tr90", "acetato", "metal", "plastica"].includes(subLower)) {
            cat = "Montura";
            name = "Monturas"; // Group under single subcategory "Monturas"
          } else if (subLower.includes("organico") || subLower.includes("vidrio")) {
            if (subLower.includes("bifocal") || subLower.includes("progresivo") || subLower.includes("freeform")) {
              if (med.includes("base:")) {
                cat = "Block";
              } else {
                cat = "Material Listo";
              }
            } else {
              cat = "Lentilla";
            }
          } else if (subLower.includes("bifocal") || subLower.includes("progresivo") || subLower.includes("freeform")) {
            if (med.includes("base:")) {
              cat = "Block";
            } else {
              cat = "Material Listo";
            }
          } else if (subLower === "estuches") {
            cat = "Accesorios";
          } else {
            cat = "Otros";
          }
          catCache[cacheKey] = cat;
          nameCache[cacheKey] = name;
        }
      }

      const catTrimmed = cat.toString().trim();
      const nameTrimmed = name.toString().trim();

      if (!this.indexedData[catTrimmed]) this.indexedData[catTrimmed] = {};
      if (!this.indexedData[catTrimmed][nameTrimmed]) this.indexedData[catTrimmed][nameTrimmed] = [];

      this.indexedData[catTrimmed][nameTrimmed].push({
        id: item["# idPrecio"] || item["# idListaPrecio"] || Math.random(),
        categoria: catTrimmed,
        nombre: nameTrimmed,
        medida: (item.medida || "Única").toString().trim(),
        cf: item.CF ?? item.cf ?? 0,
        sf: item.SF ?? item.sf ?? null,
        cantidad: item.cantidad ?? 0
      });
      count++;
    });
    console.log(
      `State: Indexed ${count} items. Categories:`,
      Object.keys(this.indexedData),
    );
  },

  saveCart() {
    localStorage.setItem("proforma", JSON.stringify(this.cart));
  },

  clearCart() {
    this.cart = [];
    this.saveCart();
  },
};

window.State = State;
