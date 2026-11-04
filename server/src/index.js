import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { auth } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import ingredientRoutes from "./routes/ingredients.js";
import purchaseRoutes from "./routes/purchases.js";
import consumptionRoutes from "./routes/consumption.js";
import wasteRoutes from "./routes/waste.js";
import alertRoutes from "./routes/alerts.js";
import dashboardRoutes from "./routes/dashboard.js";
import reportRoutes from "./routes/reports.js";
import forecastRoutes from "./routes/forecast.js";
import demoRoutes from "./routes/demo.js";

export function createApp() {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: (process.env.CLIENT_ORIGIN || "http://localhost:5173").split(","),
    }),
  );
  app.use(express.json({ limit: "200kb" }));
  if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

  app.get("/api/health", (_req, res) =>
    res.json({ ok: true, db: mongoose.connection.readyState === 1 }),
  );
  app.use(
    "/api/auth",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 100,
      standardHeaders: true,
      legacyHeaders: false,
    }),
    authRoutes,
  );
  app.use("/api/ingredients", auth, ingredientRoutes);
  app.use("/api/purchases", auth, purchaseRoutes);
  app.use("/api/consumption", auth, consumptionRoutes);
  app.use("/api/waste", auth, wasteRoutes);
  app.use("/api/alerts", auth, alertRoutes);
  app.use("/api/dashboard", auth, dashboardRoutes);
  app.use("/api/reports", auth, reportRoutes);
  app.use("/api/forecast", auth, forecastRoutes);
  app.use("/api/demo", auth, demoRoutes);
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

  // Serve the built React app when present (single-process deployment)
  const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../client/dist",
  );
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.name === "CastError")
      return res.status(400).json({ error: "Invalid id." });
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res
      .status(status)
      .json({
        error:
          status >= 500 ? "Something went wrong on the server." : err.message,
        ...(err.extra || {}),
      });
  });
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is missing. Copy .env.example to .env first.");
    process.exit(1);
  }
  const port = process.env.PORT || 8080;
  mongoose
    .connect(
      process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/smart_kitchen",
    )
    .then(() =>
      createApp().listen(port, () =>
        console.log(`Smart Kitchen API running on http://localhost:${port}`),
      ),
    )
    .catch((e) => {
      console.error("Could not connect to MongoDB:", e.message);
      process.exit(1);
    });
}
