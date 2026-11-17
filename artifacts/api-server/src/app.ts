import helmet from "helmet";
import {
  allowedOrigins,
  issueCsrf,
  protectMutations,
  validateProductionConfig,
} from "./lib/http-security";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { beforeApiBody } from "./routes/orders";
import { logger } from "./lib/logger";
import { trustedProxyAddresses } from "./lib/admin-login-limit";
import { StoreError } from "./lib/management-store";

validateProductionConfig();
const app: Express = express();
app.disable("x-powered-by");
app.use(
  helmet({
    strictTransportSecurity: false,
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
  }),
);
app.set("trust proxy", trustedProxyAddresses(process.env.TRUSTED_PROXY_IPS));

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: allowedOrigins(), credentials: true }));
app.get("/api/csrf", issueCsrf);
app.use("/api", protectMutations, beforeApiBody);
app.use((req, res, next) =>
  express.json({
    inflate: false,
    limit: /^\/api\/(admin|customer)\/media$/.test(req.path) || /^\/api\/orders\/\d+\/payment\/receipt\/?$/.test(req.path) ? "6mb" : "128kb",
  })(req, res, next),
);

app.use("/api", router);
app.use((_req, res) => {
  res.status(404).json({ message: "مسیر پیدا نشد." });
});
app.use(
  (
    error: unknown,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error instanceof StoreError) {
      if (error.status === 429) res.set("Retry-After", "900");
      res.status(error.status).json({ message: error.message });
      return;
    }
    // Request bodies, OTPs, SQL parameters and provider responses are never logged.
    req.log?.error({ code: "request_failed" }, "Request failed");
    const status = (error as { status?: number })?.status;
    res
      .status(
        status === 413
          ? 413
          : status === 400
            ? 400
            : status === 415
              ? 415
              : 503,
      )
      .json({
        message:
          status === 413
            ? "حجم درخواست بیش از حد مجاز است."
            : "درخواست انجام نشد؛ دوباره تلاش کنید.",
      });
  },
);

export default app;
