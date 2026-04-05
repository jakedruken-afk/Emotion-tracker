import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSessionUser } from "./auth";
import { trustProxy } from "./config";
import { initializeDatabase } from "./db";
import { registerRoutes } from "./routes";

const app = express();
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const isProductionBundle = path.basename(path.dirname(currentDir)) === "dist";

if (trustProxy) {
  app.set("trust proxy", 1);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(loadSessionUser);

app.use((req, _res, next) => {
  const startedAt = Date.now();

  _res.on("finish", () => {
    const duration = Date.now() - startedAt;
    if (req.path.startsWith("/api")) {
      console.log(`${req.method} ${req.path} ${_res.statusCode} ${duration}ms`);
    }
  });

  next();
});

registerRoutes(app);

if (isProductionBundle) {
  const clientDist = path.resolve(currentDir, "..", "client");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

const port = Number(process.env.PORT ?? 3001);

initializeDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Emotion Tracker API listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize the database", error);
    process.exit(1);
  });
