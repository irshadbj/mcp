const SESSION_COOKIE = "irshad_oauth_session";
const STATE_COOKIE = "irshad_oauth_state";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const STATE_TTL_SECONDS = 10 * 60;
const encoder = new TextEncoder();

export async function handleOAuthRequest(request, env, url) {
  if (!url.pathname.startsWith("/oauth/")) return null;

  if (url.pathname === "/oauth/login" && request.method === "GET") {
    const config = oauthConfig(env, url);
    if (config.error) return configurationError(config.error);
    const state = randomToken();
    const verifier = randomToken();
    const next = safeNext(url.searchParams.get("next"));
    const signedState = await signPayload(
      { state, verifier, next, exp: nowSeconds() + STATE_TTL_SECONDS },
      env
    );
    const challenge = base64Url(new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(verifier))
    ));
    const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorize.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256"
    }).toString();

    return new Response(null, {
      status: 302,
      headers: {
        Location: authorize.toString(),
        "Set-Cookie": cookie(STATE_COOKIE, signedState, STATE_TTL_SECONDS, url),
        "Cache-Control": "no-store"
      }
    });
  }

  if (url.pathname === "/oauth/callback" && request.method === "GET") {
    const config = oauthConfig(env, url);
    if (config.error) return configurationError(config.error);
    const params = url.searchParams;
    const state = params.get("state") || "";
    const savedState = await verifyPayload(cookieValue(request, STATE_COOKIE), env);
    if (!savedState || savedState.state !== state || savedState.exp < nowSeconds()) {
      return Response.json({ error: "OAuth state validation failed." }, {
        status: 400,
        headers: noStoreHeaders()
      });
    }

    const code = params.get("code");
    if (!code || params.has("error")) {
      return Response.json({ error: "Google sign-in was not completed." }, {
        status: 400,
        headers: noStoreHeaders()
      });
    }

    try {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
          grant_type: "authorization_code",
          code_verifier: savedState.verifier
        })
      });
      if (!tokenResponse.ok) {
        return Response.json({ error: "Google token exchange failed." }, {
          status: 502,
          headers: noStoreHeaders()
        });
      }
      const token = await tokenResponse.json();
      if (typeof token.access_token !== "string") {
        return Response.json({ error: "Google did not return an access token." }, {
          status: 502,
          headers: noStoreHeaders()
        });
      }

      const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: "Bearer " + token.access_token }
      });
      if (!profileResponse.ok) {
        return Response.json({ error: "Google account verification failed." }, {
          status: 502,
          headers: noStoreHeaders()
        });
      }
      const profile = await profileResponse.json();
      if (!profile.sub || !profile.email || profile.email_verified !== true) {
        return Response.json({ error: "Google returned an unverified account." }, {
          status: 403,
          headers: noStoreHeaders()
        });
      }

      const sessionToken = await issueSessionToken({ sub: String(profile.sub) }, env);
      const headers = new Headers({
        Location: savedState.next || "/admin",
        "Cache-Control": "no-store"
      });
      headers.append("Set-Cookie", cookie(SESSION_COOKIE, sessionToken, SESSION_TTL_SECONDS, url));
      headers.append("Set-Cookie", cookie(STATE_COOKIE, "", 0, url));
      return new Response(null, {
        status: 302,
        headers
      });
    } catch {
      console.error("Google OAuth callback failed.");
      return Response.json({ error: "Google sign-in failed." }, {
        status: 502,
        headers: noStoreHeaders()
      });
    }
  }

  if (url.pathname === "/oauth/session" && request.method === "GET") {
    const session = await getOAuthSession(request, env);
    if (!session) {
      return Response.json({ error: "Authentication required." }, {
        status: 401,
        headers: noStoreHeaders()
      });
    }
    return Response.json({
      user: { user_id: session.userId },
      access_token: session.token,
      token_type: "Bearer",
      expires_in: session.expiresIn
    }, { headers: noStoreHeaders() });
  }

  if (url.pathname === "/oauth/logout" && request.method === "POST") {
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/",
        "Set-Cookie": cookie(SESSION_COOKIE, "", 0, url),
        "Cache-Control": "no-store"
      }
    });
  }

  return Response.json({ error: "Not found" }, {
    status: 404,
    headers: noStoreHeaders()
  });
}

export async function getOAuthSession(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const bearer = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  const token = bearer || cookieValue(request, SESSION_COOKIE);
  const payload = await verifyPayload(token, env);
  if (!payload || !payload.sub || !payload.exp || payload.exp < nowSeconds()) {
    return null;
  }
  return {
    sub: payload.sub,
    userId: "google:" + payload.sub,
    token,
    expiresIn: payload.exp - nowSeconds()
  };
}

export async function issueSessionToken(user, env) {
  return signPayload({
    sub: user.sub,
    exp: nowSeconds() + SESSION_TTL_SECONDS
  }, env);
}

function oauthConfig(env, url) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return { error: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google sign-in." };
  }
  if (typeof env.OAUTH_SESSION_SECRET !== "string" || env.OAUTH_SESSION_SECRET.length < 32) {
    return { error: "Set OAUTH_SESSION_SECRET to a random value of at least 32 characters." };
  }
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI || new URL("/oauth/callback", env.APP_URL || url.origin).toString()
  };
}

async function signPayload(payload, env) {
  const key = await signingKey(env);
  const encoded = base64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(encoded));
  return encoded + "." + base64Url(new Uint8Array(signature));
}

async function verifyPayload(token, env) {
  if (typeof token !== "string") return null;
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra !== undefined) return null;
  try {
    const key = await signingKey(env);
    const verified = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signature),
      encoder.encode(encoded)
    );
    if (!verified) return null;
    return JSON.parse(new TextDecoder().decode(fromBase64Url(encoded)));
  } catch {
    return null;
  }
}

async function signingKey(env) {
  if (typeof env.OAUTH_SESSION_SECRET !== "string" || env.OAUTH_SESSION_SECRET.length < 32) {
    throw new Error("OAUTH_SESSION_SECRET must contain at least 32 characters.");
  }
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(env.OAUTH_SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function cookie(name, value, maxAge, url) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${url.protocol === "https:" ? "; Secure" : ""}`;
}

function cookieValue(request, name) {
  const cookies = request.headers.get("Cookie") || "";
  for (const part of cookies.split(";")) {
    const separator = part.indexOf("=");
    if (separator >= 0 && part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return "";
}

function safeNext(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return "/admin";
  try {
    const target = new URL(value, "https://oauth.invalid");
    return target.origin === "https://oauth.invalid"
      ? target.pathname + target.search + target.hash
      : "/admin";
  } catch {
    return "/admin";
  }
}

function randomToken() {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function noStoreHeaders() {
  return { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
}

function configurationError(message) {
  return new Response(message, {
    status: 503,
    headers: { ...noStoreHeaders(), "Content-Type": "text/plain; charset=utf-8" }
  });
}
