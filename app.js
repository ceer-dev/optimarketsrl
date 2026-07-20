// Main Entry Point - Orchestrates initialization
document.addEventListener("DOMContentLoaded", () => {
  Controller.init();

  // Diagnostic check
  setTimeout(() => {
    if (typeof window.localMasterData === "undefined") {
      console.error(
        "DIAGNOSTIC: localMasterData is STILL undefined. The browser may be blocking the 2.8MB script load.",
      );
    } else {
      console.log(
        "DIAGNOSTIC: localMasterData found in window. Size: " +
          window.localMasterData.length +
          " items.",
      );
    }
  }, 2000);
});
