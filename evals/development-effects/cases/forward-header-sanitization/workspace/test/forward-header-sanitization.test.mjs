import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeForwardHeaders } from "../src/index.mjs";

test("removes basic lower-case hop-by-hop headers", () => {
  assert.deepEqual(
    sanitizeForwardHeaders([
      { name: "connection", value: "x-remove" },
      { name: "transfer-encoding", value: "chunked" },
      { name: "content-type", value: "text/plain" },
    ]),
    [{ name: "content-type", value: "text/plain" }],
  );
});

test("keeps sanitizeForwardHeaders as the public named export", async () => {
  const direct = await import("../src/forward-header-sanitization.mjs");
  const publicApi = await import("../src/index.mjs");

  assert.equal(publicApi.sanitizeForwardHeaders, direct.sanitizeForwardHeaders);
  assert.deepEqual(Object.keys(direct), ["sanitizeForwardHeaders"]);
  assert.deepEqual(Object.keys(publicApi), ["sanitizeForwardHeaders"]);
});
