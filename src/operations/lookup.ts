import type { Client } from "@xdevplatform/xdk";
import type { RateLimiter } from "../rate-limiter.js";

// Helper: XDK returns `string | undefined` for IDs — normalize to string
function str(v: string | undefined): string {
  return v ?? "";
}

// --- Tweet Lookup ---

export interface TweetData {
  id: string;
  text: string;
  authorId?: string;
  authorUsername?: string;
  createdAt?: string;
  metrics?: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    bookmarks: number;
    impressions: number;
  };
}

/**
 * Look up a single tweet by ID with full metrics.
 */
export async function getTweet(
  client: Client,
  rl: RateLimiter,
  tweetId: string
): Promise<TweetData | null> {
  const res = await rl.call("tweet.get", () =>
    client.posts.getById(tweetId, {
      tweetFields: ["created_at", "public_metrics", "author_id", "note_tweet"],
      expansions: ["author_id"],
      userFields: ["username", "public_metrics"],
    })
  );

  const d = res.data;
  if (!d) return null;

  const author = res.includes?.users?.find((u: { id: string }) => u.id === d.authorId);

  return {
    id: str(d.id),
    text: d.text ?? "",
    authorId: d.authorId,
    authorUsername: author?.username,
    createdAt: d.createdAt,
    metrics: d.publicMetrics
      ? {
          likes: d.publicMetrics.likeCount ?? 0,
          retweets: d.publicMetrics.retweetCount ?? 0,
          replies: d.publicMetrics.replyCount ?? 0,
          quotes: d.publicMetrics.quoteCount ?? 0,
          bookmarks: d.publicMetrics.bookmarkCount ?? 0,
          impressions: d.publicMetrics.impressionCount ?? 0,
        }
      : undefined,
  };
}

/**
 * Look up multiple tweets by ID.
 */
export async function getTweets(
  client: Client,
  rl: RateLimiter,
  tweetIds: string[]
): Promise<TweetData[]> {
  const res = await rl.call("tweet.getMany", () =>
    client.posts.getByIds(tweetIds, {
      tweetFields: ["created_at", "public_metrics", "author_id"],
      expansions: ["author_id"],
      userFields: ["username"],
    })
  );

  const users = res.includes?.users ?? [];
  return (res.data ?? []).map((d) => {
    const author = users.find((u: { id: string }) => u.id === d.authorId);
    return {
      id: str(d.id),
      text: d.text ?? "",
      authorId: d.authorId,
      authorUsername: author?.username,
      createdAt: d.createdAt,
      metrics: d.publicMetrics
        ? {
            likes: d.publicMetrics.likeCount ?? 0,
            retweets: d.publicMetrics.retweetCount ?? 0,
            replies: d.publicMetrics.replyCount ?? 0,
            quotes: d.publicMetrics.quoteCount ?? 0,
            bookmarks: d.publicMetrics.bookmarkCount ?? 0,
            impressions: d.publicMetrics.impressionCount ?? 0,
          }
        : undefined,
    };
  });
}

// --- User Lookup ---

export interface UserData {
  id: string;
  name: string;
  username: string;
  description?: string;
  createdAt?: string;
  profileImageUrl?: string;
  metrics?: {
    followers: number;
    following: number;
    tweets: number;
    listed: number;
    likes: number;
  };
}

/**
 * Look up a user by ID.
 */
export async function getUser(
  client: Client,
  rl: RateLimiter,
  userId: string
): Promise<UserData | null> {
  const res = await rl.call("user.get", () =>
    client.users.getById(userId, {
      userFields: [
        "public_metrics",
        "description",
        "created_at",
        "profile_image_url",
      ],
    })
  );

  const d = res.data;
  if (!d) return null;

  return {
    id: d.id,
    name: d.name ?? "",
    username: d.username ?? "",
    description: d.description,
    createdAt: d.createdAt,
    profileImageUrl: d.profileImageUrl,
    metrics: d.publicMetrics
      ? {
          followers: d.publicMetrics.followersCount ?? 0,
          following: d.publicMetrics.followingCount ?? 0,
          tweets: d.publicMetrics.tweetCount ?? 0,
          listed: d.publicMetrics.listedCount ?? 0,
          likes: d.publicMetrics.likeCount ?? 0,
        }
      : undefined,
  };
}

/**
 * Look up a user by username.
 */
export async function getUserByUsername(
  client: Client,
  rl: RateLimiter,
  username: string
): Promise<UserData | null> {
  const res = await rl.call("user.getByUsername", () =>
    client.users.getByUsername(username, {
      userFields: [
        "public_metrics",
        "description",
        "created_at",
        "profile_image_url",
      ],
    })
  );

  const d = res.data;
  if (!d) return null;

  return {
    id: d.id,
    name: d.name ?? "",
    username: d.username ?? "",
    description: d.description,
    createdAt: d.createdAt,
    profileImageUrl: d.profileImageUrl,
    metrics: d.publicMetrics
      ? {
          followers: d.publicMetrics.followersCount ?? 0,
          following: d.publicMetrics.followingCount ?? 0,
          tweets: d.publicMetrics.tweetCount ?? 0,
          listed: d.publicMetrics.listedCount ?? 0,
          likes: d.publicMetrics.likeCount ?? 0,
        }
      : undefined,
  };
}

/**
 * Get authenticated user's profile (getMe).
 */
export async function getMe(
  client: Client,
  rl: RateLimiter
): Promise<UserData | null> {
  const res = await rl.call("user.me", () =>
    client.users.getMe({
      userFields: [
        "public_metrics",
        "description",
        "created_at",
        "profile_image_url",
      ],
    })
  );

  const d = res.data;
  if (!d) return null;

  return {
    id: d.id,
    name: d.name ?? "",
    username: d.username ?? "",
    description: d.description,
    createdAt: d.createdAt,
    profileImageUrl: d.profileImageUrl,
    metrics: d.publicMetrics
      ? {
          followers: d.publicMetrics.followersCount ?? 0,
          following: d.publicMetrics.followingCount ?? 0,
          tweets: d.publicMetrics.tweetCount ?? 0,
          listed: d.publicMetrics.listedCount ?? 0,
          likes: d.publicMetrics.likeCount ?? 0,
        }
      : undefined,
  };
}

// --- List Timeline ---

/**
 * Get recent tweets from a list.
 */
export async function getListTimeline(
  client: Client,
  rl: RateLimiter,
  listId: string,
  maxResults = 10
): Promise<TweetData[]> {
  const res = await rl.call("list.timeline", () =>
    client.lists.getPosts(listId, {
      maxResults: Math.max(5, Math.min(maxResults, 100)),
      tweetFields: ["created_at", "public_metrics", "author_id"],
      expansions: ["author_id"],
      userFields: ["username", "public_metrics"],
    })
  );

  const users = res.includes?.users ?? [];
  return (res.data ?? []).map((d) => {
    const author = users.find((u: { id: string }) => u.id === d.authorId);
    return {
      id: str(d.id),
      text: d.text ?? "",
      authorId: d.authorId,
      authorUsername: author?.username,
      createdAt: d.createdAt,
      metrics: d.publicMetrics
        ? {
            likes: d.publicMetrics.likeCount ?? 0,
            retweets: d.publicMetrics.retweetCount ?? 0,
            replies: d.publicMetrics.replyCount ?? 0,
            quotes: d.publicMetrics.quoteCount ?? 0,
            bookmarks: d.publicMetrics.bookmarkCount ?? 0,
            impressions: d.publicMetrics.impressionCount ?? 0,
          }
        : undefined,
    };
  });
}

/**
 * Get a user's own recent posts.
 */
export async function getUserTimeline(
  client: Client,
  rl: RateLimiter,
  userId: string,
  maxResults = 10
): Promise<TweetData[]> {
  const res = await rl.call("user.timeline", () =>
    client.users.getPosts(userId, {
      maxResults: Math.max(5, Math.min(maxResults, 100)),
      tweetFields: ["created_at", "public_metrics"],
    })
  );

  // Trim to requested count (API minimum is 5)
  const data = (res.data ?? []).slice(0, maxResults);
  return data.map((d) => ({
    id: str(d.id),
    text: d.text ?? "",
    createdAt: d.createdAt,
    metrics: d.publicMetrics
      ? {
          likes: d.publicMetrics.likeCount ?? 0,
          retweets: d.publicMetrics.retweetCount ?? 0,
          replies: d.publicMetrics.replyCount ?? 0,
          quotes: d.publicMetrics.quoteCount ?? 0,
          bookmarks: d.publicMetrics.bookmarkCount ?? 0,
          impressions: d.publicMetrics.impressionCount ?? 0,
        }
      : undefined,
  }));
}
