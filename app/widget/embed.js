(() => {
  function mount() {
    const script = document.currentScript;
    if (!script) return;

    const parent = document.getElementById("dialogue-widget") || script.parentElement;
    const agentId = script.dataset.agentId || "";
    const region = script.dataset.region || "gb";
    const auth = script.dataset.auth || "signed";
    const theme = script.dataset.theme || "light";
    const height = parseInt(script.dataset.height || "120", 10);

    if (!agentId) {
      console.error("[dialogue] Missing data-agent-id");
      return;
    }

    const url = new URL("https://YOUR-DOMAIN.com/widget");
    url.searchParams.set("agentId", agentId);
    url.searchParams.set("region", region);
    url.searchParams.set("auth", auth);
    url.searchParams.set("theme", theme);

    const iframe = document.createElement("iframe");
    iframe.src = url.toString();
    iframe.allow = "microphone";
    iframe.style.width = "100%";
    iframe.style.height = `${height}px`;
    iframe.style.border = "0";
    iframe.style.borderRadius = "20px";
    iframe.style.boxShadow = "0 4px 16px rgba(0,0,0,.05)";
    iframe.setAttribute("title", "Dialogue voice assistant");

    parent?.appendChild(iframe);

    // Optional: listen for height updates from inside the iframe for full responsiveness
    window.addEventListener("message", (ev) => {
      if (!ev?.data || typeof ev.data !== "object") return;
      if (ev.data.type === "dialogue:resize" && typeof ev.data.height === "number") {
        iframe.style.height = `${ev.data.height}px`;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();