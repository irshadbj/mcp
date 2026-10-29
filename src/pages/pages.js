function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

/**
 * Public shelf of pages published through the MCP publish_page tool.
 * Pages are grouped into booklets (pages.booklet); each booklet expands to
 * show the pages it contains. Only titles, slugs and timestamps are
 * rendered — never the page HTML itself.
 */
export function pagesIndexHtml(pages, { error = "" } = {}) {
  const rows = Array.isArray(pages) ? pages : [];

  // Group into booklets, case-insensitively; pages without one go to Unfiled.
  const groups = new Map();
  for (const p of rows) {
    const raw = String(p.booklet || "").trim();
    const key = raw.toLowerCase() || "unfiled";
    if (!groups.has(key)) groups.set(key, { label: raw || "Unfiled", pages: [] });
    groups.get(key).pages.push(p);
  }

  const ordered = [...groups.entries()].sort(([keyA, a], [keyB, b]) => {
    if (keyA === "unfiled") return 1;
    if (keyB === "unfiled") return -1;
    return a.label.localeCompare(b.label);
  });

  const booklets = ordered
    .map(
      ([, group]) => `<div class="unit">
      <details class="booklet">
        <summary>
          <span class="spine" aria-hidden="true"></span>
          <span class="bname">${esc(group.label)}</span>
          <span class="bcount">${group.pages.length} ${group.pages.length === 1 ? "page" : "pages"}</span>
        </summary>
        <ul class="pageList">
${group.pages
  .map(
    (p) =>
      `          <li><a href="/pages/${encodeURIComponent(p.slug)}">${esc(p.title)}</a><span class="meta">/pages/${esc(p.slug)} · Updated ${esc(formatDate(p.updated_at))}</span></li>`
  )
  .join("\n")}
        </ul>
      </details>
      <div class="board" aria-hidden="true"></div>
    </div>`
    )
    .join("\n");

  const shelf = error
    ? `<p class="empty">${esc(error)}</p>`
    : booklets ||
      '<p class="empty">No pages published yet. Pages appear here as soon as they are published through the <code>publish_page</code> tool.</p>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="Shelf of public pages published on IrshadMCP, arranged in booklets.">
<link rel="icon" type="image/svg+xml" href="/logo.svg">
<title>IrshadMCP · Page shelf</title>
<style>
:root{color-scheme:light;--ink:#172033;--muted:#66738a;--line:#e2e8f0;--accent:#3157d5;--bg:#f7f9fd;--soft:#eef2ff;--wood1:#c9976b;--wood2:#9c6b3b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.wrap{width:min(1060px,calc(100% - 36px));margin:auto}
header{background:#fff;border-bottom:1px solid var(--line)}
.nav{min-height:74px;display:flex;align-items:center;justify-content:space-between;gap:20px}
.brand{display:flex;align-items:center;gap:11px;color:var(--ink);font-size:20px;font-weight:800}
.brand:hover{text-decoration:none}.brand img{width:40px;height:40px;border-radius:11px}
.links{display:flex;gap:22px;flex-wrap:wrap;font-size:14px;font-weight:700}
.hero{padding:54px 0 30px;background:radial-gradient(ellipse at 82% 10%,#e0e7ff 0,transparent 45%)}
.eyebrow{color:var(--accent);font-size:12px;font-weight:850;letter-spacing:.12em;text-transform:uppercase}
h1{font-size:clamp(32px,5vw,50px);line-height:1.1;letter-spacing:-.045em;margin:14px 0}
.lead{max-width:760px;color:var(--muted);font-size:18px;margin:0}
.section{padding:26px 0 44px}
.unit{margin-bottom:30px}
.booklet{background:#fff;border:1px solid var(--line);border-left:6px solid var(--accent);border-radius:12px;overflow:hidden;box-shadow:0 12px 26px rgba(23,32,51,.07)}
.booklet summary{display:flex;align-items:center;gap:14px;cursor:pointer;padding:16px 18px;list-style:none}
.booklet summary::-webkit-details-marker{display:none}
.booklet summary:hover{background:#fafbff}
.spine{width:10px;align-self:stretch;min-height:34px;border-radius:4px;background:linear-gradient(180deg,var(--accent),#7c3aed);flex-shrink:0}
.bname{font-weight:800;font-size:18px;overflow-wrap:anywhere}
.bcount{margin-left:auto;flex-shrink:0;color:var(--muted);font-size:13px;background:var(--soft);border-radius:999px;padding:3px 10px}
.booklet[open] summary{border-bottom:1px solid var(--line)}
.pageList{list-style:none;margin:0;padding:6px 18px 14px}
.pageList li{display:flex;flex-wrap:wrap;gap:2px 14px;align-items:baseline;padding:11px 0;border-bottom:1px dashed var(--line)}
.pageList li:last-child{border-bottom:0}
.pageList a{font-weight:700;overflow-wrap:anywhere}
.board{height:10px;border-radius:3px;background:linear-gradient(180deg,var(--wood1),var(--wood2));box-shadow:0 8px 16px rgba(120,80,40,.28);margin-top:4px}
.meta,.empty{color:var(--muted);font-size:14px}
.empty{background:#fff;border:1px solid var(--line);border-radius:16px;padding:26px}
code{background:#eef2ff;border-radius:6px;padding:2px 6px;font:14px ui-monospace,Consolas,monospace}
footer{border-top:1px solid var(--line);padding:24px 0;color:var(--muted);font-size:14px}
.foot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
@media(max-width:640px){.nav{padding:13px 0;align-items:flex-start}.links{gap:12px;justify-content:flex-end;font-size:13px}.bcount{display:none}}
</style>
</head>
<body>
<header><div class="wrap nav"><a class="brand" href="/"><img src="/logo.svg" alt=""><span>IrshadMCP</span></a><nav class="links"><a href="/">Home</a><a href="/about-mcp">MCP profile</a></nav></div></header>
<main>
<section class="hero"><div class="wrap"><div class="eyebrow">Public directory</div><h1>The page shelf</h1><p class="lead">Published pages stand in booklets on this shelf. Open a booklet to see the pages it contains — each page keeps its own permanent <code>/pages/your-slug</code> address.</p></div></section>
<section class="section"><div class="wrap">${shelf}</div></section>
</main>
<footer><div class="wrap foot"><span>IrshadMCP · Your notes, with AI</span><span><a href="/">Home</a> · <a href="/about-mcp">MCP profile</a></span></div></footer>
<script>if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});</script>
</body>
</html>`;
}
