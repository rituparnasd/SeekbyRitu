(() => {
  function mount(root = document) {
    root.querySelectorAll('input[type="date"]').forEach((input) => {
      if (input.dataset.calendarReady) return;
      input.dataset.calendarReady = "true";
      const wrap = document.createElement("div");
      wrap.className = "date-picker-field";
      input.before(wrap);
      wrap.append(input);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "date-picker-button";
      const label = input.labels?.[0]?.textContent || input.name || "Date";
      button.textContent = "Calendar";
      button.setAttribute("aria-label", "Choose " + label + " from calendar");
      const open = () => {
        if (input.disabled || input.readOnly) return;
        try {
          if (input.showPicker) input.showPicker();
          else input.focus();
        } catch {
          input.focus();
        }
      };
      button.addEventListener("click", open);
      input.addEventListener("click", () => {
        try {
          input.showPicker?.();
        } catch {}
      });
      wrap.append(button);
    });
  }
  globalThis.dateFields = { mount };
})();
