# 똑재TV 투자 계산기 모음 (허브 페이지)

> **지금은 공개 전 미리보기 상태**: `index.html` 에 미리보기 비밀번호 화면(PREVIEW-LOCK)과 `noindex` 가 들어 있다.
> 정식 공개 때 `PREVIEW-LOCK START` ~ `PREVIEW-LOCK END` 블록 두 곳(head·body 끝)을 지우고 올린 뒤, 서치콘솔에 sitemap 을 제출한다.

`https://ttokjaetv.github.io/` 루트에 뜨는 허브 페이지. ttokjaeTV 조직에 배포된 계산기·트래커·비교표를 주제별로 묶어 보여준다.

## 파일
- `index.html` — 허브 페이지 (단독 HTML, 외부 의존은 Pretendard 글꼴만)
- `sitemap.xml` — 허브 + 공개 도구 13종 주소 (회원 전용 도구는 넣지 않는다) (구글 서치콘솔·네이버 서치어드바이저 제출용)
- `robots.txt` — 사이트맵 위치 안내

## 새 도구를 추가할 때
1. `index.html`에서 맞는 카테고리 `.grid` 안에 `<a class="tool">` 카드를 하나 복사해 넣는다 (`data-k`에 검색어).
2. 헤더의 `무료 도구 <b>N</b>종`, `<meta name="description">`의 개수, JSON-LD `itemListElement`에 항목 추가.
3. `sitemap.xml`에 `<url>` 한 줄 추가, `lastmod` 갱신.
4. 새 도구에 `NEW` 배지를 달고, 이전 NEW 배지는 뗀다.

## 카테고리
01 노후 설계 · 02 연금·절세계좌 · 03 배당 시뮬레이션 · 04 ETF 데이터·포트폴리오 · 05 증권사 비교

## 06 준비 중 (포트폴리오 관리 도구·하락장 물타기 계산기)
- 두 도구는 다듬는 중이라 허브에서는 **링크 없는 "준비 중" 카드**로만 보여 준다. JSON-LD·sitemap에도 넣지 않는다.
- 공개할 때: 카드를 `<a class="tool" href="도구 주소">`로 바꿔 04 칸(ETF 데이터)으로 옮기고, JSON-LD·sitemap·도구 개수를 갱신한다.

## member-gate.js (현재 미사용)
- 우수회원 입장 코드 게이트 스크립트. 2026-10-12 두 도구에서 모두 떼어 내 지금은 아무 페이지도 쓰지 않는다.
- 다시 쓰려면 도구 `<head>`에 `<script src="https://ttokjaetv.github.io/member-gate.js"></script>` 한 줄을 넣는다. 코드 교체는 파일 안 `version`·`verifier` 를 바꾼다 (검증값 계산: `python3 -c "import hashlib,base64,re;c=re.sub(r'[\s\-_.]+','','새코드'.strip().lower());print(base64.b64encode(hashlib.pbkdf2_hmac('sha256',c.encode(),b'ttokjae-member-verify-v1',200000)).decode())"`).
