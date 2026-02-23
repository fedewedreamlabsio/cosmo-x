import type { Client } from "@xdevplatform/xdk";
import type { RateLimiter } from "../rate-limiter.js";

export interface PostOpts {
  text: string;
  replyTo?: string;
  quoteTweetId?: string;
  mediaIds?: string[];
}

export interface PostResult {
  id: string;
  text?: string;
}

/**
 * Create a tweet. Supports plain posts, replies, quote tweets, and media.
 */
export async function createPost(
  client: Client,
  rl: RateLimiter,
  opts: PostOpts
): Promise<PostResult> {
  const body: Record<string, unknown> = { text: opts.text };

  if (opts.replyTo) {
    body.reply = { inReplyToTweetId: opts.replyTo };
  }

  if (opts.quoteTweetId) {
    body.quoteTweetId = opts.quoteTweetId;
  }

  if (opts.mediaIds && opts.mediaIds.length > 0) {
    body.media = { mediaIds: opts.mediaIds };
  }

  const res = await rl.call("post.create", () => client.posts.create(body));

  return {
    id: res.data?.id ?? "",
    text: res.data?.text,
  };
}

/**
 * Reply to a tweet. Convenience wrapper around createPost.
 */
export async function reply(
  client: Client,
  rl: RateLimiter,
  tweetId: string,
  text: string
): Promise<PostResult> {
  return createPost(client, rl, { text, replyTo: tweetId });
}

/**
 * Delete a tweet by ID.
 */
export async function deletePost(
  client: Client,
  rl: RateLimiter,
  tweetId: string
): Promise<boolean> {
  const res = await rl.call("post.delete", () => client.posts.delete(tweetId));
  return res.data?.deleted ?? false;
}

/**
 * Post a thread — array of texts, each replying to the previous.
 * Returns all tweet IDs in order.
 */
export async function postThread(
  client: Client,
  rl: RateLimiter,
  texts: string[],
  delayMs = 1000
): Promise<PostResult[]> {
  const results: PostResult[] = [];
  let previousId: string | undefined;

  for (const text of texts) {
    const result = await createPost(client, rl, {
      text,
      replyTo: previousId,
    });
    results.push(result);
    previousId = result.id;

    // Delay between thread posts
    if (delayMs > 0 && texts.indexOf(text) < texts.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return results;
}
