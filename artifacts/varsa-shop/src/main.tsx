import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
import { initialViews } from "./browser-pages";
import type { StorefrontBootstrap } from "./lib/page-context";
import { configureMeasurement } from "./lib/analytics";
import "./index.css";

try {
  sessionStorage.removeItem("varsa_admin_token_v1");
} catch {
  /* storage disabled */
}

const root = document.getElementById("root")!;
const payload = document.getElementById("varsa-page-data");
const initial = payload?.textContent
  ? (JSON.parse(payload.textContent) as StorefrontBootstrap)
  : undefined;
configureMeasurement(
  initial?.config.siteUrl,
  initial?.config.indexable === true,
);
void initialViews(initial?.page)
  .then((views) => {
    const app = (
      <StrictMode>
        <App
          views={views}
          initial={initial}
          target={initial ? location.pathname + location.search : undefined}
        />
      </StrictMode>
    );
    if (root.firstElementChild && initial) hydrateRoot(root, app);
    else createRoot(root).render(app);
  })
  .catch((error) => {
    console.error("Storefront initialization failed.", error);
  });
