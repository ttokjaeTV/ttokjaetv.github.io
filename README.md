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

## member-lock.js (투자 Tool 멤버십 — 기능 일부 잠금, 지금은 꺼져 있음)
- 기본 계산은 무료로 두고 멤버십 전용 기능만 잠그는 공통 스크립트. 도구 전체를 잠그는 member-gate.js 와 다르다.
- **스위치:** 파일 안 `LOCK.on = false`. 꺼져 있으면 어떤 화면도 바뀌지 않는다. 멤버십 판매를 시작할 때 `true` 로 바꾸면 표시해 둔 22개 도구가 한꺼번에 잠긴다.
  - 켜기 전에 `isMember()` 를 강의실 로그인(lecture-room 의 tool-gate.js, `my_access('tools')`)과 연결해야 한다. 지금은 연결 전이라 켜면 모두 비회원으로 본다.
- **미리 보기:** 아무 도구 주소 끝에 `?lock=preview` → 이 브라우저에서 비회원 화면으로 보인다. `?lock=off` 로 끈다.
- **도구에 표시하는 법:** `<head>` 에 `<script src="https://ttokjaetv.github.io/member-lock.js"></script>` 한 줄, 그리고
  - 패널 전체: `data-member="라벨"` / 버튼·탭: `data-member-click="라벨"` / 코드 안 제한: `if (window.TJLock && !TJLock.allow('라벨')) return;`
- 무료·멤버십 나눔 기준은 "투자 Tool 무료·멤버십 나눔안" 문서(2026-10-18). 비교표·트래커 5종과 배당 재투자 계산기(rediv)는 당분간 전부 무료라 표시하지 않았고, 하락장 물타기 계산기는 표현 수정 결정 전이라 빠져 있다.
