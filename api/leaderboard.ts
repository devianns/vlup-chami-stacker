import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const CONTENT_VERSION = '2.2.0';
const POINTS_PER_CHAMI = 10_000;
const MAX_PACKING_BONUS = 9_999;
const MAX_ENTRIES = 20;

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const sql = connectionString ? neon(connectionString) : null;
let schemaReady: Promise<unknown> | null = null;

type ScoreInput = {
  nickname?: unknown;
  drops?: unknown;
  packingBonus?: unknown;
  packingRate?: unknown;
  height?: unknown;
  runSeed?: unknown;
  contentVersion?: unknown;
  checksum?: unknown;
};

function setCors(response: VercelResponse): void {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Cache-Control', 'no-store');
}

function ensureSchema(): Promise<unknown> {
  if (!sql) throw new Error('DATABASE_URL is not configured');
  schemaReady ??= sql`
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  return schemaReady;
}

function normalizeInput(body: ScoreInput): null | {
  nickname: string;
  drops: number;
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
  const packingBonus = Number(body.packingBonus);
  const packingRate = Number(body.packingRate);
  const height = Number(body.height);
  const runSeed = typeof body.runSeed === 'string' ? body.runSeed.slice(0, 96) : '';
  const checksum = typeof body.checksum === 'string' ? body.checksum.slice(0, 64) : '';
  if (!nickname || body.contentVersion !== CONTENT_VERSION || !runSeed || !checksum) return null;
  if (![drops, packingBonus, packingRate, height].every(Number.isSafeInteger)) return null;
  if (drops < 0 || drops > 500 || packingBonus < 0 || packingBonus > MAX_PACKING_BONUS || packingRate < 0 || packingRate > 100 || height < 0 || height > 2_000) return null;
  const expectedRate = Math.round((packingBonus / MAX_PACKING_BONUS) * 100);
  if (Math.abs(expectedRate - packingRate) > 1) return null;
  return { nickname, drops, packingBonus, packingRate, height, runSeed, checksum };
}

async function listScores(): Promise<unknown[]> {
  if (!sql) throw new Error('DATABASE_URL is not configured');
  return sql`
    SELECT id::text, nickname, score, score - packing_bonus AS "baseScore", drops, packing_bonus AS "packingBonus",
      packing_rate AS "packingRate", height, run_seed AS "runSeed",
      content_version AS "contentVersion", checksum, created_at AS "playedAt"
    FROM chami_leaderboard
    WHERE content_version = ${CONTENT_VERSION}
    ORDER BY drops DESC, packing_rate DESC, score DESC, created_at ASC
    LIMIT ${MAX_ENTRIES}
  `;
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  setCors(response);
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
      const score = input.drops * POINTS_PER_CHAMI + input.packingBonus;
      await sql`
        INSERT INTO chami_leaderboard
          (nickname, score, drops, packing_bonus, packing_rate, height, run_seed, content_version, checksum)
        VALUES
          (${input.nickname}, ${score}, ${input.drops}, ${input.packingBonus}, ${input.packingRate}, ${input.height}, ${input.runSeed}, ${CONTENT_VERSION}, ${input.checksum})
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
