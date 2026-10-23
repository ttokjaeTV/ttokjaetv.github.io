#!/usr/bin/env node
/*
 * calc-v*.js 기준 답안 시험:  node rules/tests/calc-test.js [--calc rules/calc-v2.js] [--rules rules/v2026.2/rules.js] [--verbose]
 *
 * --calc 없이 돌리면 rules/calc-v*.js 전부를 하나씩(따로 실행) 시험한다.
 * --rules 없이 돌리면 rules/v<버전>/rules.js 중 v2026.2 이상 전부를 차례로 시험하고, 그보다 옛 버전은 bind가 거부하는지만 본다.
 *
 * 1) 기준 답안: rules/tests/calc-cases/*.json
 *      { "year": 2026, "about": "...", "cases": [ { fn, input, expect, source, note, tol?, exact? } ] }
 *      fn     : 'incomeTax.basic' 처럼 엔진 함수 경로. input = 인자 배열.
 *      expect : 숫자·참거짓·문자열, 또는 객체(적힌 키만 비교, 배열 안 객체도 마찬가지). "Infinity"·"-Infinity"·"NaN" 문자열은 그 숫자.
 *      source : A 법령 손계산(식은 note) · B 공식 모의계산 · C 금융사 공개 예시 · D 현재 계산기 출력 회귀값(정답 아님)
 *      tol    : 숫자 허용 오차(원, 기본 1e-6 — 손계산 값과 부동소수 끝자리 차이만 허용). exact: true면 Object.is로 비교.
 *      year   : rules meta.year가 다르면 그 파일은 건너뜀(그해 법령 값으로 손계산한 답이므로).
 *      calc   : ["calc-v1"]처럼 적으면 그 엔진에서만 시험(엔진 버전 사이에 계산 방식이 바뀐 답). 없으면 모든 엔진.
 * 2) 구조 시험: 전역 이름, 얼림, 필요한 키가 빠지면 오류, 금지 API(DOM·fetch·Date·console) 미사용, 누진세·공제 연속성.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const argv = process.argv.slice(2);
const ri = argv.indexOf('--rules');
const VERBOSE = argv.includes('--verbose');
const RULES_DIR = path.join(__dirname, '..');
const ci = argv.indexOf('--calc');
if (ci < 0) {
  // 엔진 파일마다 따로 실행(전역·require 캐시가 섞이지 않게)
  const { spawnSync } = require('child_process');
  const engines = fs.readdirSync(RULES_DIR).filter(f => /^calc-v\d+\.js$/.test(f)).sort((a, b) => parseInt(a.slice(6)) - parseInt(b.slice(6)));
  let failed = 0;
  for (const e of engines) {
    const r = spawnSync(process.execPath, [__filename, '--calc', path.join(RULES_DIR, e), ...argv], { stdio: 'inherit' });
    if (r.status !== 0) failed++;
  }
  process.exit(failed ? 1 : 0);
}
const ENGINE = path.resolve(argv[ci + 1]);
const NAME = path.basename(ENGINE, '.js');
const SRC = fs.readFileSync(ENGINE, 'utf8');
const ENG = require(ENGINE);
const verNum = v => { const m = /^(\d+)\.(\d+)$/.exec(String(v)); return m ? +m[1] * 1000 + +m[2] : -1; };
const MIN = verNum('2026.2');

let targets;
if (ri >= 0) targets = [path.resolve(argv[ri + 1])];
else targets = fs.readdirSync(RULES_DIR).filter(d => /^v\d+\.\d+$/.test(d)).map(d => path.join(RULES_DIR, d, 'rules.js')).filter(f => fs.existsSync(f));

let total = 0, bad = 0;
const fail = (msg) => { bad++; console.log('FAIL ' + msg); };
const ok = (cond, msg) => { total++; if (!cond) fail(msg); else if (VERBOSE) console.log('ok   ' + msg); };

// ---------- 구조 시험 (rules와 무관) ----------
{
  // 브라우저처럼 실행: 전역 이름은 TTOKJAE_CALC 하나만
  const win = {}; win.window = win; win.self = win;
  const ctx = vm.createContext(win);
  const before = new Set(Object.getOwnPropertyNames(vm.runInContext('globalThis', ctx)));
  vm.runInContext(SRC, ctx);
  const added = Object.getOwnPropertyNames(vm.runInContext('globalThis', ctx)).filter(k => !before.has(k));
  ok(added.length === 1 && added[0] === 'TTOKJAE_CALC', '브라우저 전역은 TTOKJAE_CALC 하나 (생긴 이름: ' + added.join(', ') + ')');
  ok(vm.runInContext('TTOKJAE_CALC.version', ctx) === NAME, 'TTOKJAE_CALC.version = ' + NAME);
  ok(ENG.version === NAME && typeof ENG.bind === 'function' && Object.isFrozen(ENG), 'Node module.exports = { version, bind } (얼림)');
  // 금지 API (주석·문자열 밖 코드에서)
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
  for (const [re, name] of [[/\bdocument\b/, 'document'], [/\bfetch\s*\(/, 'fetch'], [/\bDate\b/, 'Date'], [/\bconsole\b/, 'console'], [/\bXMLHttpRequest\b/, 'XMLHttpRequest'], [/\blocalStorage\b/, 'localStorage'], [/\bTTOKJAE_RULES\b/, '전역 TTOKJAE_RULES 직접 참조']])
    ok(!re.test(code), '코드에 ' + name + ' 없음');
  // 숫자 리터럴은 단위·구조 숫자만 (제도 값은 모두 rules에서): 0, 1, 12(개월), 1e4(만원), 1e-9(끝수 오차). 표 열 번호 [2]·[3]은 제외
  const nums = (code.replace(/"(?:[^"\\\n]|\\.)*"/g, '""').replace(/\[\d\]/g, '[]').match(/(?<![\w$.])(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?(?![\w$])/gi) || []).map(Number);
  const odd = [...new Set(nums.filter(v => ![0, 1, 12, 1e4, 1e-9].includes(v)))];
  ok(!odd.length, '숫자 리터럴은 0·1·12·1e4·1e-9뿐' + (odd.length ? ' (그 밖: ' + odd.join(', ') + ')' : ''));
  // 최상위에 다른 선언이 없음 (IIFE 하나)
  const top = code.replace(/^\s+/, '');
  ok(/^\(function \(root, factory\) \{/.test(top), '파일 최상위는 UMD IIFE 하나');
  ok((() => { try { ENG.bind(null); return false; } catch (e) { return /rules v2026\.2 이상 필요: TTOKJAE_RULES 없음/.test(e.message); } })(), 'bind(null) → 오류');
}

// ---------- rules 버전별 ----------
const cases = fs.readdirSync(path.join(__dirname, 'calc-cases')).filter(f => f.endsWith('.json')).sort()
  .map(f => ({ file: f, data: JSON.parse(fs.readFileSync(path.join(__dirname, 'calc-cases', f), 'utf8')) }));
const special = v => (v === 'Infinity' ? Infinity : v === '-Infinity' ? -Infinity : v === 'NaN' ? NaN : v);
const revive = v => Array.isArray(v) ? v.map(revive) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)])) : special(v);
function match(got, exp, tol, exact, where) {
  if (typeof exp === 'number') {
    if (typeof got !== 'number') return `${where}: 숫자 아님(${JSON.stringify(got)})`;
    if (exact || !isFinite(exp) || Number.isNaN(exp)) return Object.is(got, exp) ? null : `${where}: ${got} ≠ ${exp}`;
    return Math.abs(got - exp) <= tol ? null : `${where}: ${got} ≠ ${exp} (차 ${got - exp})`;
  }
  if (exp && typeof exp === 'object') {
    if (!got || typeof got !== 'object') return `${where}: 객체 아님(${JSON.stringify(got)})`;
    for (const k of Object.keys(exp)) { const e = match(got[k], exp[k], tol, exact, where + '.' + k); if (e) return e; }
    return null;
  }
  return got === exp ? null : `${where}: ${JSON.stringify(got)} ≠ ${JSON.stringify(exp)}`;
}
const fnAt = (C, p) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), C);

const summary = [];
for (const file of targets) {
  delete require.cache[require.resolve(file)];
  const R = require(file);
  const ver = R && R.meta && R.meta.version;
  if (verNum(ver) < MIN) {
    let msg = '';
    try { ENG.bind(R); } catch (e) { msg = e.message; }
    ok(/^rules v2026\.2 이상 필요: \S+ 없음$/.test(msg), `rules v${ver}: bind 거부 ("${msg}")`);
    summary.push(`rules v${ver}: v2026.2 미만 → bind 거부 확인`);
    continue;
  }
  const C = ENG.bind(R);
  ok(C === ENG.bind(R), `v${ver}: bind(R) 캐시 (같은 R이면 같은 객체)`);
  ok(Object.isFrozen(C) && Object.keys(C).filter(k => C[k] && typeof C[k] === 'object').every(k => Object.isFrozen(C[k])), `v${ver}: 함수 묶음 얼림`);
  ok(C.rulesVersion === ver, `v${ver}: C.rulesVersion`);
  // 필요한 키 하나를 빼면 그 키 이름으로 오류
  const strip = (obj, p) => { const c = JSON.parse(JSON.stringify(obj, (k, v) => (v === Infinity ? '__inf' : v)), (k, v) => (v === '__inf' ? Infinity : v)); const ks = p.split('.'); let o = c; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; delete o[ks[ks.length - 1]]; return c; };
  for (const p of ['INCOME_TAX.dependentIncomeLimit', 'NHIS.truncUnit', 'NHIS.dependent.propHigh', 'TRADE.krxTick', 'meta.year']) {
    let msg = ''; try { ENG.bind(strip(R, p)); } catch (e) { msg = e.message; }
    ok(msg === 'rules v2026.2 이상 필요: ' + p + ' 없음', `v${ver}: ${p} 빠지면 "${msg}"`);
  }
  // 연속성·단조성 (구간 경계에서 값이 튀지 않음)
  for (const [lim] of R.INCOME_TAX.brackets.filter(r => isFinite(r[0]))) {
    ok(Math.abs(C.incomeTax.basic(lim + 1e-3) - C.incomeTax.basic(lim)) < 1, `v${ver}: 기본세율 ${lim} 경계 연속`);
  }
  for (const [lim] of R.INCOME_TAX.pensionIncomeDeduction.filter(r => isFinite(r[0]))) {
    ok(Math.abs(C.incomeTax.pensionDeduction(lim + 1e-3) - C.incomeTax.pensionDeduction(lim)) < 1, `v${ver}: 연금소득공제 ${lim} 경계 연속`);
  }
  for (const [lim] of R.RETIREMENT_INCOME_TAX.convertedPayDeduction.filter(r => isFinite(r[0]))) {
    const sev = lim + 20000000;   // 근속 12년: 근속연수공제 2,000만 → 환산급여 = 퇴직금 − 2,000만
    ok(Math.abs(C.retirementTax.calc(sev + 1e-3, 12).national - C.retirementTax.calc(sev, 12).national) < 1, `v${ver}: 환산급여공제 ${lim} 경계 연속`);
  }
  let prev = -1, mono = true;
  for (let b = 0; b <= 1.2e9; b += 997331) { const t = C.incomeTax.basic(b); if (t < prev) mono = false; prev = t; }
  ok(mono, `v${ver}: 기본세율 산출세액 단조 증가`);
  // 기준 답안
  const bySrc = { A: 0, B: 0, C: 0, D: 0 };
  let n = 0, nBad = 0, skipped = 0;
  for (const { file: cf, data } of cases) {
    const list = Array.isArray(data) ? data : data.cases;
    if (!Array.isArray(data) && data.year != null && data.year !== R.meta.year) { skipped += list.length; continue; }
    list.forEach((c, i) => {
      if (c.calc && !c.calc.includes(NAME)) { skipped++; return; }
      n++; total++;
      bySrc[c.source] = (bySrc[c.source] || 0) + 1;
      const f = fnAt(C, c.fn);
      let got, err;
      if (typeof f !== 'function') err = '함수 없음';
      else { try { got = f.apply(null, revive(c.input)); } catch (e) { err = '오류 ' + e.message; } }
      if (!err) err = match(got, revive(c.expect), c.tol == null ? 1e-6 : c.tol, !!c.exact, c.fn);
      if (err) { nBad++; fail(`v${ver} ${cf}#${i + 1} [${c.source}] ${err} — ${c.note || ''}`); }
      else if (VERBOSE) console.log(`ok   v${ver} ${cf}#${i + 1} [${c.source}] ${c.fn}`);
    });
  }
  summary.push(`${NAME} · rules v${ver}: 기준 답안 ${n}건 (A ${bySrc.A} · B ${bySrc.B} · C ${bySrc.C} · D ${bySrc.D})${skipped ? ` · 다른 연도·다른 엔진용이라 건너뜀 ${skipped}` : ''} — ${nBad ? '실패 ' + nBad : '통과'}`);
}
summary.forEach(s => console.log(s));
console.log(`${NAME} 시험 ${total}건 — ${bad ? '실패 ' + bad : '모두 통과'}`);
process.exit(bad ? 1 : 0);
