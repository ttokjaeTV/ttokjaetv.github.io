/*!
 * 똑재TV 계산기 공용 계산 엔진 (calc-v1)
 * ------------------------------------------------------------
 * rules.js(TTOKJAE_RULES)의 숫자로 '법에 정해진 계산'(세액·공제·건보료·한도·호가)만 하는 함수 묶음입니다.
 * 시뮬레이터(연도별 인출·적립·탐색)와 계산기 관례(계획 나이, 실질 환산 시점)는 넣지 않습니다.
 *
 * 쓰는 법 (브라우저): rules.js 다음, 계산기 엔진보다 먼저
 *   <script src="https://ttokjaetv.github.io/rules/v2026.2/rules.js"></script>
 *   <script src="https://ttokjaetv.github.io/rules/calc-v1.js"></script>
 *   const CALC = TTOKJAE_CALC.bind(TTOKJAE_RULES);       // 이름은 계산기 안에서 겹치지 않게
 *   CALC.incomeTax.basic(34700000)                         // 산출세액(국세)
 * 쓰는 법 (Node): const CALC = require('./rules/calc-v1.js').bind(require('./rules/v2026.2/rules.js'));
 *
 * 규칙
 *   - 전역 이름은 TTOKJAE_CALC 하나만 만든다(Node는 module.exports). DOM·fetch·Date·console을 쓰지 않는다.
 *   - 제도 숫자는 모두 bind(R)로 받은 rules에서 읽는다. 이 파일의 숫자는 단위·구조(0, 1, 12개월, 만원 1e4, 끝수 오차 1e-9)뿐.
 *   - 금액 원, 비율 0~1, 나이 만 나이. 세액은 이름에 national(국세)·total(지방소득세 포함)을 붙여 구분한다.
 *   - 부동소수 연산 순서는 2026-10-20 기준 계산기(retire-drawdown·pension-tax-sim·fin-income-tax 등) 식과 같게 두었다.
 *     연산 순서를 바꾸면 마지막 자리가 달라져 계산기 결과(인출 순서 선택 등)가 뒤집힐 수 있으므로 고치지 않는다.
 *   - 배포 후 고치지 않는다. 계산 방식을 바꿀 일이 생기면 calc-v2.js로 낸다. rules/README.md 참고.
 *   - 함수 시그니처·옵션 표: rules/README.md '공용 계산 엔진 (calc-v1.js)'. 기준 답안 시험: rules/tests/calc-test.js
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module && typeof module.exports === 'object') {
    module.exports = api;
  } else if (root) {
    root.TTOKJAE_CALC = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : this)), function () {
  'use strict';

  var VERSION = 'calc-v1';
  var NEED = 'rules v2026.2 이상 필요: ';

  // bind(R)가 읽는 rules 경로 (하나라도 없으면 오류). INCOME_TAX.dependentIncomeLimit은 v2026.2에서 추가된 키
  var REQUIRED = [
    'meta.year',
    'INCOME_TAX.brackets', 'INCOME_TAX.local', 'INCOME_TAX.basicDeduction', 'INCOME_TAX.elderDeduction', 'INCOME_TAX.elderAge',
    'INCOME_TAX.standardTaxCredit', 'INCOME_TAX.dependentIncomeLimit', 'INCOME_TAX.pensionIncomeDeduction', 'INCOME_TAX.pensionIncomeDeductionCap',
    'RETIREMENT_INCOME_TAX.serviceYearDeduction', 'RETIREMENT_INCOME_TAX.convertedPayDeduction', 'RETIREMENT_INCOME_TAX.pensionPayRatio',
    'PENSION.minAge', 'PENSION.separateLimit', 'PENSION.rateByAge', 'PENSION.rateByAgeNational', 'PENSION.separateRateNational',
    'PENSION.payoutLimitFactor', 'PENSION.payoutLimitFreeYear', 'PENSION.pre2013StartYear',
    'PROPERTY.fairMarketRatioSingleHome', 'PROPERTY.fairMarketRatioMultiHome',
    'NHIS.healthRate', 'NHIS.ltcRate', 'NHIS.premiumCapMonthly', 'NHIS.premiumFloorMonthly', 'NHIS.floorIncomeMonthly', 'NHIS.perPoint',
    'NHIS.propertyDeduction', 'NHIS.propertyPointTable', 'NHIS.finIncomeThreshold', 'NHIS.publicPensionRatio', 'NHIS.employeeExtraIncomeDeduction',
    'NHIS.truncUnit', 'NHIS.dependent.income', 'NHIS.dependent.biz', 'NHIS.dependent.propLow', 'NHIS.dependent.propHigh', 'NHIS.dependent.propIncome',
    'FIN_INCOME.threshold', 'FIN_INCOME.withholding', 'FIN_INCOME.grossUp', 'FIN_INCOME.grossUpByYear',
    'OVERSEAS_STOCK.basicDeduction', 'OVERSEAS_STOCK.rate', 'OVERSEAS_STOCK.rateNational', 'OVERSEAS_STOCK.rateLocal',
    'TRADE.securitiesTransactionTax', 'TRADE.krxTick', 'TRADE.krxEtfTick', 'TRADE.usTick',
    'NPS.startAgeByBirthYear', 'NPS.earlyReductionPerYear', 'NPS.deferralBonusPerYear', 'NPS.maxEarlyYears', 'NPS.maxDeferralYears',
  ];

  function get(R, p) {
    var o = R, ks = p.split('.');
    for (var i = 0; i < ks.length; i++) {
      if (o == null || typeof o !== 'object' || !(ks[i] in o)) return undefined;
      o = o[ks[i]];
    }
    return o;
  }

  var cache = typeof WeakMap === 'function' ? new WeakMap() : null;

  function bind(R) {
    if (!R || typeof R !== 'object') throw new Error(NEED + 'TTOKJAE_RULES 없음');
    if (cache && cache.has(R)) return cache.get(R);
    for (var i = 0; i < REQUIRED.length; i++) {
      if (get(R, REQUIRED[i]) === undefined) throw new Error(NEED + REQUIRED[i] + ' 없음');
    }
    var C = make(R);
    if (cache) cache.set(R, C);
    return C;
  }

  // 연도별 표 { 연도: 값 } — 표에 있으면 그 값, 첫 해보다 앞이면 첫 해, 마지막 해보다 뒤면 마지막 해 값
  function yearValue(T, year) {
    if (Object.prototype.hasOwnProperty.call(T, year)) return T[year];
    var ys = Object.keys(T).map(Number).sort(function (a, b) { return a - b; });
    if (!(year > ys[0])) return T[ys[0]];
    if (year > ys[ys.length - 1]) return T[ys[ys.length - 1]];
    var y = ys[0];
    for (var i = 0; i < ys.length; i++) if (ys[i] <= year) y = ys[i];
    return T[y];
  }
  var list = function (v) { return v == null ? [] : Array.isArray(v) ? v : [v]; };

  function make(R) {
    var IT = R.INCOME_TAX, RT = R.RETIREMENT_INCOME_TAX, PEN = R.PENSION, PR = R.PROPERTY, NH = R.NHIS, FI = R.FIN_INCOME,
      OS = R.OVERSEAS_STOCK, TD = R.TRADE, NPS = R.NPS;
    var LOCAL = 1 + IT.local;            // 지방소득세 가산 (1.1) — 계산기의 TAX.LOCAL·RULE.LOCAL과 같은 식
    var B = IT.brackets, PD = IT.pensionIncomeDeduction, SY = RT.serviceYearDeduction, CP = RT.convertedPayDeduction;
    var NH_PROP = NH.propertyPointTable;

    /* ================= 종합소득세 ================= */

    // 기본세율 산출세액(국세). 과세표준 0 이하·NaN이면 0
    function basic(base) {
      if (!(base > 0)) return 0;
      for (var i = 0; i < B.length; i++) if (base <= B[i][0]) return base * B[i][1] - B[i][2];
      return 0;
    }
    // 한계세율(국세). 과세표준 0 이하면 첫 구간 세율
    function marginalRate(base) {
      if (!(base > 0)) return B[0][1];
      for (var i = 0; i < B.length; i++) if (base <= B[i][0]) return B[i][1];
      return B[B.length - 1][1];
    }
    // 연금소득공제(한도 포함)
    function pensionDeduction(total) {
      var d;
      for (var i = 0; i < PD.length; i++) if (total <= PD[i][0]) { d = PD[i][3] + (total - PD[i][2]) * PD[i][1]; break; }
      return Math.min(d, IT.pensionIncomeDeductionCap);
    }
    /* 연금소득(+다른 종합소득금액) 종합과세 세액
       o = { pension: 총연금액 또는 [공적, 사적, …](합산), otherIncome: 다른 종합소득금액, age: 나이(70세 이상 경로우대),
             extraDeduction: 그 밖의 인적공제(배우자·경로우대를 계산기가 직접 셀 때), standardCredit: true(기본)/false/금액,
             kx: 물가 배수 — 주면 금액을 ÷kx(오늘 돈 가치)로 계산하고 total만 ×kx(명목). 나머지 필드는 ÷kx 기준 }
       과세표준 = max(0, 소득금액 − (기본공제 + 경로우대) − extraDeduction), 결정세액 = max(0, 산출세액 − 표준세액공제) */
    function comprehensive(o) {
      o = o || {};
      var kx = o.kx == null ? 1 : o.kx;
      var ps = list(o.pension), total = ps.length ? ps[0] / kx : 0;
      for (var i = 1; i < ps.length; i++) total = total + ps[i] / kx;
      var pd = pensionDeduction(total);
      var income = total - pd;
      if (o.otherIncome) income = income + o.otherIncome / kx;
      var ded = IT.basicDeduction + (o.age >= IT.elderAge ? IT.elderDeduction : 0);
      var extra = o.extraDeduction || 0;
      var base = Math.max(0, income - ded - extra);
      var calc = basic(base);
      var std = o.standardCredit === false ? 0 : typeof o.standardCredit === 'number' ? o.standardCredit : IT.standardTaxCredit;
      var national = Math.max(0, calc - std);
      var withLocal = national * LOCAL;
      return { pensionTotal: total, pensionDeduction: pd, income: income, deduction: ded + extra, base: base, calc: calc,
        credit: calc - national, national: national, local: withLocal - national, total: withLocal * kx, kx: kx };
    }
    // 배우자·부양가족 기본공제 소득요건(연간 소득금액 합계 ≤ 100만원)
    function dependentIncomeOk(incomeAmount) { return incomeAmount <= IT.dependentIncomeLimit; }

    /* ================= 퇴직소득세 ================= */
    // severance: 퇴직급여(원), years: 근속연수(1년 미만 올림, 최소 1년). national = 국세, total = 지방소득세 포함
    function retirementCalc(severance, years) {
      var y = Math.max(1, Math.ceil(years));
      var sd, cd, i;
      for (i = 0; i < SY.length; i++) if (y <= SY[i][0]) { sd = SY[i][3] + SY[i][1] * (y - SY[i][2]); break; }
      var conv = Math.max(0, severance - sd) * 12 / y;
      for (i = 0; i < CP.length; i++) if (conv <= CP[i][0]) { cd = CP[i][3] + (conv - CP[i][2]) * CP[i][1]; break; }
      var base = Math.max(0, conv - cd);
      var national = Math.max(0, basic(base) * y / 12);
      return { years: y, serviceDed: sd, converted: conv, convDed: cd, base: base, national: national, total: national * LOCAL };
    }

    /* ================= 사적연금(연금저축·IRP) 인출 ================= */
    // 연금소득세율(수령 나이 < 상한인 첫 행). withLocal이면 지방세 포함 표(5.5%·4.4%·3.3%) — 국세 × 1.1과 끝자리가 다를 수 있음
    function pensionRate(age, opt) {
      var T = opt && opt.withLocal ? PEN.rateByAge : PEN.rateByAgeNational;
      for (var i = 0; i < T.length; i++) if (age < T[i][0]) return T[i][1];
    }
    // 이연퇴직소득 연금수령 시 퇴직소득세 납부 비율(실제 수령연차 ≤ 상한인 첫 행: 70%·60%·50%)
    function retireRatio(paidYears) {
      var T = RT.pensionPayRatio;
      for (var i = 0; i < T.length; i++) if (paidYears <= T[i][0]) return T[i][1];
    }
    // 연금수령연차 = 기산 연차(2013-03-01 이전 가입 6, 아니면 1) + max(0, 나이 − 수령 요건 충족 나이)
    function limitYear(o) {
      var start = o.startAge == null ? PEN.minAge : o.startAge;
      return (o.pre2013 ? PEN.pre2013StartYear : 1) + Math.max(0, o.age - start);
    }
    // 연금수령한도 = 평가액 ÷ (11 − 연차) × 120%, 11년차부터 한도 없음(Infinity)
    function payoutLimit(balance, ly) {
      return ly >= PEN.payoutLimitFreeYear ? Infinity : balance / (PEN.payoutLimitFreeYear - ly) * PEN.payoutLimitFactor;
    }
    /* 세액공제 받은 원금·운용수익의 연금수령분 과세 방식 선택
       o = { amount: 연금수령분, age, comp: 종합과세로 늘어나는 세액(지방세 포함, 계산기가 계산), kx: 물가 배수(1,500만원 기준에 곱함) }
       amount ≤ 1,500만원: 저율 분리과세(나이별) vs 종합과세 / 초과: 16.5% 분리과세 vs 종합과세 — 작은 쪽 (같으면 분리과세)
       → { tax, method: 'comp' | 'low' | 'sep', alt: 분리과세 세액, limit } */
    function privateTaxChoice(o) {
      var lim = PEN.separateLimit * (o.kx == null ? 1 : o.kx);
      var low = o.amount <= lim;
      var alt = low ? o.amount * pensionRate(o.age) * LOCAL : o.amount * PEN.separateRateNational * LOCAL;
      if (o.comp < alt) return { tax: o.comp, method: 'comp', alt: alt, limit: lim };
      return { tax: alt, method: low ? 'low' : 'sep', alt: alt, limit: lim };
    }

    /* ================= 재산세 과세표준 (주택) ================= */
    function houseTaxBase(gongsi, multi) {
      if (!(gongsi > 0)) return 0;
      if (multi) return gongsi * PR.fairMarketRatioMultiHome;
      var T = PR.fairMarketRatioSingleHome;
      for (var i = 0; i < T.length; i++) if (gongsi <= T[i][0]) return gongsi * T[i][1];
    }

    /* ================= 건강보험 ================= */
    var noTrunc = function (v) { return v; };
    var floorUnit = function (v) { return Math.floor(v / NH.truncUnit + 1e-9) * NH.truncUnit; };   // 10원 미만 버림 (1e-9: 부동소수 끝수 오차 흡수)
    var truncOf = function (o) { return o && o.trunc === false ? noTrunc : floorUnit; };

    // 재산 부과점수: (과세표준 − 1억)을 만원 단위로 등급표에 대 봄. 0 이하면 0점
    function propertyPoints(taxBase) {
      var man = (taxBase - NH.propertyDeduction) / 1e4;
      if (man <= 0) return 0;
      for (var i = 0; i < NH_PROP.length; i++) if (man <= NH_PROP[i][0]) return NH_PROP[i][1];
      return NH_PROP[NH_PROP.length - 1][1];
    }
    // 건보료 소득에 잡히는 이자·배당(1인): 1,000만원 "초과"면 counted(기본 fin, 종합과세면 그로스업 포함액), 이하면 0
    //   k: 물가 배수(오늘 돈 가치로 넣을 때 명목 기준을 k로 나눠 비교)
    function finCounted(fin, o) {
      var k = (o && o.k) || 1;
      return fin > NH.finIncomeThreshold / k ? (o && o.counted !== undefined ? o.counted : fin) : 0;
    }
    // 소득월액 → 소득 건강보험료(버림 전). regional이면 하한(소득월액 28만원 이하 또는 계산값이 하한보다 작을 때)
    function incomeHealthRaw(m, regional) {
      var h = Math.max(0, m) * NH.healthRate;
      var atFloor = !!regional && (m <= NH.floorIncomeMonthly || h < NH.premiumFloorMonthly);
      if (atFloor) h = NH.premiumFloorMonthly;
      return { h: h, atFloor: atFloor, atCap: h > NH.premiumCapMonthly, v: Math.min(NH.premiumCapMonthly, h) };
    }
    /* 소득월액 m → 월 보험료. o = { regional: 지역가입자(하한 적용, 기본 false), trunc: false면 10원 미만 버림 안 함 }
       건강보험료를 버린 뒤 장기요양보험료 = 버린 건강보험료 × 장기요양률/건보료율 → 다시 버림 */
    function premium(m, o) {
      var tr = truncOf(o), x = incomeHealthRaw(m, o && o.regional);
      var h = tr(x.v);
      var l = tr(h * NH.ltcRate / NH.healthRate);
      return { health: h, ltc: l, monthly: h + l, annual: (h + l) * 12, atFloor: x.atFloor, atCap: x.atCap };
    }
    /* 지역가입자 월 보험료(세대 합산)
       o = { pub: [공적연금 연액…], wage: [근로소득 연액…](공적연금과 같이 50% 반영), fin: [이자·배당 연액…](1인별 1,000만원 판정),
             other: 사업·임대 등 소득금액(연, 세대 합계), taxBase: 주택 재산세 과세표준, k: 물가 배수(금융소득 기준), trunc }
       소득 보험료·재산 보험료를 각각 버리고, 장기요양은 합친 건강보험료 기준으로 다시 버림 */
    function regional(o) {
      o = o || {};
      var tr = truncOf(o), k = o.k || 1, i, a = 0, f = 0;
      var pubs = list(o.pub), wages = list(o.wage), fins = list(o.fin);
      for (i = 0; i < pubs.length; i++) a = a + Math.max(0, pubs[i]) * NH.publicPensionRatio;
      for (i = 0; i < wages.length; i++) a = a + Math.max(0, wages[i]) * NH.publicPensionRatio;
      for (i = 0; i < fins.length; i++) f = f + finCounted(Math.max(0, fins[i]), { k: k });
      var income = a + f + Math.max(0, o.other || 0);
      var m = income / 12;
      var x = incomeHealthRaw(m, true);
      var incPrem = tr(x.v);
      var pts = propertyPoints(o.taxBase || 0);
      var propPrem = tr(pts * NH.perPoint);
      var health = incPrem + propPrem;
      var ltc = tr(health * NH.ltcRate / NH.healthRate);
      return { income: income, m: m, incPrem: incPrem, pts: pts, propPrem: propPrem, health: health, ltc: ltc, total: health + ltc,
        floor: x.v <= NH.premiumFloorMonthly, atCap: x.atCap };
    }
    /* 직장가입자 보수 외 소득 보험료(소득월액 보험료)
       o = { fin(건보 반영 금융소득), biz, wage(보수 외 근로), pension(공적연금), trunc }
       보수 외 소득 합계 S가 2,000만원을 넘으면 (S − 2,000만) ÷ 12 × (반영 소득 ÷ S) */
    function employeeExtra(o) {
      var fin = o.fin || 0, biz = o.biz || 0, wage = o.wage || 0, pen = o.pension || 0;
      var S = fin + biz + wage + pen;
      var ev = fin + biz + NH.publicPensionRatio * (wage + pen);
      var m = S > NH.employeeExtraIncomeDeduction ? (S - NH.employeeExtraIncomeDeduction) / 12 * (ev / S) : 0;
      var p = premium(m, { regional: false, trunc: o.trunc });
      return { S: S, ev: ev, m: m, health: p.health, ltc: p.ltc, monthly: p.monthly, annual: p.annual, atFloor: p.atFloor, atCap: p.atCap };
    }
    /* 피부양자 요건 (소득 요건은 부부 함께 — 한 명이 넘으면 둘 다 탈락, 재산 요건은 각자)
       people = [{ pub(공적연금 100%), wage, fin(1,000만원 초과면 전액), other(사업·임대 소득금액), bizReg(사업자등록 또는 주택임대소득), taxBase }]
       o = { k: 물가 배수(명목 기준 금액을 k로 나눠 비교) }
       → { people: [{ inc, biz, bizReg, tb, bizOk, incOk, propOk, ok }], incAll, ok } */
    function dependent(people, o) {
      var k = (o && o.k) || 1, D = NH.dependent;
      var res = (people || []).map(function (p) {
        var biz = Math.max(0, p.other || 0);
        var inc = Math.max(0, p.pub || 0) + Math.max(0, p.wage || 0) + finCounted(Math.max(0, p.fin || 0), { k: k }) + biz;
        var tb = p.taxBase || 0;
        var bizOk = p.bizReg ? biz <= 0 : biz <= D.biz / k;
        var incOk = inc <= D.income / k && bizOk;
        var propOk = tb <= D.propLow / k || (tb <= D.propHigh / k && inc <= D.propIncome / k);
        return { inc: inc, biz: biz, bizReg: !!p.bizReg, tb: tb, bizOk: bizOk, incOk: incOk, propOk: propOk };
      });
      var incAll = res.every(function (r) { return r.incOk; });
      res.forEach(function (r) { r.ok = incAll && r.propOk; });
      return { people: res, incAll: incAll, ok: res.every(function (r) { return r.ok; }) };
    }

    /* ================= 금융소득종합과세 ================= */
    /* x = { interest, divGU(그로스업 대상 배당), divOther(그 밖의 배당), otherBase(다른 종합소득 과세표준), hasWage(근로소득 있음), year }
       2,000만원 이하: 원천징수로 끝(분리과세). 초과: 그로스업 → 비교과세 max(A, B) → 배당세액공제 → 표준세액공제(근로소득 없을 때)
       extra = 원천징수 외에 더 낼 국세(0 미만이면 0), extraTotal = 지방소득세 포함 */
    function finTax(x) {
      var I = Math.max(0, x.interest || 0), DG = Math.max(0, x.divGU || 0), DO = Math.max(0, x.divOther || 0);
      var O = Math.max(0, x.otherBase || 0);
      var F = I + DG + DO;
      var ded = O > 0 ? 0 : IT.basicDeduction;
      var hasWage = !!x.hasWage, sc = hasWage ? 0 : IT.standardTaxCredit;
      var otherCalc = basic(O);
      var otherSc = Math.min(sc, otherCalc);
      var otherTax = otherCalc - otherSc;
      var prepaid = F * FI.withholding;
      var gur = yearValue(FI.grossUpByYear, x.year == null ? R.meta.year : x.year);
      var r = { I: I, DG: DG, DO: DO, O: O, F: F, ded: ded, hasWage: hasWage, otherCalc: otherCalc, otherSc: otherSc, otherTax: otherTax,
        prepaid: prepaid, comp: F > FI.threshold };
      if (!r.comp) {
        r.gu = 0; r.finAmt = F; r.base = O; r.A = 0; r.B = 0; r.calc = 0; r.pick = 'sep'; r.dc = 0; r.stdc = 0;
        r.decided = otherTax + prepaid; r.extraRaw = 0; r.extra = 0;
      } else {
        var gu = Math.min(DG, F - FI.threshold) * gur;
        var finAmt = F + gu;
        var base = Math.max(0, O + finAmt - ded);
        var A = FI.threshold * FI.withholding + basic(base - FI.threshold);
        var Bv = F * FI.withholding + basic(base - finAmt);
        var calc = Math.max(A, Bv);
        var dc = Math.min(gu, Math.max(0, calc - Bv));
        var stdc = Math.min(sc, Math.max(0, calc - dc));
        var decided = calc - dc - stdc;
        r.gu = gu; r.finAmt = finAmt; r.base = base; r.A = A; r.B = Bv; r.calc = calc; r.pick = A >= Bv ? 'A' : 'B'; r.dc = dc; r.stdc = stdc;
        r.decided = decided; r.extraRaw = decided - otherTax - prepaid; r.extra = Math.max(0, decided - otherTax - prepaid);
      }
      r.extraLocal = r.extra * IT.local;
      r.extraTotal = r.extra + r.extraLocal;
      r.prepaidLocal = prepaid * IT.local;
      r.prepaidTotal = prepaid + r.prepaidLocal;
      return r;
    }

    /* ================= 해외주식 양도소득세 ================= */
    /* gain: 그해 양도차익(손익 통산 후, 원). o = { otherGain: 다른 해외주식 차익(더해서 통산), riaDeduction: RIA 공제액,
         roundWon: true면 차익·공제를 원 단위 반올림하고 국세·지방세를 각각 원 미만 버림(overseas-stock-tax 방식),
         incremental: true면 otherGain에 gain을 더해 늘어나는 세액만(지방세 포함 22% 한 번에, etf-vs-direct 방식) } */
    function overseasTax(gain, o) {
      o = o || {};
      var ded = OS.basicDeduction;
      if (o.incremental) {
        var oth = o.otherGain || 0;
        return { tax: (Math.max(0, gain + oth - ded) - Math.max(0, oth - ded)) * OS.rate };
      }
      var total = o.otherGain === undefined ? gain : gain + o.otherGain;
      var ria = o.riaDeduction || 0;
      if (o.roundWon) {
        var b = Math.max(0, Math.round(total) - Math.round(ria) - ded);
        var nat = Math.floor(b * OS.rateNational), loc = Math.floor(b * OS.rateLocal);
        return { base: b, national: nat, local: loc, tax: nat + loc };
      }
      var base = Math.max(0, total - ria - ded);
      return { base: base, national: base * OS.rateNational, local: base * OS.rateLocal, tax: base * OS.rate };
    }

    /* ================= 매매 비용 ================= */
    // 호가 단위: kind 'krx'(코스피·코스닥·코넥스, 'kospi' 등도 같음) | 'etf'(ETF·ETN) | 'us'(달러). 가격 < 상한인 첫 행, 없으면 마지막 행
    function tick(kind, price) {
      var T = kind === 'etf' ? TD.krxEtfTick : kind === 'us' ? TD.usTick : TD.krxTick;
      for (var i = 0; i < T.length; i++) if (price < T[i][0]) return T[i][1];
      return T[T.length - 1][1];
    }
    // 국내 매도 증권거래세·농어촌특별세. market: 'kospi' | 'kosdaq' | 'konex' | 'etf'. o.floor === false면 원 미만 버림 안 함
    function krSellTax(amount, market, o) {
      var t = TD.securitiesTransactionTax[market];
      if (!t) throw new Error('calc-v1 trade.krSellTax: 모르는 시장 ' + market);
      var fl = !(o && o.floor === false);
      var stt = fl ? Math.floor(amount * t.stt + 1e-9) : amount * t.stt;
      var rural = fl ? Math.floor(amount * t.rural + 1e-9) : amount * t.rural;
      return { stt: stt, rural: rural, tax: stt + rural };
    }

    /* ================= 국민연금 ================= */
    // 출생연도 ≤ 상한인 첫 행의 노령연금 수급개시연령
    function npsStartAge(birthYear) {
      var T = NPS.startAgeByBirthYear;
      for (var i = 0; i < T.length; i++) if (birthYear <= T[i][0]) return T[i][1];
      return T[T.length - 1][1];
    }
    // 수급 시기 조정률: offset 년(음수 = 조기 1년당 −6%, 양수 = 연기 1년당 +7.2%). o.clamp면 최대 5년으로 자름
    function timingFactor(offset, o) {
      var cl = o && o.clamp;
      if (offset < 0) return 1 - NPS.earlyReductionPerYear * (cl ? Math.min(NPS.maxEarlyYears, -offset) : -offset);
      return 1 + NPS.deferralBonusPerYear * (cl ? Math.min(NPS.maxDeferralYears, offset) : offset);
    }

    var fz = Object.freeze;
    return fz({
      version: VERSION,
      rulesVersion: R.meta && R.meta.version,
      incomeTax: fz({ basic: basic, marginalRate: marginalRate, pensionDeduction: pensionDeduction, comprehensive: comprehensive,
        dependentIncomeOk: dependentIncomeOk }),
      retirementTax: fz({ calc: retirementCalc }),
      pension: fz({ rate: pensionRate, retireRatio: retireRatio, limitYear: limitYear, payoutLimit: payoutLimit, privateTaxChoice: privateTaxChoice }),
      property: fz({ houseTaxBase: houseTaxBase }),
      nhis: fz({ propertyPoints: propertyPoints, finCounted: finCounted, premium: premium, regional: regional, employeeExtra: employeeExtra,
        dependent: dependent }),
      finIncome: fz({ tax: finTax }),
      overseasStock: fz({ tax: overseasTax }),
      trade: fz({ tick: tick, krSellTax: krSellTax }),
      nps: fz({ startAge: npsStartAge, timingFactor: timingFactor }),
    });
  }

  return Object.freeze({ version: VERSION, bind: bind });
});
