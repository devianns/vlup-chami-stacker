import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { StackerGameProtocol } from '../types';
import { validateStackerContent } from './StackerContentLoader';

const content = JSON.parse(readFileSync(new URL('../../public/game-data/stacker.json', import.meta.url), 'utf8')) as StackerGameProtocol;

describe('stacker content protocol', () => {
  it('accepts the shipped Chami dataset', () => {
    expect(validateStackerContent(content)).toEqual([]);
  });

  it('rejects a missing piece texture', () => {
    const broken = structuredClone(content);
    broken.pieces.round.texture = 'missing';
    expect(validateStackerContent(broken)).toContain("pieces.round.texture: 존재하지 않는 이미지 'missing'");
  });

  it('rejects an invalid danger line', () => {
    const broken = structuredClone(content);
    broken.renderer.dangerY = broken.renderer.floorY + 1;
    expect(validateStackerContent(broken).some((issue) => issue.startsWith('renderer.dangerY'))).toBe(true);
  });
});
