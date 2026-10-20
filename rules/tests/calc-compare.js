#!/usr/bin/env node
/*
 * calc-v1.js ↔ 계산기 기존 구현 비교 — 계산기 저장소의 git HEAD 코드에서 함수를 뽑아 같은 입력(무작위 + 경계값)으로 돌리고
 * 결과가 Object.is로 같은지 본다. 계산기를 엔진으로 옮기기 전에 '같은 옵션이면 결과가 같다'를 확인하는 도구.
 *
 *   node rules/tests/calc-compare.js [--repos 계산기 폴더] [--rules rules/v2026.2/rules.js] [--n 5000] [--seed 1] [--working]
 *
 *   --repos   : 하위에 pension-tax-sim·retire-drawdown·fin-income-tax … 저장소가 있는 폴더 (기본: 허브의 상위 폴더)
 *   --working : HEAD 대신 작업 폴더 파일을 읽음
 *   없는 저장소는 건너뛴다. 모든 비교가 일치하면 종료 코드 0. (계산기 clone이 필요해 허브 CI에서는 돌리지 않음)
 * 기존 구현은 각자 불러오는 rules 버전 대신 --rules 하나로 돌린다(값이 같은 키만 쓰므로 코드 차이만 본다).
 */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const argv = process.argv.slice(2);
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const REPOS = path.resolve(opt('--repos', path.join(__dirname, '../../..')));
const RULES = path.resolve(opt('--rules', path.join(__dirname, '../v2026.2/rules.js')));
const N = +opt('--n', 5000), SEED = +opt('--seed', 1), WORKING = argv.includes('--working');
const R = require(RULES);
const C = require('../calc-v1.js').bind(R);

// ---------- 코드 읽기 ----------
function readRepo(repo, file) {
  const dir = path.join(REPOS, repo);
  if (!fs.existsSync(dir)) return null;
  if (WORKING) return fs.existsSync(path.join(dir, file)) ? fs.readFileSync(path.join(dir, file), 'utf8') : null;
  try { return cp.execFileSync('git', ['-C', dir, 'show', 'HEAD:' + file], { maxBuffer: 1 << 28 }).toString(); } catch (e) { return null; }
}
// 시작 패턴부터 그 문장 끝까지 (중괄호·대괄호 짝 맞춤, 문자열·주석 건너뜀)
function grab(src, re) {
  const m = re.exec(src); if (!m) throw new Error('코드에서 못 찾음: ' + re);
  const isFn = /^function\b/.test(m[0]);
  let i = m.index, depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i + 1] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 1; continue; }
    if (c === "'" || c === '"' || c === '`') { const q = c; i++; while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; } continue; }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') { depth--; if (isFn && depth === 0 && c === '}') { i++; break; } }
    else if (!isFn && depth === 0 && (c === ';' || c === '\n')) { i++; break; }
  }
  return src.slice(m.index, i);
}
function load(code, names) {
  const ctx = { TTOKJAE_RULES: R, module: { exports: {} }, console, Math, Object, Array, Number, JSON };
  vm.createContext(ctx);
  vm.runInContext(code + '\n;globalThis.__out = {' + names.map(n => `${n}: typeof ${n} !== 'undefined' ? ${n} : undefined`).join(',') + '};', ctx);
  return ctx.__out;
}

// ---------- 난수·입력 ----------
let s = SEED >>> 0 || 1;
const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
// 금액: 정수 원 / 소수 / 경계±1 / 0·음수 섞음
function money(max, edges) {
  const r = rnd();
  if (edges && edges.length && r < 0.3) { const e = pick(edges); return e + pick([-1, 0, 1, -0.5, 0.5, -1e-7, 1e-7]); }
  if (r < 0.35) return pick([0, -0, -1, 1, 0.5]);
  if (r < 0.7) return Math.round(rnd() * max);
  return rnd() * max;
}
const ints = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const nn = v => Math.max(0, Math.round(v));   // 0 이상 정수 원 (화면 입력처럼)

// ---------- 비교 ----------
const enc = v => typeof v === 'number' ? (Object.is(v, -0) ? '-0' : String(v)) : v === undefined ? 'undef' : JSON.stringify(v);
function same(a, b, keys) {
  if (keys) return keys.every(([ka, kb]) => same(a[ka], b[kb === undefined ? ka : kb]));
  if (typeof a === 'number' || typeof b === 'number') return Object.is(a, b);
  if (a && typeof a === 'object' && b && typeof b === 'object') {
    if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => same(x, b[i]));
    return Object.keys(a).every(k => same(a[k], b[k]));
  }
  return a === b;
}
const results = [];
function check(label, n, gen, implFn, engFn, keys, note) {
  let bad = 0, first = null;
  for (let i = 0; i < n; i++) {
    const args = gen(i);
    const a = implFn(...args), b = engFn(...args);
    if (!same(a, b, keys)) { bad++; if (!first) first = { args, impl: a, engine: b }; }
  }
  results.push({ label, n, bad, first, note });
}
const K = arr => arr.map(k => (Array.isArray(k) ? k : [k]));

// ---------- 경계값 ----------
const BR = R.INCOME_TAX.brackets.filter(r => isFinite(r[0])).map(r => r[0]);
const PDB = R.INCOME_TAX.pensionIncomeDeduction.filter(r => isFinite(r[0])).map(r => r[0]);
const SEPL = R.PENSION.separateLimit;
const NHE = [R.NHIS.floorIncomeMonthly * 12 / R.NHIS.publicPensionRatio, R.NHIS.finIncomeThreshold, R.NHIS.dependent.income,
  R.NHIS.dependent.propLow, R.NHIS.dependent.propHigh, R.NHIS.dependent.propIncome, R.NHIS.dependent.biz, 6.725e6, 6.73e6];
const GONGSI = R.PROPERTY.fairMarketRatioSingleHome.filter(r => isFinite(r[0])).map(r => r[0]);
const PROPTB = R.NHIS.propertyPointTable.filter(r => isFinite(r[0])).map(r => R.NHIS.propertyDeduction + r[0] * 1e4);
const CONVB = R.RETIREMENT_INCOME_TAX.convertedPayDeduction.filter(r => isFinite(r[0])).map(r => r[0]);

const skipped = [];
// ===== pension-tax-sim =====
{
  const src = readRepo('pension-tax-sim', 'src/engine.js');
  if (!src) skipped.push('pension-tax-sim');
  else {
    const P = load(src, ['progressiveTax', 'pensionDeduction', 'comprehensiveTax', 'retirementTax', 'pensionRate', 'retireFactor', 'houseTaxBase',
      'propPoints', 'nhRegional', 'nhDependent', 'simulate']);
    const T = 'PTS ';
    check(T + 'progressiveTax ↔ incomeTax.basic', N, () => [money(2e9, BR)], P.progressiveTax, C.incomeTax.basic);
    check(T + 'pensionDeduction ↔ incomeTax.pensionDeduction', N, () => [money(2e8, PDB)], P.pensionDeduction, C.incomeTax.pensionDeduction);
    check(T + 'comprehensiveTax ↔ incomeTax.comprehensive({pension:[공적,사적], otherIncome, age}).total', N,
      () => [money(6e7, PDB), money(6e7, [SEPL, ...PDB]), pick([0, 0, money(1e8, BR)]), pick([undefined, ints(55, 90), 69, 70, 79, 80])],
      P.comprehensiveTax, (pub, priv, other, age) => C.incomeTax.comprehensive({ pension: [pub, priv], otherIncome: other, age }).total);
    check(T + 'retirementTax ↔ retirementTax.calc().national', N, () => [money(2e9, CONVB), pick([money(45, [0.5, 5, 6, 10, 11, 20, 21]), ints(0, 45), 0.5, 5, 6, 10, 11, 20, 21])],
      P.retirementTax, (a, b) => C.retirementTax.calc(a, b).national);
    check(T + 'pensionRate ↔ pension.rate', N, () => [pick([ints(50, 100), 69, 70, 79, 80, 69.5, 79.999])], P.pensionRate, C.pension.rate);
    check(T + 'retireFactor ↔ pension.retireRatio', N, () => [pick([ints(0, 40), 10, 11, 20, 21, 10.5])], P.retireFactor, C.pension.retireRatio);
    check(T + 'houseTaxBase ↔ property.houseTaxBase', N, () => [money(3e9, GONGSI), rnd() < 0.3], P.houseTaxBase, C.property.houseTaxBase);
    check(T + 'propPoints ↔ nhis.propertyPoints', N, () => [money(1e11, PROPTB)], P.propPoints, C.nhis.propertyPoints);
    const nhIn = () => ({ pub: Array.from({ length: ints(0, 2) }, () => money(1e8, NHE)), fin: Array.from({ length: ints(0, 2) }, () => money(5e7, NHE)),
      other: pick([0, undefined, money(5e7, NHE)]), taxBase: pick([0, money(2e9, PROPTB)]) });
    check(T + 'nhRegional ↔ nhis.regional', N, () => [nhIn()], P.nhRegional, C.nhis.regional,
      K(['income', 'm', 'incPrem', 'pts', 'propPrem', 'health', 'ltc', 'total', 'floor']));
    const person = () => ({ pub: money(4e7, NHE), fin: money(3e7, NHE), other: pick([0, 0, money(1e7, NHE)]), bizReg: rnd() < 0.2, taxBase: pick([0, money(1.5e9, NHE)]) });
    check(T + 'nhDependent ↔ nhis.dependent', N, () => [Array.from({ length: ints(1, 2) }, person)], P.nhDependent, C.nhis.dependent);
    // simulate 안의 수령한도·과세 방식 선택 (함수가 아니라 식이 들어 있음 → 행마다 엔진으로 다시 계산)
    let rows = 0, badL = 0, badC = 0, firstL = null, firstC = null;
    for (let i = 0; i < Math.max(200, N / 10); i++) {
      const p = { startAge: ints(55, 80), eligAge: ints(50, 70), pre2013: rnd() < 0.3, b1: money(2e8), b2: money(3e8), retTaxNat: money(3e7), b3: money(5e8),
        r: rnd() * 0.08 - 0.02, mode: pick(['years', 'amount', 'cap', 'split']), years: ints(1, 30), amount: money(5e7, [SEPL]), desired: money(5e7, [SEPL]),
        phase1Amount: money(4e7, [SEPL]), capAmount: money(2e7, [SEPL]), publicPension: pick([0, money(3e7, PDB)]), publicStartAge: pick([undefined, 60, 65, 70]),
        otherIncome: pick([0, money(8e7, BR)]) };
      if (!(p.b1 >= 0 && p.b2 >= 0 && p.b3 >= 0)) continue;
      const res = P.simulate(p);
      for (const r of res.rows) {
        rows++;
        const ly = C.pension.limitYear({ age: r.age, startAge: p.eligAge, pre2013: p.pre2013 });
        const lim = C.pension.payoutLimit(r.startBal, ly);
        if (!Object.is(ly, r.limitYear) || !Object.is(lim, r.limit)) { badL++; if (!firstL) firstL = { p, row: r.n, impl: [r.limitYear, r.limit], engine: [ly, lim] }; }
        if (r.p3 > 0) {
          const pub = (p.publicStartAge == null || r.age >= p.publicStartAge) ? (p.publicPension || 0) : 0;
          const comp = P.comprehensiveTax(pub, r.p3, p.otherIncome || 0, r.age) - P.comprehensiveTax(pub, 0, p.otherIncome || 0, r.age);
          const ch = C.pension.privateTaxChoice({ amount: r.p3, age: r.age, comp });
          const m = ch.method === 'comp' ? '종합과세 선택' : null;
          if (!Object.is(ch.tax, r.taxPension) || (m !== null) !== (r.method === '종합과세 선택')) { badC++; if (!firstC) firstC = { p, row: r.n, impl: [r.taxPension, r.method], engine: ch }; }
        }
      }
    }
    results.push({ label: T + 'simulate 수령한도 ↔ pension.limitYear·payoutLimit (행)', n: rows, bad: badL, first: firstL });
    results.push({ label: T + 'simulate 과세 방식 선택 ↔ pension.privateTaxChoice (행)', n: rows, bad: badC, first: firstC });
  }
}
// ===== retire-drawdown =====
{
  const src = readRepo('retire-drawdown', 'src/engine.js');
  if (!src) skipped.push('retire-drawdown');
  else if (/TTOKJAE_CALC/.test(src)) skipped.push('retire-drawdown (이미 calc-v1 사용 — HEAD가 전환 전이어야 비교 의미 있음)');
  else {
    const D = load(src, ['progressiveTax', 'pensionDeduction', 'compTax', 'retirementTax', 'pensionRate', 'retireFactor', 'houseTaxBase', 'propPoints',
      'nhRegional', 'nhDependentOk', 'npsLegalAge', 'npsFactor']);
    const T = 'RDD ';
    check(T + 'progressiveTax ↔ incomeTax.basic', N, () => [money(2e9, BR)], D.progressiveTax, C.incomeTax.basic);
    check(T + 'pensionDeduction ↔ incomeTax.pensionDeduction', N, () => [money(2e8, PDB)], D.pensionDeduction, C.incomeTax.pensionDeduction);
    check(T + 'compTax ↔ comprehensive({pension:[공적,사적], extraDeduction}).total', N,
      () => [money(6e7, PDB), money(6e7, [SEPL, ...PDB]), pick([undefined, 0, R.INCOME_TAX.elderDeduction, R.INCOME_TAX.basicDeduction, R.INCOME_TAX.elderDeduction + R.INCOME_TAX.basicDeduction])],
      D.compTax, (pub, priv, ded) => C.incomeTax.comprehensive({ pension: [pub, priv], extraDeduction: ded }).total);
    check(T + 'compTax(÷kx)×kx ↔ comprehensive({…, kx}).total', N,
      () => [money(6e7, PDB), money(6e7, [SEPL]), pick([0, R.INCOME_TAX.basicDeduction]), Math.pow(1 + rnd() * 0.05, ints(0, 40))],
      (pub, priv, ded, kx) => D.compTax(pub / kx, priv / kx, ded) * kx, (pub, priv, ded, kx) => C.incomeTax.comprehensive({ pension: [pub, priv], extraDeduction: ded, kx }).total);
    check(T + 'retirementTax ↔ retirementTax.calc().national', N, () => [money(2e9, CONVB), pick([money(45), ints(0, 45), 0.5, 5, 6, 10, 11, 20, 21])],
      D.retirementTax, (a, b) => C.retirementTax.calc(a, b).national);
    check(T + 'pensionRate ↔ pension.rate', N, () => [pick([ints(50, 100), 69, 70, 79, 80, 69.5, NaN])], D.pensionRate, C.pension.rate);
    check(T + 'retireFactor ↔ pension.retireRatio', N, () => [pick([ints(0, 40), 10, 11, 20, 21, NaN])], D.retireFactor, C.pension.retireRatio);
    check(T + 'houseTaxBase ↔ property.houseTaxBase', N, () => [money(3e9, GONGSI), rnd() < 0.3], D.houseTaxBase, C.property.houseTaxBase);
    check(T + 'propPoints ↔ nhis.propertyPoints', N, () => [money(1e11, PROPTB)], D.propPoints, C.nhis.propertyPoints);
    const nhIn = () => ({ pub: Array.from({ length: ints(0, 2) }, () => money(1e8, NHE)), fin: Array.from({ length: ints(0, 2) }, () => money(5e7, NHE)),
      other: pick([0, undefined, money(5e7, NHE)]), taxBase: pick([0, money(2e9, PROPTB)]), ix: pick([undefined, 1, Math.pow(1.025, ints(0, 40))]) });
    check(T + 'nhRegional ↔ nhis.regional({…, k: ix})', N, () => [nhIn()], D.nhRegional, o => C.nhis.regional(Object.assign({}, o, { k: o.ix })),
      K(['income', 'incPrem', 'propPrem', 'health', 'ltc', 'total']));
    const person = () => ({ pub: money(4e7, NHE), fin: money(3e7, NHE), taxBase: pick([0, money(1.5e9, NHE)]) });
    check(T + 'nhDependentOk ↔ nhis.dependent().ok', N, () => [Array.from({ length: ints(1, 2) }, person), pick([undefined, 1, Math.pow(1.025, ints(0, 40))])],
      D.nhDependentOk, (ppl, k) => C.nhis.dependent(ppl, { k }).ok);
    check(T + 'npsLegalAge ↔ nps.startAge', N, () => [ints(1940, 2000)], D.npsLegalAge, C.nps.startAge);
    check(T + 'npsFactor ↔ nps.timingFactor', N, () => [pick([ints(-5, 5), rnd() * 10 - 5])], D.npsFactor, C.nps.timingFactor);
  }
}
// ===== fin-income-tax · etf-vs-direct (같은 세금 엔진) =====
for (const repo of ['fin-income-tax', 'etf-vs-direct']) {
  const html = readRepo(repo, 'index.html');
  if (!html) { skipped.push(repo); continue; }
  const a = html.indexOf('// ============== 세금 엔진'), b = html.indexOf('// ============== 세금 엔진 끝');
  let code = html.slice(a, b);
  if (repo === 'etf-vs-direct') code += '\n' + grab(html, /const CG_DED = /) + '\n' + grab(html, /const cgTax = /);
  const F = load(code, ['basicTax', 'marginalRate', 'finTax', 'nhFinCounted', 'nhPremium', 'nhisCalc', 'propPoints', 'cgTax']);
  const T = repo === 'fin-income-tax' ? 'FIT ' : 'EVD ';
  check(T + 'basicTax ↔ incomeTax.basic', N, () => [money(2e9, BR)], F.basicTax, C.incomeTax.basic);
  check(T + 'marginalRate ↔ incomeTax.marginalRate', N, () => [money(2e9, BR)], F.marginalRate, C.incomeTax.marginalRate);
  const fx = () => ({ interest: money(3e7, [R.FIN_INCOME.threshold]), divGU: money(3e7, [R.FIN_INCOME.threshold]), divOther: money(3e7, [R.FIN_INCOME.threshold]),
    otherBase: pick([0, money(2e8, BR)]), hasWage: rnd() < 0.3 });
  check(T + 'finTax ↔ finIncome.tax', N, () => [fx()], F.finTax, C.finIncome.tax);
  check(T + 'nhFinCounted ↔ nhis.finCounted(F, {counted})', N, () => [F.finTax(fx())], F.nhFinCounted, t => C.nhis.finCounted(t.F, { counted: t.comp ? t.finAmt : t.F }));
  check(T + 'nhPremium ↔ nhis.premium', N, () => [money(1e8 / 12, [R.NHIS.floorIncomeMonthly, 280389, 280390, R.NHIS.premiumCapMonthly / R.NHIS.healthRate]), rnd() < 0.6],
    F.nhPremium, (m, reg) => C.nhis.premium(m, { regional: reg }));
  const nhO = () => ({ biz: pick([0, money(3e7, NHE)]), wage: pick([0, money(5e7, NHE)]), pension: pick([0, money(4e7, NHE)]) });
  check(T + "nhisCalc('work') ↔ nhis.employeeExtra", N, () => [money(5e7, NHE), nhO()], (fin, o) => F.nhisCalc('work', fin, o),
    (fin, o) => C.nhis.employeeExtra(Object.assign({ fin }, o)), K(['S', 'ev', 'm', 'health', 'ltc', 'monthly', 'annual', 'atFloor', 'atCap']));
  check(T + "nhisCalc('regional') ↔ nhis.premium(ev ÷ 12, {regional})", N, () => [money(5e7, NHE), Object.assign(nhO(), { other: pick([0, money(1e7)]) })],
    (fin, o) => F.nhisCalc('regional', fin, o),
    (fin, o) => C.nhis.premium((fin + (o.biz || 0) + (o.other || 0) + R.NHIS.publicPensionRatio * ((o.wage || 0) + (o.pension || 0))) / 12, { regional: true }),
    K(['health', 'ltc', 'monthly', 'annual', 'atFloor', 'atCap']));
  check(T + "nhisCalc('regional') ↔ nhis.regional (소득 합산 순서 다름: 0 이상 정수 원 입력)", N,
    () => [(v => (v > R.NHIS.finIncomeThreshold ? v : 0))(nn(money(5e7, NHE))), { biz: nn(pick([0, money(3e7, NHE)])), wage: nn(pick([0, money(5e7, NHE)])), pension: nn(pick([0, money(4e7, NHE)])) }],
    (fin, o) => F.nhisCalc('regional', fin, o), (fin, o) => { const r = C.nhis.regional({ pub: [o.pension], wage: [o.wage], fin: [fin], other: o.biz });
      return { health: r.health, ltc: r.ltc, monthly: r.total, annual: r.total * 12 }; }, K(['health', 'ltc', 'monthly', 'annual']),
    'FIT는 금융소득을 nhFinCounted로 미리 거른 값을 받음. 음수는 FIT가 그대로 더하고 엔진은 항목별 0으로 자름(FIT 화면 입력은 0 이상)');
  check(T + "nhisCalc('dep') 자격 ↔ nhis.dependent().ok (0 이상 정수 원 입력)", N,
    () => [(v => (v > R.NHIS.finIncomeThreshold ? v : 0))(nn(money(3e7, NHE))), { biz: nn(pick([0, money(1e7, NHE)])), wage: nn(pick([0, money(2e7, NHE)])), pension: nn(pick([0, money(3e7, NHE)])),
      bizReg: rnd() < 0.2, prop: nn(pick([0, money(1.5e9, NHE)])) }],
    (fin, o) => F.nhisCalc('dep', fin, o).eligible,
    (fin, o) => C.nhis.dependent([{ pub: o.pension, wage: o.wage, fin, other: o.biz, bizReg: o.bizReg, taxBase: o.prop }]).ok,
    null, 'FIT는 금융소득을 nhFinCounted로 미리 거른 값(1,000만 이하 0)을 받음 → 엔진에는 1,000만 초과 값만 들어오는 경우와 같음. FIT 기타소득(oth)은 엔진 필드 없음 → 0으로 둠');
  check(T + 'propPoints ↔ nhis.propertyPoints', N, () => [money(1e11, PROPTB)], F.propPoints, C.nhis.propertyPoints);
  if (F.cgTax) check(T + 'cgTax ↔ overseasStock.tax(gain, {otherGain, incremental}).tax', N,
    () => [{ otherForeign: pick([0, money(1e7, [R.OVERSEAS_STOCK.basicDeduction]), -money(1e7)]) }, money(5e7, [R.OVERSEAS_STOCK.basicDeduction])],
    F.cgTax, (inp, g) => C.overseasStock.tax(g, { otherGain: inp.otherForeign, incremental: true }).tax);
}
// ===== overseas-stock-tax =====
{
  const html = readRepo('overseas-stock-tax', 'index.html');
  if (!html) skipped.push('overseas-stock-tax');
  else {
    const O = load(grab(html, /const TR = TTOKJAE_RULES, OS = /) + '\n' + grab(html, /const TAX = \{/) + '\n' + grab(html, /function taxOf\(/), ['taxOf']);
    check('OST taxOf ↔ overseasStock.tax(total, {riaDeduction, roundWon})', N,
      () => [money(1e8, [R.OVERSEAS_STOCK.basicDeduction]) * pick([1, -1]), pick([0, 0, money(5e7)])], O.taxOf,
      (t, r) => C.overseasStock.tax(t, { riaDeduction: r, roundWon: true }), K(['base', ['nat', 'national'], ['loc', 'local'], 'tax']));
  }
}
// ===== trading-cost =====
{
  const html = readRepo('trading-cost', 'index.html');
  if (!html) skipped.push('trading-cost');
  else {
    const X = load(['const TR = TTOKJAE_RULES;', grab(html, /const TT = TR\.TRADE/), grab(html, /const KR_TAX = \{/), grab(html, /function tickOf\(/),
      grab(html, /function krTick\(/), grab(html, /function krCalc\(/)].join('\n'), ['krTick', 'krCalc']);
    const PR = [...R.TRADE.krxTick, ...R.TRADE.krxEtfTick].filter(r => isFinite(r[0])).map(r => r[0]);
    check('TC krTick ↔ trade.tick', N, () => [money(2e6, PR), pick(['kospi', 'kosdaq', 'etf'])], X.krTick, (p, m) => C.trade.tick(m === 'etf' ? 'etf' : 'krx', p));
    check('TC krCalc 거래세·농특세 ↔ trade.krSellTax', N, () => [Math.round(money(1e6, PR)), ints(1, 1000), pick(['kospi', 'kosdaq', 'etf'])],
      (sp, q, m) => { const r = X.krCalc({ m, bp: 0, sp, q, fb: 0, fs: 0, d: 0 }); return { stt: r.stt, rural: r.rural, tax: r.tax }; },
      (sp, q, m) => C.trade.krSellTax(sp * q, m));
  }
}
// ===== nps-calc =====
{
  const src = readRepo('nps-calc', 'src/engine.js');
  if (!src) skipped.push('nps-calc');
  else {
    const Q = load(src, ['npsStartAge', 'npsTimingRate']);
    check('NPS npsStartAge ↔ nps.startAge', N, () => [ints(1940, 2000)], Q.npsStartAge, C.nps.startAge);
    check('NPS npsTimingRate ↔ nps.timingFactor({clamp})', N, () => [pick([ints(-8, 8), rnd() * 16 - 8, 0, -0])], Q.npsTimingRate, o => C.nps.timingFactor(o, { clamp: true }));
  }
}

// ---------- 출력 ----------
let fail = 0, total = 0;
console.log(`calc-v1 ↔ 기존 구현 (${WORKING ? '작업 폴더' : 'git HEAD'}, rules v${R.meta.version}, 시드 ${SEED})\n`);
for (const r of results) {
  total += r.n;
  console.log(`${r.bad ? '✗' : '✓'} ${r.label}: ${r.n}건${r.bad ? ` · 다름 ${r.bad}` : ''}${r.note ? `  (${r.note})` : ''}`);
  if (r.bad) { fail++; console.log('    첫 차이:', JSON.stringify(r.first, (k, v) => (typeof v === 'number' && !isFinite(v) ? String(v) : Object.is(v, -0) ? '-0' : v)).slice(0, 600)); }
}
if (skipped.length) console.log('\n건너뜀: ' + skipped.join(', '));
console.log(`\n합계: ${results.length}개 비교 · ${total}건 — ${fail ? '차이 있는 비교 ' + fail : '모두 일치'}`);
process.exit(fail ? 1 : 0);
