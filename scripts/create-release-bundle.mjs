import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cwd = process.cwd();
const rawVersion =
  process.argv[2] ??
  process.env.RELEASE_VERSION ??
  new Date().toISOString().replace(/[:]/g, "").replace("T", "-").slice(0, 15);
const version = rawVersion.replace(/[^A-Za-z0-9._-]+/g, "-");
const bundleName = `lamb-pilot-${version}`;
const releaseRoot = path.resolve(cwd, "tmp", "release-bundles");
const bundleDir = path.join(releaseRoot, bundleName);
const archivePath = path.join(releaseRoot, `${bundleName}.tar.gz`);

const entriesToInclude = [
  "dist",
  "deploy",
  "scripts",
  "package.json",
  "package-lock.json",
  "README.md",
  ".env.example",
  "ecosystem.config.cjs",
];

fs.mkdirSync(releaseRoot, { recursive: true });
fs.rmSync(bundleDir, { recursive: true, force: true });
fs.rmSync(archivePath, { force: true });
fs.mkdirSync(bundleDir, { recursive: true });

for (const entry of entriesToInclude) {
  const sourcePath = path.resolve(cwd, entry);
  if (!fs.existsSync(sourcePath)) {
    continue;
  }

  const targetPath = path.join(bundleDir, entry);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.cpSync(sourcePath, targetPath, { recursive: true });
}

const tarArgs = ["-czf", archivePath, "-C", releaseRoot, bundleName];
const tarCommand = process.platform === "win32" ? "tar.exe" : "tar";
const tarResult = spawnSync(tarCommand, tarArgs, {
  cwd,
  stdio: "inherit",
});

if (tarResult.status !== 0) {
  process.exit(tarResult.status ?? 1);
}

console.log(`Release bundle created at ${archivePath}`);
console.log(`Release directory prepared at ${bundleDir}`);
