import { envFromProcess, CosmoX } from "../../dist/client.js";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

describe("envFromProcess()", () => {
  it("reads credentials from environment variables", () => {
    // These should be set in the test environment
    const env = envFromProcess();
    assert.ok(env.consumerKey, "consumerKey should be set");
    assert.ok(env.consumerSecret, "consumerSecret should be set");
    assert.ok(env.accessToken, "accessToken should be set");
    assert.ok(env.accessTokenSecret, "accessTokenSecret should be set");
    assert.ok(env.bearerToken, "bearerToken should be set");
  });

  it("reads optional scheduler vars", () => {
    const env = envFromProcess();
    // These may or may not be set
    assert.equal(typeof env.schedulerUrl, process.env.SCHEDULER_URL ? "string" : typeof env.schedulerUrl);
  });
});

describe("CosmoX", () => {
  it("initializes without errors", () => {
    const cosmo = new CosmoX();
    assert.ok(cosmo);
    assert.ok(cosmo.env);
    assert.ok(cosmo.oauth1);
    assert.ok(cosmo.bearer);
  });

  it("exposes client (oauth1) and reader (bearer)", () => {
    const cosmo = new CosmoX();
    assert.strictEqual(cosmo.client, cosmo.oauth1);
    assert.strictEqual(cosmo.reader, cosmo.bearer);
  });

  it("client and reader are different instances", () => {
    const cosmo = new CosmoX();
    assert.notStrictEqual(cosmo.client, cosmo.reader);
  });

  it("accepts custom env config", () => {
    const customEnv = {
      consumerKey: "test-key",
      consumerSecret: "test-secret",
      accessToken: "test-access",
      accessTokenSecret: "test-access-secret",
      bearerToken: "test-bearer",
    };
    const cosmo = new CosmoX(customEnv);
    assert.equal(cosmo.env.consumerKey, "test-key");
    assert.equal(cosmo.env.bearerToken, "test-bearer");
  });
});
