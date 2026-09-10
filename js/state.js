// State Management with Persistent Storage, Real-Time Sync & Price Verification
// ============================================================================

const DB_NAME = "OptimarketCatalogDB";
const STORE_NAME = "catalog_store";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

async function idbGet(key) {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

async function idbSet(key, value) {
  const db = await openDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put({ key, value });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}

const State = {
  masterData: [],
  indexedData: {},
  cart: JSON.parse(localStorage.getItem("proforma") || "[]"),
  currentCategory: null,
  currentItem: null,

  isReady: false,
  loadError: null,
  priceVerified: false,
  priceStatus: "pending",
  lastVerified: null,
  currentEtag: null,

  async init(dataUrl = "precios.json") {
    try {
      console.log("State: Initializing data layer...");

      // 1. Check for local JS bypass (if opened offline via file://)
      if (window.location.protocol === "file:") {
        const localData = window.localMasterData || (typeof localMasterData !== "undefined" ? localMasterData : null);
        if (localData && Array.isArray(localData) && localData.length > 0) {
          this.masterData = localData;
          this.indexData();
          this.isReady = true;
          this.priceVerified = false;
          this.priceStatus = "local_file";
          console.log(`State: Loaded from localMasterData (file:/// mode). Items: ${localData.length}`);
          return true;
        }
      }

      // 2. Fast Path: Check IndexedDB Cache
      const cached = await idbGet("catalog");
      if (cached && Array.isArray(cached.masterData) && cached.masterData.length > 0) {
        this.masterData = cached.masterData;
        this.indexedData = cached.indexedData || {};
        this.currentEtag = cached.etag || null;
        this.lastVerified = cached.timestamp || null;

        // If indexedData was missing from cache, generate it once
        if (Object.keys(this.indexedData).length === 0) {
          this.indexData();
          idbSet("catalog", {
            masterData: this.masterData,
            indexedData: this.indexedData,
            etag: this.currentEtag,
            timestamp: this.lastVerified
          });
        }

        this.isReady = true;
        console.log(`State: Fast cache hit from IndexedDB (${this.masterData.length} items).`);

        // Trigger background verification with server
        this.checkForBackgroundUpdates(dataUrl);
        return true;
      }

      // 3. First-run or Empty Cache: Asynchronous HTTP Fetch
      await this.loadDataFromNetwork(dataUrl);
      return true;
    } catch (err) {
      console.error("State Init Error:", err);
      this.isReady = false;
      this.loadError = err;
      return false;
    }
  },

  async loadDataFromNetwork(url) {
    console.log(`State: Fetching latest prices from ${url}...`);
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const etag = response.headers.get("ETag");
    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Invalid or empty data received from server.");
    }

    this.masterData = data;
    this.currentEtag = etag;
    this.lastVerified = Date.now();
    this.priceVerified = true;
    this.priceStatus = "vigente";

    this.indexData();
    this.isReady = true;

    // Persist to IndexedDB
    idbSet("catalog", {
      masterData: this.masterData,
      indexedData: this.indexedData,
      etag: this.currentEtag,
      timestamp: this.lastVerified
    });

    console.log(`State: Network load complete. Indexed ${this.masterData.length} items.`);
  },

  async checkForBackgroundUpdates(url) {
    if (window.location.protocol === "file:") return;

    try {
      const headers = {};
      if (this.currentEtag) headers["If-None-Match"] = this.currentEtag;

      const response = await fetch(url, {
        method: "HEAD",
        headers,
        cache: "no-cache"
      });

      if (response.status === 304) {
        this.priceVerified = true;
        this.priceStatus = "vigente";
        this.lastVerified = Date.now();
        console.log("State: Background check confirmed prices are up-to-date (304 Not Modified).");
        return;
      }

      const newEtag = response.headers.get("ETag");
      if (response.status === 200 && (!this.currentEtag || newEtag !== this.currentEtag)) {
        console.log("State: New price version detected on server! Updating in background...");
        const fullRes = await fetch(url, { cache: "no-cache" });
        if (fullRes.ok) {
          const freshData = await fullRes.json();
          this.masterData = freshData;
          this.currentEtag = newEtag;
          this.lastVerified = Date.now();
          this.priceVerified = true;
          this.priceStatus = "actualizado";
          this.indexData();

          await idbSet("catalog", {
            masterData: this.masterData,
            indexedData: this.indexedData,
            etag: this.currentEtag,
            timestamp: this.lastVerified
          });

          // If cart has items, update prices to match new active list
          this.revalidateCartPrices();
          if (window.Controller && typeof Controller.onPricesUpdated === "function") {
            Controller.onPricesUpdated();
          }
        }
      }
    } catch (e) {
      console.warn("State: Background check skipped (offline):", e.message);
      this.priceVerified = false;
      this.priceStatus = "offline_sin_verificar";
    }
  },

  async verifyPriceFreshness(url = "precios.json") {
    if (window.location.protocol === "file:") {
      return {
        ok: true,
        verified: false,
        isOffline: true,
        message: "Modo archivo local (sin servidor)."
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const headers = {};
      if (this.currentEtag) headers["If-None-Match"] = this.currentEtag;

      const response = await fetch(url, {
        method: "HEAD",
        headers,
        signal: controller.signal,
        cache: "no-cache"
      });
      clearTimeout(timeoutId);

      if (response.status === 304) {
        this.priceVerified = true;
        this.priceStatus = "vigente";
        this.lastVerified = Date.now();
        return {
          ok: true,
          verified: true,
          status: "vigente",
          message: "Precios vigentes confirmados con el servidor."
        };
      }

      const newEtag = response.headers.get("ETag");
      if (response.status === 200 && (!this.currentEtag || newEtag !== this.currentEtag)) {
        // Fetch new data
        await this.loadDataFromNetwork(url);
        this.revalidateCartPrices();
        return {
          ok: true,
          verified: true,
          updated: true,
          status: "actualizado",
          message: "Precios actualizados con la lista vigente del servidor."
        };
      }

      this.priceVerified = true;
      return { ok: true, verified: true, status: "vigente", message: "Precios vigentes." };
    } catch (err) {
      console.warn("State: Could not verify prices with server (offline or timeout):", err);
      this.priceVerified = false;
      const lastDate = this.lastVerified
        ? new Date(this.lastVerified).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })
        : "Sin registro";
      return {
        ok: false,
        verified: false,
        status: "offline",
        lastDate,
        message: `No se pudo verificar la lista vigente con el servidor (Modo sin conexión). Última sincronización local: ${lastDate}.`
      };
    }
  },

  revalidateCartPrices() {
    if (!Array.isArray(this.cart) || this.cart.length === 0) return;
    let changed = false;

    // Create lookup map by id
    const priceMap = new Map();
    this.masterData.forEach((item) => {
      const id = item["# idPrecio"] || item["# idListaPrecio"];
      if (id !== undefined) priceMap.set(id, item.CF ?? item.cf ?? 0);
    });

    this.cart.forEach((cartItem) => {
      if (priceMap.has(cartItem.id)) {
        const freshPrice = priceMap.get(cartItem.id);
        if (cartItem.cf !== freshPrice) {
          console.log(`State: Updating cart item ${cartItem.nombre} price from ${cartItem.cf} to ${freshPrice}`);
          cartItem.cf = freshPrice;
          changed = true;
        }
      }
    });

    if (changed) {
      this.saveCart();
    }
  },

  indexData() {
    this.indexedData = {};
    let count = 0;
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
            name = "Monturas";
          } else if (subLower.includes("organico") || subLower.includes("vidrio")) {
            if (subLower.includes("bifocal") || subLower.includes("progresivo") || subLower.includes("freeform")) {
              cat = med.includes("base:") ? "Block" : "Material Listo";
            } else {
              cat = "Lentilla";
            }
          } else if (subLower.includes("bifocal") || subLower.includes("progresivo") || subLower.includes("freeform")) {
            cat = med.includes("base:") ? "Block" : "Material Listo";
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

    console.log(`State: Indexed ${count} items.`);
  },

  saveCart() {
    localStorage.setItem("proforma", JSON.stringify(this.cart));
  },

  clearCart() {
    this.cart = [];
    this.saveCart();
  }
};

window.State = State;
