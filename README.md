# 차미 쌓기 게임!

[게임 규칙](docs/GAME_RULES.ko.md) · [팬게임 규정 준수 확인](FAN_GAME_COMPLIANCE.ko.md)

시트리와 함께 빨간 한계선 아래의 빈틈을 차미로 채우는 모바일 퍼스트 물리 스태킹 팬게임입니다. Phaser 3, TypeScript, Vite와 JSON 게임 프로토콜로 구성되어 있습니다.

> 비영리 팬게임입니다. Original By Creatorbus Inc. · [시트리 공식 유튜브](https://www.youtube.com/@sitry_vlup)<br>
> 게임의 캐릭터 스탠딩·스프라이트·배경·타이틀 등 시각 에셋 제작에 생성형 AI가 사용되었습니다. 공식 음원 및 AI 음성 합성은 사용하지 않습니다. 공개·배포 전 확인할 사항은 [팬게임 규정 준수 확인 문서](FAN_GAME_COMPLIANCE.ko.md)를 참고해 주세요.

## 게임 규칙

- 다음 차미의 위치를 정한 뒤 클릭하거나 Space를 눌러 떨어뜨립니다.
- 빨간 선 아래에 완전히 들어간 차미만 최종 개수에 포함됩니다.
- 안정된 차미가 빨간 선을 넘은 상태로 1.1초가 지나면 게임이 끝납니다.
- 차미는 매 게임 셔플 백 방식으로 무작위 등장합니다.
- 작은·중간·큰 차미는 각각 `6,000점`, `10,000점`, `15,000점`입니다.
- 총점은 `쌓은 차미의 크기 점수 합계 + 밀집도 보너스(0~2,999)`입니다.
- 순위는 총점, 밀집도, 차미 개수, 달성 시각 순서로 비교합니다.

자세한 기준은 [게임 규칙 문서](docs/GAME_RULES.ko.md)에 정리되어 있습니다.

## 사운드

첫 접속은 항상 음소거 상태입니다. 시작 화면의 `소리 켜기` 버튼이나 게임 화면 빠른 메뉴의 소리 버튼으로 배경음과 효과음을 함께 켜고 끌 수 있습니다.

배경음과 효과음은 외부 음원 파일 대신 Web Audio로 실시간 합성하는 게임 전용 오리지널 사운드입니다. 차미 낙하·안착·5개 달성·한계선 경고·게임 종료·기록 저장에 서로 다른 효과음이 재생되며, 브라우저 탭이 숨겨지면 자동으로 일시 정지됩니다.

## 실행

```bash
npm install
npm run dev
```

프로덕션 확인:

```bash
npm test
npm run build
npm run preview
```

같은 와이파이의 휴대폰에서 테스트하려면 `npm run dev -- --host`를 실행하고 표시되는 Network 주소로 접속합니다.

## 데이터 기반 구성

- 게임 데이터: [`public/game-data/stacker.json`](public/game-data/stacker.json)
- JSON Schema: [`public/game-data/stacker.schema.json`](public/game-data/stacker.schema.json)
- 물리 게임: [`src/game/StackerScene.ts`](src/game/StackerScene.ts)
- 점수 공식: [`src/game/StackerScoring.ts`](src/game/StackerScoring.ts)
- 반응형 UI: [`src/stacker-ui.css`](src/stacker-ui.css)
- 온라인 점수판 API: [`api/leaderboard.ts`](api/leaderboard.ts)

현재 게임 프로토콜은 v5, 콘텐츠 버전은 3.0.1입니다. 작은·중간·큰 크기의 12가지 차미가 셔플 백에서 무작위로 등장하며, 크기별 점수와 밀집도 보너스를 합산합니다. 한계선은 `Y=190`이고, 마찰·회전·초기 수평 속도를 조정해 이전보다 잘 구르고 미끄러집니다. 삐딱 차미는 투명 여백을 제외하고 흰색 몸통 외곽을 따르는 다각형 충돌체를 사용합니다.

## 온라인 점수판

Vercel 서버리스 함수가 Neon PostgreSQL에 접속합니다. 데이터베이스 비밀번호는 클라이언트 번들에 포함하지 않습니다.

Vercel 프로젝트에는 다음 중 하나가 설정되어 있어야 합니다.

```text
DATABASE_URL=postgresql://...
# 또는
POSTGRES_URL=postgresql://...
```

Vercel에 게임 전체를 배포하면 같은 출처의 `/api/leaderboard`를 자동으로 사용합니다. 별도의 공개 API 주소를 프런트엔드에 넣을 필요가 없습니다.

게임은 접속 직후 유휴 시간에 전체 순위표를 미리 받고, 순위창을 열 때 최신 기록을 다시 확인합니다. 서버 응답이 늦거나 실패하면 브라우저 로컬 기록을 유지합니다.

로컬에서 API까지 함께 시험하려면 Vercel CLI의 `vercel dev`를 사용합니다. 일반 `npm run dev`는 프런트엔드만 실행합니다.

## Vercel 배포

`main` 브랜치를 Vercel 프로젝트에 연결하면 정적 게임과 `api/leaderboard.ts`가 함께 배포됩니다. Neon 연동으로 생성된 `DATABASE_URL` 또는 `POSTGRES_URL` 환경변수만 있으면 됩니다.

## 저장과 검증

- 닉네임은 최대 12자로 정규화합니다.
- 최종 점수는 저장 전에 같은 공식으로 다시 계산합니다.
- 서버는 크기별 개수·높이·밀집도 범위와 체크섬을 검증하고, 짧은 시간의 반복 제출을 제한합니다.
- 온라인 기록에는 콘텐츠 버전과 `runSeed`를 함께 저장합니다.
- 브라우저 로컬 기록은 네트워크 장애 시 사용하는 보조 저장소입니다.

게임 물리를 브라우저에서 실행하는 캐주얼 점수판이므로 고의적인 클라이언트 변조를 완전히 막는 경쟁용 안티치트는 아닙니다. 완전한 검증에는 입력 로그를 서버에서 다시 재생하는 별도 구조가 필요합니다.

## 주요 에셋

- 차미 스프라이트: `public/assets/characters/chami/`
- 시트리 스탠딩: `public/assets/characters/sitry/`
- 타이틀 키아트: `public/assets/title/`
- 파비콘: `public/chami-favicon.png`

## 글꼴 라이선스

대기 화면 로고와 인게임 상단 제목에는 프로젝트에 포함된 **Pretendard Black 900 v1.3.9**를 사용합니다.

- 제작자: Kil Hyung-jin
- 저작권: Copyright © 2021 Kil Hyung-jin, Reserved Font Name `Pretendard`
- 라이선스: [SIL Open Font License 1.1](https://github.com/orioncactus/pretendard/blob/main/LICENSE)
- 공식 저장소: [orioncactus/pretendard](https://github.com/orioncactus/pretendard)

Pretendard는 OFL 1.1에 따라 소프트웨어와 함께 사용·임베딩·재배포할 수 있습니다. 폰트 파일 자체를 단독 판매하지 않으며, 글꼴명과 라이선스 고지를 유지합니다. 배포본에는 제목용 Black 900 파일만 포함하며, 게임의 나머지 본문은 기존 글꼴 스택을 사용합니다.
