#!/usr/bin/env node
/*
 * rules.js 값 검증 — rules/v2026.1/rules.js의 모든 값을 계산기 코드에 실제로 적힌 값과 대조한다.
 *
 *   node rules/tests/check-values.js [계산기 clone 폴더] [--rules 경로] [--allow-missing] [--only 실패만]
 *
 *   계산기 clone 폴더: 하위에 <repo>/index.html(·src/engine.js)이 있는 폴더.
 *     기본값: 환경변수 TTOKJAE_REPOS → 없으면 ../../../../_점검/calc-verify/consistency/repos (이 파일 기준)
 *   --rules: 검증할 rules.js (기본 ../v2026.1/rules.js)
 *   --allow-missing: 코드에서 패턴을 못 찾은 항목(= 이미 TTOKJAE_RULES로 옮겼거나 코드가 바뀜)을 실패로 치지 않음
 *   --only: 일치(OK) 행은 표에서 빼고 출력
 *   --self-only: 계산기 코드 대조는 건너뛰고 맨 아래 'rules.js 자체' 행만 (계산기 clone 없는 허브 CI용)
 *
 * 결과: 표 출력, 불일치(또는 --allow-missing 없이 '없음')가 하나라도 있으면 종료 코드 1.
 * 이 검사는 "이관 전 계산기 리터럴 = rules.js" 기준선이다. 계산기를 TTOKJAE_RULES로 옮긴 뒤에는
 * 해당 항목이 '없음'으로 바뀌는 게 정상이고(--allow-missing), 남은 하드코딩은 tools/scan-hardcoded.js로 찾는다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

// ---------- 인자 ----------
const argv = process.argv.slice(2);
const flag = f => argv.includes(f);
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1] === '--rules'));
const REPOS = path.resolve(positional[0] || process.env.TTOKJAE_REPOS || path.join(__dirname, '../../../../_점검/calc-verify/consistency/repos'));
const RULES_PATH = path.resolve(opt('--rules', path.join(__dirname, '../v2026.1/rules.js')));
const ALLOW_MISSING = flag('--allow-missing');
const ONLY_BAD = flag('--only');
const SELF_ONLY = flag('--self-only');

const R = require(RULES_PATH);
if (!R || !R.meta) { console.error('rules.js를 읽지 못했습니다: ' + RULES_PATH); process.exit(2); }

// ---------- 도우미 ----------
const NUM = '(-?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:e[+-]?\\d+)?|Infinity)';
const num = s => (s === 'Infinity' ? Infinity : Number(s));
function arrLit(s) {
  const t = s.replace(/\s+/g, '');
  if (!/^[\[\]\d.,eE+\-Infinity]*$/.test(t)) throw new Error('배열 리터럴이 아님: ' + s.slice(0, 60));
  return Function('"use strict";return (' + t + ');')();
}
function get(p) { return p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), R); }
function close(a, b) {
  if (typeof a === 'number' && typeof b === 'number') {
    if (a === b) return true;
    if (!isFinite(a) || !isFinite(b)) return false;
    return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  }
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => close(x, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every(k => close(a[k], b[k]));
  }
  return a === b;
}
const show = v => {
  if (typeof v === 'number') return String(v);
  const s = JSON.stringify(v, (k, x) => (x === Infinity ? 'Inf' : x));
  return s.length > 46 ? s.slice(0, 43) + '…' : s;
};
const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;
// 숫자만 순서대로 뽑기 (식별자 안 숫자 b3·n2 등 제외)
const numbersIn = s => (s.match(/(?<![\w.$])(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?(?![\w])/g) || []).map(Number);
// anchor부터 첫 { 또는 [ 블록(짝 맞춤)까지 잘라 내기
function block(text, anchorRe) {
  const m = anchorRe.exec(text);
  if (!m) return null;
  let i = m.index + m[0].length;
  while (i < text.length && text[i] !== '{' && text[i] !== '[') i++;
  const open = text[i], closeCh = open === '{' ? '}' : ']';
  let depth = 0, j = i;
  for (; j < text.length; j++) {
    if (text[j] === open) depth++;
    else if (text[j] === closeCh && --depth === 0) break;
  }
  return { start: m.index, text: text.slice(m.index, j + 1) };
}

// 구간표 → 계산기 코드에 나오는 숫자 순서 (pensionDeduction·retirementTax 모양)
// [상한, 율, 시작, 누적]: 첫 행 "d = x" / 나머지 "누적 + (x − 시작) × 율"
function seqRateTable(t) {
  const out = [];
  t.forEach(([lim, rate, start, cum], i) => {
    if (isFinite(lim)) out.push(lim);
    if (i > 0) out.push(cum, start, rate);
  });
  return out;
}
// [상한연수, 1년당, 시작연수, 누적]: 첫 행 "1년당 × 연수" / 나머지 "누적 + 1년당 × (연수 − 시작)"
function seqYearTable(t) {
  const out = [];
  t.forEach(([lim, per, start, cum], i) => {
    if (isFinite(lim)) out.push(lim);
    if (i === 0) out.push(per); else out.push(cum, per, start);
  });
  return out;
}
// 나이표 [[상한(미만), 값]…] ↔ "age >= 80 ? a : age >= 70 ? b : c" 순서 (큰 나이부터)
const ageTableFromDesc = ([a, b, c], [hi, lo]) => [[lo, c], [hi, b], [Infinity, a]];

// ---------- 검사 정의 ----------
// k(id, repo, files, how, path|expectFn)
//   how: { kv: [anchorRe, key] } 블록 안 key: 값 / { re, cap?: n | fn } 정규식 / { block: anchorRe, seq: true } 숫자 순서 / { arr: anchorRe }
const C = [];
const k = (repo, files, label, how, expect) => C.push({ repo, files: [].concat(files), label, how, expect });
const E = ['index.html', 'src/engine.js?'];   // ? = 있으면 같이 검사
const P = p => () => get(p);
const man = p => () => get(p) / 1e4;          // 만원 단위로 쓰는 계산기(retire-check)
const pct = p => () => get(p) * 100;          // % 숫자로 쓰는 곳

// --- fin-income-tax · etf-vs-direct : RULE / NH_PROP ---
for (const repo of ['fin-income-tax', 'etf-vs-direct']) {
  const A = /const RULE = /;
  k(repo, 'index.html', 'RULE.brackets', { arr: /brackets:\s*/ }, P('INCOME_TAX.brackets'));
  const kv = [
    ['finLimit', 'FIN_INCOME.threshold'], ['wh', 'FIN_INCOME.withholding'], ['local', 'INCOME_TAX.local'],
    ['grossUp', 'FIN_INCOME.grossUp'], ['basicDed', 'INCOME_TAX.basicDeduction'], ['hi', 'NHIS.healthRate'],
    ['ltc', 'NHIS.ltcRate'], ['hiCap', 'NHIS.premiumCapMonthly'], ['hiFloor', 'NHIS.premiumFloorMonthly'],
    ['floorIncome', 'NHIS.floorIncomeMonthly'], ['nhFinMin', 'NHIS.finIncomeThreshold'], ['extraDed', 'NHIS.employeeExtraIncomeDeduction'],
    ['depIncome', 'NHIS.dependent.income'], ['depBiz', 'NHIS.dependent.biz'], ['depProp1', 'NHIS.dependent.propLow'],
    ['depProp2', 'NHIS.dependent.propHigh'], ['depPropIncome', 'NHIS.dependent.propIncome'], ['perPoint', 'NHIS.perPoint'],
    ['propDed', 'NHIS.propertyDeduction'],
  ];
  for (const [key, p] of kv) k(repo, 'index.html', 'RULE.' + key, { kv: [A, key] }, P(p));
  k(repo, 'index.html', 'NH_PROP', { arr: /const NH_PROP = / }, P('NHIS.propertyPointTable'));
  k(repo, 'index.html', '건보 공적연금·근로 반영률', { re: new RegExp('fin \\+ biz \\+ oth \\+ ' + NUM + ' \\* \\(wage \\+ pen\\)') }, P('NHIS.publicPensionRatio'));
  k(repo, 'index.html', '10원 미만 절사', { re: /floor10 = v => Math\.floor\(v \/ (\d+) \+ 1e-9\) \* \1/ }, P('NHIS.truncUnit'));
}
k('etf-vs-direct', 'index.html', 'CG_DED', { re: new RegExp('CG_DED = ' + NUM) }, P('OVERSEAS_STOCK.basicDeduction'));
k('etf-vs-direct', 'index.html', 'CG_RATE', { re: new RegExp('CG_RATE = ' + NUM) }, P('OVERSEAS_STOCK.rate'));
k('etf-vs-direct', 'index.html', 'ETF_WH', { re: new RegExp('ETF_WH = ' + NUM) }, P('FIN_INCOME.withholdingWithLocal'));
k('etf-vs-direct', 'index.html', 'US_WH', { re: new RegExp('US_WH = ' + NUM) }, P('FIN_INCOME.usWithholding'));

// --- pension-tax-sim (index.html 내장 엔진 + src/engine.js = retire-check가 실시간 로드) · retire-drawdown ---
const PT = ['index.html', 'src/engine.js'];
const ptKV = [['LOCAL', () => 1 + R.INCOME_TAX.local], ['SEP_LIMIT', P('PENSION.separateLimit')], ['SEP_RATE', P('PENSION.separateRateNational')],
  ['OTHER_RATE', P('PENSION.otherIncomeRateNational')], ['BASIC_DEDUCTION', P('INCOME_TAX.basicDeduction')],
  ['ELDER_DEDUCTION', P('INCOME_TAX.elderDeduction')], ['STD_CREDIT', P('INCOME_TAX.standardTaxCredit')]];
for (const [key, f] of ptKV) k('pension-tax-sim', PT, 'RULE.' + key, { kv: [/const RULE = /, key] }, f);
const rdKV = [['LOCAL', () => 1 + R.INCOME_TAX.local], ['SEP_LIMIT', P('PENSION.separateLimit')], ['SEP_RATE', P('PENSION.separateRateNational')],
  ['OTHER_RATE', P('PENSION.otherIncomeRateNational')], ['BASIC', P('INCOME_TAX.basicDeduction')], ['ELDER', P('INCOME_TAX.elderDeduction')],
  ['STD_CREDIT', P('INCOME_TAX.standardTaxCredit')], ['DIV', P('FIN_INCOME.withholdingWithLocal')]];
for (const [key, f] of rdKV) k('retire-drawdown', E, 'TAX.' + key, { kv: [/const TAX = /, key] }, f);

for (const [repo, files] of [['pension-tax-sim', PT], ['retire-drawdown', E]]) {
  k(repo, files, 'pensionRate(나이별 국세율)', { re: new RegExp('age >= 80\\)? (?:return |\\? )' + NUM + '[;:]?\\s*(?:if \\()?(?:: )?age >= 70\\)? (?:return |\\? )' + NUM + '[;:]?\\s*(?:return |: )?' + NUM), cap: m => ageTableFromDesc([num(m[1]), num(m[2]), num(m[3])], [80, 70]) }, P('PENSION.rateByAgeNational'));
  k(repo, files, 'retireFactor(퇴직소득 연금수령 비율)', { re: new RegExp('n <= 10\\)? (?:return |\\? )' + NUM + '[;:]?\\s*(?:if \\()?(?:: )?n <= 20\\)? (?:return |\\? )' + NUM + '[;:]?\\s*(?:return |: )?' + NUM), cap: m => [[10, num(m[1])], [20, num(m[2])], [Infinity, num(m[3])]] }, P('RETIREMENT_INCOME_TAX.pensionPayRatio'));
  k(repo, files, 'progressiveTax 세율표', { arr: /function progressiveTax[\s\S]*?const B = / }, P('INCOME_TAX.brackets'));
  k(repo, files, 'pensionDeduction 연금소득공제', { block: /function pensionDeduction\(/, seq: true }, () => seqRateTable(R.INCOME_TAX.pensionIncomeDeduction).concat(R.INCOME_TAX.pensionIncomeDeductionCap));
  k(repo, files, 'retirementTax 근속연수공제', { re: /let sd;([\s\S]*?)const conv/, seqCap: 1 }, () => seqYearTable(R.RETIREMENT_INCOME_TAX.serviceYearDeduction));
  k(repo, files, 'retirementTax 환산급여공제', { re: /let cd;([\s\S]*?)(?:const base|return)/, seqCap: 1 }, () => seqRateTable(R.RETIREMENT_INCOME_TAX.convertedPayDeduction));
  const nhKV = [['hi', 'NHIS.healthRate'], ['ltc', 'NHIS.ltcRate'], ['floorIncomeM', 'NHIS.floorIncomeMonthly'], ['floorPrem', 'NHIS.premiumFloorMonthly'],
    ['capPremM', 'NHIS.premiumCapMonthly'], ['perPoint', 'NHIS.perPoint'], ['propDed', 'NHIS.propertyDeduction'], ['finMin', 'NHIS.finIncomeThreshold'],
    ['pubRate', 'NHIS.publicPensionRatio'], ['depIncome', 'NHIS.dependent.income'], ['depProp1', 'NHIS.dependent.propLow'],
    ['depProp2', 'NHIS.dependent.propHigh'], ['depPropIncome', 'NHIS.dependent.propIncome']];
  if (repo === 'pension-tax-sim') nhKV.push(['depBiz', 'NHIS.dependent.biz']);
  for (const [key, p] of nhKV) k(repo, files, 'NH.' + key, { kv: [/const NH = /, key] }, P(p));
  k(repo, files, 'NH_PROP', { arr: /const NH_PROP = / }, P('NHIS.propertyPointTable'));
  k(repo, files, 'houseTaxBase 공정시장가액비율', {
    re: new RegExp('multi\\) return g\\w* \\* ' + NUM + ';\\s*return g\\w* \\* \\(g\\w* <= ' + NUM + ' \\? ' + NUM + ' : g\\w* <= ' + NUM + ' \\? ' + NUM + ' : ' + NUM + '\\)'),
    cap: m => ({ multi: num(m[1]), single: [[num(m[2]), num(m[3])], [num(m[4]), num(m[5])], [Infinity, num(m[6])]] }),
  }, () => ({ multi: R.PROPERTY.fairMarketRatioMultiHome, single: R.PROPERTY.fairMarketRatioSingleHome }));
}
k('pension-tax-sim', PT, '연금수령한도 (11 − 연차) × 1.2', { re: new RegExp('limitYear >= ' + NUM + ' \\? Infinity : startBal / \\(' + NUM + ' - limitYear\\) \\* ' + NUM), cap: m => [num(m[1]), num(m[2]), num(m[3])] }, () => [R.PENSION.payoutLimitFreeYear, R.PENSION.payoutLimitFreeYear, R.PENSION.payoutLimitFactor]);
k('pension-tax-sim', PT, '2013 이전 계좌 시작 연차', { re: new RegExp('p\\.pre2013 \\? ' + NUM + ' : 1') }, P('PENSION.pre2013StartYear'));
k('pension-tax-sim', PT, '경로우대 나이', { re: new RegExp('age >= ' + NUM + ' \\? RULE\\.ELDER_DEDUCTION') }, P('INCOME_TAX.elderAge'));
k('retire-drawdown', E, '경로우대 나이', { re: new RegExp('ages\\[i\\] >= ' + NUM + ' \\? TAX\\.ELDER') }, P('INCOME_TAX.elderAge'));
k('retire-drawdown', E, '연금 납입한도 1,800만', { re: new RegExp('x\\.cTc \\|\\| 0\\), ' + NUM + '\\)') }, P('PENSION_SAVINGS.contributionLimit'));
k('retire-drawdown', E, '세액공제 한도 900만', { re: new RegExp('Math\\.min\\(c, ' + NUM + '\\)') }, P('PENSION_SAVINGS.creditLimitTotal'));
k('retire-drawdown', E, 'ISA 연 납입 2,000만', { re: new RegExp('x\\.cIsa \\|\\| 0\\), ' + NUM + '\\)') }, P('ISA.annualLimit'));
k('retire-drawdown', E, '연금수령 나이 55', { re: new RegExp('1 \\+ Math\\.max\\(0, a - ' + NUM + '\\)') }, P('PENSION.minAge'));
k('retire-drawdown', E, '수급개시연령표', { block: /function npsLegalAge\(/, seq: true }, () => R.NPS.startAgeByBirthYear.flatMap(([b, a]) => (isFinite(b) ? [b, a] : [a])));
k('retire-drawdown', E, '조기 감액·연기 가산', { re: new RegExp('1 \\+ ' + NUM + ' \\* shift : 1 \\+ ' + NUM + ' \\* shift'), cap: m => [num(m[1]), num(m[2])] }, () => [R.NPS.earlyReductionPerYear, R.NPS.deferralBonusPerYear]);

// --- retire-check (만원·% 단위 리터럴) ---
const RC = 'retire-check';
k(RC, 'index.html', '수급개시연령표', { block: /function npsStartAge\(/, seq: true }, () => R.NPS.startAgeByBirthYear.flatMap(([b, a]) => (isFinite(b) ? [b, a] : [a])));
k(RC, 'index.html', '조기 감액·연기 가산', { re: new RegExp('1 \\+ ' + NUM + ' \\* shift : 1 \\+ ' + NUM + ' \\* shift'), cap: m => [num(m[1]), num(m[2])] }, () => [R.NPS.earlyReductionPerYear, R.NPS.deferralBonusPerYear]);
k(RC, 'index.html', 'ageRate 연금소득세(%)', { re: new RegExp('age < 70 \\? ' + NUM + ' : age < 80 \\? ' + NUM + ' : ' + NUM), cap: m => [[70, num(m[1]) / 100], [80, num(m[2]) / 100], [Infinity, num(m[3]) / 100]] }, P('PENSION.rateByAge'));
k(RC, 'index.html', '피부양자 재산 5.4억·9억(만원)·소득', { re: new RegExp('prop <= ' + NUM + '\\) return ' + NUM + '; if \\(prop <= ' + NUM + '\\) return ' + NUM), cap: m => [num(m[1]), num(m[2]), num(m[3]), num(m[4])] }, () => [R.NHIS.dependent.propLow / 1e4, R.NHIS.dependent.income / 1e4, R.NHIS.dependent.propHigh / 1e4, R.NHIS.dependent.propIncome / 1e4]);
k(RC, 'index.html', '건보 금융소득 1,000만(만원)', { re: new RegExp('finCount = f => f > ' + NUM) }, man('NHIS.finIncomeThreshold'));
k(RC, 'index.html', '피부양자 사업소득 500만(만원)', { re: new RegExp('amt <= ' + NUM + '; \\}') }, man('NHIS.dependent.biz'));
k(RC, 'index.html', '사적연금 1,500만(만원)', { re: new RegExp('m\\.cOk = m\\.wcIn <= ' + NUM) }, man('PENSION.separateLimit'));
k(RC, 'index.html', '피부양자 소득 2,000만(만원)', { re: new RegExp('m\\.spInc > ' + NUM + '\\) m\\.hi = \'bad\'') }, man('NHIS.dependent.income'));
k(RC, 'index.html', '금융소득종합과세 2,000만(만원)', { re: new RegExp('m\\.fin > ' + NUM + '\\) finV') }, man('FIN_INCOME.threshold'));
k(RC, 'index.html', 'ISA 이전 10%·300만(만원)', { re: new RegExp('m\\.isaMove \\* ' + NUM + ', ' + NUM + '\\)'), cap: m => [num(m[1]), num(m[2])] }, () => [R.PENSION_SAVINGS.isaTransferCreditRate, R.PENSION_SAVINGS.isaTransferCreditCap / 1e4]);
k(RC, 'index.html', '세액공제율 16.5/13.2(%)', { re: new RegExp('data-rate="' + NUM + '" class="on">이하[^<]*</button><button type="button" data-rate="' + NUM + '"'), cap: m => [num(m[1]), num(m[2])] }, () => [R.PENSION_SAVINGS.creditRateHigh * 100, R.PENSION_SAVINGS.creditRateLow * 100]);
k(RC, 'index.html', '물가 기본 2.5(%)', { re: new RegExp("num\\('inf'\\), 0, 10\\) : " + NUM) }, pct('MARKET_DEFAULTS.inflation'));

// --- nps-calc ---
const NP = ['index.html', 'src/engine.js?'];
const npsKV = [['A', 'NPS.A'], ['A_YEAR', 'NPS.aYear'], ['B_MIN', 'NPS.incomeFloorMonthly'], ['B_MAX', 'NPS.incomeCapMonthly'],
  ['SPOUSE', 'NPS.familyBenefitSpouseMonthly'], ['DEPENDENT', 'NPS.familyBenefitOtherMonthly'], ['EARLY_PER_YEAR', 'NPS.earlyReductionPerYear'],
  ['DELAY_PER_YEAR', 'NPS.deferralBonusPerYear'], ['MIN_MONTHS', 'NPS.minMonths'], ['MAX_CHUNAP', 'NPS.maxChunapMonths'],
  ['RATE_2026', 'NPS.premiumRateByYear.2026'], ['FIRST_YEAR', 'NPS.firstYear']];
for (const [key, p] of npsKV) k('nps-calc', NP, 'NPS.' + key, { kv: [/const NPS = /, key] }, P(p));
k('nps-calc', NP, 'npsAlpha 비례상수(1988~2026)', { block: /function npsAlpha\(/, fn: true }, P('NPS.alphaByYear'));
k('nps-calc', NP, 'npsPremiumRate 보험료율(2025~2033)', { block: /function npsPremiumRate\(/, fn: true, years: [2025, 2033] }, P('NPS.premiumRateByYear'));
k('nps-calc', NP, '수급개시연령표', { block: /function npsStartAge\(/, seq: true }, () => R.NPS.startAgeByBirthYear.flatMap(([b, a]) => (isFinite(b) ? [b, a] : [a])));
k('nps-calc', NP, '조기·연기 최대 5년', { re: /NPS\.EARLY_PER_YEAR \* Math\.min\((\d+), -offset\)[\s\S]*?NPS\.DELAY_PER_YEAR \* Math\.min\((\d+), offset\)/, cap: m => [num(m[1]), num(m[2])] }, () => [R.NPS.maxEarlyYears, R.NPS.maxDeferralYears]);
k('nps-calc', 'index.html', '2026 보험료 리터럴(전체·본인)', { re: new RegExp('Bc \\* ' + NUM + ' / 10\\) \\* 10\\)\\}</b> — 직장인은 회사와 절반씩\\(본인 \\$\\{won\\(Math\\.floor\\(Bc \\* ' + NUM), cap: m => [num(m[1]), num(m[2])] }, () => [R.NPS.premiumRateByYear[2026], R.NPS.premiumRateByYear[2026] * R.NPS.employeeShareRatio]);
k('nps-calc', 'index.html', '물가 기본 2.5(%)', { re: new RegExp('id="inflation" data-unit="%" value="' + NUM + '"') }, pct('MARKET_DEFAULTS.inflation'));

// --- isa-maturity ---
const IS = ['index.html', 'src/engine.js?'];
k('isa-maturity', IS, 'ISA_YEAR_LIMIT', { re: new RegExp('ISA_YEAR_LIMIT = ' + NUM) }, P('ISA.annualLimit'));
k('isa-maturity', IS, 'ISA_TOTAL_LIMIT', { re: new RegExp('ISA_TOTAL_LIMIT = ' + NUM) }, P('ISA.totalLimit'));
k('isa-maturity', IS, 'TRANSFER_CREDIT_CAP', { re: new RegExp('TRANSFER_CREDIT_CAP = ' + NUM) }, P('PENSION_SAVINGS.isaTransferCreditCap'));
k('isa-maturity', IS, '연금 이전 10%', { re: new RegExp('Math\\.min\\(\\w+ \\* ' + NUM + ', TRANSFER_CREDIT_CAP\\)') }, P('PENSION_SAVINGS.isaTransferCreditRate'));
for (const [key, p] of [['freeLimit', 'ISA.taxFreeGeneral'], ['isaTax', 'ISA.excessRate'], ['creditRate', 'PENSION_SAVINGS.creditRateLow'],
  ['pensionRate', 'PENSION.rateByAge.0.1'], ['otherRate', 'PENSION.otherIncomeRate'], ['genTax', 'FIN_INCOME.withholdingWithLocal']]) {
  k('isa-maturity', 'index.html', '기본값 ' + key, { re: new RegExp('\\b' + key + ': ' + NUM) }, P(p));
}
k('isa-maturity', 'index.html', '비과세 칩 200/400만', { re: new RegExp('data-v="' + NUM + '">일반형[\\s\\S]*?data-v="' + NUM + '">서민형'), cap: m => [num(m[1]), num(m[2])] }, () => [R.ISA.taxFreeGeneral, R.ISA.taxFreePreferential]);
k('isa-maturity', 'index.html', '세액공제율 칩 16.5/13.2', { re: new RegExp('data-v="' + NUM + '">16\\.5%[\\s\\S]*?data-v="' + NUM + '">13\\.2%'), cap: m => [num(m[1]), num(m[2])] }, () => [R.PENSION_SAVINGS.creditRateHigh, R.PENSION_SAVINGS.creditRateLow]);
k('isa-maturity', 'index.html', '연금소득세 칩 5.5/4.4/3.3', { re: new RegExp('data-v="' + NUM + '">55~69세[\\s\\S]*?data-v="' + NUM + '">70~79세[\\s\\S]*?data-v="' + NUM + '">80세~'), cap: m => [[70, num(m[1])], [80, num(m[2])], [Infinity, num(m[3])]] }, P('PENSION.rateByAge'));
k('isa-maturity', 'index.html', '의무가입 3년', { re: /Math\.max\(minYears, Math\.round\(P\.horizon \|\| 0\), (\d+)\)/ }, P('ISA.minHoldingYears'));

// --- overseas-stock-tax ---
const OS = 'overseas-stock-tax';
for (const [key, p] of [['basic', 'OVERSEAS_STOCK.basicDeduction'], ['natRate', 'OVERSEAS_STOCK.rateNational'], ['locRate', 'OVERSEAS_STOCK.rateLocal'],
  ['etfRate', 'FIN_INCOME.withholdingWithLocal'], ['riaCap', 'OVERSEAS_STOCK.riaSaleCap']]) {
  k(OS, 'index.html', 'TAX.' + key, { kv: [/const TAX = /, key] }, P(p));
}
k(OS, 'index.html', 'RIA_PERIODS 공제율', { block: /const RIA_PERIODS = /, re2: /w: ([\d.]+)/g }, () => R.OVERSEAS_STOCK.riaDeductionByPeriod.map(r => r[2]));
k(OS, 'index.html', 'RIA_PERIODS 월 구간', { block: /const RIA_PERIODS = /, re2: /'(\d+)~(\d+)월/g, pairs: true }, () => R.OVERSEAS_STOCK.riaDeductionByPeriod.map(r => [r[0], r[1]]));
k(OS, 'index.html', 'ETF 비교 0.14 + 0.014 리터럴', { re: new RegExp('posRows \\* ' + NUM + '\\) \\+ Math\\.floor\\(posRows \\* ' + NUM + '\\)'), cap: m => [num(m[1]), num(m[2])] }, () => [R.FIN_INCOME.withholding, R.FIN_INCOME.withholding * R.INCOME_TAX.local]);
k(OS, 'index.html', '손실 절세 0.22 리터럴', { re: new RegExp('L \\* ' + NUM + ' - 1') }, P('OVERSEAS_STOCK.rate'));
k(OS, 'index.html', '금융소득 2,000만 리터럴', { re: new RegExp('over = posRows > ' + NUM) }, P('FIN_INCOME.threshold'));

// --- trading-cost · Water-Calc · target-stop ---
const TC = 'trading-cost';
for (const m of ['kospi', 'kosdaq', 'etf']) {
  k(TC, 'index.html', 'KR_TAX.' + m, { re: new RegExp(m + ':\\s*\\{ stt: ' + NUM + ',\\s*rural: ' + NUM), cap: x => ({ stt: num(x[1]), rural: num(x[2]) }) }, P('TRADE.securitiesTransactionTax.' + m));
}
k(TC, 'index.html', '코넥스 표 0.10%', { re: /<td>코넥스<\/td><td>([\d.]+)%/ }, () => (R.TRADE.securitiesTransactionTax.konex.stt + R.TRADE.securitiesTransactionTax.konex.rural) * 100);
k(TC, 'index.html', 'TAF_MAX', { re: new RegExp('TAF_MAX = ' + NUM) }, P('TRADE.tafMaxUsd'));
k(TC, 'index.html', 'TAF 최소 0.01', { re: new RegExp('Math\\.min\\(TAF_MAX, Math\\.max\\(' + NUM + ', ceilCent') }, P('TRADE.tafMinUsd'));
k(TC, 'index.html', 'DEF.sec', { re: new RegExp('\\bsec: ' + NUM) }, P('TRADE.secFeePerMillionUsd'));
k(TC, 'index.html', 'DEF.taf', { re: new RegExp('\\btaf: ' + NUM) }, P('TRADE.tafPerShareUsd'));
k(TC, 'index.html', 'input#sec 기본값', { re: new RegExp('id="sec"[^>]*value="' + NUM + '"') }, P('TRADE.secFeePerMillionUsd'));
k(TC, 'index.html', 'input#taf 기본값', { re: new RegExp('id="taf"[^>]*value="' + NUM + '"') }, P('TRADE.tafPerShareUsd'));
k(TC, 'index.html', 'krTick 호가표 [상한, 구간 하단 호가, 상한 직전 호가]', { block: /function krTick\(/, fn: 'krTick' }, () => ({ krx: R.TRADE.krxTick.map(([l, t]) => [l, t, t]), etf: R.TRADE.krxEtfTick.map(([l, t]) => [l, t, t]) }));
k(TC, 'index.html', '미국 호가', { re: new RegExp('raw < ' + NUM + ' \\? ' + NUM + ' : ' + NUM), cap: m => [[num(m[1]), num(m[2])], [Infinity, num(m[3])]] }, P('TRADE.usTick'));
k('Water-Calc', 'index.html', '거래세 옵션 코스피·코스닥(%)', { re: /<option value="([\d.]+)">[\d.]+% — 코스피 · 코스닥/ }, () => (R.TRADE.securitiesTransactionTax.kospi.stt + R.TRADE.securitiesTransactionTax.kospi.rural) * 100);
k('Water-Calc', 'index.html', '거래세 옵션 코스닥 = 코스피', { re: /<option value="([\d.]+)">[\d.]+% — 코스피 · 코스닥/ }, () => (R.TRADE.securitiesTransactionTax.kosdaq.stt + R.TRADE.securitiesTransactionTax.kosdaq.rural) * 100);
k('Water-Calc', 'index.html', '거래세 옵션 코넥스(%)', { re: /<option value="([\d.]+)">[\d.]+% — 코넥스/ }, () => (R.TRADE.securitiesTransactionTax.konex.stt + R.TRADE.securitiesTransactionTax.konex.rural) * 100);
k('target-stop', 'index.html', '안내 문구 증권거래세 0.20%', { re: /팔 때 증권거래세 ([\d.]+)%/ }, () => (R.TRADE.securitiesTransactionTax.kospi.stt + R.TRADE.securitiesTransactionTax.kospi.rural) * 100);

// --- 배당 원천징수·금융소득 경계 (covered-call · rediv · retirement · portfolio-sheet-data · usd-return) ---
k('covered-call', ['index.html', 'src/engine.js?'], 'TAX 15.4%', { re: new RegExp('const TAX = ' + NUM) }, P('FIN_INCOME.withholdingWithLocal'));
k('covered-call', 'index.html', 'FIN_COMP_LINE', { re: new RegExp('FIN_COMP_LINE = ' + NUM) }, P('FIN_INCOME.threshold'));
k('rediv', 'index.html', 'TAX_KR', { re: new RegExp('TAX_KR = ' + NUM) }, P('FIN_INCOME.withholdingWithLocal'));
k('rediv', 'index.html', 'TAX_US', { re: new RegExp('TAX_US = ' + NUM) }, P('FIN_INCOME.usWithholding'));
k('rediv', 'index.html', '종합과세 2,000만', { re: new RegExp('taxableIncomeAT > ' + NUM + '\\);\\s*\\n') }, P('FIN_INCOME.threshold'));
k('rediv', 'index.html', '건보 1,000만', { re: new RegExp('over1k = [^\\n]*taxableIncomeAT > ' + NUM) }, P('NHIS.finIncomeThreshold'));
k('retirement', 'index.html', 'FIN_NHIS_LINE', { re: new RegExp('FIN_NHIS_LINE = ' + NUM) }, P('NHIS.finIncomeThreshold'));
k('retirement', 'index.html', 'FIN_TAX_LINE', { re: new RegExp('FIN_TAX_LINE = ' + NUM) }, P('FIN_INCOME.threshold'));
k('portfolio-sheet-data', 'index.html', 'CGT_DED', { re: new RegExp('CGT_DED=' + NUM) }, P('OVERSEAS_STOCK.basicDeduction'));
k('portfolio-sheet-data', 'index.html', 'CGT_RATE', { re: new RegExp('CGT_RATE=' + NUM) }, P('OVERSEAS_STOCK.rate'));
k('portfolio-sheet-data', 'index.html', 'DIV_WHT', { re: new RegExp('DIV_WHT=' + NUM) }, P('FIN_INCOME.withholdingWithLocal'));
k('portfolio-sheet-data', 'index.html', 'US_DIV_WHT', { re: new RegExp('US_DIV_WHT=' + NUM) }, P('FIN_INCOME.usWithholding'));
k('portfolio-sheet-data', 'index.html', '금융소득 LIMIT', { re: new RegExp('const LIMIT=' + NUM) }, P('FIN_INCOME.threshold'));
k('portfolio-sheet-data', 'index.html', 'IRP 위험자산 70%', { re: new RegExp('total\\*' + NUM + '-risky') }, P('PENSION_SAVINGS.irpRiskAssetLimit'));
k('usd-return', 'index.html', '미국 원천징수 15% 안내', { re: /미국 원천징수 (\d+)%/ }, pct('FIN_INCOME.usWithholding'));

// --- 물가 기본값 ---
for (const [repo, id] of [['freedom', 'inf'], ['human-capital', 'inf'], ['retire-drawdown', 'inf'], ['goal-calc', 'inflation'], ['retirement', 'inflation'],
  ['rediv', 'inflation-rate'], ['ttokjae-div', 'inflation-rate']]) {
  k(repo, 'index.html', '물가 기본 2.5(%)', { re: new RegExp('id="' + id + '"[^>]*value="' + NUM + '"') }, pct('MARKET_DEFAULTS.inflation'));
}

// ---------- 실행 ----------
function evalFn(src, name) {
  // 계산기 함수 본문(숫자·비교만 있는 순수 함수)을 떼어 실행해 표로 만든다
  return Function('"use strict";' + src + '; return ' + name + ';')();
}
function extract(text, how) {
  if (how.kv) {
    const b = block(text, how.kv[0]); if (!b) return null;
    const m = new RegExp('(?:^|[\\s{,])' + how.kv[1] + ':\\s*' + NUM).exec(b.text); if (!m) return null;
    return { v: num(m[1]), line: lineOf(text, b.start + m.index + 1) };
  }
  if (how.arr) {
    const m = how.arr.exec(text); if (!m) return null;
    const from = m.index + m[0].length;
    let i = from; while (text[i] !== '[') i++;
    let d = 0, j = i; for (; j < text.length; j++) { if (text[j] === '[') d++; else if (text[j] === ']' && --d === 0) break; }
    return { v: arrLit(text.slice(i, j + 1)), line: lineOf(text, i) };
  }
  if (how.block) {
    const b = block(text, how.block); if (!b) return null;
    const line = lineOf(text, b.start);
    if (how.seq) return { v: numbersIn(b.text.replace(/^[^{]*\{/, '')), line };
    if (how.re2) {
      const out = []; let m; how.re2.lastIndex = 0;
      while ((m = how.re2.exec(b.text))) out.push(how.pairs ? [num(m[1]), num(m[2])] : num(m[1]));
      return { v: out, line };
    }
    if (how.fn === 'krTick') {
      // 규칙표의 각 구간 하단 가격과 상한 직전 가격을 계산기 함수에 넣어 본다
      const f = evalFn(b.text, 'krTick');
      const probe = (tbl, m) => tbl.map(([lim], i) => {
        const lo = i === 0 ? 1 : tbl[i - 1][0];
        return [lim, f(lo, m), f(isFinite(lim) ? lim - 0.5 : lo * 100, m)];
      });
      return { v: { krx: probe(R.TRADE.krxTick, 'kospi'), etf: probe(R.TRADE.krxEtfTick, 'etf') }, line };
    }
    if (how.fn) {
      const name = /function (\w+)/.exec(b.text)[1];
      const f = evalFn(b.text, name);
      const out = {};
      const [y0, y1] = how.years || [R.NPS.firstYear, R.meta.year];
      for (let y = y0; y <= y1; y++) out[y] = f(y);
      return { v: out, line };
    }
  }
  if (how.re) {
    const m = how.re.exec(text); if (!m) return null;
    let v;
    if (how.seqCap) v = numbersIn(m[how.seqCap]);
    else if (typeof how.cap === 'function') v = how.cap(m);
    else v = num(m[how.cap || 1]);
    return { v, line: lineOf(text, m.index) };
  }
  return null;
}

const rows = [];
let bad = 0, missing = 0, ok = 0;
for (const c of SELF_ONLY ? [] : C) {
  const expect = c.expect();
  for (let f of c.files) {
    const optional = f.endsWith('?'); f = f.replace(/\?$/, '');
    const fp = path.join(REPOS, c.repo, f);
    if (!fs.existsSync(fp)) { if (!optional) { rows.push([c.repo, f, '-', c.label, show(expect), '(파일 없음)', 'MISSING']); missing++; } continue; }
    const text = fs.readFileSync(fp, 'utf8');
    let r;
    try { r = extract(text, c.how); } catch (e) { r = { v: 'ERR ' + e.message, line: '-' }; }
    if (!r) { if (!optional) { rows.push([c.repo, f, '-', c.label, show(expect), '(패턴 없음)', 'MISSING']); missing++; } continue; }
    const pass = close(r.v, expect);
    if (pass) ok++; else bad++;
    rows.push([c.repo, f, String(r.line), c.label, show(expect), show(r.v), pass ? 'OK' : 'MISMATCH']);
  }
}

// rules.js 안의 자체 일관성 (국세 ↔ 지방세 포함 값 등)
const self = [
  ['PENSION.rateByAge = 국세 × 1.1', R.PENSION.rateByAge.map(([a, r]) => [a, r]), R.PENSION.rateByAgeNational.map(([a, r]) => [a, r * (1 + R.INCOME_TAX.local)])],
  ['PENSION.separateRate = 국세 × 1.1', R.PENSION.separateRate, R.PENSION.separateRateNational * (1 + R.INCOME_TAX.local)],
  ['PENSION.otherIncomeRate = 국세 × 1.1', R.PENSION.otherIncomeRate, R.PENSION.otherIncomeRateNational * (1 + R.INCOME_TAX.local)],
  ['FIN_INCOME.withholdingWithLocal = 14% × 1.1', R.FIN_INCOME.withholdingWithLocal, R.FIN_INCOME.withholding * (1 + R.INCOME_TAX.local)],
  ['OVERSEAS_STOCK.rate = 국세 + 지방', R.OVERSEAS_STOCK.rate, R.OVERSEAS_STOCK.rateNational + R.OVERSEAS_STOCK.rateLocal],
  ['FIN_INCOME.grossUp = grossUpByYear[meta.year]', R.FIN_INCOME.grossUp, R.FIN_INCOME.grossUpByYear[R.meta.year]],
  ['NHIS.propertyPointTable 60등급', R.NHIS.propertyPointTable.length, 60],
  ['INCOME_TAX.brackets 누진공제 연속성', R.INCOME_TAX.brackets.slice(1).map(([, r, d], i) => d), R.INCOME_TAX.brackets.slice(1).map(([, r], i) => {
    const [lim0, r0, d0] = R.INCOME_TAX.brackets[i]; return Math.round(lim0 * r - (lim0 * r0 - d0)); })],
  ['연금소득공제 누적 연속성', R.INCOME_TAX.pensionIncomeDeduction.map(r => r[3]), R.INCOME_TAX.pensionIncomeDeduction.map((r, i, a) => (i === 0 ? 0 : a[i - 1][3] + (a[i - 1][0] - a[i - 1][2]) * a[i - 1][1]))],
  ['환산급여공제 누적 연속성', R.RETIREMENT_INCOME_TAX.convertedPayDeduction.map(r => r[3]), R.RETIREMENT_INCOME_TAX.convertedPayDeduction.map((r, i, a) => (i === 0 ? 0 : a[i - 1][3] + (a[i - 1][0] - a[i - 1][2]) * a[i - 1][1]))],
  ['근속연수공제 누적 연속성', R.RETIREMENT_INCOME_TAX.serviceYearDeduction.map(r => r[3]), R.RETIREMENT_INCOME_TAX.serviceYearDeduction.map((r, i, a) => (i === 0 ? 0 : a[i - 1][3] + (a[i - 1][0] - a[i - 1][2]) * a[i - 1][1]))],
  ['TTOKJAE_RULES 동결(deep freeze)', Object.isFrozen(R) && Object.isFrozen(R.NHIS.propertyPointTable[0]) && Object.isFrozen(R.TRADE.securitiesTransactionTax.kospi), true],
];
for (const [label, a, b] of self) {
  const pass = close(a, b);
  if (pass) ok++; else bad++;
  rows.push(['(rules.js 자체)', '-', '-', label, show(b), show(a), pass ? 'OK' : 'MISMATCH']);
}

// ---------- 출력 ----------
const head = ['repo', 'file', 'line', '항목', 'rules.js', '코드 값', '결과'];
const shown = ONLY_BAD ? rows.filter(r => r[6] !== 'OK') : rows;
const wid = s => [...String(s)].reduce((w, ch) => w + (/[ᄀ-ᇿ　-鿿가-힯＀-￯]/.test(ch) ? 2 : 1), 0);
const W = head.map((h, i) => Math.min(48, Math.max(wid(h), ...shown.map(r => wid(r[i])))));
const pad = (s, w) => { s = String(s); while (wid(s) > w) s = [...s].slice(0, -2).join('') + '…'; return s + ' '.repeat(Math.max(0, w - wid(s))); };
console.log(`rules.js v${R.meta.version} (${RULES_PATH})\n계산기 clone: ${SELF_ONLY ? '(--self-only: 대조 안 함)' : REPOS}\n`);
console.log(head.map((h, i) => pad(h, W[i])).join(' | '));
console.log(W.map(w => '-'.repeat(w)).join('-+-'));
for (const r of shown) console.log(r.map((x, i) => pad(x, W[i])).join(' | '));
console.log(`\n합계: ${rows.length}건 — 일치 ${ok} · 불일치 ${bad} · 패턴/파일 없음 ${missing}${ALLOW_MISSING ? ' (허용)' : ''}`);
const fail = bad > 0 || (!ALLOW_MISSING && missing > 0);
console.log(fail ? '결과: 실패' : '결과: 통과');
process.exit(fail ? 1 : 0);
