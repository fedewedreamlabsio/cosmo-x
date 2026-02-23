import type { Client } from "@xdevplatform/xdk";
import { PostPaginator } from "@xdevplatform/xdk";
import type { RateLimiter } from "../rate-limiter.js";

function str(v: string | undefined): string {
  return v ?? "";
}

export interface SearchOpts {
  query: string;
  maxResults?: number;
  /** Max pages to fetch. Default: 1 */
  maxPages?: number;
  startTime?: string;
  endTime?: string;
  sortOrder?: "recency" | "relevancy";
}

export interface SearchResult {
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

export interface SearchResponse {
  results: SearchResult[];
  nextToken?: string;
  totalPages: number;
}

const TWEET_FIELDS = ["created_at", "public_metrics", "author_id"] as const;
const USER_FIELDS = ["username", "public_metrics"] as const;

/**
 * Search recent tweets with rate-limit-aware pagination.
 * This is the core keyword-seeding operation.
 */
export async function searchRecent(
  client: Client,
  rl: RateLimiter,
  opts: SearchOpts
): Promise<SearchResponse> {
  const maxPages = opts.maxPages ?? 1;
  const perPage = Math.min(opts.maxResults ?? 10, 100);
  const results: SearchResult[] = [];
  let nextToken: string | undefined;
  let pageCount = 0;

  for (let page = 0; page < maxPages; page++) {
    const searchOpts: Record<string, unknown> = {
      maxResults: perPage,
      tweetFields: [...TWEET_FIELDS],
      expansions: ["author_id"],
      userFields: [...USER_FIELDS],
    };
    if (nextToken) searchOpts.paginationToken = nextToken;
    if (opts.startTime) searchOpts.startTime = opts.startTime;
    if (opts.endTime) searchOpts.endTime = opts.endTime;
    if (opts.sortOrder) searchOpts.sortOrder = opts.sortOrder;

    const res = await rl.call("search", () =>
      client.posts.searchRecent(opts.query, searchOpts)
    );

    pageCount++;
    const users = res.includes?.users ?? [];

    for (const tweet of res.data ?? []) {
      const author = users.find((u: { id: string }) => u.id === tweet.authorId);
      results.push({
        id: str(tweet.id),
        text: tweet.text ?? "",
        authorId: tweet.authorId,
        authorUsername: author?.username,
        createdAt: tweet.createdAt,
        metrics: tweet.publicMetrics
          ? {
              likes: tweet.publicMetrics.likeCount ?? 0,
              retweets: tweet.publicMetrics.retweetCount ?? 0,
              replies: tweet.publicMetrics.replyCount ?? 0,
              quotes: tweet.publicMetrics.quoteCount ?? 0,
              bookmarks: tweet.publicMetrics.bookmarkCount ?? 0,
              impressions: tweet.publicMetrics.impressionCount ?? 0,
            }
          : undefined,
      });
    }

    nextToken = res.meta?.nextToken;
    if (!nextToken) break;
  }

  return { results, nextToken, totalPages: pageCount };
}

/**
 * Create an async iterator over search results.
 * Handles pagination automatically — just for-await over it.
 */
export function searchIterator(
  client: Client,
  rl: RateLimiter,
  query: string,
  perPage = 10
): PostPaginator {
  return new PostPaginator(async (token?: string) => {
    const opts: Record<string, unknown> = {
      maxResults: perPage,
      tweetFields: [...TWEET_FIELDS],
      expansions: ["author_id"],
      userFields: [...USER_FIELDS],
    };
    if (token) opts.paginationToken = token;

    const res = await rl.call("search", () =>
      client.posts.searchRecent(query, opts)
    );

    return {
      data: res.data ?? [],
      meta: res.meta,
      includes: res.includes,
      errors: res.errors,
    };
  });
}
