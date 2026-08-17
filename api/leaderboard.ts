import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const CONTENT_VERSION = '3.0.1';
const MAX_PACKING_BONUS = 2_999;
const MAX_ENTRIES = 20;
const PIECE_POINTS: Record<string, number> = {
  'round-s': 6000, 'round-m': 10000, 'round-l': 15000,
  'wide-s': 6000, 'wide-m': 10000, 'wide-l': 15000,
  'tall-s': 6000, 'tall-m': 10000, 'tall-l': 15000,
  'wobble-s': 6000, 'wobble-m': 10000, 'wobble-l': 15000,
};

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const sql = connectionString ? neon(connectionString) : null;
let schemaReady: Promise<unknown> | null = null;

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
};

function setResponseHeaders(response: VercelResponse): void {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
}

function ensureSchema(): Promise<unknown> {
  if (!sql) throw new Error('DATABASE_URL is not configured');
  const database = sql;
  schemaReady ??= (async () => {
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
  return schemaReady;
}

function normalizeInput(body: ScoreInput): null | {
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
  const nickname = typeof body.nickname === 'string'
    ? [...body.nickname.normalize('NFKC').replace(/[<>\u0000-\u001f]/g, '').trim()].slice(0, 12).join('')
    : '';
  const drops = Number(body.drops);
  const baseScore = Number(body.baseScore);
  const packingBonus = Number(body.packingBonus);
  const packingRate = Number(body.packingRate);
  const height = Number(body.height);
  const runSeed = typeof body.runSeed === 'string' ? body.runSeed.slice(0, 96) : '';
  const checksum = typeof body.checksum === 'string' ? body.checksum.slice(0, 64) : '';
  if (!nickname || body.contentVersion !== CONTENT_VERSION || !runSeed || !checksum) return null;
  if (![drops, baseScore, packingBonus, packingRate, height].every(Number.isSafeInteger)) return null;
  if (drops < 0 || drops > 500 || packingBonus < 0 || packingBonus > MAX_PACKING_BONUS || packingRate < 0 || packingRate > 100 || height < 0 || height > 2_000) return null;
  if (!body.pieceCounts || typeof body.pieceCounts !== 'object' || Array.isArray(body.pieceCounts)) return null;
  const pieceCounts = body.pieceCounts as Record<string, unknown>;
  const countEntries = Object.entries(pieceCounts);
  if (!countEntries.every(([id, count]) => id in PIECE_POINTS && Number.isSafeInteger(count) && Number(count) >= 0)) return null;
  const expectedDrops = countEntries.reduce((sum, [, count]) => sum + Number(count), 0);
  const expectedBaseScore = countEntries.reduce((sum, [id, count]) => sum + PIECE_POINTS[id] * Number(count), 0);
  if (drops !== expectedDrops || baseScore !== expectedBaseScore) return null;
  const expectedRate = Math.round((packingBonus / MAX_PACKING_BONUS) * 100);
  if (Math.abs(expectedRate - packingRate) > 1) return null;
  return { nickname, drops, baseScore, pieceCounts: pieceCounts as Record<string, number>, packingBonus, packingRate, height, runSeed, checksum };
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
    await ensureSchema();
    if (request.method === 'GET') {
      response.status(200).json({ entries: await listScores(), updatedAt: new Date().toISOString() });
      return;
    }
    if (request.method === 'POST') {
      const input = normalizeInput(request.body as ScoreInput);
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
