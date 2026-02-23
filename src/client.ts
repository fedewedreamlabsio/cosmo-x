import { Client, OAuth1 } from "@xdevplatform/xdk";
import type { OAuth1Config, ClientConfig } from "@xdevplatform/xdk";

export interface CosmoEnv {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  bearerToken: string;
  schedulerUrl?: string;
  schedulerKey?: string;
}

/**
 * Read X API credentials from environment variables.
 * Throws if any required var is missing.
 */
export function envFromProcess(): CosmoEnv {
  const required = {
    consumerKey: process.env.X_CONSUMER_KEY,
    consumerSecret: process.env.X_CONSUMER_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET,
    bearerToken: process.env.X_BEARER_TOKEN,
  };

  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }

  return {
    ...(required as Record<string, string>) as unknown as CosmoEnv,
    schedulerUrl: process.env.SCHEDULER_URL ?? process.env.SCHEDULER_API_URL,
    schedulerKey: process.env.SCHEDULER_API_KEY,
  };
}

/**
 * Create an OAuth1-authenticated XDK client (user context — read + write).
 */
export function createOAuth1Client(env: CosmoEnv): Client {
  const oauth1Config: OAuth1Config = {
    apiKey: env.consumerKey,
    apiSecret: env.consumerSecret,
    accessToken: env.accessToken,
    accessTokenSecret: env.accessTokenSecret,
    callback: "oob",
  };
  const oauth1 = new OAuth1(oauth1Config);
  return new Client({ oauth1 } as ClientConfig);
}

/**
 * Create a Bearer-authenticated XDK client (app-only — read only, higher rate limits).
 */
export function createBearerClient(env: CosmoEnv): Client {
  return new Client({ bearerToken: env.bearerToken } as ClientConfig);
}

/**
 * CosmoX holds both clients and the env config.
 * Use `oauth1` for write ops, `bearer` for read-heavy ops.
 */
export class CosmoX {
  readonly env: CosmoEnv;
  readonly oauth1: Client;
  readonly bearer: Client;

  constructor(env?: CosmoEnv) {
    this.env = env ?? envFromProcess();
    this.oauth1 = createOAuth1Client(this.env);
    this.bearer = createBearerClient(this.env);
  }

  /** User-context client (reads + writes) */
  get client(): Client {
    return this.oauth1;
  }

  /** App-only client (reads only, higher rate limits for some endpoints) */
  get reader(): Client {
    return this.bearer;
  }
}
