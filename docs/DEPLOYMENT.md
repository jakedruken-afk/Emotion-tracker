# L.A.M.B Deployment Guide

This guide covers the GitHub-driven deployment flow included in this repository.

## What The Repo Supports

- `CI` workflow for typecheck + build on every push and pull request
- `Release` workflow for GitHub release assets built from tagged versions
- `Deploy` workflow for pushing a built bundle from GitHub Actions to a live Linux server
- `Server Backup` workflow for triggering a remote database backup and downloading it as a GitHub Actions artifact

## Recommended Live Pilot Stack

- Ubuntu 24.04 LTS or another modern Linux server
- Node.js `22+`
- `pm2` for process supervision
- `caddy` for HTTPS and reverse proxy
- A private server path such as `/srv/lamb-pilot`

## One-Time Server Setup

Install Node.js 22+, PM2, and Caddy on the server.

Example PM2 install:

```bash
npm install -g pm2
```

Create the base app folders:

```bash
sudo mkdir -p /srv/lamb-pilot/shared/data
sudo mkdir -p /srv/lamb-pilot/shared/backups
sudo chown -R "$USER":"$USER" /srv/lamb-pilot
```

Create the production environment file:

```bash
cp /srv/lamb-pilot/current/.env.example /srv/lamb-pilot/shared/.env
```

If `/srv/lamb-pilot/current` does not exist yet, let the first deploy create it, then copy from the example file in the new release.

## Production Environment File

Set at least these values in `/srv/lamb-pilot/shared/.env`:

```dotenv
NODE_ENV=production
LAMB_PRODUCTION_MODE=true
PORT=3001
APP_BASE_URL=https://your-domain.example
SESSION_SECRET=replace-with-a-long-random-secret
DATABASE_PATH=/srv/lamb-pilot/shared/data/emotion-tracker.db
BACKUP_DIR=/srv/lamb-pilot/shared/backups
ENABLE_DEMO_SEED=false
TRUST_PROXY=true
```

## GitHub Secrets For Deployments

Create a GitHub `production` environment or whichever environment name you want to use, then add these secrets:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PATH`
- `DEPLOY_PORT` (optional, defaults to `22`)

Recommended `DEPLOY_PATH`:

```text
/srv/lamb-pilot
```

## How Deployments Work

The `Deploy` workflow:

1. Checks out the selected Git ref
2. Runs `npm ci`
3. Runs `npm run check`
4. Runs `npm run build`
5. Creates a release bundle with `scripts/create-release-bundle.mjs`
6. Uploads that bundle to the server over SSH
7. Runs `deploy/apply-release.sh` on the server
8. Installs production dependencies
9. Reloads the app with PM2

## First Live Sign-In

After the first live deployment, create the first support account on the server:

```bash
cd /srv/lamb-pilot/current
npm run bootstrap:support -- --username pilot-support --first-name Pilot --last-name Lead
```

Then sign in and use `Manage Access` to invite patients and additional staff.

## Caddy

A sample reverse-proxy config is included at [`deploy/Caddyfile.example`](../deploy/Caddyfile.example).

Typical live flow:

- Caddy terminates HTTPS
- Caddy reverse-proxies to `127.0.0.1:3001`
- PM2 keeps the Node app running

## Releases

To create a GitHub release bundle:

1. Push a tag like `v0.1.0`
2. Let the `Release` workflow build the bundle
3. Download the generated `.tar.gz` from the GitHub release page if you want an offline deployment artifact

You can also create a bundle locally:

```powershell
npm run release:bundle -- v0.1.0
```

## Backups

### Local

```powershell
npm run backup
```

### Live Server From GitHub

Use the `Server Backup` workflow. It will:

1. SSH into the live server
2. Run `npm run backup` from the current release
3. Copy the newest backup file back into the GitHub Actions run
4. Upload the backup as a downloadable workflow artifact

## Restore

On the server:

```bash
cd /srv/lamb-pilot/current
npm run restore -- /srv/lamb-pilot/shared/backups/emotion-tracker-YYYYMMDD-HHMMSS.db
```

Stop or reload the app carefully during a restore so the SQLite files are not being written at the same time.
