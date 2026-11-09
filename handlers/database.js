// Shared PostgREST operations used by MCP and dashboard handlers.
function qs(pairs) {
  return (
    "?" +
    pairs
      .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v))
      .join("&")
  );
}

async function request(env, table, query = "", init = {}) {
  const endpoint =
    String(env.SUPABASE_URL).replace(/\/+$/, "") + "/rest/v1/" + table;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(endpoint + query, {
    ...init,
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {})
    }
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}

  if (!response.ok) {
    throw new Error(
      (data && data.message) || "Database request failed (" + response.status + ")"
    );
  }
  return data;
}

function cleanFilter(value) {
  return String(value).replace(/[%_,()"]/g, "");
}

export function dbReady(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function listNotes(env, { query = "", tag = "", limit = 25 }, table = "notes") {
  const pairs = [
    ["select", "*"],
    ["order", "updated_at.desc"],
    ["limit", String(limit)]
  ];

  if (query) {
    const pattern = '"*' + query.replace(/[\\"]/g, "\\$&") + '*"';
    pairs.push([
      "or",
      `(title.ilike.${pattern},content.ilike.${pattern},tags.ilike.${pattern})`
    ]);
  }

  if (tag) {
    pairs.push(["tags", "ilike.*" + cleanFilter(tag) + "*"]);
  }

  return (await request(env, table, qs(pairs))) || [];
}

export async function getNote(env, id, table = "notes") {
  const rows = await request(
    env,
    table,
    qs([["select", "*"], ["id", "eq." + id], ["limit", "1"]])
  );
  return rows && rows[0] ? rows[0] : null;
}

export async function insertNote(env, row, table = "notes") {
  const rows = await request(env, table, "", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row)
  });
  return rows && rows[0] ? rows[0] : null;
}

export async function updateNote(env, id, patch, table = "notes") {
  const rows = await request(env, table, qs([["id", "eq." + id]]), {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch)
  });
  return rows && rows[0] ? rows[0] : null;
}

export async function deleteNote(env, id, table = "notes") {
  const rows = await request(env, table, qs([["id", "eq." + id]]), {
    method: "DELETE",
    headers: { Prefer: "return=representation" }
  });
  return Array.isArray(rows) && rows.length > 0;
}

export async function listPages(env, { query = "", limit = 25 }) {
  const pairs = [
    ["select", "*"],
    ["order", "updated_at.desc"],
    ["limit", String(limit)]
  ];

  if (query) {
    const pattern = '"*' + query.replace(/[\\"]/g, "\\$&") + '*"';
    pairs.push(["or", `(title.ilike.${pattern},slug.ilike.${pattern})`]);
  }

  return (await request(env, "pages", qs(pairs))) || [];
}

export async function getPage(env, slug) {
  const rows = await request(
    env,
    "pages",
    qs([["select", "*"], ["slug", "eq." + slug], ["limit", "1"]])
  );
  return rows && rows[0] ? rows[0] : null;
}

export async function savePage(env, slug, row) {
  try {
    return await postPage(env, { ...row, slug });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/content/i.test(message)) throw error;
    const legacy = { ...row, slug, html: row.content };
    delete legacy.content;
    return await postPage(env, legacy);
  }
}

async function postPage(env, body) {
  const rows = await request(
    env,
    "pages",
    qs([["on_conflict", "slug"]]),
    {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(body)
    }
  );
  return rows && rows[0] ? rows[0] : null;
}

export async function deletePage(env, slug) {
  const rows = await request(env, "pages", qs([["slug", "eq." + slug]]), {
    method: "DELETE",
    headers: { Prefer: "return=representation" }
  });
  return Array.isArray(rows) && rows.length > 0;
}

export const listSkills = (env, options) => listNotes(env, options, "skills");
export const getSkill = (env, id) => getNote(env, id, "skills");
export const insertSkill = (env, row) => insertNote(env, row, "skills");
export const updateSkill = (env, id, patch) => updateNote(env, id, patch, "skills");
export const deleteSkill = (env, id) => deleteNote(env, id, "skills");
