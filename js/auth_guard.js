// Strict Auth Guard & Session Initializer
// =======================================

(function () {
  const client = JSON.parse(localStorage.getItem("registeredClient"));
  if (!client && !window.location.pathname.includes("form.html")) {
    window.location.href = "form.html";
  } else {
    document.documentElement.style.display = "block";
    document.addEventListener("DOMContentLoaded", () => {
      document.body.style.opacity = "1";
      if (client) {
        const welcomeMessage = document.getElementById("welcomeMessage");
        if (welcomeMessage) {
          welcomeMessage.innerText = `Cotización para ${client.optica}`;
        }

        // Show novedades modal once per session
        if (!sessionStorage.getItem("novedadesShown")) {
          setTimeout(() => {
            const modal = document.getElementById("novedadesModal");
            if (modal) {
              modal.classList.remove("hidden");
              sessionStorage.setItem("novedadesShown", "true");
            }
          }, 500);
        }
      }
      const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn) {
        logoutBtn.onclick = () => {
          localStorage.removeItem("registeredClient");
          window.location.href = "form.html";
        };
      }
    });
  }
})();
