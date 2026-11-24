import { readFile } from "node:fs/promises";
import type { Plugin } from "vite";
import type { storefrontHandler } from "./src/entry-server";
import { storefrontHeaders } from "./security-policy";

export function storefrontPlugin(apiOrigin: string): Plugin {
  return {
    name: "varsa-storefront",
    configureServer(server) {
      const createHandler = async () => {
        const { storefrontHandler: create } = (await server.ssrLoadModule(
          "/src/entry-server.tsx",
        )) as { storefrontHandler: typeof storefrontHandler };
        return create({
          apiOrigin,
          template: async (target) =>
            server.transformIndexHtml(
              target,
              await readFile(new URL("./index.html", import.meta.url), "utf8"),
            ),
          report: (error) => server.config.logger.error(String(error)),
        });
      };
      let ready: ReturnType<typeof createHandler> | undefined;
      server.watcher.on("change", () => {
        ready = undefined;
      });
      server.middlewares.use(async (req, res, next) => {
        if (
          !req.url ||
          /^\/(?:api(?:\/|$)|@|__|node_modules\/|src\/)/.test(req.url)
        )
          return next();
        try {
          ready ??= createHandler();
          await (
            await ready
          )(req, res, next);
        } catch (error) {
          ready = undefined;
          next(error);
        }
      });
    },
    async configurePreviewServer(server) {
      const entry = new URL("./dist/server/entry-server.js", import.meta.url);
      const { storefrontHandler: create } = (await import(entry.href)) as {
        storefrontHandler: typeof storefrontHandler;
      };
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
      const handle = create({
        apiOrigin,
        template: async () => html,
        manifest,
        headers: storefrontHeaders,
      });
      server.middlewares.use((req, res, next) => {
        void handle(req, res, next).catch(next);
      });
    },
  };
}
