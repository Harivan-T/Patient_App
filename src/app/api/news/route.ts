import { NextResponse } from 'next/server';
import { query } from '@/lib/epr';

export const dynamic = 'force-dynamic';

export interface NewsArticle {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
}

const TOPICS = ['sports', 'health'] as const;
type Topic = typeof TOPICS[number];

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchFromGNews(topic: Topic): Promise<NewsArticle[]> {
  const key = process.env.GNEWS_API_KEY;
  if (!key || key === 'your_gnews_api_key') return [];

  const url = `https://gnews.io/api/v4/top-headlines?topic=${topic}&lang=en&max=6&apikey=${key}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return [];

  const data = await res.json();
  return (data.articles ?? []).map((a: { title: string; source: { name: string }; url: string; publishedAt: string }) => ({
    title: a.title,
    source: a.source?.name ?? '',
    url: a.url,
    publishedAt: a.publishedAt,
  }));
}

async function ensureTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS news_cache (
       topic      TEXT        PRIMARY KEY,
       articles   JSONB       NOT NULL,
       fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
  );
}

async function getCached(topic: Topic): Promise<{ articles: NewsArticle[]; fresh: boolean }> {
  const rows = await query<{ articles: NewsArticle[]; fetched_at: string }>(
    `SELECT articles, fetched_at FROM news_cache WHERE topic = $1`,
    [topic],
  );
  if (!rows.length) return { articles: [], fresh: false };
  const age = Date.now() - new Date(rows[0].fetched_at).getTime();
  return { articles: rows[0].articles, fresh: age < CACHE_TTL_MS };
}

async function upsertCache(topic: Topic, articles: NewsArticle[]) {
  await query(
    `INSERT INTO news_cache (topic, articles, fetched_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (topic) DO UPDATE SET articles = $2::jsonb, fetched_at = NOW()`,
    [topic, JSON.stringify(articles)],
  );
}

export async function GET() {
  await ensureTable();

  const result: Record<Topic, NewsArticle[]> = { sports: [], health: [] };

  await Promise.all(
    TOPICS.map(async (topic) => {
      const { articles, fresh } = await getCached(topic);
      if (fresh) {
        result[topic] = articles;
        return;
      }
      const fresh_articles = await fetchFromGNews(topic);
      if (fresh_articles.length) {
        await upsertCache(topic, fresh_articles);
        result[topic] = fresh_articles;
      } else {
        result[topic] = articles; // serve stale if API fails
      }
    }),
  );

  return NextResponse.json(result);
}
