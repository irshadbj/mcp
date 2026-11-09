import { deleteSkill, getSkill, insertSkill, listSkills, updateSkill } from "./database.js";
import { cleanString, cleanTags, parseNote, parseTags } from "./common.js";

export const tools = [
  {
    name: "create_skill",
    description: "Create a reusable how-to guide or recipe in the skills table.",
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
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }
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
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }
  }
];

export async function call(tool, args, env) {
  if (tool === "create_skill") {
    const title = cleanString(args.title, 200);
    const content = cleanString(args.content, 50000, false);
    if (!title || !content) throw new Error("title and content are required.");
    const tags = cleanTags(args.tags);
    const now = new Date().toISOString();
    const row = await insertSkill(env, {
      id: crypto.randomUUID(),
      title,
      content,
      tags: JSON.stringify(tags),
      created_at: now,
      updated_at: now
    });
    if (!row) throw new Error("Skill could not be saved.");
    return parseNote(row);
  }
  if (tool === "list_skills") {
    const query = typeof args.query === "string" ? args.query.trim().slice(0, 200) : "";
    const tag = typeof args.tag === "string" ? args.tag.trim().slice(0, 40) : "";
    const limit = Math.max(1, Math.min(100, Number.parseInt(args.limit, 10) || 25));
    return (await listSkills(env, { query, tag, limit })).map(parseNote);
  }
  if (tool === "get_skill") {
    const id = cleanString(args.id, 100);
    const row = await getSkill(env, id);
    if (!row) throw new Error("Skill not found.");
    return parseNote(row);
  }
  if (tool === "update_skill") {
    const id = cleanString(args.id, 100);
    const current = await getSkill(env, id);
    if (!current) throw new Error("Skill not found.");
    const title = args.title === undefined ? current.title : cleanString(args.title, 200);
    const content = args.content === undefined ? current.content : cleanString(args.content, 50000, false);
    const tags = args.tags === undefined ? parseTags(current.tags) : cleanTags(args.tags);
    if (!title || !content) throw new Error("title and content cannot be empty.");
    const updated = await updateSkill(env, id, {
      title, content, tags: JSON.stringify(tags), updated_at: new Date().toISOString()
    });
    if (!updated) throw new Error("Skill not found.");
    return parseNote(updated);
  }
  if (tool === "delete_skill") {
    const id = cleanString(args.id, 100);
    if (!(await deleteSkill(env, id))) throw new Error("Skill not found.");
    return { deleted: true, id };
  }
  return undefined;
}
