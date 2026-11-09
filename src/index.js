import { Hono } from "hono";
import { dbReady } from "./handlers/database.js";
import { getOAuthSession, handleOAuthRequest } from "./handlers/oauth.js";
import { corsHeaders, handleMcpMethod, rpcError } from "./handlers/protocol.js";
import { handleDashboardRequest } from "./routes/dashboard.js";
import { handlePublicRequest } from "./routes/public.js";

const app = new Hono();
app.all("*", (c) => handle(c.req.raw, process.env));
export default app;

async function handle(request, env) {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  const oauthResponse = await handleOAuthRequest(request, env, url);
  if (oauthResponse) return oauthResponse;

  const publicResponse = await handlePublicRequest(request, env, url);
  if (publicResponse) return publicResponse;

  const dashboardResponse = await handleDashboardRequest(request, env, url);
  if (dashboardResponse) return dashboardResponse;

  if (url.pathname !== "/mcp") {
    return Response.json(
      { error: "Not found", home: "/", dashboard: "/admin", endpoint: "/mcp" },
      { status: 404, headers: corsHeaders() }
    );
  }

  const session = await getOAuthSession(request, env);
  if (!session) {
    return Response.json(
      { error: "Google sign-in required." },
      {
        status: 401,
        headers: {
          ...corsHeaders(),
          "WWW-Authenticate": 'Bearer realm="IrshadMCP", error="invalid_token"'
        }
      }
    );
  }

  if (request.method !== "POST") {
    return Response.json(
      { error: "Use POST for MCP requests." },
      { status: 405, headers: corsHeaders() }
    );
  }

  const userEnv = { ...env, AUTH_USER_ID: session.userId };
  if (!dbReady(userEnv)) {
    return Response.json(
      { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500, headers: corsHeaders() }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  return handleMcpMethod({ body, env: userEnv, origin: url.origin });
}
