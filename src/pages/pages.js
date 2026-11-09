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
 * The shelf lists booklets. Opening a booklet lists its pages; HTML remains
 * available only at each page's nested URL.
 */
export function pagesIndexHtml(pages, {
  error = "",
  booklet = null,
  bookletPath = null
} = {}) {
  const rows = Array.isArray(pages) ? pages : [];
  const groups = new Map();
  for (const page of rows) {
    const label = String(page.booklet || "").trim();
    const key = label.toLocaleLowerCase() || "_unfiled";
    if (!groups.has(key)) {
      groups.set(key, {
        label: label || "Unfiled",
        path: label ? encodeURIComponent(label) : "_unfiled",
        pages: []
      });
    }
    groups.get(key).pages.push(page);
  }

  const ordered = [...groups.values()].sort((a, b) => {
    if (a.path === "_unfiled") return 1;
    if (b.path === "_unfiled") return -1;
    return a.label.localeCompare(b.label);
  });

  const pageBookletPath = bookletPath || encodeURIComponent(String(booklet || ""));
  const content = booklet === null
    ? ordered.map(group => `<a class="unit booklet" href="/pages/${group.path}/">
      <span class="spine" aria-hidden="true"></span>
      <span class="bookletInfo"><span class="bname">${esc(group.label)}</span><span class="meta">Open this booklet</span></span>
      <span class="bcount">${group.pages.length} ${group.pages.length === 1 ? "page" : "pages"}</span>
      <span class="bookletArrow" aria-hidden="true">→</span>
    </a>`).join("\n")
    : rows.map(page =>
      `<article class="pageRow">
        <span class="pageIcon" aria-hidden="true">↗</span>
        <div class="pageInfo"><a href="/pages/${pageBookletPath}/${encodeURIComponent(page.slug)}">${esc(page.title)}</a><span class="meta">Updated ${esc(formatDate(page.updated_at))}</span></div>
      </article>`
    ).join("\n");

  const shelf = error
    ? `<p class="empty">${esc(error)}</p>`
    : content ||
      (booklet === null
        ? '<p class="empty">No booklets yet. Add a booklet name when publishing a page to see it here.</p>'
        : '<p class="empty">This booklet has no pages yet.</p>');
  const title = booklet === null ? "The page shelf" : String(booklet);
  const eyebrow = booklet === null
    ? "Public directory"
    : '<a href="/pages/">The page shelf</a> &nbsp; / &nbsp; Booklet';
  const lead = booklet === null
    ? 'Published pages are organized into booklets. Choose a booklet to browse its pages.'
    : `Pages in the ${esc(booklet)} booklet. Choose a title to open its published page.`;

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
.unit{margin-bottom:16px}
.booklet{display:flex;align-items:center;gap:16px;padding:18px 20px;background:#fff;border:1px solid var(--line);border-left:6px solid var(--accent);border-radius:12px;overflow:hidden;box-shadow:0 12px 26px rgba(23,32,51,.07);transition:transform .18s ease,box-shadow .18s ease}
.booklet:hover{transform:translateY(-2px);box-shadow:0 17px 32px rgba(23,32,51,.12);text-decoration:none}
.bookletInfo,.pageInfo{display:flex;flex-direction:column;min-width:0}
.bookletInfo .meta{margin-top:3px}
.spine{width:10px;align-self:stretch;min-height:34px;border-radius:4px;background:linear-gradient(180deg,var(--accent),#7c3aed);flex-shrink:0}
.bname{font-weight:800;font-size:18px;overflow-wrap:anywhere}
.bcount{margin-left:auto;flex-shrink:0;color:var(--muted);font-size:13px;background:var(--soft);border-radius:999px;padding:3px 10px}
.bookletArrow{font-size:22px;color:var(--accent);transition:transform .18s ease}
.booklet:hover .bookletArrow{transform:translateX(4px)}
.pageRow{display:flex;align-items:center;gap:14px;margin:0 0 12px;padding:16px 18px;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 7px 18px rgba(23,32,51,.06)}
.pageIcon{display:grid;place-items:center;width:38px;height:38px;flex-shrink:0;border-radius:11px;background:var(--soft);color:var(--accent);font-weight:800}
.pageInfo a{font-weight:750;overflow-wrap:anywhere}
.pageInfo .meta{margin-top:3px}
.meta,.empty{color:var(--muted);font-size:14px}
.empty{background:#fff;border:1px solid var(--line);border-radius:16px;padding:26px}
code{background:#eef2ff;border-radius:6px;padding:2px 6px;font:14px ui-monospace,Consolas,monospace}
footer{border-top:1px solid var(--line);padding:24px 0;color:var(--muted);font-size:14px}
.foot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
@media(max-width:640px){.nav{padding:13px 0;align-items:flex-start}.links{gap:12px;justify-content:flex-end;font-size:13px}.bcount{display:none}.booklet{padding:15px 13px;gap:11px}.bookletArrow{display:none}}
</style>
</head>
<body>
<header><div class="wrap nav"><a class="brand" href="/"><img src="/logo.svg" alt=""><span>IrshadMCP</span></a><nav class="links"><a href="/">Home</a><a href="/about-mcp">MCP profile</a></nav></div></header>
<main>
<section class="hero"><div class="wrap"><div class="eyebrow">${eyebrow}</div><h1>${esc(title)}</h1><p class="lead">${lead}</p></div></section>
<section class="section"><div class="wrap">${shelf}</div></section>
</main>
<footer><div class="wrap foot"><span>IrshadMCP · Your notes, with AI</span><span><a href="/">Home</a> · <a href="/about-mcp">MCP profile</a></span></div></footer>
<script>if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});</script>
</body>
</html>`;
}
