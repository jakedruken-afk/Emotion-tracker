import fs from "node:fs";
import path from "node:path";
import { loadProjectEnv } from "./lib/load-env.mjs";

loadProjectEnv();

const cwd = process.cwd();
const defaultDatabasePath =
  process.env.DATABASE_PATH ?? path.resolve(cwd, "data", "emotion-tracker.db");
const backupDir = process.env.BACKUP_DIR ?? path.resolve(cwd, "backups");
const sourceArg = process.argv[2];
const targetArg = process.argv[3];
const databasePath = targetArg
  ? path.resolve(cwd, targetArg)
  : process.env.TARGET_DATABASE_PATH ?? defaultDatabasePath;

if (!sourceArg) {
  console.error("Usage: npm run restore -- <path-to-backup-db>");
  process.exit(1);
}

const sourcePath = path.resolve(cwd, sourceArg);
if (!fs.existsSync(sourcePath)) {
  console.error(`Backup file was not found at ${sourcePath}`);
  process.exit(1);
}

try {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  fs.mkdirSync(backupDir, { recursive: true });

  if (fs.existsSync(databasePath)) {
    const safetyStamp = new Date()
      .toISOString()
      .replace(/[:]/g, "")
      .replace("T", "-")
      .slice(0, 15);
    const safetyPath = path.join(backupDir, `pre-restore-${safetyStamp}.db`);
    fs.copyFileSync(databasePath, safetyPath);

    for (const suffix of ["-wal", "-shm"]) {
      const currentSidecar = `${databasePath}${suffix}`;
      if (fs.existsSync(currentSidecar)) {
        fs.copyFileSync(currentSidecar, `${safetyPath}${suffix}`);
      }
    }
  }

  fs.copyFileSync(sourcePath, databasePath);

  for (const suffix of ["-wal", "-shm"]) {
    const sourceSidecar = `${sourcePath}${suffix}`;
    const targetSidecar = `${databasePath}${suffix}`;

    fs.rmSync(targetSidecar, { force: true });

    if (fs.existsSync(sourceSidecar)) {
      fs.copyFileSync(sourceSidecar, targetSidecar);
    }
  }

  console.log(`Database restored from ${sourcePath} to ${databasePath}`);
} catch (error) {
  if (error && typeof error === "object" && "code" in error && error.code === "EPERM") {
    console.error(
      "Restore failed because the database files are in use. Stop the running app first, then try the restore again.",
    );
    process.exit(1);
  }

  throw error;
}
