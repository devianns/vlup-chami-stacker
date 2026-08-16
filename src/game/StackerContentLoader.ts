import type { StackerGameProtocol, StackerPieceDefinition } from '../types';

export class ContentError extends Error {
  constructor(public issues: string[]) {
    super(`게임 설정 오류 ${issues.length}개`);
  }
}

export async function loadStackerContent(url = './game-data/stacker.json'): Promise<StackerGameProtocol> {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`게임 설정을 불러오지 못했습니다. (${response.status})`);
  const data = await response.json() as StackerGameProtocol;
  const issues = validateStackerContent(data);
  if (!issues.length) issues.push(...await validateAssets(data));
  if (issues.length) throw new ContentError(issues);
  return data;
}

async function validateAssets(data: StackerGameProtocol): Promise<string[]> {
  const results = await Promise.all(Object.entries(data.assets.images).map(async ([id, asset]) => {
    try {
      const response = await fetch(asset.src, { method: 'HEAD' });
      return response.ok ? null : `assets.images.${id}: 파일을 찾을 수 없습니다. '${asset.src}'`;
    } catch {
      return `assets.images.${id}: 파일에 접근할 수 없습니다. '${asset.src}'`;
    }
  }));
  return results.filter((issue): issue is string => issue !== null);
}

function validatePiece(id: string, piece: StackerPieceDefinition, data: StackerGameProtocol, issues: string[]): void {
  const path = `pieces.${id}`;
  if (!data.assets.images[piece.texture]) issues.push(`${path}.texture: 존재하지 않는 이미지 '${piece.texture}'`);
  if (!['circle', 'capsule', 'rectangle'].includes(piece.shape)) issues.push(`${path}.shape: 지원하지 않는 충돌체입니다.`);
  if (!(piece.width > 0) || !(piece.height > 0)) issues.push(`${path}: width와 height는 0보다 커야 합니다.`);
  if (piece.shape === 'circle' && (!(piece.radius ?? 0) || piece.radius! > Math.min(piece.width, piece.height) / 2)) issues.push(`${path}.radius: 원형 반지름이 유효하지 않습니다.`);
  if (!(piece.mass > 0)) issues.push(`${path}.mass: 0보다 커야 합니다.`);
  if (piece.friction < 0 || piece.friction > 1) issues.push(`${path}.friction: 0~1 범위여야 합니다.`);
  if (piece.restitution < 0 || piece.restitution > 1) issues.push(`${path}.restitution: 0~1 범위여야 합니다.`);
}

export function validateStackerContent(data: StackerGameProtocol): string[] {
  const issues: string[] = [];
  if (!data || typeof data !== 'object') return ['게임 설정의 최상위 값은 JSON 객체여야 합니다.'];
  if (data.protocolVersion !== 5) issues.push('protocolVersion: 지원 버전은 5입니다.');
  if (!data.game?.id || !data.game?.version || !data.game?.title) issues.push('game.id, game.version, game.title은 필수입니다.');
  if (!data.assets?.images || !data.pieces) return [...issues, 'assets.images와 pieces는 필수입니다.'];
  if (!Object.keys(data.pieces).length) issues.push('pieces: 최소 한 종류가 필요합니다.');
  Object.entries(data.pieces).forEach(([id, piece]) => validatePiece(id, piece, data, issues));
  if (data.renderer?.backgroundImage && !data.assets.images[data.renderer.backgroundImage]) issues.push(`renderer.backgroundImage: 존재하지 않는 이미지 '${data.renderer.backgroundImage}'`);
  if (!data.presenter?.name) issues.push('presenter.name은 필수입니다.');
  (['idle', 'guide', 'cheer'] as const).forEach((key) => {
    if (!data.assets.images[data.presenter?.[key]]) issues.push(`presenter.${key}: 존재하지 않는 이미지 '${data.presenter?.[key]}'`);
  });
  if (!data.assets.images[data.titleScreen?.art]) issues.push(`titleScreen.art: 존재하지 않는 이미지 '${data.titleScreen?.art}'`);
  if (!data.titleScreen?.title || !data.titleScreen?.cta) issues.push('titleScreen.title과 titleScreen.cta는 필수입니다.');
  if (!(data.renderer?.width > 0) || !(data.renderer?.height > 0)) issues.push('renderer: 유효한 화면 크기가 필요합니다.');
  if (!(data.renderer?.dangerY > data.stacking?.previewY && data.renderer.dangerY < data.renderer.floorY)) issues.push('renderer.dangerY: previewY와 floorY 사이여야 합니다.');
  if (!(data.renderer?.arenaWidth > 0 && data.renderer.arenaWidth <= data.renderer.width)) issues.push('renderer.arenaWidth: 화면 너비 이하여야 합니다.');
  if (!(data.stacking?.pointsPerChami > data.stacking?.maxPackingBonus)) issues.push('stacking.pointsPerChami: maxPackingBonus보다 커야 합니다.');
  if (!data.stacking?.bag?.length) issues.push('stacking.bag: 랜덤 주머니에 차미가 하나 이상 필요합니다.');
  data.stacking?.bag?.forEach((id) => { if (!data.pieces[id]) issues.push(`stacking.bag: 존재하지 않는 차미 '${id}'`); });
  (['start', 'drop', 'milestone', 'danger', 'gameOver'] as const).forEach((key) => {
    if (!data.dialogue?.[key]?.length) issues.push(`dialogue.${key}: 대사가 하나 이상 필요합니다.`);
  });
  return issues;
}
