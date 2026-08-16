# GitHub Pages 배포

이 프로젝트는 서버 없이 `dist` 폴더만으로 실행되는 정적 웹 게임입니다.

1. `npm ci`, `npm test`, `npm run build`를 실행합니다.
2. 생성된 `dist` 폴더를 GitHub Pages 배포 대상으로 사용합니다.
3. GitHub 저장소의 Pages 설정에서 사용하는 배포 방식에 맞춰 `dist`를 게시합니다.

Vite의 상대 경로 기반 설정을 사용하므로 프로젝트 Pages에서도 별도의 저장소 경로 설정 없이 에셋을 읽습니다.
