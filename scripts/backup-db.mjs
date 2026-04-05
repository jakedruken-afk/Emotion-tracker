import fs from "node:fs";
import path from "node:path";
import { loadProjectEnv } from "./lib/load-env.mjs";

loadProjectEnv();

const cwd = process.cwd();
const databasePath =
  process.env.DATABASE_PATH ?? path.resolve(cwd, "data", "emotion-tracker.db");
const backupDir = process.env.BACKUP_DIR ?? path.resolve(cwd, "backups");

if (!fs.existsSync(databasePath)) {
  console.error(`Database file was not found at ${databasePath}`);
  process.exit(1);
}

fs.mkdirSync(backupDir, { recursive: true });

const timestamp = new Date()
  .toISOString()
  .replace(/[:]/g, "")
  .replace("T", "-")
  .slice(0, 15);

const backupBasePath = path.join(backupDir, `emotion-tracker-${timestamp}.db`);

fs.copyFileSync(databasePath, backupBasePath);

for (const suffix of ["-wal", "-shm"]) {
  const sourcePath = `${databasePath}${suffix}`;
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, `${backupBasePath}${suffix}`);
  }
}

console.log(`Database backup created at ${backupBasePath}`);
