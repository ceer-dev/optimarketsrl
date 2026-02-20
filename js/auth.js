/**
 * Authentication Logic
 * Handles Login, Logout, and Session checking.
 * Works with both local file:// and server environments.
 */

const STORAGE_KEY = "opticaUser";

// Detect base path: if running from /views/, go up one level for login
// Standardized for local file:// and server paths
const currentPath = window.location.pathname.toLowerCase();
const isInViews =
  currentPath.includes("/views/") ||
  currentPath.includes("\\views\\") ||
  currentPath.endsWith("cotizacion.html") ||
  currentPath.endsWith("login.html");

const LOGIN_URL = isInViews ? "login.html" : "views/login.html";
const APP_URL = isInViews ? "cotizacion.html" : "views/cotizacion.html";

const Auth = {
  /**
   * Checks if user is logged in.
   * If not logged in, redirects to login page.
   * @returns {Object|null} User object if logged in
   */
  check: function () {
    // Allow access to login page without auth
    if (window.location.pathname.includes("login.html")) {
      const user = this.getUser();
      if (user) {
        window.location.href = APP_URL;
      }
      return null;
    }

    const user = this.getUser();
    if (!user) {
      window.location.href = LOGIN_URL;
      return null;
    }
    return user;
  },

  /**
   * Get user from local storage
   */
  getUser: function () {
    const stored = localStorage.getItem(STORAGE_KEY);
    try {
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Login user and redirect
   */
  login: function (name, phone, nit) {
    if (!name || !phone) {
      alert("Por favor completa Nombre y Celular");
      return;
    }

    const user = { name, phone, nit };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));

    window.location.href = APP_URL;
  },

  /**
   * Logout user and redirect
   */
  logout: function () {
    localStorage.removeItem(STORAGE_KEY);
    window.location.href = LOGIN_URL;
  },
};

// Expose Auth globally
window.Auth = Auth;
