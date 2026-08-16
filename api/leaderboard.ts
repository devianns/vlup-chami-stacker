import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const CONTENT_VERSION = '3.0.1';
const MAX_PACKING_BONUS = 2_999;
const MAX_ENTRIES = 20;
const MAX_DROPS = 100;
const MAX_HEIGHT = 720;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_POSTS = 6;
const PIECE_POINTS: Record<string, number> = {
  'round-s': 6000, 'round-m': 10000, 'round-l': 15000,
  'wide-s': 6000, 'wide-m': 10000, 'wide-l': 15000,
  'tall-s': 6000, 'tall-m': 10000, 'tall-l': 15000,
  'wobble-s': 6000, 'wobble-m': 10000, 'wobble-l': 15000,
};

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const sql = connectionString ? neon(connectionString) : null;
let schemaReady: Promise<void> | null = null;
const postAttempts = new Map<string, { count: number; resetsAt: number }>();

type ScoreInput = {
  nickname?: unknown;
  drops?: unknown;
  baseScore?: unknown;
  pieceCounts?: unknown;
  packingBonus?: unknown;
  packingRate?: unknown;
  height?: unknown;
  runSeed?: unknown;
  contentVersion?: unknown;
  checksum?: unknown;
  playedAt?: unknown;
};

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

export function fnv1a(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function normalizeInput(body: unknown): null | {
  nickname: string;
  drops: number;
  baseScore: number;
  pieceCounts: Record<string, number>;
  packingBonus: number;
  packingRate: number;
  height: number;
  runSeed: string;
  checksum: string;
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const value = body as ScoreInput;
  const nickname = typeof value.nickname === 'string'
    ? [...value.nickname.normalize('NFKC').replace(/[<>\u0000-\u001f]/g, '').trim()].slice(0, 12).join('')
    : '';
  const drops = Number(value.drops);
  const baseScore = Number(value.baseScore);
  const packingBonus = Number(value.packingBonus);
  const packingRate = Number(value.packingRate);
  const height = Number(value.height);
  const runSeed = typeof value.runSeed === 'string' ? value.runSeed.slice(0, 96) : '';
  const checksum = typeof value.checksum === 'string' ? value.checksum.slice(0, 64).toLowerCase() : '';
  const playedAt = typeof value.playedAt === 'string' ? value.playedAt.slice(0, 64) : '';
  if (!nickname || value.contentVersion !== CONTENT_VERSION || !/^[a-z0-9-]{8,96}$/i.test(runSeed) || !/^[a-f0-9]{8}$/.test(checksum)) return null;
  if (![drops, baseScore, packingBonus, packingRate, height].every(Number.isSafeInteger)) return null;
  if (drops < 0 || drops > MAX_DROPS || packingBonus < 0 || packingBonus > MAX_PACKING_BONUS || packingRate < 0 || packingRate > 100 || height < 0 || height > MAX_HEIGHT) return null;
  if (!value.pieceCounts || typeof value.pieceCounts !== 'object' || Array.isArray(value.pieceCounts)) return null;
  const pieceCounts = value.pieceCounts as Record<string, unknown>;
  const countEntries = Object.entries(pieceCounts);
  if (countEntries.length > Object.keys(PIECE_POINTS).length) return null;
  if (!countEntries.every(([id, count]) => id in PIECE_POINTS && Number.isSafeInteger(count) && Number(count) >= 0)) return null;
  const expectedDrops = countEntries.reduce((sum, [, count]) => sum + Number(count), 0);
  const expectedBaseScore = countEntries.reduce((sum, [id, count]) => sum + PIECE_POINTS[id] * Number(count), 0);
  if (drops !== expectedDrops || baseScore !== expectedBaseScore) return null;
  const expectedRate = Math.round((packingBonus / MAX_PACKING_BONUS) * 100);
  if (Math.abs(expectedRate - packingRate) > 1) return null;
  const playedAtTime = Date.parse(playedAt);
  if (!Number.isFinite(playedAtTime) || Math.abs(Date.now() - playedAtTime) > 24 * 60 * 60 * 1_000) return null;
  const score = baseScore + packingBonus;
  const expectedChecksum = fnv1a([nickname, score, baseScore, packingBonus, packingRate, height, drops, runSeed, CONTENT_VERSION, playedAt].join('|'));
  if (checksum !== expectedChecksum) return null;
  return { nickname, drops, baseScore, pieceCounts: pieceCounts as Record<string, number>, packingBonus, packingRate, height, runSeed, checksum };
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
    SELECT id::text, nickname, score, score - packing_bonus AS "baseScore", drops, packing_bonus AS "packingBonus",
      packing_rate AS "packingRate", height, piece_counts AS "pieceCounts", run_seed AS "runSeed",
      content_version AS "contentVersion", checksum, created_at AS "playedAt"
    FROM chami_leaderboard
    WHERE content_version = ${CONTENT_VERSION}
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
          (${input.nickname}, ${score}, ${input.drops}, ${input.packingBonus}, ${input.packingRate}, ${input.height}, ${JSON.stringify(input.pieceCounts)}, ${input.runSeed}, ${CONTENT_VERSION}, ${input.checksum})
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
