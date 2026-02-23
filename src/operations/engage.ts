import type { Client } from "@xdevplatform/xdk";
import type { RateLimiter } from "../rate-limiter.js";

/**
 * Like a tweet.
 */
export async function like(
  client: Client,
  rl: RateLimiter,
  userId: string,
  tweetId: string
): Promise<boolean> {
  const res = await rl.call("engage.like", () =>
    client.users.likePost(userId, { tweetId })
  );
  return res.data?.liked ?? false;
}

/**
 * Unlike a tweet.
 */
export async function unlike(
  client: Client,
  rl: RateLimiter,
  userId: string,
  tweetId: string
): Promise<boolean> {
  const res = await rl.call("engage.unlike", () =>
    client.users.unlikePost(userId, tweetId)
  );
  return res.data?.liked === false;
}

/**
 * Retweet a tweet.
 */
export async function repost(
  client: Client,
  rl: RateLimiter,
  userId: string,
  tweetId: string
): Promise<boolean> {
  const res = await rl.call("engage.repost", () =>
    client.users.repostPost(userId, { tweetId })
  );
  return res.data?.retweeted ?? false;
}

/**
 * Undo a retweet.
 */
export async function unrepost(
  client: Client,
  rl: RateLimiter,
  userId: string,
  tweetId: string
): Promise<boolean> {
  const res = await rl.call("engage.unrepost", () =>
    client.users.unrepostPost(userId, tweetId)
  );
  return res.data?.retweeted === false;
}

/**
 * Follow a user.
 */
export async function follow(
  client: Client,
  rl: RateLimiter,
  userId: string,
  targetUserId: string
): Promise<boolean> {
  const res = await rl.call("engage.follow", () =>
    client.users.followUser(userId, { targetUserId })
  );
  return res.data?.following ?? false;
}

/**
 * Unfollow a user.
 */
export async function unfollow(
  client: Client,
  rl: RateLimiter,
  userId: string,
  targetUserId: string
): Promise<boolean> {
  const res = await rl.call("engage.unfollow", () =>
    client.users.unfollowUser(userId, targetUserId)
  );
  return res.data?.following === false;
}
