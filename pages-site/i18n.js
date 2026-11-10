(function () {
  var st = document.createElement("style");
  st.textContent = ".lang{display:inline-flex;gap:4px;margin-left:auto;margin-right:16px}.lang button{background:transparent;color:inherit;border:1px solid var(--border);border-radius:4px;padding:4px 8px;font:inherit;font-size:12px;cursor:pointer}.lang button[aria-pressed=true]{border-color:currentColor;font-weight:700}";
  document.head.appendChild(st);
  var pt = {
    "LOGS · DIAGNOSTICS · PRIVACY": "LOGS · DIAGNÓSTICO · PRIVACIDADE",
    "Example log": "Exemplo de log",
    "Three hours to turn your logs into a fix plan.": "Três horas para transformar seus logs em um plano de correção.",
    "Port already in use": "Porta já em uso",
    "Check the process before stopping the application.": "Verifique o processo antes de encerrar a aplicação.",
    "Start free trial →": "Iniciar teste grátis →",
    "3 free hours per GitHub account. After that, a sponsorship of any amount — monthly or one-time.": "3 horas grátis por conta GitHub. Depois, patrocínio de qualquer valor — mensal ou único.",
    "Open source ↗": "Código aberto ↗",
    "Open in new window ↗": "Abrir em nova janela ↗"
  };
  function apply(lang) {
    document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      el.textContent = lang === "pt" ? pt[key] || key : key;
    });
    document.querySelectorAll("[data-lang]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-lang") === lang));
    });
    try { localStorage.setItem("devrescue.language", lang); } catch (e) {}
  }
  var saved = null;
  try { saved = localStorage.getItem("devrescue.language"); } catch (e) {}
  document.querySelectorAll("[data-lang]").forEach(function (b) {
    b.addEventListener("click", function () { apply(b.getAttribute("data-lang")); });
  });
  apply(saved === "pt" ? "pt" : "en");
})();
