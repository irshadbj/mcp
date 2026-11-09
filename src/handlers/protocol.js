import { toolDefinitions, callTool } from "./index.js";

const SERVER_DESCRIPTION =
  "Irshad's private notes server. Notes, skills, memories and tasks are private records stored in Supabase; public HTML pages are stored separately in the pages table. Use publish_page for public content.";

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, Accept, Mcp-Session-Id, Last-Event-ID",
    "Access-Control-Expose-Headers": "Mcp-Session-Id",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function rpcResult(id, result) {
  return Response.json(
    { jsonrpc: "2.0", id: id ?? null, result },
    { headers: corsHeaders() }
  );
}

export function rpcError(id, code, message) {
  return Response.json(
    { jsonrpc: "2.0", id: id ?? null, error: { code, message } },
    { status: 400, headers: corsHeaders() }
  );
}

export async function handleMcpMethod({ body, env, origin }) {
  const { id, method, params = {} } = body || {};
  if (!method) return rpcError(id ?? null, -32600, "Invalid Request");

  if (method === "initialize") {
    return rpcResult(id, {
      protocolVersion: params.protocolVersion || "2025-03-26",
      capabilities: { tools: {} },
      serverInfo: {
        name: "irshadmcp",
        title: "IrshadMCP",
        version: "1.1.0",
        description: SERVER_DESCRIPTION,
        icons: [
          {
            src: "https://" + new URL(origin).host + "/logo.svg",
            mimeType: "image/svg+xml",
            sizes: ["any"]
          }
        ]
      },
      instructions: SERVER_DESCRIPTION
    });
  }

  if (
    method === "notifications/initialized" ||
    method === "notifications/cancelled"
  ) {
    return new Response(null, { status: 202, headers: corsHeaders() });
  }
  if (method === "ping") return rpcResult(id, {});
  if (method === "tools/list") {
    return rpcResult(id, { tools: toolDefinitions });
  }
  if (method !== "tools/call") {
    return rpcError(id, -32601, `Method not found: ${method}`);
  }

  const tool = params.name;
  const args = params.arguments || {};
  try {
    const output = await callTool(tool, args, env, origin);
    if (output === undefined) return rpcError(id, -32602, `Unknown tool: ${tool}`);
    return rpcResult(id, {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }]
    });
  } catch (error) {
    return rpcResult(id, {
      isError: true,
      content: [
        {
          type: "text",
          text: error instanceof Error ? error.message : "Request failed."
        }
      ]
    });
  }
}
