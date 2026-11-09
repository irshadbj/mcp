import {
  deleteOwnedRecord,
  getOwnedRecord,
  insertOwnedRecord,
  listOwnedRecords,
  updateOwnedRecord
} from "./database.js";
import { cleanString, cleanTags } from "./common.js";

export const tools = [
  {
    name: "create_memory",
    description: "Save a memory for the signed-in Google account.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1, maxLength: 200 },
        content: { type: "string", minLength: 1, maxLength: 500000 },
        tags: { type: "array", items: { type: "string" }, maxItems: 20 }
      },
      required: ["title", "content"]
    }
  },
  {
    name: "list_memories",
    description: "List the signed-in Google account's memories, optionally searching text or filtering by tag.",
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
    name: "get_memory",
    description: "Read a memory by ID.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }
  },
  {
    name: "update_memory",
    description: "Update a memory by ID. Supply one or more fields.",
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
    name: "delete_memory",
    description: "Permanently delete a memory by ID.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }
  }
];

export async function call(tool, args, env) {
  if (tool === "create_memory") {
    const title = cleanString(args.title, 200);
    const content = cleanString(args.content, 500000, false);
    if (!title || !content) throw new Error("title and content are required.");
    const now = new Date().toISOString();
    const row = await insertOwnedRecord(env, "memories", {
      id: crypto.randomUUID(),
      title,
      content,
      tags: cleanTags(args.tags),
      created_at: now,
      updated_at: now
    });
    if (!row) throw new Error("Memory could not be saved.");
    return row;
  }
  if (tool === "list_memories") {
    const query = typeof args.query === "string" ? args.query.trim().slice(0, 200) : "";
    const tag = typeof args.tag === "string" ? args.tag.trim().slice(0, 40) : "";
    return listOwnedRecords(env, "memories", {
      query,
      tag,
      limit: safeLimit(args.limit),
      searchColumns: ["title", "content"]
    });
  }
  if (tool === "get_memory") {
    const id = cleanString(args.id, 100);
    const row = await getOwnedRecord(env, "memories", "id", id);
    if (!row) throw new Error("Memory not found.");
    return row;
  }
  if (tool === "update_memory") {
    const id = cleanString(args.id, 100);
    const current = await getOwnedRecord(env, "memories", "id", id);
    if (!current) throw new Error("Memory not found.");
    const title = args.title === undefined ? current.title : cleanString(args.title, 200);
    const content = args.content === undefined ? current.content : cleanString(args.content, 500000, false);
    const tags = args.tags === undefined ? current.tags : cleanTags(args.tags);
    if (!title || !content) throw new Error("title and content cannot be empty.");
    const updated = await updateOwnedRecord(env, "memories", "id", id, {
      title, content, tags, updated_at: new Date().toISOString()
    });
    if (!updated) throw new Error("Memory not found.");
    return updated;
  }
  if (tool === "delete_memory") {
    const id = cleanString(args.id, 100);
    if (!(await deleteOwnedRecord(env, "memories", "id", id))) {
      throw new Error("Memory not found.");
    }
    return { deleted: true, id };
  }
  return undefined;
}

function safeLimit(value) {
  return Math.max(1, Math.min(100, Number.parseInt(value, 10) || 25));
}
