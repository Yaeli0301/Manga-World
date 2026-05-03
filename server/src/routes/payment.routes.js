import { Router } from "express";
import * as pay from "../controllers/payment.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const r = Router();

r.get("/health", pay.stripeHealth);
r.get("/subscription", authMiddleware, pay.subscriptionSummary);
r.post("/checkout", authMiddleware, pay.createCheckout);
r.post("/portal", authMiddleware, pay.portal);
r.post("/mock-subscribe", authMiddleware, pay.mockSubscribe);

export default r;
