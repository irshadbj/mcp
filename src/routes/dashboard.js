import { dashboardHtml } from "../pages/admin.js";
import {
  dbReady,
  deleteNote,
  deletePage,
  deleteSkill,
  getNote,
  getPage,
  getSkill,
  insertNote,
  insertSkill,
  listNotes,
  listPages,
  listSkills,
  updateNote,
  updateSkill
} from "../handlers/database.js";
import {
  cleanString,
  cleanTags,
  isValidSlug,
  pageView,
  parseNote,
  parseTags,
  renderNoteHtml
} from "../handlers/common.js";

export async function handleDashboardRequest(request, env, url) {
  if (!(url.pathname === "/admin" || url.pathname === "/admin/" || url.pathname.startsWith("/api/"))) return null;
  const denied = dashboardAuth(request, env);
  if (denied) return denied;
  if ((url.pathname === "/admin" || url.pathname === "/admin/") && request.method === "GET") {
    return new Response(dashboardHtml(), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
    });
  }
  if (!url.pathname.startsWith("/api/")) return null;
  if (!dbReady(env)) return Response.json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  try {
    return await handleDashboardApi(request, env, url);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Request failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
export function dashboardAuth(request, env) {
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

export async function handleDashboardApi(request, env, url) {
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




