import { Hono } from "hono";
import { homeHtml } from "./pages/home.js";
import { dashboardHtml } from "./pages/admin.js";
import { pagesIndexHtml } from "./pages/pages.js";
import { swScript } from "./sw.js";

const LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
  '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
  '<stop offset="0" stop-color="#3157d5"/><stop offset="1" stop-color="#7c3aed"/>' +
  '</linearGradient></defs>' +
  '<rect width="512" height="512" rx="112" fill="url(#g)"/>' +
  '<path d="M160 112h140l72 72v204a24 24 0 0 1-24 24H160a24 24 0 0 1-24-24V136a24 24 0 0 1 24-24z" fill="#fff"/>' +
  '<path d="M300 112v48a24 24 0 0 0 24 24h48z" fill="#c7d2fe"/>' +
  '<rect x="180" y="248" width="152" height="18" rx="9" fill="#3157d5"/>' +
  '<rect x="180" y="290" width="152" height="18" rx="9" fill="#3157d5" opacity=".6"/>' +
  '<rect x="180" y="332" width="96" height="18" rx="9" fill="#3157d5" opacity=".35"/>' +
  '</svg>';

const SERVER_DESCRIPTION =
  "Irshad's private notes server. Private notes are stored in the Supabase notes table, reusable skills in the skills table, and public HTML pages separately in the pages table. For a public HTML page, use publish_page and never create_note; pages can be grouped into a booklet on the /pages shelf and are served at /pages/<slug>.";

// Published pages are untrusted markup served from this origin, so scripts,
// same-origin requests and framing are all denied.
const PAGE_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data: blob: https:; " +
  "font-src data: https:; media-src data: https:; base-uri 'none'; " +
  "form-action 'none'; frame-ancestors 'none'";

const app = new Hono();
app.all("*", (c) => handle(c.req.raw, process.env));
export default app;

async function handle(request, env) {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  // Public logo (no auth) so MCP clients can load the server icon.
  if (
    request.method === "GET" &&
    (url.pathname === "/logo.svg" || url.pathname === "/favicon.svg")
  ) {
    return new Response(LOGO_SVG, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  // Service worker: network-first, so visited pages are cached and only
  // served from the cache when the browser is offline.
  if (request.method === "GET" && url.pathname === "/sw.js") {
    return new Response(swScript, {
      headers: {
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "no-cache",
        "Service-Worker-Allowed": "/",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }

  // Public information page; note content is not rendered here.
  // Public MCP profile page; no private note data is exposed.
  if ((url.pathname === "/about-mcp" || url.pathname === "/about") && request.method === "GET") {
    return new Response(aboutMcpHtml(url.origin), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } });
  }

  if (url.pathname === "/" && request.method === "GET") {
    return new Response(homeHtml(), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }

  // Public directory of pages published through the MCP publish_page tool.
  // Only titles, slugs and timestamps are listed; page HTML stays on /pages/<slug>.
  if ((url.pathname === "/pages" || url.pathname === "/pages/") && request.method === "GET") {
    const headers = {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
      "X-Content-Type-Options": "nosniff"
    };

    let rows = [];
    let error = "";

    if (!dbReady(env)) {
      error = "Published pages are unavailable because the database is not configured.";
    } else {
      try {
        rows = await listPages(env, { query: "", limit: 100 });
      } catch {
        error = "Published pages could not be loaded right now. Please try again shortly.";
      }
    }

    return new Response(pagesIndexHtml(rows, { error }), { headers });
  }

  // Public pages published through the MCP publish_page tool.
  // /pages/<slug> is canonical; /p/<slug> remains a legacy alias.
  if (
    request.method === "GET" &&
    (url.pathname.startsWith("/pages/") || url.pathname.startsWith("/p/"))
  ) {
    const pageHeaders = {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": PAGE_CSP
    };

    let slug = "";
    const pagePrefix = url.pathname.startsWith("/pages/") ? "/pages/" : "/p/";
    try {
      slug = decodeURIComponent(url.pathname.slice(pagePrefix.length)).trim().toLowerCase();
    } catch {}

    if (!isValidSlug(slug)) return pageNotFound(pageHeaders);

    if (!dbReady(env)) {
      return Response.json(
        { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." },
        { status: 500, headers: corsHeaders() }
      );
    }

    let row = null;
    try {
      row = await getPage(env, slug);
    } catch {
      return Response.json(
        { error: "Database request failed." },
        { status: 500, headers: corsHeaders() }
      );
    }

    if (!row) return pageNotFound(pageHeaders);

    return new Response(row.content ?? row.html ?? "", {
      headers: { ...pageHeaders, "Cache-Control": "public, max-age=60" }
    });
  }

  // Protect the dashboard and its API independently from MCP authentication.
  if (url.pathname === "/admin" || url.pathname === "/admin/" || url.pathname.startsWith("/api/")) {
    const denied = dashboardAuth(request, env);
    if (denied) return denied;

    if ((url.pathname === "/admin" || url.pathname === "/admin/") && request.method === "GET") {
      return new Response(dashboardHtml(), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }

    if (url.pathname.startsWith("/api/")) {
      if (!dbReady(env)) {
        return Response.json(
          { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
          { status: 500 }
        );
      }
      try {
        return await handleDashboardApi(request, env, url);
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Request failed" },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
    }
  }

  if (url.pathname !== "/mcp") {
    return Response.json(
      { error: "Not found", home: "/", dashboard: "/admin", endpoint: "/mcp" },
      { status: 404, headers: corsHeaders() }
    );
  }

  // If configured, MCP clients must provide Authorization: Bearer <key>.
  if (env.MCP_API_KEY) {
    const auth = request.headers.get("Authorization") || "";
    if (auth !== `Bearer ${env.MCP_API_KEY}`) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders() }
      );
    }
  }

  if (request.method !== "POST") {
    return Response.json(
      { error: "Use POST for MCP requests." },
      { status: 405, headers: corsHeaders() }
    );
  }

  if (!dbReady(env)) {
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

  const { id, method, params = {} } = body || {};
  if (!method) {
    return rpcError(id ?? null, -32600, "Invalid Request");
  }

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
            src: "https://" + url.host + "/logo.svg",
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

  if (method === "ping") {
    return rpcResult(id, {});
  }

  if (method === "tools/list") {
    return rpcResult(id, {
      tools: [
        {
          name: "create_note",
          description: "Create a private note in the notes table. For a public HTML page, use publish_page instead; do not save published pages as notes.",
          inputSchema: {
            type: "object",
            properties: {
              title: { type: "string", minLength: 1, maxLength: 200 },
              content: { type: "string", minLength: 1, maxLength: 50000 },
              tags: { type: "array", items: { type: "string" }, maxItems: 20 }
            },
            required: ["title", "content"]
          }
        },
        {
          name: "list_notes",
          description: "List notes or search title, content and tags, optionally filtered by tag.",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string" },
              tag: { type: "string", maxLength: 40 },
              limit: { type: "integer", minimum: 1, maximum: 100 }
            }
          }
        },
        {
          name: "get_note",
          description: "Read a note by ID.",
          inputSchema: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"]
          }
        },
        {
          name: "update_note",
          description: "Update a note by ID. Supply one or more fields.",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              content: { type: "string" },
              tags: { type: "array", items: { type: "string" } }
            },
            required: ["id"]
          }
        },
        {
          name: "delete_note",
          description: "Permanently delete a note by ID.",
          inputSchema: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"]
          }
        },
        {
          name: "create_skill",
          description: "Create a skill: a reusable how-to guide or recipe stored in the skills table, separate from notes and pages.",
          inputSchema: {
            type: "object",
            properties: {
              title: { type: "string", minLength: 1, maxLength: 200 },
              content: { type: "string", minLength: 1, maxLength: 50000 },
              tags: { type: "array", items: { type: "string" }, maxItems: 20 }
            },
            required: ["title", "content"]
          }
        },
        {
          name: "list_skills",
          description: "List skills or search their title, content and tags, optionally filtered by tag.",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string" },
              tag: { type: "string", maxLength: 40 },
              limit: { type: "integer", minimum: 1, maximum: 100 }
            }
          }
        },
        {
          name: "get_skill",
          description: "Read a skill by ID.",
          inputSchema: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"]
          }
        },
        {
          name: "update_skill",
          description: "Update a skill by ID. Supply one or more fields.",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              content: { type: "string" },
              tags: { type: "array", items: { type: "string" } }
            },
            required: ["id"]
          }
        },
        {
          name: "delete_skill",
          description: "Permanently delete a skill by ID.",
          inputSchema: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"]
          }
        },
        {
          name: "publish_page",
          description:
            "Publish (create or replace) a public HTML page in the separate Supabase pages table. Never use create_note for public pages. Optionally place it in a booklet on the /pages shelf. The page will be served at /pages/<slug> on this server.",
          inputSchema: {
            type: "object",
            properties: {
              slug: {
                type: "string",
                pattern: "^[a-z0-9][a-z0-9-]{0,63}$",
                description: "Optional URL slug; derived from the title when omitted."
              },
              title: { type: "string", minLength: 1, maxLength: 200 },
              html: { type: "string", minLength: 1, maxLength: 200000 },
              booklet: {
                type: "string",
                maxLength: 80,
                description: "Optional booklet (group) this page belongs to on the /pages shelf."
              }
            },
            required: ["title", "html"]
          }
        },
        {
          name: "list_pages",
          description: "List published pages or search their title and slug.",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string" },
              limit: { type: "integer", minimum: 1, maximum: 100 }
            }
          }
        },
        {
          name: "get_page",
          description: "Read a published page by slug, including its HTML.",
          inputSchema: {
            type: "object",
            properties: { slug: { type: "string" } },
            required: ["slug"]
          }
        },
        {
          name: "delete_page",
          description: "Permanently unpublish a page by slug.",
          inputSchema: {
            type: "object",
            properties: { slug: { type: "string" } },
            required: ["slug"]
          }
        }
      ]
    });
  }

  if (method !== "tools/call") {
    return rpcError(id, -32601, `Method not found: ${method}`);
  }

  const tool = params.name;
  const args = params.arguments || {};

  try {
    let output;

    if (tool === "create_note") {
      const title = cleanString(args.title, 200);
      const content = cleanString(args.content, 50000, false);

      if (!title || !content) {
        throw new Error("title and content are required.");
      }

      const tags = cleanTags(args.tags);
      const noteId = crypto.randomUUID();
      const now = new Date().toISOString();

      await insertNote(env, {
        id: noteId,
        title,
        content,
        tags: JSON.stringify(tags),
        created_at: now,
        updated_at: now
      });

      output = {
        id: noteId,
        title,
        content,
        html: renderNoteHtml(content),
        tags,
        created_at: now,
        updated_at: now
      };

    } else if (tool === "list_notes") {
      const limit = Math.max(
        1,
        Math.min(100, Number.parseInt(args.limit, 10) || 25)
      );

      const query = typeof args.query === "string"
        ? args.query.trim().slice(0, 200)
        : "";

      const tag = typeof args.tag === "string"
        ? args.tag.trim().slice(0, 40)
        : "";

      output = (await listNotes(env, { query, tag, limit })).map(parseNote);

    } else if (tool === "get_note") {
      const noteId = cleanString(args.id, 100);
      const row = await getNote(env, noteId);

      if (!row) throw new Error("Note not found.");
      output = parseNote(row);

    } else if (tool === "update_note") {
      const noteId = cleanString(args.id, 100);
      const current = await getNote(env, noteId);

      if (!current) throw new Error("Note not found.");

      const title = args.title === undefined
        ? current.title
        : cleanString(args.title, 200);

      const content = args.content === undefined
        ? current.content
        : cleanString(args.content, 50000, false);

      const tags = args.tags === undefined
        ? parseTags(current.tags)
        : cleanTags(args.tags);

      if (!title || !content) {
        throw new Error("title and content cannot be empty.");
      }

      const updated = await updateNote(env, noteId, {
        title,
        content,
        tags: JSON.stringify(tags),
        updated_at: new Date().toISOString()
      });

      if (!updated) throw new Error("Note not found.");
      output = parseNote(updated);

    } else if (tool === "delete_note") {
      const noteId = cleanString(args.id, 100);

      if (!(await deleteNote(env, noteId))) {
        throw new Error("Note not found.");
      }

      output = { deleted: true, id: noteId };

    } else if (tool === "create_skill") {
      const title = cleanString(args.title, 200);
      const content = cleanString(args.content, 50000, false);

      if (!title || !content) {
        throw new Error("title and content are required.");
      }

      const tags = cleanTags(args.tags);
      const now = new Date().toISOString();

      output = parseNote(
        await insertSkill(env, {
          id: crypto.randomUUID(),
          title,
          content,
          tags: JSON.stringify(tags),
          created_at: now,
          updated_at: now
        })
      );

    } else if (tool === "list_skills") {
      const limit = Math.max(
        1,
        Math.min(100, Number.parseInt(args.limit, 10) || 25)
      );
      const query = typeof args.query === "string"
        ? args.query.trim().slice(0, 200)
        : "";
      const tag = typeof args.tag === "string"
        ? args.tag.trim().slice(0, 40)
        : "";

      output = (await listSkills(env, { query, tag, limit })).map(parseNote);

    } else if (tool === "get_skill") {
      const skillId = cleanString(args.id, 100);
      const row = await getSkill(env, skillId);

      if (!row) throw new Error("Skill not found.");
      output = parseNote(row);

    } else if (tool === "update_skill") {
      const skillId = cleanString(args.id, 100);
      const current = await getSkill(env, skillId);

      if (!current) throw new Error("Skill not found.");

      const title = args.title === undefined
        ? current.title
        : cleanString(args.title, 200);
      const content = args.content === undefined
        ? current.content
        : cleanString(args.content, 50000, false);
      const tags = args.tags === undefined
        ? parseTags(current.tags)
        : cleanTags(args.tags);

      if (!title || !content) {
        throw new Error("title and content cannot be empty.");
      }

      const updated = await updateSkill(env, skillId, {
        title,
        content,
        tags: JSON.stringify(tags),
        updated_at: new Date().toISOString()
      });

      if (!updated) throw new Error("Skill not found.");
      output = parseNote(updated);

    } else if (tool === "delete_skill") {
      const skillId = cleanString(args.id, 100);

      if (!(await deleteSkill(env, skillId))) {
        throw new Error("Skill not found.");
      }

      output = { deleted: true, id: skillId };

    } else if (tool === "publish_page") {
      const title = cleanString(args.title, 200);
      // Stored in the pages.content column: it may hold HTML or plain text,
      // so the column keeps the neutral "content" name.
      const content = cleanString(args.html, 200000, false);
      const booklet = cleanString(args.booklet, 80);

      if (!title || !content) {
        throw new Error("title and html are required.");
      }

      const requested =
        typeof args.slug === "string" ? args.slug.trim().toLowerCase() : "";
      const slug = requested || toSlug(title);

      if (!isValidSlug(slug)) {
        throw new Error(
          "Invalid slug. Use 1-64 characters: a-z, 0-9 and hyphens."
        );
      }

      const existing = await getPage(env, slug);
      const now = new Date().toISOString();

      const saved = await savePage(env, slug, {
        slug,
        title,
        content,
        booklet: booklet || (existing && existing.booklet) || "",
        created_at: (existing && existing.created_at) || now,
        updated_at: now
      });

      if (!saved) throw new Error("Page could not be saved to the pages table.");
      output = pageView(saved, url.origin);

    } else if (tool === "list_pages") {
      const limit = Math.max(
        1,
        Math.min(100, Number.parseInt(args.limit, 10) || 25)
      );
      const query = typeof args.query === "string"
        ? args.query.trim().slice(0, 200)
        : "";

      output = (await listPages(env, { query, limit })).map(p =>
        pageView(p, url.origin)
      );

    } else if (tool === "get_page") {
      const slug =
        typeof args.slug === "string" ? args.slug.trim().toLowerCase() : "";
      if (!isValidSlug(slug)) throw new Error("Invalid slug.");

      const row = await getPage(env, slug);
      if (!row) throw new Error("Page not found.");

      output = pageView(row, url.origin);

    } else if (tool === "delete_page") {
      const slug =
        typeof args.slug === "string" ? args.slug.trim().toLowerCase() : "";
      if (!isValidSlug(slug)) throw new Error("Invalid slug.");

      if (!(await deletePage(env, slug))) throw new Error("Page not found.");
      output = { deleted: true, slug, url: url.origin + "/pages/" + slug };

    } else {
      return rpcError(id, -32602, `Unknown tool: ${tool}`);
    }

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

/* ---------- Supabase (PostgREST) data layer ---------- */

function dbReady(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function qs(pairs) {
  return (
    "?" +
    pairs
      .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v))
      .join("&")
  );
}

async function sb(env, table, query = "", init = {}) {
  const endpoint =
    String(env.SUPABASE_URL).replace(/\/+$/, "") + "/rest/v1/" + table;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  const res = await fetch(endpoint + (query || ""), {
    ...init,
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {})
    }
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}

  if (!res.ok) {
    throw new Error(
      (data && data.message) || "Database request failed (" + res.status + ")"
    );
  }
  return data;
}

async function listNotes(env, { query = "", tag = "", limit = 25 }, table = "notes") {
  const pairs = [
    ["select", "*"],
    ["order", "updated_at.desc"],
    ["limit", String(limit)]
  ];

  if (query) {
    const p = '"*' + query.replace(/[\\"]/g, "\\$&") + '*"';
    pairs.push([
      "or",
      `(title.ilike.${p},content.ilike.${p},tags.ilike.${p})`
    ]);
  }

  if (tag) {
    pairs.push(["tags", "ilike.*" + cleanFilter(tag) + "*"]);
  }

  return (await sb(env, table, qs(pairs))) || [];
}

async function getNote(env, id, table = "notes") {
  const rows = await sb(
    env,
    table,
    qs([["select", "*"], ["id", "eq." + id], ["limit", "1"]])
  );
  return rows && rows[0] ? rows[0] : null;
}

async function insertNote(env, row, table = "notes") {
  const rows = await sb(env, table, "", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row)
  });
  return rows && rows[0] ? rows[0] : null;
}

async function updateNote(env, id, patch, table = "notes") {
  const rows = await sb(env, table, qs([["id", "eq." + id]]), {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch)
  });
  return rows && rows[0] ? rows[0] : null;
}

async function deleteNote(env, id, table = "notes") {
  const rows = await sb(env, table, qs([["id", "eq." + id]]), {
    method: "DELETE",
    headers: { Prefer: "return=representation" }
  });
  return Array.isArray(rows) && rows.length > 0;
}

async function listPages(env, { query = "", limit = 25 }) {
  const pairs = [
    ["select", "*"],
    ["order", "updated_at.desc"],
    ["limit", String(limit)]
  ];

  if (query) {
    const p = '"*' + query.replace(/[\\"]/g, "\\$&") + '*"';
    pairs.push(["or", `(title.ilike.${p},slug.ilike.${p})`]);
  }

  return (await sb(env, "pages", qs(pairs))) || [];
}

async function getPage(env, slug) {
  const rows = await sb(
    env,
    "pages",
    qs([["select", "*"], ["slug", "eq." + slug], ["limit", "1"]])
  );
  return rows && rows[0] ? rows[0] : null;
}

async function savePage(env, slug, row) {
  try {
    return await postPage(env, { ...row, slug });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!/content/i.test(msg)) throw error;
    // Some databases still have the column named html instead of content.
    const legacy = { ...row, slug, html: row.content };
    delete legacy.content;
    return await postPage(env, legacy);
  }
}

async function postPage(env, body) {
  const rows = await sb(env, "pages", qs([["on_conflict", "slug"]]), {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify(body)
  });
  return rows && rows[0] ? rows[0] : null;
}

async function deletePage(env, slug) {
  const rows = await sb(env, "pages", qs([["slug", "eq." + slug]]), {
    method: "DELETE",
    headers: { Prefer: "return=representation" }
  });
  return Array.isArray(rows) && rows.length > 0;
}

/* ---------- helpers ---------- */

function corsHeaders() {
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

function rpcError(id, code, message) {
  return Response.json(
    { jsonrpc: "2.0", id: id ?? null, error: { code, message } },
    { status: 400, headers: corsHeaders() }
  );
}

function cleanString(value, max, trim = true) {
  if (typeof value !== "string") return "";
  const out = trim ? value.trim() : value;
  return out.length > 0 && out.length <= max ? out : "";
}

function cleanFilter(value) {
  // Strips characters that carry meaning in PostgREST filter expressions.
  return String(value).replace(/[%_,()"]/g, "");
}

function cleanTags(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter(v => typeof v === "string" && v.trim())
    .slice(0, 20)
    .map(v => v.trim().slice(0, 40));
}

function parseTags(value) {
  try {
    const t = JSON.parse(value || "[]");
    return Array.isArray(t) ? t : [];
  } catch {
    return [];
  }
}

function parseNote(row) {
  const tags = parseTags(row.tags);
  return { ...row, tags, html: renderNoteHtml(row.content) };
}

/* Skills reuse the note row shape but live in the skills table. */
const listSkills = (env, opts) => listNotes(env, opts, "skills");
const getSkill = (env, id) => getNote(env, id, "skills");
const insertSkill = (env, row) => insertNote(env, row, "skills");
const updateSkill = (env, id, patch) => updateNote(env, id, patch, "skills");
const deleteSkill = (env, id) => deleteNote(env, id, "skills");

/* ---------- plain text -> safe HTML rendering ---------- */

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}

function inlineHtml(text) {
  return String(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
}

/**
 * Turns a note's plain text into semantic HTML: headings, paragraphs, lists,
 * quotes, horizontal rules, fenced code and inline emphasis/links.
 * Every line is escaped first, so the output is always safe to inject.
 */
function renderNoteHtml(content) {
  const lines = String(content ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let inCode = false;
  let list = null;
  let para = [];

  const flushPara = () => {
    if (para.length) out.push("<p>" + para.join("<br>") + "</p>");
    para = [];
  };
  const closeList = () => {
    if (list) {
      out.push("</" + list + ">");
      list = null;
    }
  };

  for (const rawLine of lines) {
    const line = escapeHtml(rawLine);

    if (/^\s*```/.test(line)) {
      flushPara();
      closeList();
      if (inCode) {
        out.push("</code></pre>");
        inCode = false;
      } else {
        out.push("<pre><code>");
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      out.push(line + "\n");
      continue;
    }

    if (!line.trim()) {
      flushPara();
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushPara();
      closeList();
      const level = heading[1].length;
      out.push(
        "<h" + level + ">" + inlineHtml(heading[2]) + "</h" + level + ">"
      );
      continue;
    }

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flushPara();
      closeList();
      out.push("<hr>");
      continue;
    }

    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bullet) {
      flushPara();
      if (list !== "ul") {
        closeList();
        out.push("<ul>");
        list = "ul";
      }
      out.push("<li>" + inlineHtml(bullet[1]) + "</li>");
      continue;
    }

    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (numbered) {
      flushPara();
      if (list !== "ol") {
        closeList();
        out.push("<ol>");
        list = "ol";
      }
      out.push("<li>" + inlineHtml(numbered[1]) + "</li>");
      continue;
    }

    const quote = line.match(/^\s*&gt;\s?(.*)$/);
    if (quote) {
      flushPara();
      closeList();
      out.push("<blockquote>" + inlineHtml(quote[1]) + "</blockquote>");
      continue;
    }

    para.push(inlineHtml(line));
  }

  if (inCode) out.push("</code></pre>");
  flushPara();
  closeList();

  return out.join("");
}

/* ---------- published pages ---------- */

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

function isValidSlug(value) {
  return typeof value === "string" && SLUG_PATTERN.test(value);
}

function toSlug(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
}

function pageView(row, origin) {
  return {
    slug: row.slug,
    title: row.title,
    booklet: row.booklet || "",
    // The database column is content (HTML or plain text); html stays the
    // MCP-facing field name.
    html: row.content ?? row.html ?? "",
    url: origin + "/pages/" + row.slug,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function pageNotFound(headers) {
  return new Response(
    '<!doctype html><html lang="en"><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      "<title>Page not found</title>" +
      '<body style="font:16px/1.6 system-ui,-apple-system,sans-serif;margin:64px auto;max-width:640px;padding:0 20px;color:#172033">' +
      "<h1>Page not found</h1>" +
      "<p>This page is not published on this server.</p>" +
      '<p><a href="/" style="color:#3157d5">Back to the home page</a></p>' +
      "</body></html>",
    { status: 404, headers }
  );
}

function dashboardAuth(request, env) {
  // Fail closed if the dashboard password has not been configured.
  if (!env.DASHBOARD_PASSWORD) {
    return new Response(
      "Dashboard is not configured. Set DASHBOARD_PASSWORD in the Vercel project environment variables.",
      {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store"
        }
      }
    );
  }

  const expectedUser = env.DASHBOARD_USER || "admin";
  const auth = request.headers.get("Authorization") || "";

  if (!auth.startsWith("Basic ")) {
    return new Response("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Notes Dashboard", charset="UTF-8"',
        "Cache-Control": "no-store"
      }
    });
  }

  let decoded = "";
  try {
    decoded = atob(auth.slice(6));
  } catch {}

  const colon = decoded.indexOf(":");
  const user = colon >= 0 ? decoded.slice(0, colon) : "";
  const pass = colon >= 0 ? decoded.slice(colon + 1) : "";

  if (
    !constantTimeEqual(user, expectedUser) ||
    !constantTimeEqual(pass, env.DASHBOARD_PASSWORD)
  ) {
    return new Response("Invalid username or password", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Notes Dashboard", charset="UTF-8"',
        "Cache-Control": "no-store"
      }
    });
  }

  return null;
}

function constantTimeEqual(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));

  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);

  for (let i = 0; i < n; i++) {
    diff |=
      (x[i % (x.length || 1)] || 0) ^
      (y[i % (y.length || 1)] || 0);
  }

  return diff === 0;
}

async function handleDashboardApi(request, env, url) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  };

  if (request.method === "GET" && url.pathname === "/api/notes") {
    const query = (url.searchParams.get("q") || "").trim().slice(0, 200);
    const tag = (url.searchParams.get("tag") || "").trim().slice(0, 40);

    const limit = Math.max(
      1,
      Math.min(
        100,
        Number.parseInt(url.searchParams.get("limit") || "100", 10) || 100
      )
    );

    const rows = await listNotes(env, { query, tag, limit });
    return Response.json(rows.map(parseNote), { headers });
  }

  if (request.method === "POST" && url.pathname === "/api/notes") {
    const body = await safeJson(request);

    if (!body) {
      return Response.json(
        { error: "Invalid JSON body" },
        { status: 400, headers }
      );
    }

    const title = cleanString(body.title, 200);
    const content = cleanString(body.content, 50000, false);

    if (!title || !content) {
      return Response.json(
        {
          error:
            "Title and content are required (max title 200, content 50000 characters)."
        },
        { status: 400, headers }
      );
    }

    const tags = cleanTags(
      Array.isArray(body.tags)
        ? body.tags
        : String(body.tags || "").split(",")
    );

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await insertNote(env, {
      id,
      title,
      content,
      tags: JSON.stringify(tags),
      created_at: now,
      updated_at: now
    });

    return Response.json(
      { id, title, content, tags, html: renderNoteHtml(content), created_at: now, updated_at: now },
      { status: 201, headers }
    );
  }

  if (request.method === "GET" && url.pathname === "/api/pages") {
    const query = (url.searchParams.get("q") || "").trim().slice(0, 200);

    const limit = Math.max(
      1,
      Math.min(
        100,
        Number.parseInt(url.searchParams.get("limit") || "100", 10) || 100
      )
    );

    const rows = await listPages(env, { query, limit });
    return Response.json(
      rows.map(p => pageView(p, url.origin)),
      { headers }
    );
  }

  const pageMatch = url.pathname.match(/^\/api\/pages\/([^/]+)$/);

  if (pageMatch) {
    let slug;

    try {
      slug = decodeURIComponent(pageMatch[1]).trim().toLowerCase();
    } catch {
      return Response.json({ error: "Invalid slug" }, { status: 400, headers });
    }

    if (!isValidSlug(slug)) {
      return Response.json({ error: "Invalid slug" }, { status: 400, headers });
    }

    if (request.method === "GET") {
      const row = await getPage(env, slug);

      return row
        ? Response.json(pageView(row, url.origin), { headers })
        : Response.json({ error: "Page not found" }, { status: 404, headers });
    }

    if (request.method === "DELETE") {
      return (await deletePage(env, slug))
        ? Response.json({ deleted: true, slug }, { headers })
        : Response.json({ error: "Page not found" }, { status: 404, headers });
    }
  }

  const match = url.pathname.match(/^\/api\/notes\/([^/]+)$/);

  if (match) {
    let noteId;

    try {
      noteId = decodeURIComponent(match[1]);
    } catch {
      return Response.json(
        { error: "Invalid note ID" },
        { status: 400, headers }
      );
    }

    if (request.method === "GET") {
      const row = await getNote(env, noteId);

      return row
        ? Response.json(parseNote(row), { headers })
        : Response.json({ error: "Note not found" }, { status: 404, headers });
    }

    if (request.method === "PUT") {
      const body = await safeJson(request);

      if (!body) {
        return Response.json(
          { error: "Invalid JSON body" },
          { status: 400, headers }
        );
      }

      const current = await getNote(env, noteId);

      if (!current) {
        return Response.json(
          { error: "Note not found" },
          { status: 404, headers }
        );
      }

      const title = body.title === undefined
        ? current.title
        : cleanString(body.title, 200);

      const content = body.content === undefined
        ? current.content
        : cleanString(body.content, 50000, false);

      const tags = body.tags === undefined
        ? parseTags(current.tags)
        : cleanTags(
            Array.isArray(body.tags)
              ? body.tags
              : String(body.tags || "").split(",")
          );

      if (!title || !content) {
        return Response.json(
          { error: "Title and content cannot be empty." },
          { status: 400, headers }
        );
      }

      const updated = await updateNote(env, noteId, {
        title,
        content,
        tags: JSON.stringify(tags),
        updated_at: new Date().toISOString()
      });

      return updated
        ? Response.json(parseNote(updated), { headers })
        : Response.json({ error: "Note not found" }, { status: 404, headers });
    }

    if (request.method === "DELETE") {
      return (await deleteNote(env, noteId))
        ? Response.json({ deleted: true, id: noteId }, { headers })
        : Response.json({ error: "Note not found" }, { status: 404, headers });
    }
  }

  if (request.method === "GET" && url.pathname === "/api/skills") {
    const query = (url.searchParams.get("q") || "").trim().slice(0, 200);
    const tag = (url.searchParams.get("tag") || "").trim().slice(0, 40);

    const limit = Math.max(
      1,
      Math.min(100, Number.parseInt(url.searchParams.get("limit") || "100", 10) || 100)
    );

    const rows = await listSkills(env, { query, tag, limit });
    return Response.json(rows.map(parseNote), { headers });
  }

  if (request.method === "POST" && url.pathname === "/api/skills") {
    const body = await safeJson(request);

    if (!body) {
      return Response.json({ error: "Invalid JSON body" }, { status: 400, headers });
    }

    const title = cleanString(body.title, 200);
    const content = cleanString(body.content, 50000, false);

    if (!title || !content) {
      return Response.json(
        { error: "Title and content are required (max title 200, content 50000 characters)." },
        { status: 400, headers }
      );
    }

    const tags = cleanTags(
      Array.isArray(body.tags) ? body.tags : String(body.tags || "").split(",")
    );

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await insertSkill(env, {
      id,
      title,
      content,
      tags: JSON.stringify(tags),
      created_at: now,
      updated_at: now
    });

    return Response.json(
      { id, title, content, tags, html: renderNoteHtml(content), created_at: now, updated_at: now },
      { status: 201, headers }
    );
  }

  const skillMatch = url.pathname.match(/^\/api\/skills\/([^/]+)$/);

  if (skillMatch) {
    let skillId;

    try {
      skillId = decodeURIComponent(skillMatch[1]);
    } catch {
      return Response.json({ error: "Invalid skill ID" }, { status: 400, headers });
    }

    if (request.method === "GET") {
      const row = await getSkill(env, skillId);

      return row
        ? Response.json(parseNote(row), { headers })
        : Response.json({ error: "Skill not found" }, { status: 404, headers });
    }

    if (request.method === "PUT") {
      const body = await safeJson(request);

      if (!body) {
        return Response.json({ error: "Invalid JSON body" }, { status: 400, headers });
      }

      const current = await getSkill(env, skillId);

      if (!current) {
        return Response.json({ error: "Skill not found" }, { status: 404, headers });
      }

      const title = body.title === undefined
        ? current.title
        : cleanString(body.title, 200);
      const content = body.content === undefined
        ? current.content
        : cleanString(body.content, 50000, false);
      const tags = body.tags === undefined
        ? parseTags(current.tags)
        : cleanTags(Array.isArray(body.tags) ? body.tags : String(body.tags || "").split(","));

      if (!title || !content) {
        return Response.json({ error: "Title and content cannot be empty." }, { status: 400, headers });
      }

      const updated = await updateSkill(env, skillId, {
        title,
        content,
        tags: JSON.stringify(tags),
        updated_at: new Date().toISOString()
      });

      return updated
        ? Response.json(parseNote(updated), { headers })
        : Response.json({ error: "Skill not found" }, { status: 404, headers });
    }

    if (request.method === "DELETE") {
      return (await deleteSkill(env, skillId))
        ? Response.json({ deleted: true, id: skillId }, { headers })
        : Response.json({ error: "Skill not found" }, { status: 404, headers });
    }
  }

  return Response.json({ error: "Not found" }, { status: 404, headers });
}

async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}





function aboutMcpHtml(origin) {
  const endpoint = origin + "/mcp";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="IrshadMCP server profile, MCP endpoint, capabilities, logo and documentation links.">
<meta name="theme-color" content="#3157d5"><link rel="icon" type="image/svg+xml" href="/logo.svg">
<title>About IrshadMCP · Server profile</title>
<style>
:root{color-scheme:light;--ink:#172033;--muted:#65728a;--line:#e2e8f0;--bg:#f6f8fc;--accent:#3157d5;--soft:#edf1ff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}.wrap{width:min(1080px,calc(100% - 36px));margin:auto}
header{background:#fff;border-bottom:1px solid var(--line)}.nav{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:18px}
.brand{display:flex;align-items:center;gap:12px;font-size:19px;font-weight:800;color:var(--ink)}.brand img{width:42px;height:42px;border-radius:12px}
.navlinks{display:flex;gap:18px;flex-wrap:wrap;font-size:14px;font-weight:700}.hero{padding:54px 0 34px;background:radial-gradient(ellipse at 82% 0%,#dfe7ff 0,transparent 48%)}
.eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.14em;font-weight:850;color:var(--accent)}h1{font-size:clamp(36px,5vw,56px);letter-spacing:-.045em;line-height:1.08;margin:13px 0}
.lead{max-width:760px;color:var(--muted);font-size:18px;margin:0}.profile{display:grid;grid-template-columns:1.25fr .75fr;gap:18px;align-items:stretch;margin-top:28px}
.panel,.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:22px;min-width:0}.identity{display:flex;gap:18px;align-items:center}.identity img{width:94px;height:94px;border-radius:22px;box-shadow:0 8px 28px #243d8b22}.identity h2{font-size:25px;margin:0}.muted{color:var(--muted)}.pill{display:inline-flex;border-radius:999px;background:#e8f7ef;color:#146b4c;padding:3px 10px;font-size:12px;font-weight:800;margin-top:8px}
h2{font-size:24px;line-height:1.2;margin:0 0 12px;letter-spacing:-.02em}h3{font-size:17px;margin:0 0 7px}.section{padding:22px 0}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.symbol{width:38px;height:38px;border-radius:11px;background:var(--soft);color:var(--accent);display:grid;place-items:center;font-weight:850;margin-bottom:13px}
.endpoint{display:flex;gap:10px;align-items:center;background:#111827;color:#edf2ff;padding:14px;border-radius:12px;margin-top:12px}.endpoint code{overflow-wrap:anywhere;flex:1;min-width:0;font:14px/1.5 ui-monospace,Consolas,monospace}
button{border:0;border-radius:9px;background:var(--accent);color:white;padding:10px 13px;font:inherit;font-weight:750;cursor:pointer}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.btn{display:inline-flex;border-radius:10px;padding:10px 14px;font-weight:750;background:var(--accent);color:#fff}.btn.alt{background:#fff;color:var(--ink);border:1px solid #cbd5e1}
table{width:100%;border-collapse:collapse}td{padding:11px 6px;border-bottom:1px solid var(--line);vertical-align:top}td:first-child{font-weight:750;width:155px}.tool{font:13px ui-monospace,Consolas,monospace;background:var(--soft);padding:3px 7px;border-radius:6px;display:inline-block;margin:3px 3px 3px 0}
footer{border-top:1px solid var(--line);margin-top:24px;padding:24px 0;color:var(--muted);font-size:14px}.foot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
@media(max-width:760px){.nav{align-items:flex-start;padding:14px 0}.navlinks{gap:10px;justify-content:flex-end}.profile{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.hero{padding-top:38px}.identity img{width:72px;height:72px}.endpoint{align-items:stretch;flex-direction:column}.endpoint button{width:100%}td:first-child{width:118px}}
</style></head><body>
<header><div class="wrap nav"><a class="brand" href="/"><img src="/logo.svg" alt="IrshadMCP logo"><span>IrshadMCP</span></a><nav class="navlinks"><a href="/">Home</a><a href="#connection">Connection</a><a href="#capabilities">Capabilities</a><a href="/admin">Notes dashboard</a></nav></div></header>
<main class="wrap"><section class="hero"><div class="eyebrow">MCP server profile</div><h1>Meet IrshadMCP.</h1><p class="lead">A personal notes server that lets compatible AI assistants securely work with your notes through the Model Context Protocol (MCP).</p>
<div class="profile"><article class="panel"><div class="identity"><img src="/logo.svg" alt="IrshadMCP logo"><div><h2>IrshadMCP</h2><div class="muted">Personal notes · Remote MCP server</div><span class="pill">HTTP endpoint · JSON-RPC</span></div></div><p class="muted">Create, search, read, update and delete private notes with tags, and publish public HTML pages separately in the pages table. Everything is persisted in Supabase; the web dashboard is protected separately from MCP access.</p><div class="actions"><a class="btn" href="#connection">Get connection details</a><a class="btn alt" href="/logo.svg" target="_blank" rel="noopener">View logo SVG ↗</a></div></article>
<aside class="panel"><h3>Server at a glance</h3><table><tr><td>Name</td><td>IrshadMCP</td></tr><tr><td>Protocol</td><td>Model Context Protocol</td></tr><tr><td>Transport</td><td>Remote HTTP · JSON-RPC</td></tr><tr><td>Storage</td><td>Supabase PostgreSQL</td></tr><tr><td>Version</td><td>1.1.0</td></tr><tr><td>Authentication</td><td>Bearer key if configured; dashboard uses separate credentials</td></tr></table></aside></div></section>
<section class="section" id="connection"><article class="panel"><h2>Connection details</h2><p class="muted">Use this endpoint in an MCP-compatible client. Authentication must match the server configuration.</p><div class="endpoint"><code id="endpoint">${endpoint}</code><button id="copy" type="button">Copy endpoint</button></div><div class="actions"><a class="btn alt" href="/logo.svg" target="_blank" rel="noopener">Logo URL</a><a class="btn alt" href="https://modelcontextprotocol.io/" target="_blank" rel="noopener noreferrer">MCP website ↗</a><a class="btn alt" href="https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt" target="_blank" rel="noopener noreferrer">ChatGPT connection guide ↗</a></div><p class="muted" style="margin-bottom:0">Public information page only. It does not display secrets, note contents, or authentication keys.</p></article></section>
<section class="section" id="capabilities"><h2>Available tools</h2><p class="muted">These tools are exposed to connected clients for note management.</p><div class="grid">
<article class="card"><div class="symbol">＋</div><h3>Create notes</h3><p class="muted">Save a note with a title, content and optional tags.</p><span class="tool">create_note</span></article>
<article class="card"><div class="symbol">⌕</div><h3>Search and read</h3><p class="muted">Find notes by title, content or tags, then retrieve a note by ID.</p><span class="tool">list_notes</span><span class="tool">get_note</span></article>
<article class="card"><div class="symbol">↻</div><h3>Maintain notes</h3><p class="muted">Edit titles, content and tags, or permanently delete a note when requested.</p><span class="tool">update_note</span><span class="tool">delete_note</span></article>
<article class="card"><div class="symbol">✦</div><h3>Skill library</h3><p class="muted">Save reusable how-to skills with titles, content and tags, kept separate from notes.</p><span class="tool">create_skill</span><span class="tool">list_skills</span><span class="tool">get_skill</span><span class="tool">update_skill</span><span class="tool">delete_skill</span></article>
<article class="card"><div class="symbol">◧</div><h3>Publish pages</h3><p class="muted">Publish, read and remove public HTML pages saved separately from notes, arranged in booklets on the <code>/pages</code> shelf and served at <code>/pages/your-slug</code>.</p><span class="tool">publish_page</span><span class="tool">list_pages</span><span class="tool">get_page</span><span class="tool">delete_page</span></article>
</div></section>
<section class="section"><article class="panel"><h2>Useful links</h2><table><tr><td>Home page</td><td><a href="/">IrshadMCP landing page ↗</a></td></tr><tr><td>MCP endpoint</td><td><a href="/mcp">/mcp</a> <span class="muted">(POST requests; a browser GET is not a health check)</span></td></tr><tr><td>Logo</td><td><a href="/logo.svg">/logo.svg</a></td></tr><tr><td>Published pages</td><td><a href="/pages">/pages</a> · <code>/pages/&lt;slug&gt;</code> <span class="muted">(HTML published through the publish_page tool)</span></td></tr><tr><td>Notes dashboard</td><td><a href="/admin">/admin</a> <span class="muted">(requires dashboard login)</span></td></tr><tr><td>MCP specification</td><td><a href="https://modelcontextprotocol.io/" target="_blank" rel="noopener noreferrer">modelcontextprotocol.io ↗</a></td></tr><tr><td>ChatGPT setup</td><td><a href="https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt" target="_blank" rel="noopener noreferrer">Official connection guide ↗</a></td></tr></table></article></section></main>
<footer><div class="wrap foot"><span>IrshadMCP · Personal notes for AI workflows</span><a href="/">Back to home ↑</a></div></footer>
<script>document.getElementById("copy").addEventListener("click",async()=>{const b=document.getElementById("copy");try{await navigator.clipboard.writeText(document.getElementById("endpoint").textContent);b.textContent="Copied!";}catch{b.textContent="Copy unavailable — select the URL";}setTimeout(()=>b.textContent="Copy endpoint",2000);});if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});</script></body></html>`;
}
