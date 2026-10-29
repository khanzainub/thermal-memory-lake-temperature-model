"use strict";
/* Basic Paper: tab switching and responsive framing only.
   Both independent scientific models retain their original fitting,
   validation, CSV upload and plot/export code. */
(() => {
  const byId = id => document.getElementById(id);
  const frames = [byId("frameMemory"), byId("frameBaseline")];
  function resize(frame) {
    try {
      const d = frame.contentDocument;
      if (d) frame.style.height = Math.max(520, d.documentElement.scrollHeight, d.body.scrollHeight) + "px";
    } catch (_) {}
  }
  function initialize(frame) {
    const ready = () => {
      try {
        const d = frame.contentDocument;
        if (!d || !d.body) return;
        const style = d.createElement("style");
        style.textContent = ".hero,.lake-data-panel,footer{display:none!important}.container{max-width:100%!important;padding-top:0!important}.page-shell{min-height:0!important}html,body{overflow-x:hidden!important}";
        d.head.append(style);
        const Resize = frame.contentWindow.ResizeObserver;
        if (Resize) new Resize(() => resize(frame)).observe(d.body);
      } catch (_) {}
      resize(frame);
    };
    frame.addEventListener("load", ready);
    if (frame.contentDocument?.readyState === "complete") ready();
  }
  frames.forEach(initialize);
  function activate(mode) {
    const memory = mode !== "baseline";
    byId("memoryPane").hidden = !memory;
    byId("baselinePane").hidden = memory;
    for (const [id, selected] of [["tabMemory", memory],["tabBaseline", !memory]]) {
      const tab = byId(id);
      tab.classList.toggle("cmp-active", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    byId("modeNote").textContent = memory
      ? "With Memory: upload your CSV below to calibrate, validate and run the thermal-response model."
      : "Baseline (M = 0): upload your CSV below to calibrate, validate and run the zero-memory model.";
    resize(memory ? frames[0] : frames[1]);
  }
  byId("tabMemory").addEventListener("click", () => activate("memory"));
  byId("tabBaseline").addEventListener("click", () => activate("baseline"));
  byId("tabMemory").addEventListener("keydown", e => {
    if (e.key === "ArrowRight") { e.preventDefault(); byId("tabBaseline").focus(); activate("baseline"); }
  });
  byId("tabBaseline").addEventListener("keydown", e => {
    if (e.key === "ArrowLeft") { e.preventDefault(); byId("tabMemory").focus(); activate("memory"); }
  });
  activate("memory");
})();