import {
  deleteOwnedRecord,
  getOwnedRecord,
  insertOwnedRecord,
  listOwnedRecords,
  updateOwnedRecord
} from "./database.js";
import { cleanString } from "./common.js";

export const tools = [
  {
    name: "create_task",
    description: "Create a task for the signed-in Google account.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1, maxLength: 200 },
        description: { type: "string", maxLength: 50000 },
        due_date: { type: "string", format: "date" }
      },
      required: ["title"]
    }
  },
  {
    name: "list_tasks",
    description: "List the signed-in Google account's tasks, optionally searching or filtering by completion.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        completed: { type: "boolean" },
        limit: { type: "integer", minimum: 1, maximum: 100 }
      }
    }
  },
  {
    name: "get_task",
    description: "Read a task by ID.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }
  },
  {
    name: "update_task",
    description: "Update a task's title, description, due date, or completion state.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        due_date: { type: ["string", "null"], format: "date" },
        is_completed: { type: "boolean" }
      },
      required: ["id"]
    }
  },
  {
    name: "delete_task",
    description: "Permanently delete a task by ID.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }
  }
];

export async function call(tool, args, env) {
  if (tool === "create_task") {
    const title = cleanString(args.title, 200);
    if (!title) throw new Error("title is required.");
    const description = args.description === undefined ? null : cleanString(args.description, 50000, false);
    if (args.description !== undefined && description === "") {
      throw new Error("description cannot be empty.");
    }
    const dueDate = normalizeDate(args.due_date);
    const now = new Date().toISOString();
    const row = await insertOwnedRecord(env, "tasks", {
      task_id: crypto.randomUUID(),
      title,
      description,
      due_date: dueDate,
      is_completed: false,
      created_at: now,
      updated_at: now
    });
    if (!row) throw new Error("Task could not be saved.");
    return row;
  }
  if (tool === "list_tasks") {
    const query = typeof args.query === "string" ? args.query.trim().slice(0, 200) : "";
    return listOwnedRecords(env, "tasks", {
      query,
      completed: typeof args.completed === "boolean" ? args.completed : undefined,
      limit: safeLimit(args.limit),
      searchColumns: ["title", "description"]
    });
  }
  if (tool === "get_task") {
    const id = cleanString(args.id, 100);
    const row = await getOwnedRecord(env, "tasks", "task_id", id);
    if (!row) throw new Error("Task not found.");
    return row;
  }
  if (tool === "update_task") {
    const id = cleanString(args.id, 100);
    const current = await getOwnedRecord(env, "tasks", "task_id", id);
    if (!current) throw new Error("Task not found.");
    const patch = {};
    if (args.title !== undefined) {
      patch.title = cleanString(args.title, 200);
      if (!patch.title) throw new Error("title cannot be empty.");
    }
    if (args.description !== undefined) {
      patch.description = args.description === null ? null : cleanString(args.description, 50000, false);
      if (patch.description === "") throw new Error("description cannot be empty.");
    }
    if (args.due_date !== undefined) patch.due_date = normalizeDate(args.due_date);
    if (args.is_completed !== undefined) {
      if (typeof args.is_completed !== "boolean") {
        throw new Error("is_completed must be a boolean.");
      }
      patch.is_completed = args.is_completed;
    }
    if (!Object.keys(patch).length) throw new Error("At least one task field must be provided.");
    patch.updated_at = new Date().toISOString();
    const updated = await updateOwnedRecord(env, "tasks", "task_id", id, patch);
    if (!updated) throw new Error("Task not found.");
    return updated;
  }
  if (tool === "delete_task") {
    const id = cleanString(args.id, 100);
    if (!(await deleteOwnedRecord(env, "tasks", "task_id", id))) {
      throw new Error("Task not found.");
    }
    return { deleted: true, id };
  }
  return undefined;
}

function normalizeDate(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("due_date must use YYYY-MM-DD.");
  }
  const date = new Date(value + "T00:00:00.000Z");
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("due_date must be a valid calendar date.");
  }
  return value;
}

function safeLimit(value) {
  return Math.max(1, Math.min(100, Number.parseInt(value, 10) || 25));
}
