import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { leaderboardRules, normalizeInput } from './leaderboard-validation';

const MAX_ENTRIES = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_POSTS = 6;

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const sql = connectionString ? neon(connectionString) : null;
let schemaReady: Promise<void> | null = null;
const postAttempts = new Map<string, { count: number; resetsAt: number }>();

function setResponseHeaders(response: VercelResponse): void {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
}

async function ensureSchema(): Promise<void> {
  if (!sql) throw new Error('DATABASE_URL is not configured');
  const database = sql;
  schemaReady ??= (async (): Promise<void> => {
    await database`
      CREATE TABLE IF NOT EXISTS chami_leaderboard (
        id BIGSERIAL PRIMARY KEY,
        nickname VARCHAR(12) NOT NULL,
        score INTEGER NOT NULL,
        drops INTEGER NOT NULL,
        packing_bonus INTEGER NOT NULL,
        packing_rate INTEGER NOT NULL,
        height INTEGER NOT NULL,
        run_seed VARCHAR(96) NOT NULL UNIQUE,
        content_version VARCHAR(24) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        piece_counts JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await database`ALTER TABLE chami_leaderboard ADD COLUMN IF NOT EXISTS piece_counts JSONB NOT NULL DEFAULT '{}'`;
  })();
  try {
    await schemaReady;
  } catch (error) {
    schemaReady = null;
    throw error;
  }
}

function clientKey(request: VercelRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return value?.split(',')[0]?.trim() || request.socket.remoteAddress || 'unknown';
}

function isPostRateLimited(request: VercelRequest): boolean {
  const now = Date.now();
  if (postAttempts.size > 1_000) {
    postAttempts.forEach((attempt, key) => { if (attempt.resetsAt <= now) postAttempts.delete(key); });
  }
  const key = clientKey(request);
  const current = postAttempts.get(key);
  if (!current || current.resetsAt <= now) {
    postAttempts.set(key, { count: 1, resetsAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT_MAX_POSTS;
}

async function listScores(): Promise<unknown[]> {
  if (!sql) throw new Error('DATABASE_URL is not configured');
  return sql`
    SELECT id::text, nickname, score, drops, packing_rate AS "packingRate",
      run_seed AS "runSeed", created_at AS "playedAt"
    FROM chami_leaderboard
    WHERE content_version = ${leaderboardRules.contentVersion}
    ORDER BY score DESC, packing_rate DESC, drops DESC, created_at ASC
    LIMIT ${MAX_ENTRIES}
  `;
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  setResponseHeaders(response);
  if (request.method === 'OPTIONS') { response.status(204).end(); return; }
  if (!sql) { response.status(503).json({ error: '점수판 서버가 아직 설정되지 않았어요.' }); return; }

  try {
    if (request.method === 'POST' && isPostRateLimited(request)) {
      response.setHeader('Retry-After', '60');
      response.status(429).json({ error: '기록 요청이 너무 잦아요. 잠시 뒤 다시 시도해 주세요.' });
      return;
    }
    await ensureSchema();
    if (request.method === 'GET') {
      response.status(200).json({ entries: await listScores(), updatedAt: new Date().toISOString() });
      return;
    }
    if (request.method === 'POST') {
      const input = normalizeInput(request.body);
      if (!input) { response.status(400).json({ error: '점수 정보를 확인할 수 없어요.' }); return; }
      const score = input.baseScore + input.packingBonus;
      await sql`
        INSERT INTO chami_leaderboard
          (nickname, score, drops, packing_bonus, packing_rate, height, piece_counts, run_seed, content_version, checksum)
        VALUES
          (${input.nickname}, ${score}, ${input.drops}, ${input.packingBonus}, ${input.packingRate}, ${input.height}, ${JSON.stringify(input.pieceCounts)}, ${input.runSeed}, ${leaderboardRules.contentVersion}, ${input.checksum})
        ON CONFLICT (run_seed) DO NOTHING
      `;
      response.status(201).json({ entries: await listScores(), updatedAt: new Date().toISOString() });
      return;
    }
    response.setHeader('Allow', 'GET, POST, OPTIONS');
    response.status(405).json({ error: '지원하지 않는 요청입니다.' });
  } catch (error) {
    console.error('leaderboard api error', error);
    response.status(500).json({ error: '점수판 서버에 잠시 문제가 생겼어요.' });
  }
}
