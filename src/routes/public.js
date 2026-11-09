import { homeHtml } from "../pages/home.js";
import { pagesIndexHtml } from "../pages/pages.js";
import { aboutMcpHtml } from "../pages/about.js";
import { swScript } from "../sw.js";
import { dbReady, getPage, listPages } from "../handlers/database.js";
import { isValidSlug, pageNotFound } from "../handlers/common.js";
import { corsHeaders } from "../handlers/protocol.js";

const LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
  '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
  '<stop offset="0" stop-color="#3157d5"/><stop offset="1" stop-color="#7c3aed"/>' +
  '</linearGradient></defs>' +
  '<rect width="512" height="512" rx="112" fill="url(#g)"/>' +
  '<path d="M160 112h140l72 72v204a24 24 0 0 1-24 24H160a24 24 0 0 1-24-24V136a24 24 0 0 1 24-24z" fill="#fff"/>' +
  '<path d="M300 112v48a24 24 0 0 0 24 24h48z" fill="#c7d2fe"/>' +
  '<rect x="180" y="248" width="152" height="18" rx="9" fill="#3157d5"/>' +
  '<rect x="180" y="290" width="152" height="18" rx="9" fill="#3157d5" opacity=".6"/>' +
  '<rect x="180" y="332" width="96" height="18" rx="9" fill="#3157d5" opacity=".35"/>' +
  '</svg>';

const PAGE_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data: blob: https:; " +
  "font-src data: https:; media-src data: https:; base-uri 'none'; " +
  "form-action 'none'; frame-ancestors 'none'";

export async function handlePublicRequest(request, env, url) {
  if (
    request.method === "GET" &&
    (url.pathname === "/logo.svg" || url.pathname === "/favicon.svg")
  ) {
    return new Response(LOGO_SVG, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  if (request.method === "GET" && url.pathname === "/sw.js") {
    return new Response(swScript, {
      headers: {
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "no-cache",
        "Service-Worker-Allowed": "/",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }

  if (
    request.method === "GET" &&
    (url.pathname === "/about-mcp" || url.pathname === "/about")
  ) {
    return new Response(aboutMcpHtml(url.origin), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }

  if (request.method === "GET" && url.pathname === "/") {
    return new Response(homeHtml(), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }

  if (request.method === "GET" && (url.pathname === "/pages" || url.pathname === "/pages/")) {
    const headers = {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
      "X-Content-Type-Options": "nosniff"
    };
    let rows = [];
    let error = "";
    if (!dbReady(env)) {
      error = "Published pages are unavailable because the database is not configured.";
    } else {
      try {
        rows = await listPages(env, { query: "", limit: 100 });
      } catch {
        error = "Published pages could not be loaded right now. Please try again shortly.";
      }
    }
    return new Response(pagesIndexHtml(rows, { error }), { headers });
  }

  if (request.method === "GET" && url.pathname.startsWith("/pages/")) {
    const rawSegments = url.pathname.slice("/pages/".length).split("/").filter(Boolean);
    if (rawSegments.length === 1 && url.pathname.endsWith("/")) {
      const headers = {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60",
        "X-Content-Type-Options": "nosniff"
      };
      if (!dbReady(env)) {
        return new Response(
          pagesIndexHtml([], { error: "Published pages are unavailable because the database is not configured." }),
          { headers }
        );
      }

      let booklet;
      try {
        booklet = decodeURIComponent(rawSegments[0]);
      } catch {
        return pageNotFound(headers);
      }
      try {
        const allPages = await listPages(env, { query: "", limit: 100 });
        const matches = allPages.filter(page =>
          booklet === "_unfiled"
            ? !String(page.booklet || "").trim()
            : String(page.booklet || "").trim().toLocaleLowerCase() === booklet.trim().toLocaleLowerCase()
        );
        if (!matches.length) return pageNotFound(headers);
        const label = booklet === "_unfiled" ? "Unfiled" : String(matches[0].booklet).trim();
        return new Response(pagesIndexHtml(matches, { booklet: label, bookletPath: rawSegments[0] }), { headers });
      } catch {
        return new Response(
          pagesIndexHtml([], { error: "Published pages could not be loaded right now. Please try again shortly." }),
          { headers }
        );
      }
    }

    const headers = {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": PAGE_CSP
    };

    let segments = [];
    try {
      segments = rawSegments.map(segment => decodeURIComponent(segment));
    } catch {
      return pageNotFound(headers);
    }
    const booklet = segments.length === 2 ? segments[0] : null;
    const slug = segments.length === 2
      ? segments[1].trim().toLowerCase()
      : segments.length === 1
        ? segments[0].trim().toLowerCase()
        : "";
    if (!isValidSlug(slug)) return pageNotFound(headers);
    if (!dbReady(env)) {
      return Response.json(
        { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." },
        { status: 500, headers: corsHeaders() }
      );
    }
    let row = null;
    try {
      row = await getPage(env, slug);
    } catch {
      return Response.json(
        { error: "Database request failed." },
        { status: 500, headers: corsHeaders() }
      );
    }
    if (!row) return pageNotFound(headers);
    if (booklet !== null) {
      const rowBooklet = String(row.booklet || "").trim();
      const belongsToBooklet = booklet === "_unfiled"
        ? !rowBooklet
        : rowBooklet.toLocaleLowerCase() === booklet.trim().toLocaleLowerCase();
      if (!belongsToBooklet) return pageNotFound(headers);
    }
    return new Response(row.content ?? row.html ?? "", {
      headers: { ...headers, "Cache-Control": "public, max-age=60" }
    });
  }

  return null;
}
