/**
 * Sveltia CMS OAuth Proxy for Cloudflare Workers
 *
 * Handles the GitHub OAuth flow required by Sveltia CMS.
 * Based on the sveltia-cms-auth reference implementation:
 * https://github.com/sveltia/sveltia-cms-auth
 *
 * Environment variables (set via `wrangler secret put`):
 *   GITHUB_CLIENT_ID     — GitHub OAuth App client ID
 *   GITHUB_CLIENT_SECRET — GitHub OAuth App client secret
 *
 * Config variables (set in wrangler.toml [vars]):
 *   ALLOWED_DOMAINS — comma-separated list of allowed CMS domains
 */

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

/**
 * Escape special regex characters in a string.
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Return an HTML page that posts a message back to the CMS window opener.
 */
function outputHTML({ provider, token, error }) {
  const content = error
    ? `authorization:${provider}:error:${JSON.stringify(error)}`
    : `authorization:${provider}:success:${JSON.stringify({ token, provider })}`;

  return new Response(
    `<!doctype html>
<html>
<head><title>OAuth Redirect</title></head>
<body>
<script>
(function() {
  function sendMessage(message) {
    var target = window.opener || window.parent;
    target.postMessage(message, "*");
  }
  sendMessage("${content}");
  window.close();
})();
</script>
</body>
</html>`,
    { headers: { 'Content-Type': 'text/html;charset=UTF-8' } },
  );
}

/**
 * Validate that the request origin is in the allowed domains list.
 */
function isAllowedDomain(origin, allowedDomains) {
  if (!allowedDomains) return true;

  const domains = allowedDomains.split(',').map((d) => d.trim());

  for (const domain of domains) {
    const pattern = domain.includes('*')
      ? new RegExp(`^https?://${escapeRegExp(domain).replace('\\*', '.*')}$`)
      : new RegExp(`^https?://${escapeRegExp(domain)}$`);

    if (pattern.test(origin)) return true;
  }

  return false;
}

/**
 * Handle the initial auth request — redirect to GitHub OAuth.
 */
function handleAuth(request, env) {
  const url = new URL(request.url);
  const provider = url.searchParams.get('provider') || 'github';
  const siteId = url.searchParams.get('site_id') || '';
  const scope = url.searchParams.get('scope') || 'repo,user';
  const origin = url.searchParams.get('origin') || url.searchParams.get('site_id') || '';

  if (!env.GITHUB_CLIENT_ID) {
    return new Response('GITHUB_CLIENT_ID is not configured', { status: 500 });
  }

  if (origin && !isAllowedDomain(origin, env.ALLOWED_DOMAINS)) {
    return new Response('Domain not allowed', { status: 403 });
  }

  const state = JSON.stringify({ provider, siteId, origin });
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: `${url.origin}/callback`,
    scope,
    state: btoa(state),
  });

  return Response.redirect(`${GITHUB_AUTH_URL}?${params}`, 302);
}

/**
 * Handle the OAuth callback — exchange code for token.
 */
async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');

  let state;
  try {
    state = JSON.parse(atob(stateParam));
  } catch {
    return outputHTML({ provider: 'github', error: 'Invalid state parameter' });
  }

  const { provider = 'github' } = state;

  if (!code) {
    return outputHTML({ provider, error: 'Missing authorization code' });
  }

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return outputHTML({ provider, error: 'OAuth credentials not configured' });
  }

  try {
    const response = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return outputHTML({ provider, error: data.error_description || data.error });
    }

    return outputHTML({ provider, token: data.access_token });
  } catch (err) {
    return outputHTML({ provider, error: `Token exchange failed: ${err.message}` });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === '/auth' || pathname === '/oauth/authorize') {
      return handleAuth(request, env);
    }

    if (pathname === '/callback' || pathname === '/oauth/redirect') {
      return handleCallback(request, env);
    }

    if (pathname === '/') {
      return new Response('Sveltia CMS Auth Proxy is running.', {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};
