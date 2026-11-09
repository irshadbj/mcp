import { deleteNote, getNote, insertNote, listNotes, updateNote } from "./database.js";
import { cleanString, cleanTags, parseNote, parseTags } from "./common.js";

export const tools = [
  {
    name: "create_note",
    description: "Create a private note in the notes table. Use publish_page for public pages.",
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
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }
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
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }
  }
];

export async function call(tool, args, env) {
  if (tool === "create_note") {
    const title = cleanString(args.title, 200);
    const content = cleanString(args.content, 500000, false);
    if (!title || !content) throw new Error("title and content are required.");
    const tags = cleanTags(args.tags);
    const now = new Date().toISOString();
    const row = await insertNote(env, {
      id: crypto.randomUUID(),
      title,
      content,
      tags: JSON.stringify(tags),
      created_at: now,
      updated_at: now
    });
    if (!row) throw new Error("Note could not be saved.");
    return parseNote(row);
  }
  if (tool === "list_notes") {
    const query = typeof args.query === "string" ? args.query.trim().slice(0, 200) : "";
    const tag = typeof args.tag === "string" ? args.tag.trim().slice(0, 40) : "";
    return (await listNotes(env, { query, tag, limit: safeLimit(args.limit) })).map(parseNote);
  }
  if (tool === "get_note") {
    const id = cleanString(args.id, 100);
    const row = await getNote(env, id);
    if (!row) throw new Error("Note not found.");
    return parseNote(row);
  }
  if (tool === "update_note") {
    const id = cleanString(args.id, 100);
    const current = await getNote(env, id);
    if (!current) throw new Error("Note not found.");
    const title = args.title === undefined ? current.title : cleanString(args.title, 200);
    const content = args.content === undefined ? current.content : cleanString(args.content, 500000, false);
    const tags = args.tags === undefined ? parseTags(current.tags) : cleanTags(args.tags);
    if (!title || !content) throw new Error("title and content cannot be empty.");
    const updated = await updateNote(env, id, {
      title, content, tags: JSON.stringify(tags), updated_at: new Date().toISOString()
    });
    if (!updated) throw new Error("Note not found.");
    return parseNote(updated);
  }
  if (tool === "delete_note") {
    const id = cleanString(args.id, 100);
    if (!(await deleteNote(env, id))) throw new Error("Note not found.");
    return { deleted: true, id };
  }
  return undefined;
}

function safeLimit(value, fallback = 25) {
  return Math.max(1, Math.min(100, Number.parseInt(value, 10) || fallback));
}
