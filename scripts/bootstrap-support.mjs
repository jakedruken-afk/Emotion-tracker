import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createInterface } from "node:readline/promises";
import { hash } from "bcryptjs";
import { loadProjectEnv } from "./lib/load-env.mjs";

loadProjectEnv();

const cwd = process.cwd();
const databasePath =
  process.env.DATABASE_PATH ?? path.resolve(cwd, "data", "emotion-tracker.db");
const minimumPasswordLength = 12;
const args = parseArgs(process.argv.slice(2));
const supportSeed = await getSupportSeed();

if (!supportSeed.username) {
  console.error("A username is required.");
  process.exit(1);
}

if (!supportSeed.password || supportSeed.password.length < minimumPasswordLength) {
  console.error(
    `A password is required and must be at least ${minimumPasswordLength} characters long.`,
  );
  process.exit(1);
}

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new DatabaseSync(databasePath);
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'patient',
    first_name TEXT,
    last_name TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const existingSupportCount = Number(
  (
    db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'support'").get() ?? {
      count: 0,
    }
  ).count ?? 0,
);

if (existingSupportCount > 0) {
  console.log(
    "A support account already exists in this database. Use the in-app invite flow for additional staff accounts.",
  );
  process.exit(0);
}

const existingUser = db
  .prepare("SELECT id FROM users WHERE username = ? LIMIT 1")
  .get(supportSeed.username);

if (existingUser) {
  console.error(`The username "${supportSeed.username}" is already in use.`);
  process.exit(1);
}

const passwordHash = await hash(supportSeed.password, 12);

db.prepare(`
  INSERT INTO users (username, password, role, first_name, last_name)
  VALUES (?, ?, 'support', ?, ?)
`).run(
  supportSeed.username,
  passwordHash,
  supportSeed.firstName || null,
  supportSeed.lastName || null,
);

console.log(`Support account created for ${supportSeed.username}.`);
console.log("Next steps:");
console.log("1. Start the app with production settings.");
console.log("2. Sign in with this support account.");
console.log("3. Use Manage Access to invite patients and additional staff.");

async function getSupportSeed() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return {
      username: args.username || (await rl.question("Support username: ")).trim(),
      password: args.password || (await rl.question("Support password: ")).trim(),
      firstName:
        args.firstName || (await rl.question("First name (optional): ")).trim(),
      lastName: args.lastName || (await rl.question("Last name (optional): ")).trim(),
    };
  } finally {
    rl.close();
  }
}

function parseArgs(argv) {
  const parsed = {
    username: "",
    password: "",
    firstName: "",
    lastName: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--username" && next) {
      parsed.username = next;
      index += 1;
      continue;
    }

    if (current === "--password" && next) {
      parsed.password = next;
      index += 1;
      continue;
    }

    if (current === "--first-name" && next) {
      parsed.firstName = next;
      index += 1;
      continue;
    }

    if (current === "--last-name" && next) {
      parsed.lastName = next;
      index += 1;
    }
  }

  return parsed;
}
