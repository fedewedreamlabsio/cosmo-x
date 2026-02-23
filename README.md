# cosmo-x

X API toolkit with typed operations, rate-limit management, and scheduling.

Built on the official [`@xdevplatform/xdk`](https://github.com/xdevplatform/xdk) TypeScript SDK.

## Features

- **Typed client** — OAuth 1.0a + Bearer token auth, initialized from environment variables
- **Rate limiter** — automatic 429 detection, exponential backoff, pre-call exhaustion checks
- **Operations** — search, post, reply, thread, lookup, like, repost, follow, measure
- **Scheduler** — typed client for deferred posting via [xscheduler](https://github.com/cosmo-kappa/xscheduler) API
- **CLI** — every operation available as a command
- **Test suite** — unit tests for core logic + integration tests against live API

## Quick Start

```bash
git clone https://github.com/cosmo-kappa/cosmo-x.git
cd cosmo-x
npm install
cp .env.example .env   # add your X API credentials
npm run build
```

Verify everything works:

```bash
npx cosmo-x test
```

```
Running connectivity test...

  ✓ OAuth1 auth — @your_handle (185 followers)
  ✓ Bearer auth — found @your_handle
  ✓ Search — 10 results
  ✓ Scheduler — ok

Done.
```

## CLI

```bash
# ── Account ──
cosmo-x me                              # profile + metrics
cosmo-x pulse [count]                   # health check (impressions, bookmark rate)

# ── Lookup ──
cosmo-x user <username>                 # user profile by handle
cosmo-x tweet <id>                      # tweet with full metrics
cosmo-x timeline [count]                # your recent posts (default: 10)
cosmo-x list <listId> [count]           # list timeline

# ── Search ──
cosmo-x search <query> [pages]          # recent search, multi-page

# ── Post ──
cosmo-x post <text>                     # create a tweet
cosmo-x reply <tweetId> <text>          # reply to a tweet
cosmo-x thread <text1> | <text2> | ...  # post a thread (pipe-separated)
cosmo-x delete <tweetId>                # delete a tweet

# ── Engage ──
cosmo-x like <tweetId>                  # like
cosmo-x repost <tweetId>               # retweet
cosmo-x follow <username>              # follow

# ── Measure ──
cosmo-x measure <tweetId>              # metrics + bookmark rate + rating

# ── Scheduler ──
cosmo-x schedule <text> <ISO-time>     # schedule a post
cosmo-x scheduled [status]             # list scheduled posts
```

## Library API

```typescript
import {
  CosmoX,
  RateLimiter,
  searchRecent,
  createPost,
  reply,
  postThread,
  getTweet,
  getUser,
  getMe,
  getListTimeline,
  like,
  follow,
  measureArticle,
  pulseCheck,
  Scheduler,
} from "cosmo-x";

// Initialize — reads X_CONSUMER_KEY, X_BEARER_TOKEN, etc. from env
const cosmo = new CosmoX();
const rl = new RateLimiter({ log: console.error });

// Search with pagination
const results = await searchRecent(cosmo.reader, rl, {
  query: "AI agents -is:retweet lang:en",
  maxResults: 10,
  maxPages: 3,
});
console.log(results.results.length, "tweets across", results.totalPages, "pages");

// Post
const tweet = await createPost(cosmo.client, rl, { text: "hello from cosmo-x" });

// Reply
const r = await reply(cosmo.client, rl, tweet.id, "replying to myself..");

// Thread
const thread = await postThread(cosmo.client, rl, [
  "thread starts here..",
  "second thought..",
  "and the conclusion",
], 2000); // 2s delay between posts

// Tweet lookup with metrics
const article = await getTweet(cosmo.reader, rl, "1234567890");
console.log(article?.metrics); // { likes, retweets, bookmarks, impressions, ... }

// Measure bookmark rate
const m = await measureArticle(cosmo.reader, rl, "1234567890");
console.log(m?.bookmarkRate, m?.rating); // 9.2 "exceptional"

// Pulse check — account health
const pulse = await pulseCheck(cosmo.client, rl);
console.log(pulse?.user.username, pulse?.avgBookmarkRate);

// Schedule a post (requires xscheduler)
const scheduler = Scheduler.fromEnv();
await scheduler.schedule({ text: "future post", scheduled_time: "2025-03-01T10:00:00Z" });
```

## Architecture

```
src/
├── client.ts              CosmoX class — dual OAuth1 + Bearer client from env
├── rate-limiter.ts        429 detection, exponential backoff, endpoint tracking
├── operations/
│   ├── search.ts          searchRecent + PostPaginator async iterator
│   ├── post.ts            create, reply, delete, thread
│   ├── lookup.ts          tweet, user, username, getMe, list timeline, user timeline
│   ├── engage.ts          like, unlike, repost, unrepost, follow, unfollow
│   └── measure.ts         article metrics, bookmark rate rating, pulse check
├── scheduler.ts           Typed client for xscheduler Railway API
├── cli.ts                 CLI entrypoint (17 commands)
└── index.ts               Public exports

tests/
├── unit/
│   ├── rate-limiter.test.ts   Rate limiter logic (no API calls)
│   ├── client.test.ts         Client initialization + env validation
│   └── scheduler.test.ts      Scheduler request building
└── integration/
    └── live.test.ts           Live API tests (requires credentials)
```

## Rate Limiting

The official XDK throws raw `HTTP 429` errors with no retry logic. Every operation in cosmo-x is wrapped with the `RateLimiter`:

1. **Pre-check** — if an endpoint is known to be exhausted, waits before calling
2. **Auto-retry** — on 429, waits and retries with exponential backoff (15s → 30s → 60s)
3. **Endpoint tracking** — each endpoint's rate limit state is tracked independently
4. **Logging** — all rate limit events logged to stderr

```typescript
const rl = new RateLimiter({
  maxRetries: 3,       // attempts before giving up (default: 3)
  baseDelay: 15_000,   // initial backoff in ms (default: 15s)
  log: console.error,  // where to log rate limit events
});

// Check if an endpoint is currently rate-limited
rl.isLimited("search"); // → true/false
```

## Testing

```bash
# Unit tests (no API credentials needed)
npm test

# Integration tests (requires .env with valid credentials)
npm run test:integration

# All tests
npm run test:all
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `X_CONSUMER_KEY` | Yes | X API consumer key (OAuth 1.0a) |
| `X_CONSUMER_SECRET` | Yes | X API consumer secret |
| `X_ACCESS_TOKEN` | Yes | User access token |
| `X_ACCESS_TOKEN_SECRET` | Yes | User access token secret |
| `X_BEARER_TOKEN` | Yes | App-only bearer token |
| `SCHEDULER_API_KEY` | No | xscheduler API key |
| `SCHEDULER_URL` | No | xscheduler base URL |

## Known Limitations

- **Bookmarks** require OAuth 2.0 with PKCE — the XDK enforces this per-endpoint. OAuth 1.0a calls to the bookmarks endpoint will fail.
- **Rate limits** on Basic tier are tight (1 search request / 15 seconds). The rate limiter handles this transparently but multi-page searches will be slow.
- **Impression counts** in search results return 0 for other users' tweets (X API limitation). Only your own tweets show real impression data.

## License

MIT
