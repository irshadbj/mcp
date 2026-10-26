export function dashboardHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<link rel="icon" type="image/svg+xml" href="/logo.svg">
<title>IrshadMCP · Notes Dashboard</title>
<style>
:root {
  color-scheme: light;
  --ink: #172033;
  --muted: #687386;
  --line: #e3e8ef;
  --bg: #f5f7fb;
  --accent: #3157d5;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 15px/1.5 system-ui, -apple-system, Segoe UI, sans-serif;
}
header {
  background: #fff;
  border-bottom: 1px solid var(--line);
  padding: 20px max(20px, calc((100% - 1180px)/2));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.brand { display: flex; align-items: center; gap: 12px; }
.brand img { width: 40px; height: 40px; border-radius: 10px; }
h1 { font-size: 22px; margin: 0; }
main {
  max-width: 1180px;
  margin: 24px auto;
  padding: 0 18px;
  display: block;
  gap: 20px;
}
.panel {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 18px;
  min-width: 0;
}
.toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 14px 0;
}
input, textarea {
  font: inherit;
  width: 100%;
  padding: 11px 12px;
  border: 1px solid #cfd6e2;
  border-radius: 9px;
  background: white;
  color: var(--ink);
}
textarea { min-height: 250px; resize: vertical; }
label {
  display: block;
  font-weight: 650;
  margin: 12px 0 5px;
}
button {
  font: inherit;
  border: 0;
  border-radius: 9px;
  padding: 10px 14px;
  cursor: pointer;
  background: var(--accent);
  color: white;
  font-weight: 650;
}
button.secondary { background: #eef1f7; color: #27334a; }
button.danger { background: #b42335; }
.note {
  border: 1px solid var(--line);
  border-radius: 11px;
  padding: 13px;
  margin-top: 10px;
  cursor: pointer;
}
.note:hover { border-color: #9aadef; }
.note h3 {
  margin: 0 0 5px;
  font-size: 16px;
  overflow-wrap: anywhere;
}
.meta, .preview { color: var(--muted); font-size: 13px; }
.preview {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 65px;
  overflow: hidden;
}
.tags { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 8px; }
.tag {
  font-size: 12px;
  background: #edf1ff;
  color: #334a9d;
  border-radius: 20px;
  padding: 2px 8px;
}
.noteBody { overflow-wrap: anywhere; }
.noteBody > :first-child { margin-top: 0; }
.noteBody > :last-child { margin-bottom: 0; }
.noteBody h1 { font-size: 23px; margin: 18px 0 8px; }
.noteBody h2 { font-size: 19px; margin: 16px 0 7px; }
.noteBody h3 { font-size: 16px; margin: 14px 0 6px; }
.noteBody p { margin: 0 0 11px; line-height: 1.65; }
.noteBody ul, .noteBody ol { margin: 0 0 12px; padding-left: 22px; }
.noteBody li { margin: 4px 0; }
.noteBody a { color: var(--accent); }
.noteBody code { background: #eef1f7; border-radius: 5px; padding: 2px 5px; font: 13px ui-monospace, Consolas, monospace; }
.noteBody pre { background: #101828; color: #e7edff; padding: 13px; border-radius: 10px; overflow: auto; }
.noteBody pre code { background: none; color: inherit; padding: 0; }
.noteBody blockquote { margin: 12px 0; padding: 4px 14px; border-left: 3px solid var(--accent); color: var(--muted); background: #fff; }
.noteBody hr { border: 0; border-top: 1px solid var(--line); margin: 16px 0; }
.pageCard { display: flex; justify-content: space-between; gap: 12px; align-items: center; cursor: default; }
.pageCard:hover { border-color: var(--line); }
.pageCard h3 { margin-bottom: 3px; }
.pageCard .preview { max-height: none; }
.pageActions { display: flex; gap: 7px; flex-shrink: 0; }
.mini { font: inherit; font-size: 13px; font-weight: 650; border: 1px solid #cfd6e2; background: #fff; color: var(--ink); border-radius: 8px; padding: 6px 10px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
.mini:hover { border-color: #9aadef; }
button.mini.danger { background: #b42335; border-color: #b42335; color: #fff; }
#status{min-height:24px;color:var(--muted);margin-top:10px}dialog{width:min(720px,calc(100% - 28px));max-height:calc(100dvh - 28px);overflow:auto;padding:0;border:0;background:transparent}dialog::backdrop{background:rgba(15,23,42,.56);backdrop-filter:blur(3px)}dialog .panel{box-shadow:0 24px 80px rgba(15,23,42,.22)}.dialogHeader{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.dialogHeader h2{margin:0}#status{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:10;background:#172033;color:#fff;padding:9px 14px;border-radius:10px;max-width:calc(100% - 28px)}
.empty { color: var(--muted); padding: 20px 0; }
@media (max-width: 800px) {
  main { margin-top: 14px; }
  header { padding: 16px 18px; }
  textarea { min-height: 180px; }
}
</style>
</head>
<body>
<header>
  <div class="brand">
    <img src="/logo.svg" alt="IrshadMCP logo">
    <div>
      <h1>IrshadMCP</h1>
      <div class="meta">Your private notes</div>
    </div>
  </div>
  <div style="display:flex;gap:10px;align-items:center"><a class="meta" href="/" style="text-decoration:none">← Home</a><button id="newBtn">+ New note</button></div>
</header>

<main><section class="panel"><h2>All notes</h2><div class="toolbar"><input id="search" placeholder="Search title, content, or tags…" aria-label="Search notes"><input id="tagFilter" placeholder="Filter by tag" aria-label="Filter by tag"></div><div id="notes"><p class="empty">Loading notes…</p></div></section><section class="panel" style="margin-top:20px"><h2>Published pages</h2><p class="meta">HTML pages published by your AI assistant through the MCP <code>publish_page</code> tool.</p><div id="pages"><p class="empty">Loading pages…</p></div></section></main><div id="status" role="status" aria-live="polite"></div><dialog id="editorDialog" aria-labelledby="formTitle"><section class="panel"><div class="dialogHeader"><h2 id="formTitle">Create a note</h2><button type="button" class="secondary" id="closeEditor">Close</button></div><form id="editor"><input type="hidden" id="id"><label for="title">Title</label><input id="title" maxlength="200" required placeholder="Note title"><label for="content">Content</label><textarea id="content" maxlength="50000" required placeholder="Write your note…"></textarea><label for="tags">Tags (comma-separated)</label><input id="tags" placeholder="work, study, ideas"><div class="toolbar"><button type="submit">Save note</button><button type="button" class="secondary" id="clearBtn">Clear fields</button><button type="button" class="danger" id="deleteBtn" hidden>Delete</button></div></form></section></dialog>

<dialog id="readerDialog" aria-labelledby="readerTitle"><section class="panel"><div class="dialogHeader"><h2 id="readerTitle">Note</h2><button type="button" class="secondary" id="closeReader">Close</button></div><div class="meta" id="readerMeta"></div><div class="tags" id="readerTags"></div><article class="noteBody" id="readerBody" style="margin-top:16px"></article><div class="toolbar"><button type="button" id="readerEdit">Edit note</button></div></section></dialog>

<script>
const $=id=>document.getElementById(id);let notes=[],pages=[],reading=null;
async function api(path,options={}){const r=await fetch(path,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});const data=await r.json().catch(()=>({error:"Unexpected server response"}));if(!r.ok)throw new Error(data.error||"Request failed");return data;}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function render(){const q=$("search").value.trim().toLowerCase(),tag=$("tagFilter").value.trim().toLowerCase();const found=notes.filter(n=>(!q||(n.title+" "+n.content+" "+(n.tags||[]).join(" ")).toLowerCase().includes(q))&&(!tag||(n.tags||[]).some(t=>t.toLowerCase().includes(tag))));$("notes").innerHTML=found.length?found.map(n=>'<article class="note" data-id="'+esc(n.id)+'" tabindex="0" role="button" aria-label="Read '+esc(n.title)+'"><h3>'+esc(n.title)+'</h3><div class="meta">Updated '+esc(new Date(n.updated_at).toLocaleString())+'</div><div class="preview">'+(n.html||esc(n.content))+'</div><div class="tags">'+(n.tags||[]).map(t=>'<span class="tag">'+esc(t)+'</span>').join("")+'</div></article>').join(""):'<p class="empty">No matching notes.</p>';}
async function load(){try{notes=await api("/api/notes");render();}catch(e){$("notes").innerHTML='<p class="empty">'+esc(e.message)+'</p>';}}
function clearForm(){$("id").value="";$("title").value="";$("content").value="";$("tags").value="";$("formTitle").textContent="Create a note";$("deleteBtn").hidden=true;}
function openEditor(){if(!$("editorDialog").open)$("editorDialog").showModal();$("title").focus();}
function closeEditor(){if($("editorDialog").open)$("editorDialog").close();}
function edit(n){$("id").value=n.id;$("title").value=n.title;$("content").value=n.content;$("tags").value=(n.tags||[]).join(", ");$("formTitle").textContent="Edit note";$("deleteBtn").hidden=false;openEditor();}
function openReader(n){reading=n;$("readerTitle").textContent=n.title;$("readerMeta").textContent="Updated "+new Date(n.updated_at).toLocaleString();$("readerTags").innerHTML=(n.tags||[]).map(t=>'<span class="tag">'+esc(t)+'</span>').join("");$("readerBody").innerHTML=n.html||"<p>"+esc(n.content)+"</p>";if(!$("readerDialog").open)$("readerDialog").showModal();}
function closeReader(){if($("readerDialog").open)$("readerDialog").close();}
function activateNote(e){const card=e.target.closest("[data-id]");if(!card)return;const n=notes.find(x=>x.id===card.dataset.id);if(n)openReader(n);}
$("notes").addEventListener("click",activateNote);$("notes").addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.closest("[data-id]")){e.preventDefault();activateNote(e);}});
$("closeReader").onclick=closeReader;$("readerEdit").onclick=()=>{closeReader();if(reading)edit(reading);};
$("readerDialog").addEventListener("click",e=>{if(e.target===$("readerDialog"))closeReader();});
function renderPages(){$("pages").innerHTML=pages.length?pages.map(p=>'<article class="note pageCard"><div style="min-width:0"><h3>'+esc(p.title)+'</h3><div class="meta">/p/'+esc(p.slug)+' · Updated '+esc(new Date(p.updated_at).toLocaleString())+'</div></div><div class="pageActions"><a class="mini" href="/p/'+encodeURIComponent(p.slug)+'" target="_blank" rel="noopener">Open ↗</a><button class="mini danger" type="button" data-slug="'+esc(p.slug)+'">Delete</button></div></article>').join(""):'<p class="empty">No pages published yet. Ask your AI assistant to publish one.</p>';}
async function loadPages(){try{pages=await api("/api/pages");renderPages();}catch(e){$("pages").innerHTML='<p class="empty">'+esc(e.message)+'</p>';}}
$("pages").addEventListener("click",async e=>{const b=e.target.closest("button[data-slug]");if(!b)return;const slug=b.dataset.slug;if(!confirm("Permanently delete this page?"))return;try{await api("/api/pages/"+encodeURIComponent(slug),{method:"DELETE"});$("status").textContent="Page deleted.";await loadPages();}catch(err){$("status").textContent=err.message;}});
$("search").addEventListener("input",render);$("tagFilter").addEventListener("input",render);$("newBtn").onclick=()=>{clearForm();openEditor();};$("clearBtn").onclick=clearForm;$("closeEditor").onclick=closeEditor;
$("editorDialog").addEventListener("click",e=>{if(e.target===$("editorDialog"))closeEditor();});$("editorDialog").addEventListener("close",()=>{$("editor").reset();clearForm();});
$("editor").addEventListener("submit",async e=>{e.preventDefault();const id=$("id").value,payload={title:$("title").value,content:$("content").value,tags:$("tags").value.split(",").map(t=>t.trim()).filter(Boolean)};try{await api(id?"/api/notes/"+encodeURIComponent(id):"/api/notes",{method:id?"PUT":"POST",body:JSON.stringify(payload)});closeEditor();$("status").textContent="Saved successfully.";await load();}catch(err){$("status").textContent=err.message;}});
$("deleteBtn").onclick=async()=>{const id=$("id").value;if(!id||!confirm("Permanently delete this note?"))return;try{await api("/api/notes/"+encodeURIComponent(id),{method:"DELETE"});closeEditor();$("status").textContent="Note deleted.";await load();}catch(err){$("status").textContent=err.message;}};load();loadPages();
</script>
</body>
</html>`;
}

