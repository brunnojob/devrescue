import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/github/return")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code") ?? "";
        const nonce = url.searchParams.get("nonce") ?? "";
        const success =
          url.searchParams.get("success") === "true" &&
          url.searchParams.get("connector_id") === "github" &&
          code.length > 0 &&
          code.length <= 4096 &&
          nonce.length <= 100;
        const message = JSON.stringify({
          type: "devrescue-github-complete",
          code: success ? code : null,
          nonce,
          success,
        }).replace(/</g, "\\u003c");
        // The opener verifies source, origin and nonce; only its authenticated request exchanges the code.
        return new Response(
          `<!doctype html><html><head><title>GitHub — DevRescue</title></head><body><p>Returning to DevRescue…</p><script>history.replaceState(null,"",location.pathname);if(window.opener){window.opener.postMessage(${message},location.origin);}window.close();</script></body></html>`,
          {
            headers: {
              "content-type": "text/html; charset=utf-8",
              "cache-control": "no-store",
              "referrer-policy": "no-referrer",
              "x-content-type-options": "nosniff",
            },
          },
        );
      },
    },
  },
});
