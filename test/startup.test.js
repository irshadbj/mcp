import test from "node:test";
import assert from "node:assert/strict";
import { Script } from "node:vm";
import app from "../src/index.js";
import { dashboardHtml } from "../src/pages/admin.js";
import { pagesIndexHtml } from "../src/pages/pages.js";

test("deployment entrypoint loads and serves the public logo", async () => {
  const response = await app.request("/logo.svg");

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /image\/svg\+xml/);
});

test("MCP advertises and persists memories and tasks", async () => {
  const previous = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    userId: process.env.USER_ID,
    dashboardPassword: process.env.DASHBOARD_PASSWORD,
    fetch: globalThis.fetch
  };
  const calls = [];
  process.env.SUPABASE_URL = "https://supabase.example";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  process.env.USER_ID = "test-user";
  const records = new Map();
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ url: String(input), init });
    const url = new URL(String(input));
    const table = url.pathname.split("/").pop();
    const primaryKey = table === "tasks" ? "task_id" : "id";
    const recordKey = `${table}:${url.searchParams.get(primaryKey)?.slice(3) || ""}`;
    if (init.method === "POST") {
      const row = JSON.parse(init.body);
      records.set(`${table}:${row[primaryKey]}`, row);
      return Response.json([row]);
    }
    if (init.method === "PATCH") {
      const row = records.get(recordKey);
      if (!row) return Response.json([]);
      const updated = { ...row, ...JSON.parse(init.body) };
      records.set(`${table}:${updated[primaryKey]}`, updated);
      return Response.json([updated]);
    }
    if (init.method === "DELETE") {
      const row = records.get(recordKey);
      records.delete(recordKey);
      return Response.json(row ? [row] : []);
    }
    const row = records.get(recordKey);
    return Response.json(row ? [row] : []);
  };

  const rpc = async (id, name, args) => {
    const response = await app.request("/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        method: name,
        params: args
      })
    });
    return response.json();
  };

  try {
    const listed = await rpc(1, "tools/list", {});
    const names = listed.result.tools.map(tool => tool.name);
    for (const name of [
      "create_note", "list_notes", "get_note", "update_note", "delete_note",
      "create_skill", "list_skills", "get_skill", "update_skill", "delete_skill",
      "publish_page", "list_pages", "get_page", "delete_page",
      "create_memory", "list_memories", "get_memory", "update_memory", "delete_memory",
      "create_task", "list_tasks", "get_task", "update_task", "delete_task"
    ]) {
      assert.ok(names.includes(name), `missing MCP tool ${name}`);
    }

    await rpc(2, "tools/call", {
      name: "create_note",
      arguments: { title: "Note", content: "Note body" }
    });
    assert.match(calls.at(-1).url, /\/rest\/v1\/notes$/);
    await rpc(3, "tools/call", {
      name: "create_skill",
      arguments: { title: "Guide", content: "Steps" }
    });
    assert.match(calls.at(-1).url, /\/rest\/v1\/skills$/);
    const publishedPage = await rpc(4, "tools/call", {
      name: "publish_page",
      arguments: {
        title: "Public page",
        html: "<h1>Hello</h1>",
        booklet: "Research Notes"
      }
    });
    assert.match(calls.at(-1).url, /\/rest\/v1\/pages\?/);
    assert.equal(
      JSON.parse(publishedPage.result.content[0].text).url,
      "http://localhost/pages/Research%20Notes/public-page"
    );

    const memory = await rpc(2, "tools/call", {
      name: "create_memory",
      arguments: { title: "Context", content: "Remember this", tags: ["work"] }
    });
    assert.equal(memory.result.isError, undefined);
    const memoryCall = calls.at(-1);
    assert.match(memoryCall.url, /\/rest\/v1\/memories$/);
    assert.equal(JSON.parse(memoryCall.init.body).user_id, "test-user");
    assert.deepEqual(JSON.parse(memoryCall.init.body).tags, ["work"]);
    const memoryId = JSON.parse(memoryCall.init.body).id;
    await rpc(3, "tools/call", {
      name: "update_memory",
      arguments: { id: memoryId, content: "Updated" }
    });
    assert.equal(JSON.parse(calls.at(-1).init.body).content, "Updated");
    const fetchedMemory = await rpc(4, "tools/call", {
      name: "get_memory",
      arguments: { id: memoryId }
    });
    assert.match(fetchedMemory.result.content[0].text, /Updated/);
    await rpc(5, "tools/call", {
      name: "delete_memory",
      arguments: { id: memoryId }
    });
    assert.equal(calls.at(-1).init.method, "DELETE");

    await rpc(6, "tools/call", {
      name: "create_task",
      arguments: { title: "Ship feature", due_date: "2026-11-10" }
    });
    const taskCall = calls.at(-1);
    assert.match(taskCall.url, /\/rest\/v1\/tasks$/);
    const taskRow = JSON.parse(taskCall.init.body);
    assert.equal(taskRow.user_id, "test-user");
    assert.equal(taskRow.due_date, "2026-11-10");
    assert.equal(taskRow.is_completed, false);
    const taskId = taskRow.task_id;
    await rpc(7, "tools/call", {
      name: "update_task",
      arguments: { id: taskId, is_completed: true }
    });
    assert.equal(JSON.parse(calls.at(-1).init.body).is_completed, true);
    const fetchedTask = await rpc(8, "tools/call", {
      name: "get_task",
      arguments: { id: taskId }
    });
    assert.match(fetchedTask.result.content[0].text, /"is_completed": true/);

    await rpc(9, "tools/call", {
      name: "list_tasks",
      arguments: { completed: false }
    });
    const listUrl = new URL(calls.at(-1).url);
    assert.equal(listUrl.searchParams.get("user_id"), "eq.test-user");
    assert.equal(listUrl.searchParams.get("is_completed"), "eq.false");
    await rpc(10, "tools/call", {
      name: "delete_task",
      arguments: { id: taskId }
    });
    assert.equal(calls.at(-1).init.method, "DELETE");
  } finally {
    if (previous.url === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.key;
    if (previous.userId === undefined) delete process.env.USER_ID;
    else process.env.USER_ID = previous.userId;
    if (previous.dashboardPassword === undefined) delete process.env.DASHBOARD_PASSWORD;
    else process.env.DASHBOARD_PASSWORD = previous.dashboardPassword;
    globalThis.fetch = previous.fetch;
  }
});

test("public and dashboard routes remain separately wired", async () => {
  const about = await app.request("/about-mcp");
  assert.equal(about.status, 200);
  assert.match(await about.text(), /IrshadMCP/);

  const previous = process.env.DASHBOARD_PASSWORD;
  process.env.DASHBOARD_PASSWORD = "test-password";
  try {
    const dashboard = await app.request("/admin");
    assert.equal(dashboard.status, 401);
  } finally {
    if (previous === undefined) delete process.env.DASHBOARD_PASSWORD;
    else process.env.DASHBOARD_PASSWORD = previous;
  }
});

test("dashboard exposes memory and task management with user-scoped API access", async () => {
  const previous = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    userId: process.env.USER_ID,
    password: process.env.DASHBOARD_PASSWORD,
    fetch: globalThis.fetch
  };
  const rows = new Map();
  const calls = [];
  process.env.SUPABASE_URL = "https://supabase.example";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  process.env.USER_ID = "dashboard-user";
  process.env.DASHBOARD_PASSWORD = "dashboard-password";
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push(url);
    const table = url.pathname.split("/").pop();
    const key = table === "tasks" ? "task_id" : "id";
    const id = url.searchParams.get(key)?.slice(3);
    if (init.method === "POST") {
      const row = JSON.parse(init.body);
      rows.set(`${table}:${row[key]}`, row);
      return Response.json([row]);
    }
    if (init.method === "PATCH") {
      const row = rows.get(`${table}:${id}`);
      if (!row) return Response.json([]);
      const updated = { ...row, ...JSON.parse(init.body) };
      rows.set(`${table}:${id}`, updated);
      return Response.json([updated]);
    }
    if (init.method === "DELETE") {
      const row = rows.get(`${table}:${id}`);
      rows.delete(`${table}:${id}`);
      return Response.json(row ? [row] : []);
    }
    if (id) {
      const row = rows.get(`${table}:${id}`);
      return Response.json(row ? [row] : []);
    }
    return Response.json([...rows.entries()]
      .filter(([recordKey]) => recordKey.startsWith(`${table}:`))
      .map(([, row]) => row));
  };

  const auth = "Basic " + btoa("admin:dashboard-password");
  const call = (path, method = "GET", body) => app.request(path, {
    method,
    headers: {
      Authorization: auth,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  try {
    const dashboard = await call("/admin");
    const html = await dashboard.text();
    assert.equal(dashboard.status, 200);
    assert.match(html, /Memories/);
    assert.match(html, /Tasks/);

    const createdMemoryResponse = await call("/api/memories", "POST", {
      title: "Dashboard memory",
      content: "Remember from dashboard",
      tags: ["dashboard"]
    });
    assert.equal(createdMemoryResponse.status, 201);
    const memory = await createdMemoryResponse.json();
    assert.equal(memory.user_id, "dashboard-user");
    const listedMemories = await (await call("/api/memories")).json();
    assert.equal(listedMemories[0].id, memory.id);
    const memoryUpdateResponse = await call(`/api/memories/${memory.id}`, "PUT", { content: "Updated" });
    assert.equal(memoryUpdateResponse.status, 200);
    const updatedMemoryResponse = await call(`/api/memories/${memory.id}`);
    assert.equal(updatedMemoryResponse.status, 200);
    assert.equal((await updatedMemoryResponse.json()).content, "Updated");
    const memoryDeleteResponse = await call(`/api/memories/${memory.id}`, "DELETE");
    assert.equal(memoryDeleteResponse.status, 200);

    const createdTaskResponse = await call("/api/tasks", "POST", {
      title: "Dashboard task",
      due_date: "2026-11-12"
    });
    assert.equal(createdTaskResponse.status, 201);
    const task = await createdTaskResponse.json();
    assert.equal(task.user_id, "dashboard-user");
    const updatedTaskResponse = await call(`/api/tasks/${task.task_id}`, "PUT", {
      is_completed: true
    });
    assert.equal(updatedTaskResponse.status, 200);
    assert.equal((await updatedTaskResponse.json()).is_completed, true);
    const listedTasks = await (await call("/api/tasks?completed=true")).json();
    assert.equal(listedTasks[0].task_id, task.task_id);
    assert.ok(calls.some(url =>
      url.pathname.endsWith("/tasks") &&
      url.searchParams.get("user_id") === "eq.dashboard-user" &&
      url.searchParams.get("is_completed") === "eq.true"
    ));
    const taskDeleteResponse = await call(`/api/tasks/${task.task_id}`, "DELETE");
    assert.equal(taskDeleteResponse.status, 200);
  } finally {
    if (previous.url === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.key;
    if (previous.userId === undefined) delete process.env.USER_ID;
    else process.env.USER_ID = previous.userId;
    if (previous.password === undefined) delete process.env.DASHBOARD_PASSWORD;
    else process.env.DASHBOARD_PASSWORD = previous.password;
    globalThis.fetch = previous.fetch;
  }
});

test("dashboard inline scripts compile", () => {
  const scripts = [...dashboardHtml().matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length >= 2);
  for (const [, source] of scripts) {
    assert.doesNotThrow(() => new Script(source));
  }
});

test("page shelf lists booklets and nested routes list and serve their pages", async () => {
  const previous = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    fetch: globalThis.fetch
  };
  const records = [
    {
      slug: "first-page",
      title: "First page",
      content: "<main>First page body</main>",
      booklet: "Research Notes",
      updated_at: "2026-11-09T12:00:00.000Z"
    },
    {
      slug: "second-page",
      title: "Second page",
      content: "<main>Second page body</main>",
      booklet: "Research Notes",
      updated_at: "2026-11-08T12:00:00.000Z"
    },
    {
      slug: "loose-page",
      title: "Loose page",
      content: "<main>Loose page body</main>",
      booklet: "",
      updated_at: "2026-11-07T12:00:00.000Z"
    }
  ];
  process.env.SUPABASE_URL = "https://supabase.example";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    const slug = url.searchParams.get("slug");
    const row = slug ? records.find(page => `eq.${page.slug}` === slug) : null;
    return Response.json(slug ? (row ? [row] : []) : records);
  };

  try {
    const shelf = pagesIndexHtml(records);
    assert.match(shelf, /href="\/pages\/Research%20Notes\/"/);
    assert.match(shelf, /href="\/pages\/_unfiled\/"/);
    assert.doesNotMatch(shelf, /href="\/pages\/Research%20Notes\/first-page"/);
    assert.doesNotMatch(shelf, /First page<\/a>/);

    const rootResponse = await app.request("/pages/");
    const rootHtml = await rootResponse.text();
    assert.equal(rootResponse.status, 200);
    assert.match(rootHtml, /Research Notes/);
    assert.doesNotMatch(rootHtml, /First page/);

    const bookletResponse = await app.request("/pages/Research%20Notes/");
    const bookletHtml = await bookletResponse.text();
    assert.equal(bookletResponse.status, 200);
    assert.match(bookletHtml, /First page/);
    assert.match(bookletHtml, /href="\/pages\/Research%20Notes\/first-page"/);
    assert.doesNotMatch(bookletHtml, /Loose page/);

    const nestedPage = await app.request("/pages/Research%20Notes/first-page");
    assert.equal(nestedPage.status, 200);
    assert.equal(await nestedPage.text(), "<main>First page body</main>");

    const unfiledPage = await app.request("/pages/_unfiled/loose-page");
    assert.equal(unfiledPage.status, 200);
    assert.equal(await unfiledPage.text(), "<main>Loose page body</main>");

    const wrongBooklet = await app.request("/pages/Another%20Booklet/first-page");
    assert.equal(wrongBooklet.status, 404);
  } finally {
    if (previous.url === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.key;
    globalThis.fetch = previous.fetch;
  }
});
