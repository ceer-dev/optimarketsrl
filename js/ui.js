/**
 * UI Utilities
 * Shared functions for UI manipulation and Partials loading.
 */

const UI = {
  // HTML Templates to avoid CORS issues with file:// protocol
  headerTemplate: `
    <header class="app-header glass sticky-header">
        <div class="header-left">
            <div class="user-profile">
                <div class="user-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="user-details">
                    <h2 id="displayOpticaName" class="user-name">Cargando...</h2>
                    <div class="user-meta">
                        <span id="displayPhone"><i class="fas fa-phone-alt"></i> --</span>
                        <span id="displayNit" class="hidden"><i class="fas fa-id-card"></i> --</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="header-actions">
            <button id="headerCartBtn" class="header-cart-btn" onclick="window.scrollToCart()" title="Ver mi pedido">
                <div class="cart-icon-wrapper">
                    <i class="fas fa-shopping-cart"></i>
                    <span id="headerCartBadge" class="header-cart-badge hidden">0</span>
                </div>
                <span class="cart-text">Pedido</span>
            </button>
            <button id="logoutBtn" class="btn-logout" title="Cerrar Sesión">
                <i class="fas fa-sign-out-alt"></i>
                <span class="logout-text">Salir</span>
            </button>
        </div>
    </header>
    `,

  footerTemplate: `
    <footer style="text-align: center; padding: 1rem; color: #94a3b8; font-size: 0.8rem; margin-top: 2rem;">
        <p>&copy; 2026 Optimarket. Todos los derechos reservados.</p>
    </footer>
    `,

  /**
   * Injects the header and footer templates.
   */
  init: function () {
    const headerContainer = document.getElementById("header-container");
    const footerContainer = document.getElementById("footer-container");

    if (headerContainer) headerContainer.innerHTML = this.headerTemplate;
    if (footerContainer) footerContainer.innerHTML = this.footerTemplate;

    // After header is loaded, update user info if logged in
    this.updateHeaderInfo();
  },

  /**
   * Updates header with user info from Auth
   */
  updateHeaderInfo: function () {
    if (!window.Auth) return;
    const user = window.Auth.getUser();
    if (user) {
      const nameEl = document.getElementById("displayOpticaName");
      const phoneEl = document.getElementById("displayPhone");
      const nitEl = document.getElementById("displayNit");
      const logoutBtn = document.getElementById("logoutBtn");

      if (nameEl) nameEl.textContent = user.name;

      if (phoneEl) {
        phoneEl.innerHTML = `<i class="fas fa-phone-alt"></i> ${user.phone}`;
      }

      if (nitEl) {
        if (user.nit) {
          nitEl.innerHTML = `<i class="fas fa-id-card"></i> ${user.nit}`;
          nitEl.classList.remove("hidden");
        } else {
          nitEl.classList.add("hidden");
        }
      }

      if (logoutBtn) {
        // Ensure no duplicate listeners by cloning
        const newBtn = logoutBtn.cloneNode(true);
        logoutBtn.parentNode.replaceChild(newBtn, logoutBtn);
        newBtn.addEventListener("click", () => window.Auth.logout());
      }
    }
  },

  /**
   * Shows a Toast notification
   */
  showToast: function (msg, type = "normal") {
    // Create toast element if it doesn't exist
    let toast = document.getElementById("toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast";
      toast.className = "toast hidden";
      document.body.appendChild(toast);
    }

    toast.textContent = msg;
    toast.style.backgroundColor = type === "error" ? "#ef4444" : "#333";
    toast.style.color = "#fff";

    toast.classList.remove("hidden");
    // Ensure CSS class for toast handles visibility
    toast.style.opacity = "1";
    toast.style.bottom = "2rem";

    setTimeout(() => {
      toast.classList.add("hidden");
      toast.style.opacity = "0";
      toast.style.bottom = "-50px";
    }, 3000);
  },
  /**
   * Updates the cart badge in the header
   */
  updateCartBadge: function (count) {
    const btn = document.getElementById("headerCartBtn");
    const badge = document.getElementById("headerCartBadge");
    if (!btn || !badge) return;

    // Button always visible as requested
    btn.classList.remove("hidden");

    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove("hidden");
      btn.classList.add("has-items");
    } else {
      badge.classList.add("hidden");
      btn.classList.remove("has-items");
    }
  },
};

// Initialize UI when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  UI.init();

  // Update badge initially
  setTimeout(() => {
    if (window.cart) UI.updateCartBadge(window.cart.length);
  }, 100);
});
