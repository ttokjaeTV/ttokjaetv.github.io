# 똑재TV 계산기 공용 제도 상수 (`rules/`)

세금·건강보험료·연금·국민연금·매매비용 계산에 쓰는 **숫자(요율·한도·구간표)만** 모아 둔 단일 출처입니다.
25개 계산기가 각자 코드에 적어 두던 값(7.19%, 4,591,740원, 1,500만원, 거래세 0.20% …)을 여기 한 곳에서 읽게 해서,
제도가 바뀌면 이 파일 하나만 새 버전으로 내고 계산기는 버전 번호만 올리면 되게 하는 것이 목적입니다.

- 계산 로직은 넣지 않습니다. 계산 방법(절사·하한 가드·통산 순서 등)은 각 계산기 몫입니다.
- 값은 2026-10-19 기준 계산기 배포본에 실제로 쓰인 값 그대로입니다(계산기 간 값 충돌 0건 → 옮겨도 결과가 바뀌지 않음).

## 파일

| 경로 | 내용 |
|---|---|
| `rules/v2026.1/rules.js` | 상수 본체. 브라우저에서는 전역 `TTOKJAE_RULES` 하나만 만들고, Node에서는 `module.exports`. 깊게 얼려(deep freeze) 있어 실수로 값을 바꿀 수 없음 |
| `rules/CHANGELOG.md` | 버전별 바뀐 값 |
| `rules/tests/check-values.js` | rules.js의 모든 값을 계산기 clone의 코드 값과 대조(표 출력, 불일치 시 종료 코드 1) |
| `rules/tools/scan-hardcoded.js` | 계산기 코드에 rules.js 값이 숫자로 박혀 있는 곳을 file:line으로 나열(이관 검증·회귀 감시) |

## 구조 (v2026.1)

```
TTOKJAE_RULES
├─ meta               { version: '2026.1', year: 2026, updated: '2026-10-19', units }
├─ NHIS               건강보험: healthRate, ltcRate, premiumCapMonthly, premiumFloorMonthly, floorIncomeMonthly,
│                     perPoint, propertyDeduction, propertyPointTable(60등급), finIncomeThreshold, publicPensionRatio,
│                     employeeExtraIncomeDeduction, truncUnit, dependent{income, biz, propLow, propHigh, propIncome}
├─ PROPERTY           fairMarketRatioSingleHome [[3억,0.43],[6억,0.44],[∞,0.45]], fairMarketRatioMultiHome 0.6
├─ INCOME_TAX         brackets [[상한, 세율, 누진공제]…], local 0.1, basicDeduction, elderDeduction, elderAge,
│                     standardTaxCredit, pensionIncomeDeduction [[상한, 율, 구간시작, 누적]…], pensionIncomeDeductionCap
├─ FIN_INCOME         threshold 2,000만, withholding 0.14, withholdingWithLocal 0.154, usWithholding 0.15,
│                     grossUp 0.10, grossUpByYear {2026: 0.10, 2027: 0.11}
├─ PENSION            사적연금 인출: minAge, separateLimit 1,500만, rateByAge [[70,0.055],[80,0.044],[∞,0.033]],
│                     rateByAgeNational, separateRate(·National), otherIncomeRate(·National),
│                     payoutLimitFactor 1.2, payoutLimitFreeYear 11, pre2013StartYear 6
├─ RETIREMENT_INCOME_TAX  serviceYearDeduction, convertedPayDeduction, pensionPayRatio [[10,0.7],[20,0.6],[∞,0.5]]
├─ PENSION_SAVINGS    creditRateHigh/Low, 기준 소득, creditLimitPensionSavings 600만, creditLimitTotal 900만,
│                     contributionLimit 1,800만, isaTransferCreditRate 0.1, isaTransferCreditCap 300만, irpRiskAssetLimit 0.7
├─ ISA                annualLimit, totalLimit, taxFreeGeneral, taxFreePreferential, excessRate, minHoldingYears
├─ NPS                A, aYear, incomeFloorMonthly, incomeCapMonthly, premiumRateByYear{2025..2033}, employeeShareRatio,
│                     alphaByYear{1988..2026}, startAgeByBirthYear, earlyReductionPerYear, maxEarlyYears,
│                     deferralBonusPerYear, maxDeferralYears, familyBenefitSpouseMonthly, familyBenefitOtherMonthly,
│                     minMonths, maxChunapMonths, firstYear, truncUnit
├─ OVERSEAS_STOCK     basicDeduction 250만, rate 0.22, rateNational, rateLocal, riaSaleCap, riaDeductionByPeriod
├─ TRADE              securitiesTransactionTax{kospi,kosdaq,konex,etf: {stt, rural}}, secFeePerMillionUsd,
│                     tafPerShareUsd, tafMaxUsd, tafMinUsd, krxTick, krxEtfTick, usTick
└─ MARKET_DEFAULTS    inflation 0.025 (제도 아님. 주가성장 보정·총수익 상한은 presets.js가 출처)
```

단위: 금액은 **원**(달러 값은 이름에 `Usd`), 비율은 **0~1**. 이름에 `National`이 붙은 세율은 국세만, 안 붙은 세율은 지방소득세 포함.
구간표는 계산기 코드와 같은 모양이라 리터럴을 기계적으로 바꿔 끼울 수 있습니다(예: `brackets`는 `[상한, 세율, 누진공제]`).
`propertyPointTable`의 상한은 **만원** 단위(계산기 코드와 같음). `krxTick`·`usTick`은 "가격 **<** 상한", 나머지 표는 "값 **≤** 상한"인 첫 행.

## 계산기에서 불러오기

계산기 자기 스크립트보다 **먼저** 한 줄(버전 고정 주소):

```html
<script src="https://ttokjaetv.github.io/rules/v2026.1/rules.js"></script>
<script>
  const R = TTOKJAE_RULES;
  const hi = R.NHIS.healthRate;                       // 0.0719
  function basicTax(base) {
    for (const [lim, r, d] of R.INCOME_TAX.brackets) if (base <= lim) return base * r - d;
  }
</script>
```

- build.py로 index.html을 만드는 계산기(pension-tax-sim, retire-drawdown, isa-maturity, nps-calc, covered-call, freedom, human-capital 등)는 `src/template.html`에 넣고 빌드합니다. index.html만 고치면 다음 빌드 때 사라집니다.
- 절대 https 주소라 **file://로 연 페이지에서도 그대로 동작**합니다(일반 `<script src>`는 CORS 대상이 아니고, rules.js는 fetch·`document.currentScript`·origin 같은 위치 의존 코드를 쓰지 않음). 오프라인이면 못 불러오므로, 계산기는 시작할 때 `if (!window.TTOKJAE_RULES)` 로 확인해 "기준값을 불러오지 못했습니다" 안내를 띄우는 것을 권장합니다(값 사본을 계산기에 다시 두면 단일 출처가 깨집니다).
- 전역은 `TTOKJAE_RULES` 하나만 만듭니다. 계산기가 쓰는 `RULE`·`NH`·`TAX`·`NPS` 같은 이름과 겹치지 않습니다. 같은 페이지에서 두 번 불러도 문제없고, 다른 버전을 겹쳐 불러오면 콘솔에 경고를 남기고 나중 것으로 바뀝니다.
- retire-check처럼 **다른 계산기 엔진(pension-tax-sim/src/engine.js)을 실시간으로 불러오는 페이지**는 그 엔진이 쓰는 rules 버전도 페이지에 들어 있어야 합니다. 엔진 쪽에서 rules를 쓰게 바꾸면 retire-check에도 같은 버전의 rules.js 태그를 엔진보다 먼저 넣으세요.
- 만원 단위로 계산하는 계산기(retire-check)는 `R.PENSION.separateLimit / 1e4`처럼 나눠 씁니다. % 숫자로 보여 주는 칩·옵션은 `(R.PENSION.rateByAge[0][1] * 100).toFixed(1)`처럼 화면에서 만듭니다.
- 설명 문구에 적힌 숫자('7.19%', '211.5원', '× 10%')도 가능하면 rules 값으로 만들어 넣으세요. `scan-hardcoded.js --text`로 남은 문구를 찾을 수 있습니다.

### 이관 대응표 (주요 리터럴 → rules 경로)

| 계산기 코드 | rules 경로 |
|---|---|
| FIT·EVD `RULE.brackets` / PTS·RDD `progressiveTax`의 `B` | `INCOME_TAX.brackets` |
| `RULE.finLimit` · `FIN_COMP_LINE` · `FIN_TAX_LINE` · PSD `LIMIT` | `FIN_INCOME.threshold` |
| `RULE.wh` / `TAX_KR`·`DIV_WHT`·`ETF_WH`·`etfRate`·`genTax`·`TAX.DIV`·covered-call `TAX` | `FIN_INCOME.withholding` / `FIN_INCOME.withholdingWithLocal` |
| `TAX_US`·`US_WH`·`US_DIV_WHT` | `FIN_INCOME.usWithholding` |
| `RULE.grossUp` | `FIN_INCOME.grossUp` (해마다 `grossUpByYear[연도]`) |
| `RULE.local` / `LOCAL: 1.1` | `INCOME_TAX.local` / `1 + INCOME_TAX.local` |
| `basicDed`·`BASIC_DEDUCTION`·`TAX.BASIC` / `ELDER(_DEDUCTION)` / `STD_CREDIT` | `INCOME_TAX.basicDeduction` / `elderDeduction` / `standardTaxCredit` |
| `pensionDeduction()`의 숫자 | `INCOME_TAX.pensionIncomeDeduction`, `pensionIncomeDeductionCap` |
| `RULE.hi`·`NH.hi` / `ltc` / `hiCap`·`capPremM` / `hiFloor`·`floorPrem` / `floorIncome(M)` | `NHIS.healthRate` / `ltcRate` / `premiumCapMonthly` / `premiumFloorMonthly` / `floorIncomeMonthly` |
| `perPoint` / `propDed` / `NH_PROP` | `NHIS.perPoint` / `propertyDeduction` / `propertyPointTable` |
| `nhFinMin`·`finMin`·`FIN_NHIS_LINE` / `pubRate`·`0.5 * (wage + pen)` / `extraDed` | `NHIS.finIncomeThreshold` / `publicPensionRatio` / `employeeExtraIncomeDeduction` |
| `depIncome`·`depBiz`·`depProp1`·`depProp2`·`depPropIncome` | `NHIS.dependent.income`·`biz`·`propLow`·`propHigh`·`propIncome` |
| `houseTaxBase()`의 0.43/0.44/0.45/0.6 | `PROPERTY.fairMarketRatioSingleHome` / `fairMarketRatioMultiHome` |
| `SEP_LIMIT` / `SEP_RATE` / `OTHER_RATE` (국세) | `PENSION.separateLimit` / `separateRateNational` / `otherIncomeRateNational` |
| `pensionRate(age)` 0.05/0.04/0.03, ISA·RC 5.5/4.4/3.3 | `PENSION.rateByAgeNational` / `PENSION.rateByAge` |
| `retireFactor(n)` 0.7/0.6/0.5 | `RETIREMENT_INCOME_TAX.pensionPayRatio` |
| `retirementTax()`의 근속연수·환산급여 숫자 | `RETIREMENT_INCOME_TAX.serviceYearDeduction`·`convertedPayDeduction` |
| `/ (11 − 연차) × 1.2`, `pre2013 ? 6 : 1` | `PENSION.payoutLimitFreeYear`, `payoutLimitFactor`, `pre2013StartYear` |
| `creditRate` 0.165/0.132, 600만·900만·1,800만 | `PENSION_SAVINGS.creditRateHigh/Low`, `creditLimitPensionSavings`, `creditLimitTotal`, `contributionLimit` |
| `TRANSFER_CREDIT_CAP`, `× 0.1` | `PENSION_SAVINGS.isaTransferCreditCap`, `isaTransferCreditRate` |
| `ISA_YEAR_LIMIT`·`ISA_TOTAL_LIMIT`·`freeLimit`·`isaTax` | `ISA.annualLimit`·`totalLimit`·`taxFreeGeneral`(`taxFreePreferential`)·`excessRate` |
| `NPS.A`·`B_MIN`·`B_MAX`·`SPOUSE`·`DEPENDENT`·`EARLY_PER_YEAR`·`DELAY_PER_YEAR`·`MIN_MONTHS`·`MAX_CHUNAP`·`RATE_2026` | `NPS.A`·`incomeFloorMonthly`·`incomeCapMonthly`·`familyBenefitSpouseMonthly`·`familyBenefitOtherMonthly`·`earlyReductionPerYear`·`deferralBonusPerYear`·`minMonths`·`maxChunapMonths`·`premiumRateByYear[2026]` |
| `npsAlpha()` / `npsPremiumRate()` / `npsStartAge()`·`npsLegalAge()` / `npsFactor()` | `NPS.alphaByYear` / `premiumRateByYear` / `startAgeByBirthYear` / `earlyReductionPerYear`·`deferralBonusPerYear` |
| OST `TAX.basic`·`natRate`·`locRate`·`riaCap`·`RIA_PERIODS` / `CG_DED`·`CG_RATE`·`CGT_DED`·`CGT_RATE` | `OVERSEAS_STOCK.*` |
| TC `KR_TAX` / `TAF_MAX` / `DEF.sec`·`DEF.taf` / `krTick()` | `TRADE.securitiesTransactionTax` / `tafMaxUsd` / `secFeePerMillionUsd`·`tafPerShareUsd` / `krxTick`·`krxEtfTick` |
| 물가 기본값 2.5 | `MARKET_DEFAULTS.inflation` (× 100) |

## Node·테스트에서 쓰기

```js
// 허브 repo를 clone해 둔 경우
const R = require('../ttokjaetv.github.io/rules/v2026.1/rules.js');

// 또는 고정 주소에서 받아서 (버전 폴더는 바뀌지 않으므로 캐시해도 안전)
const https = require('https'), vm = require('vm');
https.get('https://ttokjaetv.github.io/rules/v2026.1/rules.js', res => {
  let src = ''; res.on('data', c => (src += c)).on('end', () => {
    const m = { exports: {} };
    vm.runInNewContext(src, { module: m });
    const R = m.exports;   // R.NHIS.healthRate …
  });
});
```

계산기 `src/test.js`에서 브라우저처럼 전역으로 쓰는 엔진을 시험할 때는 `global.TTOKJAE_RULES = require(…)`를 엔진보다 먼저 실행합니다.

### 검증 도구

```bash
# rules.js ↔ 계산기 코드 값 대조 (clone 폴더 기본값: ../../../_점검/calc-verify/consistency/repos 또는 환경변수 TTOKJAE_REPOS)
node rules/tests/check-values.js [clone 폴더] [--rules rules/v2026.2/rules.js] [--only] [--allow-missing]

# 하드코딩 남은 곳 (이관 진행 확인·회귀 감시)
node rules/tools/scan-hardcoded.js --all <clone 폴더> [--summary] [--text] [--json 결과.json] [--fail-on-hit]
node rules/tools/scan-hardcoded.js <repo 경로> …
```

- `check-values.js`는 **이관 전 기준선**입니다. 계산기가 리터럴 대신 `TTOKJAE_RULES`를 읽게 바뀌면 그 항목은 '패턴 없음'이 되는 게 정상이므로 `--allow-missing`으로 돌립니다. 맨 아래 "rules.js 자체" 행(국세×1.1 = 지방세 포함 세율, 누진공제 연속성, 60등급, 동결 여부)은 항상 통과해야 합니다.
- `scan-hardcoded.js`는 이관이 끝난 계산기에서 0건이어야 합니다(`--fail-on-hit`). `src/test.js` 같은 테스트 파일은 기대값을 숫자로 쓰는 게 맞아서 기본으로 제외합니다. 2,000만·0.15처럼 흔한 숫자는 세금·건보 문맥이 있는 줄에서만 잡으므로 완벽한 목록은 아니고, 놓친 곳은 사람이 한 번 더 봐야 합니다.

## 버전 정책

1. **배포한 버전 폴더는 절대 고치지 않습니다.** `v2026.1/rules.js`가 한 번 올라가면 오타 수정이라도 새 폴더로 냅니다. 계산기가 고정 주소로 불러오므로, 옛 폴더를 고치면 검증하지 않은 계산기 결과가 말없이 바뀝니다.
2. 바꿀 값이 생기면 새 폴더를 만듭니다.
   - 같은 해 안의 개정·고시 반영: `v2026.2`, `v2026.3` …
   - 새해 기준값: `v2027.1`
3. 계산기는 자기 `<script src>`의 버전 번호를 올리고, 결과가 어떻게 달라지는지 확인한 뒤 배포합니다. 계산기마다 따로 올려도 됩니다(옛 버전 폴더는 계속 남아 있음).
4. 옛 버전 폴더는 지우지 않습니다(옛 버전을 고정한 계산기·북마크가 깨짐).
5. 키 이름을 바꾸거나 빼는 변경은 하지 않는 것을 원칙으로 합니다. 꼭 필요하면 새 버전에서 새 키를 추가하고 옛 키를 한동안 같이 둡니다.

## 해마다 갱신하는 순서 (예: 2027년)

1. `rules/v2026.x`를 통째로 복사해 `rules/v2027.1/`을 만든다.
2. 새 파일에서 `meta.version`·`meta.year`·`meta.updated`를 바꾸고, 바뀐 값을 고친다. **값마다 주석의 근거(법령·고시명, 시행일)를 같이 고친다.** 원문을 확인하지 못한 값에는 `// TODO 확인 필요`를 단다.
   - 해마다 바뀌는 것: 건보료율·장기요양률·상한·하한·점수당 금액(1월), 국민연금 A값·부양가족연금(1월)·기준소득월액 상·하한(7월), SEC fee(보통 4월·10월)·TAF(1월), 세법개정(1월 시행분: 세율·공제·한도·그로스업 `grossUpByYear` 등).
   - 표로 들고 있는 연도별 값(`premiumRateByYear`, `alphaByYear`, `grossUpByYear`)은 새 연도 행을 추가한다.
3. `CHANGELOG.md`에 바뀐 키, 이전 값 → 새 값, 근거를 적는다.
4. `node rules/tests/check-values.js --rules rules/v2027.1/rules.js --only --allow-missing`
   → 바꾼 값만 불일치로 나와야 한다(계산기가 아직 리터럴을 들고 있는 곳). "rules.js 자체" 행은 모두 통과해야 한다.
   필요하면 `tests/check-values.js`의 기본 `--rules` 경로를 새 버전으로 바꾼다.
5. 허브 repo에 새 폴더만 커밋·배포한다(옛 폴더 diff가 없어야 함: `git diff --stat rules/v2026.*`).
6. 계산기마다 `<script src>` 버전을 올리고(빌드형은 `src/template.html`), 계산기 `src/test.js`·화면 검증 후 배포한다. 화면 문구에 연도·값이 적혀 있으면 같이 고친다.
7. 다 옮긴 뒤 `scan-hardcoded.js --all <clone 폴더> --summary`로 남은 하드코딩이 없는지 확인한다.

## 지금 원문을 확인하지 못한 값 (`TODO 확인 필요`)

계산기 간 값은 모두 같지만, 2026-10-19 전수 점검에서 고시 원문을 찾지 못한 값입니다. 값은 계산기와 같게 두었습니다.

- `NPS.A` 3,193,511원 (2026년 A값)
- `NPS.familyBenefitSpouseMonthly` 25,550원 · `NPS.familyBenefitOtherMonthly` 17,030원 (2026년 부양가족연금액)
- `FIN_INCOME.grossUpByYear[2027]` 0.11 (2027년 배당가산율 11%, 아직 어떤 계산기도 계산에 쓰지 않음)

## rules.js가 해결하지 않는 것 (계산 방식 차이)

값은 같아도 계산 방식이 다른 곳은 그대로입니다(점검 inventory §8·§9).

- 지역 건보 하한: 20,160 ÷ 7.19% = 280,389원이라 소득월액 28만~28.04만 구간은 `max(하한, 소득월액 × 요율)` 가드가 필요(FIT·EVD·PTS·RDD 모두 2026-10-19 기준 반영, 새 계산기도 같은 가드를 둘 것).
- 10원 미만 절사: FIT·EVD만 적용(`NHIS.truncUnit`), PTS·RDD는 절사 없음.
- 표준세액공제 7만원: PTS·RDD는 차감, FIT·EVD는 미적용.
- 세액공제율 기본 선택값: isa-maturity 13.2%, retire-check 16.5%.
- trading-cost는 코넥스를 선택지에 두지 않음(rules에는 `konex` 있음).
