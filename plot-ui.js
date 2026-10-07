/* Presentation and plot exports only. No model state is read or changed. */
(() => {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const charts = ["chart", "validationTimeChart", "validationScatterChart", "applicationChart"];
  const filenames = ["historical-reconstruction", "validation-time-series", "validation-observed-predicted", "reconstruction-prediction"];
  const svgNode = (tag, attributes = {}, text) => {
    const node = document.createElementNS(NS, tag);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function exportSVG(container) {
    const source = container.querySelector("svg");
    if (!source) throw new Error("Run the model to generate this plot first.");
    const card = container.closest(".chart-card");
    const plot = source.cloneNode(true);
    const { width, height } = source.viewBox.baseVal;
    const legends = [...card.querySelectorAll(".chart-legend span")];
    const header = 90 + legends.length * 25;
    const output = svgNode("svg", {
      xmlns: NS, width, height: height + header + 32,
      viewBox: `0 0 ${width} ${height + header + 32}`, role: "img"
    });
    const title = card.querySelector("h3").textContent.trim();
    output.append(svgNode("title", {}, title));
    output.append(svgNode("rect", {width: "100%", height: "100%", fill: "#ffffff"}));
    output.append(svgNode("text", {x: 24, y: 28, fill: "#52666c", "font-family": "Arial, sans-serif", "font-size": 11, "letter-spacing": 1.5}, "LAKE THERMAL MEMORY"));
    output.append(svgNode("text", {x: 24, y: 57, fill: "#142f3e", "font-family": "Arial, sans-serif", "font-size": 19, "font-weight": 700}, title));
    legends.forEach((legend, index) => {
      const marker = legend.querySelector("i");
      const color = getComputedStyle(marker).backgroundColor;
      const y = 83 + index * 25;
      output.append(marker.classList.contains("legend-dot")
        ? svgNode("circle", {cx: 34, cy: y - 4, r: 4, fill: color})
        : svgNode("line", {x1: 24, x2: 44, y1: y - 4, y2: y - 4, stroke: color, "stroke-width": 3}));
      output.append(svgNode("text", {x: 53, y, fill: "#43575f", "font-family": "Arial, sans-serif", "font-size": 13}, legend.textContent.trim()));
    });
    // Embed the computed presentation so exports do not depend on this page's CSS.
    const properties = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "opacity", "font-family", "font-size", "font-weight", "text-anchor"];
    const originals = [source, ...source.querySelectorAll("*")];
    const copies = [plot, ...plot.querySelectorAll("*")];
    originals.forEach((node, index) => {
      const style = getComputedStyle(node);
      properties.forEach(property => {
        const value = style.getPropertyValue(property);
        // Keep local gradient references rather than browser-resolved page URLs.
        if (!value.includes("url(")) copies[index].style.setProperty(property, value);
      });
    });
    plot.querySelectorAll('[id*="Crosshair"], [id*="HoverPoint"]').forEach(node => node.remove());
    plot.removeAttribute("aria-hidden");
    plot.setAttribute("x", 0);
    plot.setAttribute("y", header);
    plot.setAttribute("width", width);
    plot.setAttribute("height", height);
    output.append(plot);
    output.append(svgNode("text", {x: 24, y: height + header + 22, fill: "#52666c", "font-family": "Arial, sans-serif", "font-size": 11}, "Lake Surface Temperature · Thermal-memory model"));
    return { blob: new Blob([new XMLSerializer().serializeToString(output)], {type: "image/svg+xml;charset=utf-8"}), width, height: height + header + 32 };
  }

  async function toPNG(exported) {
    const url = URL.createObjectURL(exported.blob);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("PNG could not be rendered. Please download SVG instead."));
        image.src = url;
      });
      const canvas = document.createElement("canvas");
      const scale = 3;
      canvas.width = exported.width * scale;
      canvas.height = exported.height * scale;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("PNG is unavailable in this browser. Please download SVG.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG export failed. Please download SVG.")), "image/png"));
    } finally { URL.revokeObjectURL(url); }
  }

  charts.forEach((id, index) => {
    const container = document.getElementById(id);
    if (!container) return;
    const card = container.closest(".chart-card");
    const toolbar = document.createElement("div");
    toolbar.className = "plot-toolbar";
    const hint = document.createElement("span");
    hint.className = "plot-hint";
    hint.textContent = "Export figure";
    toolbar.append(hint);
    const status = document.createElement("span");
    status.className = "plot-export-status";
    status.setAttribute("role", "status");
    const buttons = ["png", "svg"].map(format => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button--ghost plot-download";
      button.textContent = format === "png" ? "Download PNG" : "Download SVG";
      button.title = format === "png" ? "High-resolution image (3×)" : "Scalable vector figure";
      button.setAttribute("aria-label", `${button.textContent}: ${card.querySelector("h3").textContent}`);
      button.disabled = true;
      button.addEventListener("click", async () => {
        button.disabled = true;
        status.textContent = "Preparing figure…";
        try {
          const exported = exportSVG(container);
          const blob = format === "svg" ? exported.blob : await toPNG(exported);
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `lake-thermal-memory-${filenames[index]}.${format}`;
          document.body.append(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          status.textContent = `${format.toUpperCase()} download ready.`;
        } catch (error) { status.textContent = error.message; }
        finally { button.disabled = !container.querySelector("svg"); }
      });
      toolbar.append(button);
      return button;
    });
    toolbar.append(status);
    card.append(toolbar);
    container.tabIndex = 0;
    const refresh = () => {
      buttons.forEach(button => { button.disabled = !container.querySelector("svg"); });
      status.textContent = "";
    };
    new MutationObserver(refresh).observe(container, { childList: true });
    refresh();
  });
})();
