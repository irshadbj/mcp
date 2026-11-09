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
  return String(value).replace(/[%_,()"{}\\]/g, "");
}

export function dbReady(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function listNotes(env, { query = "", tag = "", limit = 25 }, table = "notes") {
  const pairs = [
    ["select", "*"],
    ["user_id", "eq." + ownerId(env)],
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
    qs([["select", "*"], ["user_id", "eq." + ownerId(env)], ["id", "eq." + id], ["limit", "1"]])
  );
  return rows && rows[0] ? rows[0] : null;
}

export async function insertNote(env, row, table = "notes") {
  const rows = await request(env, table, "", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...row, user_id: ownerId(env) })
  });
  return rows && rows[0] ? rows[0] : null;
}

export async function updateNote(env, id, patch, table = "notes") {
  const rows = await request(env, table, qs([["user_id", "eq." + ownerId(env)], ["id", "eq." + id]]), {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch)
  });
  return rows && rows[0] ? rows[0] : null;
}

export async function deleteNote(env, id, table = "notes") {
  const rows = await request(env, table, qs([["user_id", "eq." + ownerId(env)], ["id", "eq." + id]]), {
    method: "DELETE",
    headers: { Prefer: "return=representation" }
  });
  return Array.isArray(rows) && rows.length > 0;
}

export async function listPages(env, { query = "", limit = 25, ownerOnly = false }) {
  const pairs = [
    ["select", "*"],
    ["order", "updated_at.desc"],
    ["limit", String(limit)]
  ];

  if (ownerOnly) pairs.push(["user_id", "eq." + ownerId(env)]);

  if (query) {
    const pattern = '"*' + query.replace(/[\\"]/g, "\\$&") + '*"';
    pairs.push(["or", `(title.ilike.${pattern},slug.ilike.${pattern})`]);
  }

  return (await request(env, "pages", qs(pairs))) || [];
}

export async function getPage(env, slug, ownerOnly = false) {
  const pairs = [["select", "*"], ["slug", "eq." + slug], ["limit", "1"]];
  if (ownerOnly) pairs.push(["user_id", "eq." + ownerId(env)]);
  const rows = await request(
    env,
    "pages",
    qs(pairs)
  );
  return rows && rows[0] ? rows[0] : null;
}

export async function savePage(env, slug, row) {
  const existing = await getPage(env, slug, true);
  if (existing) {
    const rows = await request(
      env,
      "pages",
      qs([["slug", "eq." + slug], ["user_id", "eq." + ownerId(env)]]),
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ ...row, user_id: ownerId(env) })
      }
    );
    return rows && rows[0] ? rows[0] : null;
  }
  try {
    return await postPage(env, { ...row, slug, user_id: ownerId(env) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/content/i.test(message)) throw error;
    const legacy = { ...row, slug, user_id: ownerId(env), html: row.content };
    delete legacy.content;
    return await postPage(env, legacy);
  }
}

async function postPage(env, body) {
  const rows = await request(
    env,
    "pages",
    "",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body)
    }
  );
  return rows && rows[0] ? rows[0] : null;
}

export async function deletePage(env, slug, ownerOnly = false) {
  const pairs = [["slug", "eq." + slug]];
  if (ownerOnly) pairs.push(["user_id", "eq." + ownerId(env)]);
  const rows = await request(env, "pages", qs(pairs), {
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

function ownerId(env) {
  if (typeof env.AUTH_USER_ID !== "string" || !env.AUTH_USER_ID) {
    throw new Error("An authenticated user is required.");
  }
  return env.AUTH_USER_ID;
}

export async function listOwnedRecords(
  env,
  table,
  { query = "", limit = 25, searchColumns = ["title"], tag = "", completed } = {}
) {
  const pairs = [
    ["select", "*"],
    ["user_id", "eq." + ownerId(env)],
    ["order", "updated_at.desc"],
    ["limit", String(limit)]
  ];

  if (query) {
    const pattern = '"*' + query.replace(/[\\"]/g, "\\$&") + '*"';
    pairs.push([
      "or",
      "(" + searchColumns.map(column => `${column}.ilike.${pattern}`).join(",") + ")"
    ]);
  }

  if (tag) {
    pairs.push(["tags", "cs.{" + cleanFilter(tag) + "}"]);
  }
  if (typeof completed === "boolean") {
    pairs.push(["is_completed", "eq." + completed]);
  }

  return (await request(env, table, qs(pairs))) || [];
}

export async function getOwnedRecord(env, table, idColumn, id) {
  const rows = await request(
    env,
    table,
    qs([
      ["select", "*"],
      ["user_id", "eq." + ownerId(env)],
      [idColumn, "eq." + id],
      ["limit", "1"]
    ])
  );
  return rows && rows[0] ? rows[0] : null;
}

export async function insertOwnedRecord(env, table, row) {
  const rows = await request(env, table, "", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...row, user_id: ownerId(env) })
  });
  return rows && rows[0] ? rows[0] : null;
}

export async function updateOwnedRecord(env, table, idColumn, id, patch) {
  const rows = await request(
    env,
    table,
    qs([
      ["user_id", "eq." + ownerId(env)],
      [idColumn, "eq." + id]
    ]),
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(patch)
    }
  );
  return rows && rows[0] ? rows[0] : null;
}

export async function deleteOwnedRecord(env, table, idColumn, id) {
  const rows = await request(
    env,
    table,
    qs([
      ["user_id", "eq." + ownerId(env)],
      [idColumn, "eq." + id]
    ]),
    {
      method: "DELETE",
      headers: { Prefer: "return=representation" }
    }
  );
  return Array.isArray(rows) && rows.length > 0;
}
