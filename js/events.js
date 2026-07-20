const Events = {
  bind() {
    document.querySelectorAll(".category-btn").forEach((btn) => {
      btn.onclick = () => Controller.handleCategorySelect(btn.dataset.cat);
    });

    const productInput = document.getElementById("productInput");
    if (productInput) {
      productInput.oninput = () =>
        Controller.handleSearchInput(productInput.value);
    }

    const mainSearchBtn = document.getElementById("mainSearchBtn");
    if (mainSearchBtn) {
      mainSearchBtn.onclick = () => Controller.handleFinalSearch();
    }

    document.getElementById("step4ClearCart").onclick = () =>
      Controller.handleClearCart();
    document.getElementById("step4SendWhatsApp").onclick = () =>
      Controller.handleSendToWhatsApp();
    document.getElementById("proformaBtn").onclick = () =>
      Controller.handleViewCart();

    // Eventos del widget flotante de horarios
    const scheduleBtn = document.getElementById("scheduleBtn");
    const scheduleCard = document.getElementById("scheduleCard");
    const scheduleCardCloseBtn = document.getElementById("scheduleCardCloseBtn");

    if (scheduleBtn && scheduleCard) {
      scheduleBtn.onclick = (e) => {
        e.stopPropagation();
        scheduleCard.classList.toggle("hidden");
      };
    }

    if (scheduleCardCloseBtn && scheduleCard) {
      scheduleCardCloseBtn.onclick = (e) => {
        e.stopPropagation();
        scheduleCard.classList.add("hidden");
      };
    }

    document.addEventListener("click", (e) => {
      if (
        !e.target.closest(".form-group") &&
        !e.target.closest(".shortcut-tag")
      ) {
        document
          .querySelectorAll(".results-list")
          .forEach((l) => l.classList.remove("active"));
      }

      // Cerrar tarjeta de horarios al hacer click fuera del widget
      const scheduleWidget = document.getElementById("scheduleWidget");
      if (
        scheduleWidget &&
        scheduleCard &&
        !scheduleCard.classList.contains("hidden")
      ) {
        if (!scheduleWidget.contains(e.target)) {
          scheduleCard.classList.add("hidden");
        }
      }
    });

    const backBtn = document.querySelector("#step2 .btn.glass");
    if (backBtn) backBtn.onclick = () => View.goToStep(1);
  },
};

window.Events = Events;
