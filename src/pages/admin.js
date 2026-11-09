export function dashboardHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<link rel="icon" type="image/svg+xml" href="/logo.svg">
<title>IrshadMCP · Admin Dashboard</title>
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
.notePreview {
  background: #f8faff;
  border-left: 3px solid var(--accent);
  border-radius: 8px;
  padding: 10px 12px;
  margin-top: 9px;
  font-size: 13px;
  line-height: 1.5;
  max-height: 130px;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.notePreview > :first-child { margin-top: 0; }
.notePreview > :last-child { margin-bottom: 0; }
.notePreview h1, .notePreview h2, .notePreview h3 { font-size: 14px; margin: 8px 0 4px; }
.notePreview p { margin: 0 0 7px; }
.notePreview ul, .notePreview ol { margin: 0 0 7px; padding-left: 20px; }
.notePreview pre { background: #101828; color: #e7edff; padding: 8px; border-radius: 7px; overflow: hidden; }
.notePreview pre code { background: none; color: inherit; padding: 0; }
.notePreview blockquote { margin: 7px 0; padding: 2px 9px; border-left: 2px solid var(--accent); color: var(--muted); }
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
.recordForm { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 14px 0; }
.recordForm textarea { grid-column: 1 / -1; min-height: 110px; }
.recordForm .toolbar { grid-column: 1 / -1; margin: 0; }
.recordActions { display: flex; gap: 7px; align-items: center; flex-shrink: 0; }
.taskCard { display: flex; align-items: flex-start; gap: 10px; }
.taskCard input[type="checkbox"] { width: auto; margin-top: 5px; }
.taskCard.done h3 { text-decoration: line-through; color: var(--muted); }
.inlineEdit { margin-top: 10px; }
@media (max-width: 600px) { .recordForm { grid-template-columns: 1fr; } .recordForm textarea, .recordForm .toolbar { grid-column: auto; } }
@media (max-width: 800px) {
  main { margin-top: 14px; }
  header { padding: 16px 18px; }
  textarea { min-height: 180px; }
}
/* Dashboard visual system */
:root {
  --ink: #17243b;
  --muted: #718096;
  --line: #e6ebf3;
  --bg: #f3f6fc;
  --accent: #435ee8;
  --accent-dark: #354bc2;
  --shadow-sm: 0 2px 8px rgba(28, 43, 76, .05), 0 1px 2px rgba(28, 43, 76, .04);
  --shadow-card: 0 10px 28px rgba(31, 48, 84, .07), 0 2px 7px rgba(31, 48, 84, .04);
}
body {
  min-height: 100vh;
  background:
    radial-gradient(ellipse at 12% 0%, rgba(86, 116, 255, .09), transparent 34rem),
    linear-gradient(180deg, #f8faff 0%, var(--bg) 420px);
  color: var(--ink);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
header {
  position: sticky;
  top: 0;
  z-index: 5;
  min-height: 82px;
  padding-top: 14px;
  padding-bottom: 14px;
  background: rgba(255, 255, 255, .9);
  border-bottom-color: rgba(220, 227, 239, .9);
  box-shadow: 0 4px 20px rgba(29, 45, 80, .045);
  backdrop-filter: blur(16px);
}
.brand img {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  box-shadow: 0 5px 13px rgba(49, 87, 213, .22);
}
h1 { letter-spacing: -.035em; font-weight: 760; }
.brand .meta { margin-top: 2px; font-size: 12px; }
main {
  max-width: 1240px;
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  align-items: start;
  gap: 20px;
  margin-top: 30px;
  margin-bottom: 60px;
}
main > .panel { margin-top: 0 !important; }
main > .panel:nth-of-type(1) { grid-column: 1 / -1; }
main > .panel:nth-of-type(n + 2) { grid-column: span 6; }
.panel {
  padding: 22px;
  border: 1px solid rgba(224, 231, 242, .95);
  border-radius: 18px;
  box-shadow: var(--shadow-card);
  transition: box-shadow .2s ease, transform .2s ease, border-color .2s ease;
}
.panel:hover {
  border-color: #d7e0f1;
  box-shadow: 0 13px 32px rgba(31, 48, 84, .09), 0 3px 8px rgba(31, 48, 84, .04);
}
main > .panel > h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: #1c2a43;
  font-size: 17px;
  font-weight: 740;
  letter-spacing: -.02em;
}
main > .panel > h2::before {
  width: 8px;
  height: 8px;
  flex: 0 0 8px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 4px rgba(67, 94, 232, .1);
  content: "";
}
main > .panel > .meta { margin: 8px 0 0; line-height: 1.6; }
.toolbar { gap: 10px; }
input, textarea {
  min-height: 43px;
  border-color: #dce3ee;
  border-radius: 10px;
  box-shadow: inset 0 1px 2px rgba(23, 36, 59, .025), var(--shadow-sm);
  transition: border-color .18s ease, box-shadow .18s ease;
}
input:focus, textarea:focus {
  outline: none;
  border-color: #8294f4;
  box-shadow: 0 0 0 4px rgba(67, 94, 232, .12), var(--shadow-sm);
}
button {
  border-radius: 10px;
  box-shadow: 0 5px 12px rgba(53, 75, 194, .2);
  transition: background .18s ease, box-shadow .18s ease, transform .18s ease;
}
button:hover {
  background: var(--accent-dark);
  box-shadow: 0 8px 16px rgba(53, 75, 194, .25);
  transform: translateY(-1px);
}
button.secondary { box-shadow: 0 2px 5px rgba(23, 36, 59, .06); }
button.secondary:hover { background: #e2e8f4; box-shadow: var(--shadow-sm); }
button.danger, button.mini.danger { box-shadow: 0 4px 10px rgba(180, 35, 53, .16); }
.note {
  padding: 16px;
  border-color: #e8edf5;
  border-radius: 13px;
  background: linear-gradient(145deg, #fff, #fcfdff);
  box-shadow: var(--shadow-sm);
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
}
.note:hover {
  border-color: #d5def3;
  box-shadow: 0 9px 22px rgba(31, 48, 84, .09);
  transform: translateY(-2px);
}
.note h3 { color: #24334e; font-weight: 700; }
.notePreview {
  border-left-color: #667ef0;
  border-radius: 0 9px 9px 0;
  background: #f7f9ff;
}
.tag {
  padding: 3px 9px;
  border: 1px solid #e0e7ff;
  background: #f0f3ff;
  color: #4257b8;
  font-weight: 620;
}
.pageActions .mini, .recordActions .mini {
  border-radius: 9px;
  box-shadow: var(--shadow-sm);
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
}
.pageActions .mini:hover, .recordActions .mini:hover {
  box-shadow: var(--shadow-card);
  transform: translateY(-1px);
}
.recordForm {
  padding: 14px;
  border: 1px solid #e8edf5;
  border-radius: 13px;
  background: #f9faff;
}
.taskCard { align-items: center; gap: 13px; }
.taskCard input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--accent);
}
.taskCard.done { background: #f9fbff; }
.empty { color: #8290a4; }
#status {
  min-height: auto;
  padding: 11px 17px;
  border: 1px solid rgba(255, 255, 255, .12);
  box-shadow: 0 12px 32px rgba(16, 24, 40, .25);
  font-size: 13px;
}
dialog .panel {
  border: 1px solid rgba(255, 255, 255, .65);
  border-radius: 20px;
  box-shadow: 0 32px 90px rgba(15, 23, 42, .3);
}
@media (max-width: 900px) {
  main > .panel:nth-of-type(n) { grid-column: 1 / -1; }
}
@media (max-width: 800px) {
  main { margin-top: 18px; }
  header { padding: 12px 16px; flex-wrap: wrap; }
  header > div:last-child { flex-wrap: wrap; }
  main > .panel { padding: 18px; }
}
</style>
</head>
<body>
<header>
  <div class="brand">
    <img src="/logo.svg" alt="IrshadMCP logo">
    <div>
      <h1>IrshadMCP</h1>
      <div class="meta">Manage your private data</div>
    </div>
  </div>
  <div style="display:flex;gap:10px;align-items:center"><a class="meta" href="/" style="text-decoration:none">← Home</a><button id="copyMcpToken" class="secondary" type="button">Copy MCP token</button><form method="post" action="/oauth/logout"><button class="secondary" type="submit">Sign out</button></form><button id="newBtn">+ New note</button><button id="newSkillBtn" class="secondary">+ New skill</button></div>
</header>

<main><section class="panel"><h2>All notes</h2><div class="toolbar"><input id="search" placeholder="Search title, content, or tags…" aria-label="Search notes"><input id="tagFilter" placeholder="Filter by tag" aria-label="Filter by tag"></div><div id="notes"><p class="empty">Loading notes…</p></div></section><section class="panel" style="margin-top:20px"><h2>Published pages</h2><p class="meta">HTML pages published by your AI assistant through the MCP <code>publish_page</code> tool, arranged in booklets on the <code>/pages</code> shelf. Published page content is public.</p><div id="pages"><p class="empty">Loading pages…</p></div></section><section class="panel" style="margin-top:20px"><h2>Skills</h2><p class="meta">Reusable how-to guides saved through the MCP <code>create_skill</code> tool — kept separate from notes.</p><div id="skills"><p class="empty">Loading skills…</p></div></section><section class="panel" style="margin-top:20px"><h2>Memories</h2><p class="meta">Private context records owned by your signed-in Google account.</p><form id="memoryCreate" class="recordForm"><input name="title" maxlength="200" required placeholder="Memory title"><input name="tags" placeholder="Tags (comma-separated)"><textarea name="content" maxlength="500000" required placeholder="Memory content"></textarea><div class="toolbar"><button type="submit">Add memory</button></div></form><div id="memories"><p class="empty">Loading memories…</p></div></section><section class="panel" style="margin-top:20px"><h2>Tasks</h2><p class="meta">Track task descriptions, due dates, and completion for your signed-in Google account.</p><form id="taskCreate" class="recordForm"><input name="title" maxlength="200" required placeholder="Task title"><input name="due_date" type="date" aria-label="Due date"><input name="description" maxlength="50000" placeholder="Description"><div class="toolbar"><button type="submit">Add task</button></div></form><div id="tasks"><p class="empty">Loading tasks…</p></div></section></main><div id="status" role="status" aria-live="polite"></div><dialog id="editorDialog" aria-labelledby="formTitle"><section class="panel"><div class="dialogHeader"><h2 id="formTitle">Create a note</h2><button type="button" class="secondary" id="closeEditor">Close</button></div><form id="editor"><input type="hidden" id="id"><label for="title">Title</label><input id="title" maxlength="200" required placeholder="Note title"><label for="content">Content</label><textarea id="content" maxlength="50000" required placeholder="Write your note… Markdown headings, lists and links will be formatted."></textarea><label for="tags">Tags (comma-separated)</label><input id="tags" placeholder="work, study, ideas"><div class="toolbar"><button type="submit">Save note</button><button type="button" class="secondary" id="clearBtn">Clear fields</button><button type="button" class="danger" id="deleteBtn" hidden>Delete</button></div></form></section></dialog>

<dialog id="readerDialog" aria-labelledby="readerTitle"><section class="panel"><div class="dialogHeader"><h2 id="readerTitle">Note</h2><button type="button" class="secondary" id="closeReader">Close</button></div><div class="meta" id="readerMeta"></div><div class="tags" id="readerTags"></div><article class="noteBody" id="readerBody" style="margin-top:16px"></article><div class="toolbar"><button type="button" id="readerEdit">Edit note</button></div></section></dialog>

<script>
const $=id=>document.getElementById(id);let notes=[],pages=[],skills=[],reading=null,editingKind="note";
async function api(path,options={}){const r=await fetch(path,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});const data=await r.json().catch(()=>({error:"Unexpected server response"}));if(!r.ok)throw new Error(data.error||"Request failed");return data;}
async function copyMcpToken(){try{const session=await api("/oauth/session");await navigator.clipboard.writeText(session.access_token);$("status").textContent="MCP bearer token copied. It expires in 8 hours.";}catch(e){$("status").textContent=e.message||"Clipboard access is unavailable.";}}
$("copyMcpToken").addEventListener("click",copyMcpToken);
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function render(){const q=$("search").value.trim().toLowerCase(),tag=$("tagFilter").value.trim().toLowerCase();const found=notes.filter(n=>(!q||(n.title+" "+n.content+" "+(n.tags||[]).join(" ")).toLowerCase().includes(q))&&(!tag||(n.tags||[]).some(t=>t.toLowerCase().includes(tag))));$("notes").innerHTML=found.length?found.map(n=>'<article class="note" data-id="'+esc(n.id)+'" tabindex="0" role="button" aria-label="Read '+esc(n.title)+'"><h3>'+esc(n.title)+'</h3><div class="meta">Updated '+esc(new Date(n.updated_at).toLocaleString())+'</div><div class="notePreview">'+(n.html||"<p>"+esc(n.content)+"</p>")+'</div><div class="tags">'+(n.tags||[]).map(t=>'<span class="tag">'+esc(t)+'</span>').join("")+'</div></article>').join(""):'<p class="empty">No matching notes.</p>';}
async function load(){try{notes=await api("/api/notes");render();}catch(e){$("notes").innerHTML='<p class="empty">'+esc(e.message)+'</p>';}}
function clearForm(){$("id").value="";$("title").value="";$("content").value="";$("tags").value="";$("formTitle").textContent=editingKind==="skill"?"Create a skill":"Create a note";$("deleteBtn").hidden=true;}
function openEditor(){if(!$("editorDialog").open)$("editorDialog").showModal();$("title").focus();}
function closeEditor(){if($("editorDialog").open)$("editorDialog").close();}
function edit(n,kind="note"){editingKind=kind;$("id").value=n.id;$("title").value=n.title;$("content").value=n.content;$("tags").value=(n.tags||[]).join(", ");$("formTitle").textContent=kind==="skill"?"Edit skill":"Edit note";$("deleteBtn").hidden=false;openEditor();}
function openReader(n,kind="note"){reading=Object.assign({kind},n);$("readerTitle").textContent=n.title;$("readerMeta").textContent="Updated "+new Date(n.updated_at).toLocaleString();$("readerTags").innerHTML=(n.tags||[]).map(t=>'<span class="tag">'+esc(t)+'</span>').join("");$("readerBody").innerHTML=n.html||"<p>"+esc(n.content)+"</p>";if(!$("readerDialog").open)$("readerDialog").showModal();}
function closeReader(){if($("readerDialog").open)$("readerDialog").close();}
function activateFrom(getList,kind){return e=>{const card=e.target.closest("[data-id]");if(!card)return;const n=getList().find(x=>x.id===card.dataset.id);if(n)openReader(n,kind);};}
function bindActivation(el,getList,kind){const run=activateFrom(getList,kind);el.addEventListener("click",run);el.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.closest("[data-id]")){e.preventDefault();run(e);}});}
bindActivation($("notes"),()=>notes,"note");bindActivation($("skills"),()=>skills,"skill");
$("closeReader").onclick=closeReader;$("readerEdit").onclick=()=>{closeReader();if(reading)edit(reading,reading.kind||"note");};
$("readerDialog").addEventListener("click",e=>{if(e.target===$("readerDialog"))closeReader();});
function renderPages(){$("pages").innerHTML=pages.length?pages.map(p=>'<article class="note pageCard"><div style="min-width:0"><h3>'+esc(p.title)+'</h3><div class="meta">'+(p.booklet?esc(p.booklet)+' · ':'')+esc(p.url||('/pages/'+encodeURIComponent(p.slug)))+' · Updated '+esc(new Date(p.updated_at).toLocaleString())+'</div></div><div class="pageActions"><a class="mini" href="'+esc(p.url||('/pages/'+encodeURIComponent(p.slug)))+'" target="_blank" rel="noopener">Open ↗</a><button class="mini danger" type="button" data-slug="'+esc(p.slug)+'">Delete</button></div></article>').join(""):'<p class="empty">No pages published yet. Ask your AI assistant to publish one.</p>';}
async function loadPages(){try{pages=await api("/api/pages");renderPages();}catch(e){$("pages").innerHTML='<p class="empty">'+esc(e.message)+'</p>';}}
function renderSkills(){$("skills").innerHTML=skills.length?skills.map(s=>'<article class="note" data-id="'+esc(s.id)+'" tabindex="0" role="button" aria-label="Read '+esc(s.title)+'"><h3>'+esc(s.title)+'</h3><div class="meta">Updated '+esc(new Date(s.updated_at).toLocaleString())+'</div><div class="notePreview">'+(s.html||"<p>"+esc(s.content)+"</p>")+'</div><div class="tags">'+(s.tags||[]).map(t=>'<span class="tag">'+esc(t)+'</span>').join("")+'</div></article>').join(""):'<p class="empty">No skills yet. Ask your AI assistant to save one.</p>';}
async function loadSkills(){try{skills=await api("/api/skills");renderSkills();}catch(e){$("skills").innerHTML='<p class="empty">'+esc(e.message)+'</p>';}}
$("pages").addEventListener("click",async e=>{const b=e.target.closest("button[data-slug]");if(!b)return;const slug=b.dataset.slug;if(!confirm("Permanently delete this page?"))return;try{await api("/api/pages/"+encodeURIComponent(slug),{method:"DELETE"});$("status").textContent="Page deleted.";await loadPages();}catch(err){$("status").textContent=err.message;}});
$("search").addEventListener("input",render);$("tagFilter").addEventListener("input",render);$("newBtn").onclick=()=>{editingKind="note";clearForm();openEditor();};$("newSkillBtn").onclick=()=>{editingKind="skill";clearForm();openEditor();};$("clearBtn").onclick=clearForm;$("closeEditor").onclick=closeEditor;
$("editorDialog").addEventListener("click",e=>{if(e.target===$("editorDialog"))closeEditor();});$("editorDialog").addEventListener("close",()=>{$("editor").reset();clearForm();});
$("editor").addEventListener("submit",async e=>{e.preventDefault();const id=$("id").value,payload={title:$("title").value,content:$("content").value,tags:$("tags").value.split(",").map(t=>t.trim()).filter(Boolean)},base=editingKind==="skill"?"/api/skills":"/api/notes";try{await api(id?base+"/"+encodeURIComponent(id):base,{method:id?"PUT":"POST",body:JSON.stringify(payload)});closeEditor();$("status").textContent="Saved successfully.";if(editingKind==="skill")await loadSkills();else await load();}catch(err){$("status").textContent=err.message;}});
$("deleteBtn").onclick=async()=>{const id=$("id").value;if(!id||!confirm(editingKind==="skill"?"Permanently delete this skill?":"Permanently delete this note?"))return;const base=editingKind==="skill"?"/api/skills":"/api/notes";try{await api(base+"/"+encodeURIComponent(id),{method:"DELETE"});closeEditor();$("status").textContent="Deleted successfully.";if(editingKind==="skill")await loadSkills();else await load();}catch(err){$("status").textContent=err.message;}};load();loadPages();loadSkills();if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});
</script>
<script>
let memories=[],tasks=[];
function memoryCard(m){return '<article class="note"><h3>'+esc(m.title)+'</h3><div class="meta">Updated '+esc(new Date(m.updated_at).toLocaleString())+'</div><div class="notePreview">'+esc(m.content)+'</div><div class="tags">'+(m.tags||[]).map(t=>'<span class="tag">'+esc(t)+'</span>').join("")+'</div><div class="recordActions"><button class="mini" data-memory-edit="'+esc(m.id)+'">Edit</button><button class="mini danger" data-memory-delete="'+esc(m.id)+'">Delete</button></div><form class="recordForm inlineEdit" data-memory-form="'+esc(m.id)+'" hidden><input name="title" maxlength="200" required value="'+esc(m.title)+'"><input name="tags" value="'+esc((m.tags||[]).join(", "))+'" placeholder="Tags (comma-separated)"><textarea name="content" maxlength="500000" required>'+esc(m.content)+'</textarea><div class="toolbar"><button type="submit">Save memory</button><button type="button" class="secondary" data-cancel-edit>Cancel</button></div></form></article>';}
function taskCard(t){return '<article class="note taskCard'+(t.is_completed?' done':'')+'"><input type="checkbox" aria-label="Mark '+esc(t.title)+' complete" data-task-toggle="'+esc(t.task_id)+'" '+(t.is_completed?'checked':'')+'><div style="min-width:0;flex:1"><h3>'+esc(t.title)+'</h3><div class="meta">'+(t.due_date?'Due '+esc(t.due_date)+' · ':'')+'Updated '+esc(new Date(t.updated_at).toLocaleString())+'</div>'+(t.description?'<div class="preview">'+esc(t.description)+'</div>':'')+'<form class="recordForm inlineEdit" data-task-form="'+esc(t.task_id)+'" hidden><input name="title" maxlength="200" required value="'+esc(t.title)+'"><input name="due_date" type="date" value="'+esc(t.due_date||'')+'"><input name="description" maxlength="50000" value="'+esc(t.description||'')+'" placeholder="Description"><div class="toolbar"><button type="submit">Save task</button><button type="button" class="secondary" data-cancel-edit>Cancel</button></div></form></div><div class="recordActions"><button class="mini" data-task-edit="'+esc(t.task_id)+'">Edit</button><button class="mini danger" data-task-delete="'+esc(t.task_id)+'">Delete</button></div></article>';}
async function loadMemories(){try{memories=await api("/api/memories");$("memories").innerHTML=memories.length?memories.map(memoryCard).join(""):'<p class="empty">No memories saved yet.</p>';}catch(e){$("memories").innerHTML='<p class="empty">'+esc(e.message)+'</p>';}}
async function loadTasks(){try{tasks=await api("/api/tasks");$("tasks").innerHTML=tasks.length?tasks.map(taskCard).join(""):'<p class="empty">No tasks yet.</p>';}catch(e){$("tasks").innerHTML='<p class="empty">'+esc(e.message)+'</p>';}}
$("memoryCreate").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await api("/api/memories",{method:"POST",body:JSON.stringify({title:f.get("title"),content:f.get("content"),tags:String(f.get("tags")||"").split(",").map(x=>x.trim()).filter(Boolean)})});e.currentTarget.reset();$("status").textContent="Memory saved.";await loadMemories();}catch(err){$("status").textContent=err.message;}});
$("taskCreate").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await api("/api/tasks",{method:"POST",body:JSON.stringify({title:f.get("title"),description:f.get("description")||null,due_date:f.get("due_date")||null})});e.currentTarget.reset();$("status").textContent="Task created.";await loadTasks();}catch(err){$("status").textContent=err.message;}});
$("memories").addEventListener("click",async e=>{const edit=e.target.closest("[data-memory-edit]"),remove=e.target.closest("[data-memory-delete]"),cancel=e.target.closest("[data-cancel-edit]");if(edit){const form=$("memories").querySelector('[data-memory-form="'+CSS.escape(edit.dataset.memoryEdit)+'"]');if(form)form.hidden=!form.hidden;return;}if(cancel){cancel.closest("form").hidden=true;return;}if(remove){const id=remove.dataset.memoryDelete;if(!confirm("Permanently delete this memory?"))return;try{await api("/api/memories/"+encodeURIComponent(id),{method:"DELETE"});$("status").textContent="Memory deleted.";await loadMemories();}catch(err){$("status").textContent=err.message;}}});
$("memories").addEventListener("submit",async e=>{const form=e.target.closest("[data-memory-form]");if(!form)return;e.preventDefault();const f=new FormData(form),id=form.dataset.memoryForm;try{await api("/api/memories/"+encodeURIComponent(id),{method:"PUT",body:JSON.stringify({title:f.get("title"),content:f.get("content"),tags:String(f.get("tags")||"").split(",").map(x=>x.trim()).filter(Boolean)})});$("status").textContent="Memory updated.";await loadMemories();}catch(err){$("status").textContent=err.message;}});
$("tasks").addEventListener("click",async e=>{const edit=e.target.closest("[data-task-edit]"),remove=e.target.closest("[data-task-delete]"),cancel=e.target.closest("[data-cancel-edit]");if(edit){const form=$("tasks").querySelector('[data-task-form="'+CSS.escape(edit.dataset.taskEdit)+'"]');if(form)form.hidden=!form.hidden;return;}if(cancel){cancel.closest("form").hidden=true;return;}if(remove){const id=remove.dataset.taskDelete;if(!confirm("Permanently delete this task?"))return;try{await api("/api/tasks/"+encodeURIComponent(id),{method:"DELETE"});$("status").textContent="Task deleted.";await loadTasks();}catch(err){$("status").textContent=err.message;}}});
$("tasks").addEventListener("change",async e=>{const box=e.target.closest("[data-task-toggle]");if(!box)return;try{await api("/api/tasks/"+encodeURIComponent(box.dataset.taskToggle),{method:"PUT",body:JSON.stringify({is_completed:box.checked})});await loadTasks();}catch(err){box.checked=!box.checked;$("status").textContent=err.message;}});
$("tasks").addEventListener("submit",async e=>{const form=e.target.closest("[data-task-form]");if(!form)return;e.preventDefault();const f=new FormData(form),id=form.dataset.taskForm;try{await api("/api/tasks/"+encodeURIComponent(id),{method:"PUT",body:JSON.stringify({title:f.get("title"),description:f.get("description")||null,due_date:f.get("due_date")||null})});$("status").textContent="Task updated.";await loadTasks();}catch(err){$("status").textContent=err.message;}});
loadMemories();loadTasks();
</script>
</body>
</html>`;
}
