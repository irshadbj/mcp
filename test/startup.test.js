import test from "node:test";
import assert from "node:assert/strict";
import app from "../src/index.js";

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
    await rpc(4, "tools/call", {
      name: "publish_page",
      arguments: { title: "Public page", html: "<h1>Hello</h1>" }
    });
    assert.match(calls.at(-1).url, /\/rest\/v1\/pages\?/);

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
