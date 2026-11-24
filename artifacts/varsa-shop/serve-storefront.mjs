import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { storefrontHandler } from "./dist/server/entry-server.js";

const port = Number(process.env.STOREFRONT_PORT ?? "5174");
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid STOREFRONT_PORT");
const html = await readFile(
  new URL("./dist/public/index.html", import.meta.url),
  "utf8",
);
const manifest = JSON.parse(
  await readFile(
    new URL("./dist/public/.vite/manifest.json", import.meta.url),
    "utf8",
  ),
);
const handler = storefrontHandler({
  siteUrl: process.env.SEO_SITE_URL,
  indexable:
    process.env.NODE_ENV === "production" && process.env.SEO_INDEXING === "1",
  apiOrigin: process.env.STOREFRONT_API_ORIGIN ?? "http://127.0.0.1:5000",
  template: async () => html,
  manifest,
  report: (error) => console.error("Storefront rendering failed:", error.name),
});

const server = createServer(
  { requestTimeout: 15_000, headersTimeout: 10_000 },
  (req, res) => {
    void handler(req, res, () => {
      res.writeHead(404, {
        "X-Robots-Tag": "noindex",
        "Content-Type": "text/plain; charset=utf-8",
      });
      res.end("صفحه پیدا نشد.");
    }).catch(() => {
      if (!res.headersSent) res.writeHead(400, { "X-Robots-Tag": "noindex" });
      res.end();
    });
  },
);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.close());
}
server.listen(port, "127.0.0.1", () =>
  console.info(`Storefront listening on 127.0.0.1:${port}`),
);
