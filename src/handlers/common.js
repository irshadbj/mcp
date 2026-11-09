export function cleanString(value, max, trim = true) {
  if (typeof value !== "string") return "";
  const out = trim ? value.trim() : value;
  return out.length > 0 && out.length <= max ? out : "";
}

export function cleanTags(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(tag => typeof tag === "string" && tag.trim())
    .slice(0, 20)
    .map(tag => tag.trim().slice(0, 40));
}

export function parseTags(value) {
  try {
    const tags = JSON.parse(value || "[]");
    return Array.isArray(tags) ? tags : [];
  } catch {
    return [];
  }
}

export function parseNote(row) {
  const tags = parseTags(row.tags);
  return { ...row, tags, html: renderNoteHtml(row.content) };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, character =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character])
  );
}

function inlineHtml(text) {
  return String(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
}

export function renderNoteHtml(content) {
  const lines = String(content ?? "").replace(/\r\n?/g, "\n").split("\n");
  const output = [];
  let inCode = false;
  let list = null;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length) output.push("<p>" + paragraph.join("<br>") + "</p>");
    paragraph = [];
  };
  const closeList = () => {
    if (list) {
      output.push("</" + list + ">");
      list = null;
    }
  };

  for (const rawLine of lines) {
    const line = escapeHtml(rawLine);
    if (/^\s*```/.test(line)) {
      flushParagraph();
      closeList();
      if (inCode) {
        output.push("</code></pre>");
        inCode = false;
      } else {
        output.push("<pre><code>");
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      output.push(line + "\n");
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${inlineHtml(heading[2])}</h${level}>`);
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flushParagraph();
      closeList();
      output.push("<hr>");
      continue;
    }
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      if (list !== "ul") {
        closeList();
        output.push("<ul>");
        list = "ul";
      }
      output.push("<li>" + inlineHtml(bullet[1]) + "</li>");
      continue;
    }
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (numbered) {
      flushParagraph();
      if (list !== "ol") {
        closeList();
        output.push("<ol>");
        list = "ol";
      }
      output.push("<li>" + inlineHtml(numbered[1]) + "</li>");
      continue;
    }
    const quote = line.match(/^\s*&gt;\s?(.*)$/);
    if (quote) {
      flushParagraph();
      closeList();
      output.push("<blockquote>" + inlineHtml(quote[1]) + "</blockquote>");
      continue;
    }
    paragraph.push(inlineHtml(line));
  }

  if (inCode) output.push("</code></pre>");
  flushParagraph();
  closeList();
  return output.join("");
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function isValidSlug(value) {
  return typeof value === "string" && SLUG_PATTERN.test(value);
}

export function toSlug(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
}

export function pageView(row, origin) {
  return {
    slug: row.slug,
    title: row.title,
    booklet: row.booklet || "",
    html: row.content ?? row.html ?? "",
    url: origin + "/pages/" + row.slug,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export function pageNotFound(headers) {
  return new Response(
    '<!doctype html><html lang="en"><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      "<title>Page not found</title>" +
      '<body style="font:16px/1.6 system-ui,-apple-system,sans-serif;margin:64px auto;max-width:640px;padding:0 20px;color:#172033">' +
      "<h1>Page not found</h1>" +
      "<p>This page is not published on this server.</p>" +
      '<p><a href="/" style="color:#3157d5">Back to the home page</a></p>' +
      "</body></html>",
    { status: 404, headers }
  );
}
