# Memory MCP server — Railway deployment

This package runs `mcp.php` with PHP 8.3, Apache, cURL, and mbstring. It uses Supabase PostgREST for storage. No credentials are included in this package.

## Deploy

1. Upload these files to a new private GitHub repository: `Dockerfile`, `railway-entrypoint.sh`, `mcp.php`, and `.dockerignore` (keep this README if desired).
2. In Railway, create a project and choose **Deploy from GitHub repo**. Select the repository. Railway should detect the Dockerfile.
3. In the Railway service's **Variables** settings, add:
   - `SUPABASE_URL` = `https://YOUR_PROJECT_REF.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = your rotated Supabase server-side secret key
   - `MCP_SECRET_KEY` = a new random secret of at least 32 characters
4. Deploy the service and generate a public domain in **Settings → Networking**. Railway routes traffic to the port assigned in `PORT`; the entrypoint configures Apache to listen on it.
5. Test with a POST request, not by opening the endpoint in a browser.

## Test

Replace the URL and secret locally; do not put the secret in a URL or commit it to Git:

```sh
curl -i -X POST 'https://YOUR-RAILWAY-DOMAIN/mcp.php' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'X-MCP-Key: YOUR_NEW_MCP_SECRET' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl-test","version":"1.0.0"}}}'
```

A successful response is JSON containing `result.protocolVersion`, `result.capabilities`, and `result.serverInfo`.

## Important security notes

- Rotate any Supabase secret or MCP key previously pasted into a chat or URL.
- Set `MCP_SECRET_KEY` to a long random value (32+ characters); do not reuse a password.
- Never commit credentials to GitHub. Store them only in Railway Variables.
- The PHP endpoint uses shared-secret authentication via `X-MCP-Key` or `Authorization: Bearer ...`. Hosting it does not implement OAuth. If the ChatGPT connector requires OAuth and offers no API-key option, an OAuth authorization server must be configured separately.
- The existing code expects the Supabase `memories` table and the columns it queries (`id`, `content`, `tags`, `created_at`, `updated_at`).
