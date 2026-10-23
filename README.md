# 똑재TV 투자 계산기 모음 (허브 페이지)

> **지금은 공개 전 미리보기 상태**: `index.html` 에 미리보기 비밀번호 화면(PREVIEW-LOCK)과 `noindex` 가 들어 있다.
> 정식 공개 때 `PREVIEW-LOCK START` ~ `PREVIEW-LOCK END` 블록 두 곳(head·body 끝)을 지우고 올린 뒤, 서치콘솔에 sitemap 을 제출한다.

`https://ttokjaetv.github.io/` 루트에 뜨는 허브 페이지. ttokjaeTV 조직에 배포된 계산기·트래커·비교표를 주제별로 묶어 보여준다.

## 파일
- `index.html` — 허브 페이지 (단독 HTML, 외부 의존은 Pretendard 글꼴만)
- `sitemap.xml` — 허브 + 도구 15종 주소 (구글 서치콘솔·네이버 서치어드바이저 제출용)
- `robots.txt` — 사이트맵 위치 안내

## 새 도구를 추가할 때
1. `index.html`에서 맞는 카테고리 `.grid` 안에 `<a class="tool">` 카드를 하나 복사해 넣는다 (`data-k`에 검색어).
2. 헤더의 `무료 도구 <b>N</b>종`, `<meta name="description">`의 개수, JSON-LD `itemListElement`에 항목 추가.
3. `sitemap.xml`에 `<url>` 한 줄 추가, `lastmod` 갱신.
4. 새 도구에 `NEW` 배지를 달고, 이전 NEW 배지는 뗀다.

## 카테고리
01 노후 설계 · 02 연금·절세계좌 · 03 배당 시뮬레이션 · 04 ETF 데이터·포트폴리오 · 05 증권사 비교

## member-gate.js (현재 미사용)
- 우수회원 입장 코드 게이트 스크립트. 2026-10-12 두 도구에서 모두 떼어 내 지금은 아무 페이지도 쓰지 않는다.
- 다시 쓰려면 도구 `<head>`에 `<script src="https://ttokjaetv.github.io/member-gate.js"></script>` 한 줄을 넣는다. 코드 교체는 파일 안 `version`·`verifier` 를 바꾼다 (검증값 계산: `python3 -c "import hashlib,base64,re;c=re.sub(r'[\s\-_.]+','','새코드'.strip().lower());print(base64.b64encode(hashlib.pbkdf2_hmac('sha256',c.encode(),b'ttokjae-member-verify-v1',200000)).decode())"`).

## tool-gate.js (투자 Tool 멤버십 잠금, 2026-10-17 · 시험 중)
- 강의실(`ttokjaetv.github.io/lecture-room/`)과 **같은 Supabase 로그인**으로 멤버십 회원만 도구를 열게 하는 스크립트. member-gate.js(공용 입장 코드)를 대신할 정식 방식.
- 도구 `<head>` 맨 위에 `<script src="https://ttokjaetv.github.io/tool-gate.js"></script>` 한 줄. 상품 이름 기본값 `tools`, 바꾸려면 `data-product="이름"`, 배지 끄기 `data-badge="off"`.
- 멤버십 부여: 강의실 관리자 → 수강생 → [이용 권한 부여] → `[멤버십] 투자 Tool 멤버십`.
- **한계**: 화면 가리기만으로는 코드를 뜯어보는 사람을 못 막는다. 지켜야 할 데이터는 Supabase `tool_data` 테이블에 넣고 도구에서 `ToolGate.data('키')` 로 읽는다(서버가 회원에게만 내줌).
- 지금은 어떤 도구에도 넣지 않았다. 시험 페이지: `ttokjaetv.github.io/lecture-room/tool-test.html`.

## member-lock.js (투자 Tool 멤버십 — 기능 일부 잠금, 지금은 꺼져 있음)
- 기본 계산은 무료로 두고 멤버십 전용 기능만 잠그는 공통 스크립트. 도구 전체를 잠그는 member-gate.js 와 다르다.
- **스위치:** 파일 안 `LOCK.on = false`. 꺼져 있으면 어떤 화면도 바뀌지 않는다. 멤버십 판매를 시작할 때 `true` 로 바꾸면 표시해 둔 22개 도구가 한꺼번에 잠긴다.
  - 회원 확인은 강의실과 같은 Supabase 로그인으로 `my_access('tools')` 를 묻는다(2026-10-18 연결). 강의실에 로그인한 적 없는 브라우저는 서버에 묻지 않고 바로 비회원으로 본다. 스위치가 꺼져 있으면 서버 호출도 하지 않는다.
  - Supabase 의 `tools` 상품이 **비공개면 관리자만 통과**한다. 판매 시작 전에 강의실 관리자 화면에서 공개로 바꿀 것.
- **미리 보기:** 아무 도구 주소 끝에 `?lock=preview` → 이 브라우저에서 비회원 화면으로 보인다. `?lock=off` 로 끈다.
- **시험:** `?lock=test` → 스위치가 꺼져 있어도 이 브라우저에서만 켠 것처럼 실제 로그인으로 판정하고, 왼쪽 아래에 결과(회원 · 로그인 안 됨 · 권한 없음 · 상품 비공개 · 기간 끝남)를 띄운다. `?lock=off` 로 끈다.
- **도구에 표시하는 법:** `<head>` 에 `<script src="https://ttokjaetv.github.io/member-lock.js"></script>` 한 줄, 그리고
  - 패널 전체: `data-member="라벨"` / 버튼·탭: `data-member-click="라벨"` / 코드 안 제한: `if (window.TJLock && !TJLock.allow('라벨')) return;`
- 무료·멤버십 나눔 기준은 "투자 Tool 무료·멤버십 나눔안" 문서(2026-10-18). 비교표·트래커 5종과 배당 재투자 계산기(rediv)는 당분간 전부 무료라 표시하지 않았고, 하락장 물타기 계산기는 표현 수정 결정 전이라 빠져 있다.

## profile-v1.js (내 정보 이어쓰기 — 멤버십 기능, 2026-10-23)
- 나이·은퇴 나이·생활비·자산·국민연금처럼 노후 계산기 여러 곳이 같이 묻는 값을 **한 번만 넣게** 하는 공용 스크립트. 한 계산기에서 손으로 넣은 값을 이 브라우저 `localStorage['tj-profile-v1']`에 저장하고, 다른 계산기를 열면 그 값으로 미리 채운다. 서버로는 보내지 않는다(모든 계산기가 `ttokjaetv.github.io` 한 주소라 저장소를 같이 쓴다).
- **멤버십 기능:** `member-lock.js`가 잠겨 있으면(`TJLock.locked()`) 채우기·저장을 하지 않고 안내 띠만 보인다. 계산기는 그대로 다 쓸 수 있다. 지금은 `LOCK.on = false`라 모두에게 열려 있고, 판매를 시작해 스위치를 켜면 다른 멤버십 기능과 함께 잠긴다. 회원 판정이 늦게 끝나면(`tjlock-change`) 그때 채운다. 비회원 화면 미리 보기는 `?lock=preview`.
- 붙은 계산기 8곳: retire-check · retire-drawdown · retirement · goal-calc · freedom · human-capital · nps-calc · pension-tax-sim. 국민연금 계산기는 계산한 월 연금액·시작 나이를 '이 결과를 내 정보에 저장' 버튼으로 넘긴다.
- **배포 후 고치지 않는다.** 바꿀 일이 생기면 `profile-v2.js`로 낸다(calc-v*.js와 같은 정책).
- 계산기에 붙이는 법(자세한 설명은 파일 머리말):
  1. `<head>`에 `member-lock.js` 다음 줄로 `<script src="https://ttokjaetv.github.io/profile-v1.js"></script>` (첫 주소의 ?쿼리를 계산기가 바꾸기 전에 기억해야 해서 계산기 스크립트보다 먼저)
  2. 띠를 넣을 자리 `<div id="tj-profile"></div>`
  3. 계산기 시작 코드 끝에 `if (window.TJProfile) TJProfile.attach({ map: { '입력칸 id': '항목' } })`
- 규칙: 사용자가 그 칸을 직접 고칠 때만 저장(예시 숫자·공유 링크 값은 저장 안 함) · 주소에 공유 링크 값이 있으면 채우지 않고 '내 정보로 채우기' 버튼만 · '예시 숫자로 보기'는 이번 방문 동안 그 페이지만 · 띠의 '내 정보 보기' 창에서 값 고치기·지우기·저장 끄기.
- 항목·계산 규칙: 금융자산 합계(`fin`)는 연금저축+IRP+ISA+일반(퇴직금 제외), 세액공제 받은 원금·수익(`tc`)은 연금저축+IRP−세액공제 안 받은 원금이고, 계산기에서 합계를 직접 넣으면 더 최근 쪽을 쓴다. 은퇴 기간 = 계획 나이 − 은퇴 나이 + 1. 나이는 올해 − 출생연도.
- 시험: `node tests/profile-test.js` (허브 CI에서도 돈다).

## rules/ (계산기 공용 제도 상수, 2026-10-19 · 계산기 이관 전)
- 세금·건보료·연금·국민연금·매매비용 요율·한도·구간표만 모은 단일 출처. 계산기는 `<script src="https://ttokjaetv.github.io/rules/v2026.1/rules.js"></script>` 를 자기 스크립트보다 먼저 넣고 `TTOKJAE_RULES.NHIS.healthRate` 처럼 읽는다(전역은 `TTOKJAE_RULES` 하나).
- **배포한 버전 폴더(`rules/v2026.1/`)는 고치지 않는다.** 값이 바뀌면 `v2026.2`·`v2027.1` 새 폴더를 내고 계산기가 버전 번호를 올린다.
- 검증: `node rules/tests/check-values.js` (계산기 코드 값과 대조), `node rules/tools/scan-hardcoded.js --all <clone 폴더>` (하드코딩 남은 곳). 자세한 내용은 `rules/README.md`.
