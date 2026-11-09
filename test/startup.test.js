import test from "node:test";
import assert from "node:assert/strict";
import app from "../src/index.js";

test("deployment entrypoint loads and serves the public logo", async () => {
  const response = await app.request("/logo.svg");

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /image\/svg\+xml/);
});
