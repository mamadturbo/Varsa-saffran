import {
  createAdminSecurity,
  hasValidAdminToken,
  adminIdentity,
} from "../lib/admin-security";
import { StoreError } from "../lib/management-store";
import { securityLimit } from "../lib/security-limit";
import { normalizeIranMobile } from "@workspace/validation";
import { contentRouter } from "../modules/content/router";
import { db } from "@workspace/db";
import { createOrdersRouter } from "../lib/orders-router";
import { createManagementStore } from "../lib/management-store";
import { createManagementRouter } from "../lib/management-router";
import { Router } from "express";
import { paymentRoutes } from "../modules/payments/router";
import {
  createCustomerServices,
  createCustomerRouter,
} from "../lib/customer-router";

const store = createManagementStore(db);
const customers = createCustomerServices(db, store);
const router = Router();
const adminSecurity = createAdminSecurity(db);
export const beforeApiBody = Router();
beforeApiBody.use(adminSecurity.resolve);
const payments = paymentRoutes(db, customers);
beforeApiBody.use(payments.beforeBody);
// Authenticate and consume shared account/network quotas before allocating the
// multi-megabyte upload JSON body. Public CSRF tokens are not authentication.
beforeApiBody.post(
  ["/admin/media", "/customer/media"],
  async (req, _res, next) => {
    try {
      const isAdmin = hasValidAdminToken(req);
      if (
        req.path.toLowerCase().replace(/\/$/, "") === "/admin/media" &&
        !isAdmin
      )
        throw new StoreError("دسترسی مدیر لازم است.", 401);
      const identity = isAdmin
        ? "admin:" + adminIdentity(req)!.id
        : "customer:" + (await customers.auth.requireCustomer(req)).id;
      await securityLimit(db, req, "upload", identity, 30, 3600);
      next();
    } catch (error) {
      next(error);
    }
  },
);
router.use(adminSecurity.router, adminSecurity.auditMutation);
router.post("/orders", async (req, _res, next) => {
  try {
    await securityLimit(
      db,
      req,
      "checkout",
      normalizeIranMobile(req.body?.phone) ?? "invalid",
      15,
      3600,
    );
    next();
  } catch (error) {
    next(error);
  }
});
router.use(contentRouter(db, store));
const orders = createOrdersRouter(
  db,
  async () => (await store.publicState()).products.filter((p) => p.active),
  store,
  customers.identity,
);
router.use(createCustomerRouter(db, store, customers));
router.use(
  createManagementRouter(
    db,
    store,
    customers.onOrderChange,
    customers.afterChange,
  ),
);
router.use(orders);
router.use(payments.router);
export default router;
