const Events = {
  bind() {
    // Category selection
    document.querySelectorAll(".category-btn").forEach((btn) => {
      btn.onclick = () => Controller.handleCategorySelect(btn.dataset.cat);
    });

    // Predictive search
    const productInput = document.getElementById("productInput");
    if (productInput) {
      productInput.oninput = () =>
        Controller.handleSearchInput(productInput.value);
    }

    // Unified search button
    const mainSearchBtn = document.getElementById("mainSearchBtn");
    if (mainSearchBtn) {
      mainSearchBtn.onclick = () => Controller.handleFinalSearch();
    }

    // Cart actions
    document.getElementById("step4ClearCart").onclick = () =>
      Controller.handleClearCart();
    document.getElementById("step4SendWhatsApp").onclick = () =>
      Controller.handleSendToWhatsApp();
    document.getElementById("proformaBtn").onclick = () =>
      Controller.handleViewCart();

    // Global click listener to close results
    document.addEventListener("click", (e) => {
      if (
        !e.target.closest(".form-group") &&
        !e.target.closest(".shortcut-tag")
      ) {
        document
          .querySelectorAll(".results-list")
          .forEach((l) => l.classList.remove("active"));
      }
    });

    // Step back button
    const backBtn = document.querySelector("#step2 .btn.glass");
    if (backBtn) backBtn.onclick = () => View.goToStep(1);
  },
};

window.Events = Events;
