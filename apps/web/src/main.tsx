import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";
// OAuth codes return in a fragment: never send them to the static host or referrers.
if (location.hash.startsWith("#/oauth-return?")) {
  const params = new URLSearchParams(location.hash.split("?")[1]);
  const code = params.get("code"),
    nonce = params.get("nonce");
  history.replaceState(null, "", location.pathname);
  if (window.opener) {
    window.opener.postMessage(
      { type: "devrescue-github-complete", code, nonce, success: !!code && !!nonce },
      location.origin,
    );
    window.close();
  }
  document.getElementById("root")!.textContent =
    "GitHub authorization returned. You may close this window.";
} else {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <RouterProvider router={getRouter()} />
    </React.StrictMode>,
  );
}
