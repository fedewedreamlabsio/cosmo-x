#!/usr/bin/env node

import { CosmoX } from "./client.js";
import { RateLimiter } from "./rate-limiter.js";
import { searchRecent } from "./operations/search.js";
import { createPost, reply, deletePost, postThread } from "./operations/post.js";
import { getTweet, getUser, getUserByUsername, getMe, getListTimeline, getUserTimeline } from "./operations/lookup.js";
import { like, repost, follow } from "./operations/engage.js";
import { measureArticle, pulseCheck } from "./operations/measure.js";
import { Scheduler } from "./scheduler.js";

const rl = new RateLimiter({ log: (msg) => console.error(msg) });

function usage(): void {
  console.log(`
cosmo-x — X API toolkit

Usage: cosmo-x <command> [args]

Commands:
  me                          Get authenticated user profile
  user <username>             Look up user by username
  tweet <id>                  Look up tweet with metrics
  timeline [count]            Get own recent posts (default: 10)
  list <listId> [count]       Get list timeline
  search <query> [pages]      Search recent tweets
  post <text>                 Create a tweet
  reply <tweetId> <text>      Reply to a tweet
  thread <text1> | <text2>    Post a thread (pipe-separated)
  delete <tweetId>            Delete a tweet
  like <tweetId>              Like a tweet
  repost <tweetId>            Retweet
  follow <username>           Follow a user
  measure <tweetId>           Get article metrics + bookmark rate
  pulse [count]               Account pulse check
  schedule <text> <time>      Schedule a post (ISO time)
  scheduled [status]          List scheduled posts
  test                        Run connectivity test

Environment:
  X_CONSUMER_KEY, X_CONSUMER_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET, X_BEARER_TOKEN
  SCHEDULER_API_KEY, SCHEDULER_URL (optional)
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    usage();
    return;
  }

  const cosmo = new CosmoX();

  switch (cmd) {
    case "me": {
      const me = await getMe(cosmo.client, rl);
      console.log(JSON.stringify(me, null, 2));
      break;
    }

    case "user": {
      const username = args[1];
      if (!username) { console.error("Usage: cosmo-x user <username>"); process.exit(1); }
      const user = await getUserByUsername(cosmo.reader, rl, username);
      console.log(JSON.stringify(user, null, 2));
      break;
    }

    case "tweet": {
      const id = args[1];
      if (!id) { console.error("Usage: cosmo-x tweet <id>"); process.exit(1); }
      const tweet = await getTweet(cosmo.reader, rl, id);
      console.log(JSON.stringify(tweet, null, 2));
      break;
    }

    case "timeline": {
      const count = parseInt(args[1] ?? "10", 10);
      const me = await getMe(cosmo.client, rl);
      if (!me) { console.error("Could not get user"); process.exit(1); }
      const posts = await getUserTimeline(cosmo.reader, rl, me.id, count);
      console.log(JSON.stringify(posts, null, 2));
      break;
    }

    case "list": {
      const listId = args[1];
      if (!listId) { console.error("Usage: cosmo-x list <listId> [count]"); process.exit(1); }
      const count = parseInt(args[2] ?? "10", 10);
      const posts = await getListTimeline(cosmo.reader, rl, listId, count);
      console.log(JSON.stringify(posts, null, 2));
      break;
    }

    case "search": {
      const query = args[1];
      if (!query) { console.error("Usage: cosmo-x search <query> [pages]"); process.exit(1); }
      const pages = parseInt(args[2] ?? "1", 10);
      const res = await searchRecent(cosmo.reader, rl, {
        query,
        maxResults: 10,
        maxPages: pages,
      });
      console.log(JSON.stringify(res, null, 2));
      break;
    }

    case "post": {
      const text = args.slice(1).join(" ");
      if (!text) { console.error("Usage: cosmo-x post <text>"); process.exit(1); }
      const result = await createPost(cosmo.client, rl, { text });
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case "reply": {
      const tweetId = args[1];
      const text = args.slice(2).join(" ");
      if (!tweetId || !text) { console.error("Usage: cosmo-x reply <tweetId> <text>"); process.exit(1); }
      const result = await reply(cosmo.client, rl, tweetId, text);
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case "thread": {
      const texts = args.slice(1).join(" ").split("|").map((t) => t.trim()).filter(Boolean);
      if (texts.length < 2) { console.error("Usage: cosmo-x thread <text1> | <text2> | ..."); process.exit(1); }
      const results = await postThread(cosmo.client, rl, texts);
      console.log(JSON.stringify(results, null, 2));
      break;
    }

    case "delete": {
      const id = args[1];
      if (!id) { console.error("Usage: cosmo-x delete <tweetId>"); process.exit(1); }
      const ok = await deletePost(cosmo.client, rl, id);
      console.log(ok ? "Deleted" : "Failed");
      break;
    }

    case "like": {
      const tweetId = args[1];
      if (!tweetId) { console.error("Usage: cosmo-x like <tweetId>"); process.exit(1); }
      const me = await getMe(cosmo.client, rl);
      if (!me) { console.error("Could not get user"); process.exit(1); }
      const ok = await like(cosmo.client, rl, me.id, tweetId);
      console.log(ok ? "Liked" : "Failed");
      break;
    }

    case "repost": {
      const tweetId = args[1];
      if (!tweetId) { console.error("Usage: cosmo-x repost <tweetId>"); process.exit(1); }
      const me = await getMe(cosmo.client, rl);
      if (!me) { console.error("Could not get user"); process.exit(1); }
      const ok = await repost(cosmo.client, rl, me.id, tweetId);
      console.log(ok ? "Reposted" : "Failed");
      break;
    }

    case "follow": {
      const username = args[1];
      if (!username) { console.error("Usage: cosmo-x follow <username>"); process.exit(1); }
      const me = await getMe(cosmo.client, rl);
      if (!me) { console.error("Could not get user"); process.exit(1); }
      const target = await getUserByUsername(cosmo.reader, rl, username);
      if (!target) { console.error(`User @${username} not found`); process.exit(1); }
      const ok = await follow(cosmo.client, rl, me.id, target.id);
      console.log(ok ? `Following @${username}` : "Failed");
      break;
    }

    case "measure": {
      const id = args[1];
      if (!id) { console.error("Usage: cosmo-x measure <tweetId>"); process.exit(1); }
      const m = await measureArticle(cosmo.reader, rl, id);
      console.log(JSON.stringify(m, null, 2));
      break;
    }

    case "pulse": {
      const count = parseInt(args[1] ?? "10", 10);
      const p = await pulseCheck(cosmo.client, rl, count);
      if (!p) { console.error("Pulse check failed"); process.exit(1); }
      console.log(JSON.stringify({
        user: `@${p.user.username}`,
        followers: p.user.metrics?.followers,
        following: p.user.metrics?.following,
        totalTweets: p.user.metrics?.tweets,
        recentPosts: p.recentPosts.length,
        totalImpressions: p.totalImpressions,
        totalBookmarks: p.totalBookmarks,
        totalLikes: p.totalLikes,
        avgBookmarkRate: `${p.avgBookmarkRate}%`,
      }, null, 2));
      break;
    }

    case "schedule": {
      const text = args[1];
      const time = args[2];
      if (!text || !time) { console.error("Usage: cosmo-x schedule <text> <ISO-time>"); process.exit(1); }
      const scheduler = Scheduler.fromEnv();
      const post = await scheduler.schedule({ text, scheduled_time: time });
      console.log(JSON.stringify(post, null, 2));
      break;
    }

    case "scheduled": {
      const status = args[1] as "pending" | "posted" | "failed" | "cancelled" | undefined;
      const scheduler = Scheduler.fromEnv();
      const posts = await scheduler.listPosts(status);
      console.log(JSON.stringify(posts, null, 2));
      break;
    }

    case "test": {
      console.log("Running connectivity test...\n");
      try {
        const me = await getMe(cosmo.client, rl);
        console.log(`  ✓ OAuth1 auth — @${me?.username} (${me?.metrics?.followers} followers)`);
      } catch (e) {
        console.log(`  ✗ OAuth1 auth — ${(e as Error).message}`);
      }

      try {
        const user = await getUserByUsername(cosmo.reader, rl, "cosmo_kappa");
        console.log(`  ✓ Bearer auth — found @${user?.username}`);
      } catch (e) {
        console.log(`  ✗ Bearer auth — ${(e as Error).message}`);
      }

      try {
        const search = await searchRecent(cosmo.reader, rl, {
          query: "AI agents -is:retweet",
          maxResults: 10,
        });
        console.log(`  ✓ Search — ${search.results.length} results`);
      } catch (e) {
        console.log(`  ✗ Search — ${(e as Error).message}`);
      }

      try {
        const scheduler = Scheduler.fromEnv();
        const health = await scheduler.health();
        console.log(`  ✓ Scheduler — ${health.status}`);
      } catch (e) {
        console.log(`  ✗ Scheduler — ${(e as Error).message}`);
      }

      console.log("\nDone.");
      break;
    }

    default:
      console.error(`Unknown command: ${cmd}`);
      usage();
      process.exit(1);
  }
}

main().catch((e) => {
  console.error("Error:", (e as Error).message);
  process.exit(1);
});
