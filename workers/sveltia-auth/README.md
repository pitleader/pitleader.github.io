# Sveltia CMS Auth Proxy (Cloudflare Worker)

OAuth proxy for Sveltia CMS on GitHub Pages. Handles the server-side GitHub OAuth flow that static sites cannot perform.

Based on the [sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) reference implementation.

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- [Node.js](https://nodejs.org/) 18+
- A GitHub OAuth App

## Deployment Steps

### 1. Register a GitHub OAuth App

1. Go to <https://github.com/settings/developers>
2. Click **New OAuth App**
3. Fill in:
   - **Application name:** `Peoria IT Leaders CMS`
   - **Homepage URL:** `https://www.peoriait.com`
   - **Authorization callback URL:** `https://sveltia-cms-auth.<your-subdomain>.workers.dev/callback`
4. Click **Register application**
5. Copy the **Client ID**
6. Generate and copy a **Client Secret**

### 2. Install Dependencies and Deploy

```bash
cd workers/sveltia-auth
npm install
npx wrangler login    # authenticate with Cloudflare (first time only)
npx wrangler deploy
```

### 3. Set Secrets

```bash
npx wrangler secret put GITHUB_CLIENT_ID
# Paste your GitHub OAuth App Client ID when prompted

npx wrangler secret put GITHUB_CLIENT_SECRET
# Paste your GitHub OAuth App Client Secret when prompted
```

### 4. Update CMS Configuration

Edit `static/admin/config.yml` and replace the `base_url` placeholder:

```yaml
backend:
  name: github
  repo: pitleader/pitleader.github.io
  branch: main
  base_url: https://sveltia-cms-auth.<your-subdomain>.workers.dev
```

### 5. Verify

Visit your Worker URL in a browser (e.g., `https://sveltia-cms-auth.<your-subdomain>.workers.dev/`). You should see:

> Sveltia CMS Auth Proxy is running.

Then visit your site's `/admin/` page and test the login flow.

## Routes

| Path | Description |
|------|-------------|
| `/` | Health check |
| `/auth` | Initiates OAuth flow (redirects to GitHub) |
| `/callback` | Handles OAuth callback (exchanges code for token) |

## Environment Variables

| Variable | Set via | Description |
|----------|---------|-------------|
| `GITHUB_CLIENT_ID` | `wrangler secret put` | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | `wrangler secret put` | GitHub OAuth App client secret |
| `ALLOWED_DOMAINS` | `wrangler.toml` [vars] | Comma-separated allowed CMS domains |
