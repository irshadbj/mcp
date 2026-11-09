import { deletePage, getPage, listPages, savePage } from "./database.js";
import { cleanString, isValidSlug, pageView, toSlug } from "./common.js";

export const tools = [
  {
    name: "publish_page",
    description: "Publish or replace a public HTML page. Optionally add it to a booklet.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", pattern: "^[a-z0-9][a-z0-9-]{0,63}$" },
        title: { type: "string", minLength: 1, maxLength: 200 },
        html: { type: "string", minLength: 1, maxLength: 200000 },
        booklet: { type: "string", maxLength: 80 }
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
    inputSchema: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] }
  },
  {
    name: "delete_page",
    description: "Permanently unpublish a page by slug.",
    inputSchema: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] }
  }
];

export async function call(tool, args, env, origin) {
  if (tool === "publish_page") {
    const title = cleanString(args.title, 200);
    const content = cleanString(args.html, 200000, false);
    const booklet = cleanString(args.booklet, 80);
    if (!title || !content) throw new Error("title and html are required.");
    const requested = typeof args.slug === "string" ? args.slug.trim().toLowerCase() : "";
    const slug = requested || toSlug(title);
    if (!isValidSlug(slug)) {
      throw new Error("Invalid slug. Use 1-64 characters: a-z, 0-9 and hyphens.");
    }
    const existing = await getPage(env, slug, true);
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
    return pageView(saved, origin);
  }
  if (tool === "list_pages") {
    const limit = Math.max(1, Math.min(100, Number.parseInt(args.limit, 10) || 25));
    const query = typeof args.query === "string" ? args.query.trim().slice(0, 200) : "";
    return (await listPages(env, { query, limit, ownerOnly: true })).map(page => pageView(page, origin));
  }
  if (tool === "get_page") {
    const slug = typeof args.slug === "string" ? args.slug.trim().toLowerCase() : "";
    if (!isValidSlug(slug)) throw new Error("Invalid slug.");
    const row = await getPage(env, slug, true);
    if (!row) throw new Error("Page not found.");
    return pageView(row, origin);
  }
  if (tool === "delete_page") {
    const slug = typeof args.slug === "string" ? args.slug.trim().toLowerCase() : "";
    if (!isValidSlug(slug)) throw new Error("Invalid slug.");
    const page = await getPage(env, slug, true);
    if (!page) throw new Error("Page not found.");
    if (!(await deletePage(env, slug, true))) throw new Error("Page not found.");
    const bookletPath = String(page.booklet || "").trim()
      ? encodeURIComponent(String(page.booklet).trim())
      : "_unfiled";
    return {
      deleted: true,
      slug,
      url: origin + "/pages/" + bookletPath + "/" + encodeURIComponent(slug)
    };
  }
  return undefined;
}
