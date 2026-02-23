# cosmo-x

X API toolkit — typed client, rate-aware operations, scheduling.

Built on the official [`@xdevplatform/xdk`](https://github.com/xdevplatform/xdk) TypeScript SDK.

## What this does

Replaces hand-rolled bash/curl/python scripts with a typed, rate-limit-aware toolkit for X API operations.

- **Typed client** — OAuth1 + Bearer auth from env vars, one import
- **Rate limiter** — catches 429s, auto-waits, exponential backoff
- **Operations** — search, post, reply, thread, lookup, like, repost, follow, measure
- **Scheduler client** — typed wrapper for xscheduler Railway API
- **CLI** — all operations available from the command line

## Setup

```bash
npm install
cp .env.example .env  # fill in your X API credentials
npm run build
```

## CLI Usage

```bash
# Account
cosmo-x me                          # get your profile + metrics
cosmo-x pulse 10                    # account health check (last 10 posts)

# Lookup
cosmo-x user <username>             # look up any user
cosmo-x tweet <id>                  # look up tweet with full metrics
cosmo-x timeline 10                 # your recent posts
cosmo-x list <listId> 10            # list timeline

# Search
cosmo-x search "AI agents -is:retweet" 3    # search with 3 pages

# Post
cosmo-x post "hello world"          # create a tweet
cosmo-x reply <tweetId> "nice post" # reply to a tweet
cosmo-x thread "first | second | third"  # post a thread
cosmo-x delete <tweetId>            # delete a tweet

# Engage
cosmo-x like <tweetId>              # like a tweet
cosmo-x repost <tweetId>            # retweet
cosmo-x follow <username>           # follow a user

# Measure
cosmo-x measure <tweetId>           # get article metrics + bookmark rate

# Scheduler
cosmo-x schedule "text" "2024-01-15T10:00:00Z"  # schedule a post
cosmo-x scheduled pending                        # list pending posts

# Test
cosmo-x test                        # connectivity check
```

## Library Usage

```typescript
import { CosmoX, RateLimiter, searchRecent, createPost, measureArticle, pulseCheck } from 'cosmo-x';

const cosmo = new CosmoX();  // reads credentials from env
const rl = new RateLimiter();

// Search
const results = await searchRecent(cosmo.reader, rl, {
  query: 'AI agents -is:retweet',
  maxResults: 10,
  maxPages: 3,
});

// Post
const tweet = await createPost(cosmo.client, rl, {
  text: 'hello from cosmo-x',
});

// Reply
const reply = await createPost(cosmo.client, rl, {
  text: 'great thread..',
  replyTo: '1234567890',
});

// Measure
const metrics = await measureArticle(cosmo.reader, rl, '1234567890');
// → { bookmarkRate: 9.2, rating: "exceptional", ... }

// Pulse check
const pulse = await pulseCheck(cosmo.client, rl, 10);
// → { user, recentPosts, totalImpressions, avgBookmarkRate, ... }
```

## Architecture

```
src/
├── client.ts            # CosmoX class — OAuth1 + Bearer from env
├── rate-limiter.ts      # 429 tracking, auto-backoff, retry
├── operations/
│   ├── search.ts        # searchRecent + async pagination iterator
│   ├── post.ts          # create, reply, delete, thread
│   ├── lookup.ts        # tweet, user, list timeline, user timeline
│   ├── engage.ts        # like, unlike, repost, unrepost, follow, unfollow
│   └── measure.ts       # article metrics, bookmark rate, pulse check
├── scheduler.ts         # typed client for xscheduler Railway API
├── cli.ts               # CLI entrypoint
└── index.ts             # public exports
```

## Rate Limiting

The XDK throws raw HTTP 429 errors. This toolkit wraps every call with:

1. **Pre-check** — if an endpoint is known to be exhausted, wait before calling
2. **Auto-retry** — on 429, wait and retry (up to 3 times, exponential backoff)
3. **Logging** — rate limit events are logged to stderr

```typescript
const rl = new RateLimiter({
  maxRetries: 3,     // retry up to 3 times on 429
  baseDelay: 15000,  // 15s initial backoff
  log: console.error,
});
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `X_CONSUMER_KEY` | Yes | X API consumer key |
| `X_CONSUMER_SECRET` | Yes | X API consumer secret |
| `X_ACCESS_TOKEN` | Yes | OAuth 1.0a access token |
| `X_ACCESS_TOKEN_SECRET` | Yes | OAuth 1.0a access token secret |
| `X_BEARER_TOKEN` | Yes | App-only bearer token |
| `SCHEDULER_API_KEY` | No | xscheduler API key |
| `SCHEDULER_URL` | No | xscheduler base URL |

## License

MIT
