# SPLIT / VARIABLE

**한 칸에는 한 가지 뜻만. 카페 주문표의 메모 칸으로 배우는 변수 나누기.**

[튜토리얼 열기](https://technoetic.github.io/split-variable-tutorial/)

Martin Fowler의 리팩토링 카탈로그에 실린 Split Variable을 카페 주문표 비유로 풀어 쓴
한국어 인터랙티브 튜토리얼입니다. 메모 칸 하나에 주문 금액과 대기 시간이 번갈아 적히는
이야기로 냄새를 찾고, 뜻마다 이름 붙은 칸으로 나누는 순서를 따라가며, 나누지 않아도 되는
칸(합계·개수·반복 차례)을 가려냅니다. 코드는 마지막에 조금만 나옵니다.

English: a Korean, mostly code-free interactive tutorial for Martin Fowler's Split Variable
refactoring, told through the memo slot on a cafe order slip.

- 이야기 → 냄새 찾기 → 나누는 순서 5단계 → 나누지 않는 칸 → 받은 값 지키기 → 연습 → 코드 → 정리
- 단계마다 주소가 있어 바로 열 수 있습니다 (예: `#/steps/3`, `#/code?view=after`)
- 연습 7문제: 고르는 즉시 설명, 새 칸 이름·그대로 두는 이유까지 확인, 채점 요약
- 연습 답과 메모는 이 브라우저에 임시 저장하고 다음에 이어서 풉니다
- 밝은·어두운 테마, 움직임 줄이기, 키보드 조작, 390px 폭 화면 지원

## 화면 주소

| 주소 | 화면 |
|---|---|
| `#/` | 처음 |
| `#/story` | 메모 칸 이야기 |
| `#/smell` | 냄새 찾기 |
| `#/steps`, `#/steps/1` … `#/steps/5` | 나누는 순서와 각 단계 |
| `#/exceptions` | 나누지 않는 칸 |
| `#/parameter` | 받은 값 지키기 |
| `#/practice` (`?item=memo` 등) | 연습 |
| `#/code` (`?view=before`, `after`, `parameter`) | 코드로 보기 |
| `#/summary` | 정리와 출처 |

그 밖의 주소는 ‘없는 화면’을 보여 줍니다.

## 로컬 실행

Node.js 22 이상이 필요하며 설치할 패키지는 없습니다.

    npm start

빌드한 뒤 http://127.0.0.1:8812/split-variable-tutorial/ 에서 엽니다. 포트를 쓰기 전에
비어 있는지 확인하고, 이미 쓰고 있으면 멈춥니다. 다른 포트는 `node scripts/server.mjs --port 8813`.

    npm test
    npm run build

`npm run build`는 `dist/`에 정적 파일을 만듭니다. HTML·CSS·모든 JS 모듈·그림으로 build ID를
계산하고, 자산 파일 이름마다 그 ID를 붙입니다. `data/`의 내용은 build ID에 넣지 않습니다.
내용만 고친 배포는 같은 build로 남고, 앱이 화면을 열 때마다 데이터를 새로 받아 옵니다.
GitHub Actions는 `main`에 push될 때 시험 → 직전 배포 자산 보존 → 빌드 → 파일 목록 작성 →
Pages 배포 순서로 진행합니다.

## 저장과 업데이트

연습 답과 메모는 현재 브라우저의 localStorage에만 저장합니다. 서버로 보내지 않고
다른 기기와 공유하지 않으며, localhost에서 저장한 답이 공개 주소로 옮겨 가지도 않습니다.

페이지에 담긴 build ID와 매번 새로 받는 `version.json`을 비교해 새 배포(롤백 포함)를 알아챕니다.
화면을 옮길 때, 창으로 돌아올 때, 탭이 다시 보일 때, 뒤로 가기 캐시에서 복원될 때 확인합니다.
새 버전이 있으면 저장하지 않은 답이 없는 다음 화면 이동에서 그 주소를 새 문서로 불러옵니다.
저장하지 않은 답이 있거나 저장 중이면 먼저 묻고, 확인에 실패해도 지금 화면을 계속 쓸 수 있습니다.
배포할 때 직전 build의 자산도 함께 남겨 이미 열린 탭이 깨지지 않게 합니다.
GitHub Pages는 파일을 몇 분 동안 캐시할 수 있어서 새 배포가 늦게 보일 수 있습니다.

## 학습 범위

예제 코드의 ‘같은 출력’은 예제 입력으로 확인한 결과이며, 모든 프로그램에서 동작이 같다는
증명이 아닙니다. 이 리팩토링은 속도를 높이려는 것이 아니라 칸(변수)의 뜻을 분명히 하려는
것입니다. 다섯 단계와 설명 문장은 이 튜토리얼이 정리한 것이며 책의 문장을 옮긴 것이 아닙니다.

원전: [Martin Fowler — Split Variable](https://refactoring.com/catalog/splitVariable.html).
이야기·예제 코드·그림은 이 튜토리얼을 위해 새로 만들었습니다.
Martin Fowler나 책의 출판사와 관계없는 독립 교육 자료입니다.
