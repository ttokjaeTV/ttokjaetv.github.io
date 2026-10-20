#!/usr/bin/env node
/*
 * 하드코딩된 제도 상수 찾기 — 계산기 코드에 rules.js 값이 숫자로 직접 적혀 있는 곳을 file:line으로 나열한다.
 * TTOKJAE_RULES로 옮긴 뒤 남은 리터럴 확인(이관 검증)과, 나중에 누가 숫자를 다시 박아 넣는 것(회귀) 잡기에 쓴다.
 *
 *   node rules/tools/scan-hardcoded.js <repo 경로> [<repo 경로> …] [옵션]
 *   node rules/tools/scan-hardcoded.js <파일.js|파일.html> …          (파일 하나만, 예: rules/calc-v1.js)
 *   node rules/tools/scan-hardcoded.js --all <clone 폴더>            (하위 폴더 전부)
 *
 * 옵션
 *   --text          JS 문자열·HTML 본문의 설명 문구(예: '7.19%', '4,591,740원', '× 10%')도 따로 센다
 *   --summary       file:line 목록 없이 계산기별 개수만
 *   --json <파일>   결과를 JSON으로 저장 (이관 전후 비교용)
 *   --fail-on-hit   코드·속성 하드코딩이 하나라도 있으면 종료 코드 1 (이관 끝난 계산기 CI용)
 *   --include-tests src/*test*.js도 검사 (기본은 제외 — 테스트 기대값은 숫자가 맞음)
 *
 * 제도 값이 아닌데 숫자가 같아 걸리는 줄(물가 가정 2.5, 차트 선 굵기, 탐색 후보값 등)은 그 줄 끝에
 *   JS: // rules-ok: 이유     HTML: <!-- rules-ok: 이유 -->
 * 를 붙이면 세지 않는다(--fail-on-hit 자동 검사에서 빠지고, 맨 아래 '제외' 건수로만 나옴). 이유를 꼭 적는다.
 *
 * 검사 대상: <repo>/index.html 의 인라인 <script>(JSON 제외)와 입력 속성(value·data-*·placeholder),
 *            <repo>/src/*.js, <repo>/src/*.html (build.py로 index.html을 만드는 계산기의 원본).
 * 주석(//, /* *\/, <!-- -->)과 CSS는 보지 않는다. JS 문자열 안 숫자는 --text에서만 센다.
 *
 * 값 목록: 아래 VALUES. ctx가 있는 값(2,000만·0.15처럼 흔한 숫자)은 그 줄에 세금·건보 문맥 단어가 있을 때만 잡는다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

// ---------- 찾을 값 ----------
// [값(숫자), 설명, ctx 정규식(선택: 줄에 이 패턴이 있어야 보고)]
const TAXCTX = /세|금융|건보|보험|연금|소득|공제|한도|과세|배당|tax|Tax|TAX|fin|Fin|FIN|\bNH|nh[A-Z]|RULE|LIMIT|[lL]imit|[dD]ed|DED|[rR]ate|RATE|isa|ISA|[pP]ension|dep[A-Z]|wh|WH|[cC]ap\b|CAP|nps|NPS|LINE|prop|Prop/;
// 2,000만·1,000만처럼 흔한 금액: 세금·건보 판정 식별자가 있는 줄만
const MONEYCTX = /FIN|fin[A-Z]|Fin|LINE|LIMIT|LIMIT|건보|금융|과세|피부양|dep[A-Z]|extraDed|nhFin|finMin|finLimit|taxable|ISA|isa|cIsa|[aA]nnual|propIncome|over/;
const AGECTX = /age|[rR]ate|연금|pension|세/;
// ctx 값은 이런 줄이면 무시 (URL 입력 범위·예시 데이터 등)
const EXCLUDE = /URL_|_RANGE|\bRANGE\b|isFinite\(v\)|const lim = \{|예시|num\([^)]*, 1e7\)|\bannual: 10000000/;
// 1e4·1e7·1e8 앞에 / 또는 * 가 오면 단위 환산(만원·억)으로 보고 건너뜀
const UNIT_SCALE = new Set([1e4, 1e7, 1e8]);
const VALUES = [
  // 건강보험
  [0.0719, '건보료율 7.19% (NHIS.healthRate)'],
  [0.009448, '장기요양 0.9448% (NHIS.ltcRate)'],
  [4591740, '건보 소득 월 상한 (NHIS.premiumCapMonthly)'],
  [20160, '건보 월 하한 (NHIS.premiumFloorMonthly)'],
  [280000, '하한 소득월액 (NHIS.floorIncomeMonthly)'],
  [211.5, '재산 점수당 금액 (NHIS.perPoint)'],
  [2341, '재산 점수 최고등급 (NHIS.propertyPointTable)'],
  [540000000, '피부양자 재산 5.4억 (NHIS.dependent.propLow)'],
  [900000000, '피부양자 재산 9억 (NHIS.dependent.propHigh)'],
  [0.43, '공정시장가액비율 43% (PROPERTY)', /g\w* <=|gongsi|공시|multi/],
  [0.44, '공정시장가액비율 44% (PROPERTY)', /g\w* <=|gongsi|공시|multi/],
  [0.45, '공정시장가액비율 45% / 최고세율 (PROPERTY·INCOME_TAX)', /g\w* <=|gongsi|공시|multi|Infinity/],
  [0.6, '다주택 60% / 환산급여 60% / 퇴직 연금수령 60%', /multi\) return|conv|n <= 20|retireFactor/],
  [0.5, '공적연금 50% / 퇴직 연금수령 50%', /wage \+ pen|pubRate|retireFactor|n <= 20/],
  // 종합소득세
  [1260000, '누진공제 126만 (INCOME_TAX.brackets)'], [5760000, '누진공제 576만'], [15440000, '누진공제 1,544만'],
  [19940000, '누진공제 1,994만'], [25940000, '누진공제 2,594만'], [35940000, '누진공제 3,594만'], [65940000, '누진공제 6,594만'],
  [14000000, '과표 1,400만 / 연금소득공제 1,400만'], [88000000, '과표 8,800만'],
  [150000000, '과표 1.5억', /\[\s*(?:150e6|1\.5e8|150000000)\s*,|(?:<=|-)\s*(?:150e6|1\.5e8)\b/],
  [300000000, '과표 3억 / 공시 3억 / 환산급여 3억', /(?:<=|\[|-)\s*(?:300e6|3e8|300000000)\b/],
  [500000000, '과표 5억', /\[\s*(?:500e6|5e8|500000000)\s*,/], [1000000000, '과표 10억', /\[\s*(?:1e9|1000e6|1000000000)\s*,/],
  [0.24, '세율 24%', /\[\s*\d+(?:e\d)?\s*,\s*0\.24/], [0.35, '세율 35% / 환산급여 35%', /\[\s*\d+(?:e\d)?\s*,\s*0\.35|conv/],
  [0.38, '세율 38%', /0\.38,/], [0.42, '세율 42%', /0\.42,/],
  [1500000, '본인 기본공제 150만 (INCOME_TAX.basicDeduction)', TAXCTX],
  [70000, '표준세액공제 7만 (INCOME_TAX.standardTaxCredit)', TAXCTX],
  [1.1, '지방소득세 가산 1.1 (1 + INCOME_TAX.local)', /LOCAL|local|지방/],
  [3500000, '연금소득공제 350만', /total|공제|deduct|Deduct/], [4900000, '연금소득공제 490만'], [6300000, '연금소득공제 630만'],
  [7000000, '연금소득공제 700만', /total|공제|deduct|Deduct/], [9000000, '연금소득공제 한도·세액공제 한도 900만', TAXCTX],
  // 퇴직소득
  [45200000, '환산급여공제 4,520만'], [61700000, '환산급여공제 6,170만'], [151700000, '환산급여공제 1억5,170만'],
  [8000000, '환산급여공제 800만', /conv|cd =/], [70000000, '환산급여공제 7,000만', /conv|cd =/],
  [40000000, '근속연수공제 4,000만', /sd =|years/], [2500000, '근속연수 250만/년 · 해외주식 기본공제 250만 (OVERSEAS_STOCK.basicDeduction)'],
  [0.7, '퇴직 연금수령 70% / IRP 위험자산 70%', /n <= 10|retireFactor|risky|total\s*\*\s*0\.7/],
  // 금융소득
  [0.154, '배당·이자 15.4% (FIN_INCOME.withholdingWithLocal)'],
  [0.014, '지방소득세 1.4%'],
  [0.14, '원천징수 14% (FIN_INCOME.withholding)', /\bwh\b|WH|원천|posRows|0\.14\s*\+/],
  [0.15, '미국 원천징수 15% / 연금 분리과세·기타소득 국세 15%', /SEP_RATE|OTHER_RATE|TAX_US|US_WH|US_DIV|WHT|otherRate|sepRate|원천/],
  [20000000, '금융소득 2,000만 / 피부양자 2,000만 / 직장 보수외 2,000만 / ISA 연 2,000만', MONEYCTX],
  [10000000, '건보 금융소득 1,000만 / 피부양자 재산구간 소득 1,000만', MONEYCTX],
  [0.1, '그로스업 10% / ISA 이전 10% / 지방세 10%', /grossUp|TRANSFER|isaMove|코넥스|\blocal\b|tr \* 0\.1|c \* 0\.1|keepCash \* 0\.1/],
  [0.11, '그로스업 2027 11%', /grossUp|그로스업|배당가산/],
  // 사적연금·연금계좌
  [15000000, '사적연금 분리과세 1,500만 (PENSION.separateLimit)'],
  [0.055, '연금소득세 5.5%', AGECTX], [0.044, '연금소득세 4.4%', AGECTX], [0.033, '연금소득세 3.3%', AGECTX],
  [0.05, '연금소득세 국세 5%', /age|pensionRate/], [0.04, '연금소득세 국세 4%', /age|pensionRate/], [0.03, '연금소득세 국세 3%', /age|pensionRate/],
  [0.165, '16.5% (연금 분리과세·기타소득·세액공제율)'], [0.132, '세액공제율 13.2%'],
  [1.2, '연금수령한도 120%', /limitYear|한도|limit/],
  [18000000, '연금계좌 납입한도 1,800만', /cTc|ctc|납입|[lL]imit|Math\.min\(c\b/],
  [6000000, '연금저축 세액공제 600만', TAXCTX],
  [3000000, 'ISA 이전 추가공제 300만', /TRANSFER|isa|ISA|이전|CAP/],
  // ISA
  [100000000, 'ISA 총 1억 / 건보 재산 기본공제 1억', /ISA|isa|TOTAL|propDed|principal|prin|ded|Ded/],
  [2000000, 'ISA 비과세 200만', /free|Free|비과세|isa|ISA|일반형/], [4000000, 'ISA 비과세 400만', /free|Free|비과세|서민형/],
  [0.099, 'ISA 초과 9.9%'],
  // 국민연금
  [3193511, '국민연금 A값 (NPS.A)'], [410000, '기준소득월액 하한 (NPS.incomeFloorMonthly)'], [6590000, '기준소득월액 상한 (NPS.incomeCapMonthly)'],
  [25550, '부양가족연금 배우자'], [17030, '부양가족연금 자녀·부모'],
  [0.095, '국민연금 보험료율 2026 9.5%'], [0.0475, '국민연금 본인부담 4.75%'],
  [0.09, '국민연금 보험료율 2025 9%', /year|Rate|rate/], [0.13, '국민연금 보험료율 2033 13%', /year|Rate|rate/],
  [0.072, '연기연금 7.2%/년'], [0.06, '조기노령 −6%/년 / 세율 6%', /shift|EARLY|조기|\[\s*14e6|14000000/],
  [1.29, '비례상수 2026 1.29', /alpha|year|return/], [1.245, '비례상수 2025'], [0.015, '비례상수 연 감소 0.015', /year|alpha/],
  [1952, '수급개시연령 출생연도표', /by <=|birth|<= 19/], [1968, '수급개시연령 출생연도표', /by <=|birth|<= 19/],
  [120, '최소 가입 120개월', /MONTHS|가입/], [119, '추납 최대 119개월', /CHUNAP|추납/],
  // 해외주식·매매비용
  [0.22, '해외주식 양도세 22% (OVERSEAS_STOCK.rate)'],
  [50000000, 'RIA 매도대금 5,000만 / 과표 5,000만', /ria|RIA|e6|<=/],
  [0.0005, '코스피 증권거래세 0.05%', /stt|kospi|거래세|코스피/], [0.0015, '농어촌특별세 0.15%', /rural|농특|농어촌|거래세/], [0.002, '코스닥 증권거래세 0.20%', /stt|kosdaq|거래세|코스닥/],
  [0.001, '코넥스 증권거래세 0.10%', /stt|rural|코넥스|konex/],
  [20.6, 'SEC fee $20.60/100만달러'], [0.000195, 'FINRA TAF $0.000195/주'], [9.79, 'FINRA TAF 최대 $9.79'],
  [0.01, 'TAF 최소 $0.01 / 미국 호가 $0.01', /TAF|taf|raw < 1/], [0.0001, '미국 호가 $0.0001', /raw < 1/],
  // 만원·% 단위 (retire-check 등)
  [2000, '2,000만원(만원 단위)', /spInc > 2000|fin > 2000|return 2000;/], [1000, '1,000만원(만원 단위)', /f > 1000|fin > 1000|prop <= \d+\) return 1000;/],
  [500, '피부양자 사업소득 500만(만원)', /amt <= 500/], [300, 'ISA 이전 300만(만원)', /isaMove \* 0\.1, 300/],
  // 국내 호가 단위표 (trading-cost krTick)
  [2000, '호가 구간 2,000원', /p < 2000/], [5000, '호가 구간 5,000원', /p < 5000/], [20000, '호가 구간 2만원', /p < 20000/],
  [50000, '호가 구간 5만원', /p < 50000/], [200000, '호가 구간 20만원', /p < 200000/], [500000, '호가 구간 50만원', /p < 500000/],
  [1000, '호가 1,000원', /p < 500000/],
  [1500, '1,500만원(만원 단위)',/wcIn|cap|1500 \*|Math\.min\(C, 1500/], [54000, '피부양자 재산 5.4억(만원)'], [90000, '피부양자 재산 9억(만원)', /prop/],
  [5.5, '연금소득세 5.5(%)', /age/], [4.4, '연금소득세 4.4(%)', /age/], [3.3, '연금소득세 3.3(%)', /age/],
  [16.5, '세액공제율 16.5(%)', /rate|Rate/], [13.2, '세액공제율 13.2(%)', /rate|Rate/],
  [0.2, '거래세 0.20(%)', /거래세|코스피|코스닥|be-tax/],
  [2.5, '물가 기본값 2.5(%) (MARKET_DEFAULTS.inflation)', /\binf\b|'inf'|"inf"|inflation|물가/],
];
const MAP = new Map();
for (const [v, label, ctx] of VALUES) { const arr = MAP.get(v) || []; arr.push({ label, ctx: ctx || null }); MAP.set(v, arr); }

// 설명 문구(--text)에서 찾을 표기
const TEXT_PATTERNS = [
  [/7\.19\s*%/, '건보료율 7.19%'], [/0\.9448/, '장기요양 0.9448%'], [/13\.14\s*%/, '장기요양 13.14%'], [/4,591,740/, '건보 상한'],
  [/20,160/, '건보 하한'], [/211\.5\s*원/, '점수당 211.5원'], [/15\.4\s*%/, '15.4%'], [/16\.5\s*%/, '16.5%'], [/13\.2\s*%/, '13.2%'],
  [/5\.5\s*%|5\.5\s*→|5\.5~3\.3/, '연금소득세 5.5%'], [/9\.9\s*%/, 'ISA 9.9%'], [/\b22\s*%/, '해외주식 22%'], [/250\s*만\s*원/, '250만원'],
  [/1,500\s*만/, '1,500만원'], [/2,000\s*만/, '2,000만원'], [/1,000\s*만\s*원/, '1,000만원'], [/× 10%|\b10%\s*\(그로스업|배당가산/, '그로스업 10%'],
  [/0\.20\s*%|0\.05\s*%|0\.15\s*%|0\.10\s*%/, '거래세'], [/\$20\.60|0\.00206/, 'SEC fee'], [/0\.000195|\$9\.79/, 'TAF'],
  [/3,193,511|319만/, 'A값'], [/659만|41만\s*원/, '기준소득월액 상·하한'], [/25,550|17,030/, '부양가족연금'], [/9\.5\s*%/, '국민연금 9.5%'],
  [/5\.4\s*억|9\s*억\s*원/, '피부양자 재산'], [/43\s*%|44\s*%|45\s*%/, '공정시장가액비율'],
];

// ---------- 인자 ----------
const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const optVal = f => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const TEXT = has('--text'), SUMMARY = has('--summary'), FAIL = has('--fail-on-hit'), TESTS = has('--include-tests');
const JSON_OUT = optVal('--json');
let repos = [];
const allDir = optVal('--all');
if (allDir) repos = fs.readdirSync(allDir).map(d => path.join(allDir, d)).filter(p => fs.statSync(p).isDirectory() && !path.basename(p).startsWith('.'));
const skipNext = new Set(['--json', '--all']);
argv.forEach((a, i) => { if (!a.startsWith('--') && !(i > 0 && skipNext.has(argv[i - 1]))) repos.push(a); });
if (!repos.length) { console.error('사용법: node scan-hardcoded.js <repo 경로>… | --all <폴더> [--text] [--summary] [--json 파일] [--fail-on-hit]'); process.exit(2); }

// ---------- JS 렉서 (주석·문자열·정규식 리터럴을 구분해 숫자 토큰만 뽑는다) ----------
function lex(src) {
  const out = []; const n = src.length; const stack = [];
  let i = 0, line = 1, last = 'op';
  function readTemplate() {
    let buf = '', sline = line;
    while (i < n) {
      const c = src[i];
      if (c === '\\') { buf += src.substr(i, 2); if (src[i + 1] === '\n') line++; i += 2; continue; }
      if (c === '`') { i++; out.push({ t: 'str', s: buf, line: sline }); return; }
      if (c === '$' && src[i + 1] === '{') { i += 2; out.push({ t: 'str', s: buf, line: sline }); stack.push(0); return; }
      if (c === '\n') line++;
      buf += c; i++;
    }
  }
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; } i += 2; continue; }
    if (c === '"' || c === "'") {
      const q = c, sline = line; let buf = ''; i++;
      while (i < n && src[i] !== q) { if (src[i] === '\\') { buf += src.substr(i, 2); i += 2; continue; } if (src[i] === '\n') { line++; break; } buf += src[i]; i++; }
      i++; out.push({ t: 'str', s: buf, line: sline }); last = 'id'; continue;
    }
    if (c === '`') { i++; readTemplate(); last = 'id'; continue; }
    if (c === '{') { if (stack.length) stack[stack.length - 1]++; i++; last = 'op'; continue; }
    if (c === '}') {
      if (stack.length) {
        if (stack[stack.length - 1] === 0) { stack.pop(); i++; readTemplate(); last = 'id'; continue; }
        stack[stack.length - 1]--;
      }
      i++; last = 'close'; continue;
    }
    if (c === '/') {
      if (last === 'id' || last === 'num' || last === 'close') { i++; last = 'op'; continue; }
      i++; let cls = false;
      while (i < n) { const d = src[i]; if (d === '\\') { i += 2; continue; } if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls) { i++; break; } else if (d === '\n') break; i++; }
      while (i < n && /[a-z]/i.test(src[i])) i++;
      last = 'id'; continue;
    }
    if ((c >= '0' && c <= '9') || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const m = /^(?:0[xX][0-9a-fA-F_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?n?)/.exec(src.slice(i, i + 40));
      let k = i - 1; while (k >= 0 && /[\s(]/.test(src[k])) k--;
      out.push({ t: 'num', s: m[0], line, prev: src[k] || '' }); i += m[0].length; last = 'num'; continue;
    }
    if (/[A-Za-z_$\u0080-￿]/.test(c)) {
      const m = /^[A-Za-z_$\u0080-￿][\w$\u0080-￿]*/.exec(src.slice(i, i + 200));
      i += m[0].length;
      last = /^(return|typeof|case|in|of|new|delete|void|throw|else|do|instanceof|yield|await)$/.test(m[0]) ? 'op' : 'id';
      continue;
    }
    if (c === ')' || c === ']') { i++; last = 'close'; continue; }
    i++; last = 'op';
  }
  return out;
}

// 줄 수를 유지한 채 구간을 공백으로 지우기
const blank = s => s.replace(/[^\n]/g, ' ');
const OK_MARK = /rules-ok\s*:/;   // 제도 값이 아님 표시(이유 필수) — 그 줄의 숫자는 세지 않음
let okCount = 0;

function scanFile(fp, rel) {
  const raw = fs.readFileSync(fp, 'utf8');
  const lines = raw.split('\n');
  const hits = [];
  const isHtml = /\.html?$/i.test(fp);
  const addNum = (tok, lineNo, kind, prev) => {
    const v = Number(String(tok).replace(/_/g, '').replace(/n$/, ''));
    if ((prev === '/' || prev === '*') && UNIT_SCALE.has(v)) return;
    const ents = MAP.get(v); if (!ents) return;
    const lt = lines[lineNo - 1] || '';
    const win = lines.slice(Math.max(0, lineNo - 3), lineNo).join(' ');   // 그 줄 + 위 2줄 (여러 줄 함수 문맥)
    const ent = ents.find(e => !e.ctx || (e.ctx.test(win) && !EXCLUDE.test(lt)));
    if (ent && OK_MARK.test(lt)) { okCount++; return; }
    if (ent) hits.push({ file: rel, line: lineNo, kind, value: tok, label: ent.label, src: lt.trim().slice(0, 140) });
  };
  const addText = (s, lineNo) => {
    for (const [re, label] of TEXT_PATTERNS) if (re.test(s)) hits.push({ file: rel, line: lineNo, kind: 'text', value: (s.match(re) || [''])[0], label, src: (lines[lineNo - 1] || '').trim().slice(0, 140) });
  };
  const scanJs = (code, offset) => {
    for (const tk of lex(code)) {
      if (tk.t === 'num') addNum(tk.s, tk.line + offset, 'code', tk.prev);
      else if (TEXT && tk.s) tk.s.split('\n').forEach((ln, k) => addText(ln, tk.line + offset + k));
    }
  };
  if (!isHtml) { scanJs(raw, 0); return hits; }

  let html = raw.replace(/<!--[\s\S]*?-->/g, blank);
  // 인라인 스크립트
  html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (all, attrs, body, idx) => {
    if (!/\bsrc\s*=/.test(attrs) && !/type\s*=\s*["']?application\/(ld\+)?json/i.test(attrs) && !/type\s*=\s*["']?text\/(template|html)/i.test(attrs)) {
      const offset = raw.slice(0, idx + all.indexOf('>') + 1).split('\n').length - 1;
      scanJs(body, offset);
    }
    return blank(all);
  });
  html = html.replace(/<style\b[\s\S]*?<\/style>/gi, blank).replace(/<svg\b[\s\S]*?<\/svg>/gi, blank);
  // fill-v1.js가 rules 값으로 채우는 곳(data-rule)은 원래 글자가 남아 있어도 하드코딩이 아님
  html = html.replace(/(<(\w+)\b[^>]*\bdata-rule\s*=[^>]*>)([^<]*)(<\/\2>)/g, (all, open, tag, inner, close) => open + blank(inner) + close);
  html = html.replace(/<[^>]*\bdata-rule-attr\s*=[^>]*>/g, blank);
  // 입력 속성 값
  const attrRe = /\b(value|data-[\w-]+|placeholder)\s*=\s*"\s*(-?\d[\d_]*(?:\.\d+)?(?:e\d+)?|\.\d+)\s*"/g;
  let m;
  while ((m = attrRe.exec(html))) addNum(m[2], html.slice(0, m.index).split('\n').length, 'attr');
  if (TEXT) {
    const textOnly = html.replace(/<[^>]*>/g, t => blank(t));
    textOnly.split('\n').forEach((ln, k) => { if (ln.trim()) addText(ln, k + 1); });
  }
  return hits;
}

function filesOf(repo) {
  if (fs.existsSync(repo) && fs.statSync(repo).isFile()) return [repo];   // 파일 경로를 직접 준 경우
  const out = [];
  const idx = path.join(repo, 'index.html');
  if (fs.existsSync(idx)) out.push(idx);
  const src = path.join(repo, 'src');
  if (fs.existsSync(src) && fs.statSync(src).isDirectory()) {
    for (const f of fs.readdirSync(src).sort()) {
      if (!/\.(js|html)$/i.test(f)) continue;
      if (!TESTS && /test/i.test(f)) continue;
      out.push(path.join(src, f));
    }
  }
  return out;
}

// ---------- 실행 ----------
const result = [];
for (const repo of repos) {
  const name = path.basename(path.resolve(repo));
  const hits = [];
  for (const fp of filesOf(repo)) hits.push(...scanFile(fp, (path.relative(repo, fp) || path.basename(fp)).replace(/\\/g, '/')));
  hits.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1));
  result.push({ repo: name, path: path.resolve(repo), hits });
}

if (!SUMMARY) {
  for (const r of result) {
    const shown = r.hits.filter(h => TEXT || h.kind !== 'text');
    if (!shown.length) continue;
    console.log(`\n## ${r.repo}`);
    for (const h of shown) console.log(`  ${h.file}:${h.line}  [${h.kind}] ${h.value}  — ${h.label}\n      ${h.src}`);
  }
  console.log('');
}
const wid = s => [...String(s)].reduce((w, ch) => w + (/[ᄀ-ᇿ　-鿿가-힯＀-￯]/.test(ch) ? 2 : 1), 0);
const pad = (s, w) => String(s) + ' '.repeat(Math.max(0, w - wid(s)));
const cols = ['계산기', '코드', '속성', '합계'].concat(TEXT ? ['문구'] : []);
const tbl = result.map(r => {
  const c = r.hits.filter(h => h.kind === 'code').length, a = r.hits.filter(h => h.kind === 'attr').length, t = r.hits.filter(h => h.kind === 'text').length;
  return [r.repo, c, a, c + a].concat(TEXT ? [t] : []);
});
const tot = tbl.reduce((s, r) => s.map((x, i) => (i === 0 ? '합계' : x + r[i])), ['합계', 0, 0, 0].concat(TEXT ? [0] : []));
const W = cols.map((c, i) => Math.max(wid(c), ...tbl.concat([tot]).map(r => wid(r[i]))));
console.log(cols.map((c, i) => pad(c, W[i])).join(' | '));
console.log(W.map(w => '-'.repeat(w)).join('-+-'));
for (const r of tbl) console.log(r.map((x, i) => pad(x, W[i])).join(' | '));
console.log(W.map(w => '-'.repeat(w)).join('-+-'));
console.log(tot.map((x, i) => pad(x, W[i])).join(' | '));

if (okCount) console.log(`(rules-ok 표시로 제외한 숫자 ${okCount}개)`);
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ scanned: new Date().toISOString(), result }, null, 1));
process.exit(FAIL && tot[3] > 0 ? 1 : 0);
