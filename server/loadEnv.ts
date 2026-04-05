import fs from "node:fs";
import path from "node:path";

const ENV_FILENAMES = [".env", ".env.local"];

export function loadProjectEnv(cwd = process.cwd()) {
  for (const filename of ENV_FILENAMES) {
    const filePath = path.resolve(cwd, filename);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const fileContents = fs.readFileSync(filePath, "utf8");
    for (const rawLine of fileContents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const normalizedLine = line.startsWith("export ")
        ? line.slice("export ".length)
        : line;
      const separatorIndex = normalizedLine.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      const key = normalizedLine.slice(0, separatorIndex).trim();
      if (!key || process.env[key] != null) {
        continue;
      }

      let value = normalizedLine.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  }
}
