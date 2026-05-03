import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth.routes.js";
import mangaRoutes from "./routes/manga.routes.js";
import chapterRoutes from "./routes/chapter.routes.js";
import progressRoutes from "./routes/progress.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import bulkUploadRoutes from "./routes/bulkUpload.routes.js";
import translationRoutes from "./routes/translation.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import recommendationRoutes from "./routes/recommendation.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import socialRoutes from "./routes/social.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import { graphqlExpressMiddleware } from "./graphql/graphqlServer.js";
import * as pay from "./controllers/payment.controller.js";
import { notFoundHandler, errorHandler } from "./middleware/error.middleware.js";
import { localStaticMountPath } from "./services/upload.service.js";

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true,
  })
);
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.post("/api/payment/webhook", express.raw({ type: "application/json" }), (req, res, next) => {
  req.rawBody = req.body;
  pay.webhook(req, res, next);
});

app.use(express.json({ limit: "12mb" }));
app.use("/uploads", express.static(localStaticMountPath()));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/manga", mangaRoutes);
app.use("/api/chapters", chapterRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/bulk-upload", bulkUploadRoutes);
app.use("/api/translate", translationRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/social", socialRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/graphql", graphqlExpressMiddleware());

app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
