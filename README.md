# 똑재TV 투자 계산기 모음 (허브 페이지)

`https://ttokjaetv.github.io/` 루트에 뜨는 허브 페이지. ttokjaeTV 조직에 배포된 계산기·트래커·비교표 15종을 주제별로 묶어 보여준다.

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
