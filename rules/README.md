# 똑재TV 계산기 공용 제도 상수 (`rules/`)

세금·건강보험료·연금·국민연금·매매비용 계산에 쓰는 **숫자(요율·한도·구간표)만** 모아 둔 단일 출처입니다.
25개 계산기가 각자 코드에 적어 두던 값(7.19%, 4,591,740원, 1,500만원, 거래세 0.20% …)을 여기 한 곳에서 읽게 해서,
제도가 바뀌면 이 파일 하나만 새 버전으로 내고 계산기는 버전 번호만 올리면 되게 하는 것이 목적입니다.

- 계산 로직은 넣지 않습니다. 계산 방법(절사·하한 가드·통산 순서 등)은 각 계산기 몫입니다.
- 값은 2026-10-19 기준 계산기 배포본에 실제로 쓰인 값 그대로입니다(계산기 간 값 충돌 0건 → 옮겨도 결과가 바뀌지 않음).

## 파일

| 경로 | 내용 |
|---|---|
| `rules/v2026.1/rules.js`, `rules/v2026.2/rules.js` | 상수 본체(최신 v2026.2 = v2026.1 + 키 추가, 값 변경 없음). 브라우저에서는 전역 `TTOKJAE_RULES` 하나만 만들고, Node에서는 `module.exports`. 깊게 얼려(deep freeze) 있어 실수로 값을 바꿀 수 없음 |
| `rules/CHANGELOG.md` | 버전별 바뀐 값 |
| `rules/tests/check-values.js` | rules.js의 모든 값을 계산기 clone의 코드 값과 대조(표 출력, 불일치 시 종료 코드 1) |
| `rules/tools/scan-hardcoded.js` | 계산기 코드에 rules.js 값이 숫자로 박혀 있는 곳을 file:line으로 나열(이관 검증·회귀 감시) |
| `rules/fill-v1.js` | 정적 HTML 설명 문구의 숫자를 rules 값으로 채우는 도우미(`data-rule` 속성). 계산은 안 하고 글자만 바꿈. 배포 후 고치지 않음(바꿀 일이 생기면 `fill-v2.js`) |
| `rules/tests/fill-test.js` | fill-v1.js 식 계산·표시 형식 시험 |
| `rules/calc-v1.js` | 공용 계산 엔진(전역 `TTOKJAE_CALC`, `TTOKJAE_CALC.bind(TTOKJAE_RULES)`): 누진세·연금소득공제·종합과세·퇴직소득세·연금 인출 과세·건보료·피부양자·금융소득종합과세·해외주식 양도세·거래세·호가·국민연금 개시 나이. rules v2026.2 이상 필요. 배포 후 고치지 않음(바꿀 일이 생기면 `calc-v2.js`) |
| `rules/calc-v2.js` | calc-v1과 같고 `finIncome.tax`의 표준세액공제에 소득세법 제61조② 한도(공제기준산출세액)를 넣음(2026-10-23). 새로 쓰는 계산기는 v2 |
| `rules/tests/calc-test.js`, `rules/tests/calc-cases/*.json` | calc-v*.js 기준 답안 시험(엔진 파일마다 따로 실행, 케이스의 `calc: ["calc-v1"]`은 그 엔진에서만)(법령 손계산·공개 예시·회귀값) + 구조 시험 |
| `rules/tests/calc-compare.js` | calc-v1.js ↔ 계산기 기존 구현(git HEAD) 무작위·경계값 비교 (계산기 clone 필요, 계산기를 엔진으로 옮기기 전에 돌림) |
| `rules/tools/check-immutable.js` | 배포한 `rules/v*/`·`fill-v*.js`·`calc-v*.js`가 수정·삭제되지 않았는지 (허브 CI) |
| `.github/workflows/hub-check.yml` | 허브 자동 검사(push·PR): fill 시험, calc 시험, rules.js 자체 일관성, calc 하드코딩, 불변 검사 |

## 구조 (v2026.1)

```
TTOKJAE_RULES
├─ meta               { version: '2026.1', year: 2026, updated: '2026-10-19', units }
├─ NHIS               건강보험: healthRate, ltcRate, premiumCapMonthly, premiumFloorMonthly, floorIncomeMonthly,
│                     perPoint, propertyDeduction, propertyPointTable(60등급), finIncomeThreshold, publicPensionRatio,
│                     employeeExtraIncomeDeduction, truncUnit, dependent{income, biz, propLow, propHigh, propIncome}
├─ PROPERTY           fairMarketRatioSingleHome [[3억,0.43],[6억,0.44],[∞,0.45]], fairMarketRatioMultiHome 0.6
├─ INCOME_TAX         brackets [[상한, 세율, 누진공제]…], local 0.1, basicDeduction, elderDeduction, elderAge,
│                     standardTaxCredit, dependentIncomeLimit(v2026.2~), pensionIncomeDeduction [[상한, 율, 구간시작, 누적]…], pensionIncomeDeductionCap
├─ FIN_INCOME         threshold 2,000만, withholding 0.14, withholdingWithLocal 0.154, usWithholding 0.15,
│                     grossUp 0.10, grossUpByYear {2026: 0.10, 2027: 0.11}
├─ PENSION            사적연금 인출: minAge, separateLimit 1,500만, rateByAge [[70,0.055],[80,0.044],[∞,0.033]],
│                     rateByAgeNational, separateRate(·National), otherIncomeRate(·National),
│                     payoutLimitFactor 1.2, payoutLimitFreeYear 11, pre2013StartYear 6
├─ RETIREMENT_INCOME_TAX  serviceYearDeduction, convertedPayDeduction, pensionPayRatio [[10,0.7],[20,0.6],[∞,0.5]]
├─ PENSION_SAVINGS    creditRateHigh/Low, 기준 소득, creditLimitPensionSavings 600만, creditLimitTotal 900만,
│                     contributionLimit 1,800만, isaTransferCreditRate 0.1, isaTransferCreditCap 300만, irpRiskAssetLimit 0.7
├─ ISA                annualLimit, totalLimit, taxFreeGeneral, taxFreePreferential, excessRate, minHoldingYears
├─ NPS                A, aYear, bWeightUntilYear·bWeightOld(v2026.2~, 1998년 이전 B 0.75), incomeFloorMonthly, incomeCapMonthly, premiumRateByYear{2025..2033}, employeeShareRatio,
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

### 설명 문구 숫자 채우기 (`fill-v1.js`)

정적 HTML 문단·표·칩 글자에 적힌 제도 숫자는 `fill-v1.js`가 rules 값으로 채웁니다. rules.js 태그 **바로 다음**에 넣습니다.

```html
<script src="https://ttokjaetv.github.io/rules/v2026.1/rules.js"></script>
<script src="https://ttokjaetv.github.io/rules/fill-v1.js"></script>
…
건보료율 <span data-rule="NHIS.healthRate*100">7.19</span>% · 연 <span data-rule="PENSION.separateLimit/1e4">1,500</span>만원
최고 <span data-rule="INCOME_TAX.brackets.7.1*(1+INCOME_TAX.local)*100">49.5</span>%
```

- `data-rule`: 숫자·rules 경로(배열은 번호)·`+ - * /`·괄호만 쓰는 식(eval 안 씀). `data-fmt`: 생략(쉼표·필요한 소수) / `fN`(소수 N자리, 쉼표 없음) / `nN`(쉼표 + 소수 N자리) / `i`(연도). `data-rule-attr="placeholder"`면 글자 대신 그 속성을 바꿈.
- 원래 글자는 그대로 둡니다. rules.js를 못 불러오면 원래 글자가 보입니다.
- 새 rules 버전으로 올렸을 때 바뀐 문구는 페이지 주소에 `?rulescheck`를 붙이면 콘솔 표로 볼 수 있습니다.
- `<title>`·`<meta>`(검색·공유용), 확인 날짜('2026-10-12 확인'), 시행 연도 같은 역사적 사실은 채우지 않습니다. 해가 바뀌면 사람이 고칩니다.
- `scan-hardcoded.js --text`는 `data-rule` 요소 안 글자를 세지 않습니다.

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

## 공용 계산 엔진 (`calc-v1.js` · `calc-v2.js`)

> **calc-v2 (2026-10-23)**: calc-v1과 함수·필드가 같고 `finIncome.tax` 하나만 다릅니다. 근로소득 없는 종합소득자의 표준세액공제(제59조의4⑨)를 소득세법 제61조②·시행령 제119조의3②의 **공제기준산출세액**(산출세액 − 산출세액 × 제62조로 원천징수세율을 적용받는 이자·배당소득금액 ÷ 종합소득금액) 안에서만 뺍니다. 비교과세 B(이자·배당 전부 원천징수세율)가 고르고 다른 소득이 없으면 공제 0 → 5월 환급 없음. 결과에 `capBase`(공제기준산출세액) 필드 추가. 아래 설명의 calc-v1은 v2에도 그대로 해당합니다.

rules.js가 숫자만 들고 있다면, calc-v1.js는 그 숫자로 하는 **법에 정해진 계산**(세액·공제·건보료·한도·호가)을 한 곳에 둡니다.
계산기마다 같은 식을 따로 적어 두던 것(누진세 표 돌기, 연금소득공제, 퇴직소득세, 건보료 10원 버림 …)을 이 함수로 부르면 식이 하나가 됩니다.

```html
<script src="https://ttokjaetv.github.io/rules/v2026.2/rules.js"></script>
<script src="https://ttokjaetv.github.io/rules/fill-v1.js"></script>
<script src="https://ttokjaetv.github.io/rules/calc-v2.js"></script>   <!-- rules.js 다음, 계산기 엔진보다 먼저 -->
<script>
if (!window.TTOKJAE_RULES || !window.TTOKJAE_CALC) {
  var TJR_MSG = !window.TTOKJAE_RULES ? '기준값 파일(rules.js)을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침해 주세요.'
    : '계산 엔진 파일(calc-v1.js)을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침해 주세요.';
  /* … 기존 안내 블록 그대로 (tjrShow, throw) … */
}
const TR = TTOKJAE_RULES;
const CALC = TTOKJAE_CALC.bind(TR);            // 이름은 계산기 안에서 겹치지 않게. 같은 R이면 같은 객체(캐시)
CALC.retirementTax.calc(3e8, 30).national      // 9,862,500
</script>
```

- 전역은 `TTOKJAE_CALC` 하나(`{ version: 'calc-v1', bind(R) }`), Node는 `module.exports`. 엔진은 전역 `TTOKJAE_RULES`를 직접 보지 않고 `bind(R)`로 받은 값만 씁니다.
- `bind(R)`는 필요한 키를 모두 확인합니다. 없으면 `rules v2026.2 이상 필요: <키> 없음` 오류(v2026.1은 `INCOME_TAX.dependentIncomeLimit`이 없어 거부).
- 시뮬레이터(연도별 인출·적립, 인출 순서 탐색)와 계산기 관례는 넣지 않습니다. 관례는 계산기 몫이고, 똑재TV 계산기 공통 관례는 다음과 같습니다.
  - **'○세까지 계획'은 그 나이 해까지 포함**(retire-drawdown·freedom·retire-check·retirement 통일).
  - **실질(오늘 돈) 환산은 연말 잔액을 그해 연말 물가 지수로** 나눔.
  - 세법 기준금액 물가연동(kx)·건보 명목 기준(k)은 계산기가 켜고 끄는 옵션입니다(엔진은 받은 배수로 계산만).
- 숫자 리터럴로 제도 값을 두지 않습니다(0·1·12개월·1e4 만원·1e-9 끝수 오차만, `calc-test.js`가 검사). DOM·fetch·Date·console을 쓰지 않습니다.
- **부동소수 연산 순서**는 2026-10-20 계산기 식과 같게 맞췄습니다(retire-drawdown은 인출 순서 18개 후보 점수로 하나를 골라 마지막 비트 차이도 결과를 뒤집을 수 있음). 계산기를 옮길 때는 `tests/calc-compare.js`로 기존 함수와 Object.is 일치를 먼저 확인하고, 옛 이름·인자·단위는 얇은 껍데기 함수로 남깁니다.

### 함수 (calc-v1)

금액 원, 비율 0~1, 나이 만 나이. `national` = 국세, `total` = 지방소득세 포함.

| 함수 | 결과 | 옵션·비고 |
|---|---|---|
| `incomeTax.basic(base)` | 산출세액(국세) | 0 이하·NaN → 0 |
| `incomeTax.marginalRate(base)` | 한계세율 | 0 이하 → 첫 구간 |
| `incomeTax.pensionDeduction(total)` | 연금소득공제(한도 900만 포함) | |
| `incomeTax.comprehensive({pension, otherIncome, age, extraDeduction, standardCredit, kx})` | `{pensionTotal, pensionDeduction, income, deduction, base, calc, credit, national, local, total, kx}` | `pension`: 숫자 또는 `[공적, 사적, …]`(합산). 과세표준 = max(0, 소득금액 − (기본공제 + 70세 이상 경로우대) − extraDeduction). `standardCredit`: 기본 true(7만원), false, 또는 금액. `kx`: 금액을 ÷kx로 계산하고 `total`만 ×kx(다른 필드는 ÷kx 기준) |
| `incomeTax.dependentIncomeOk(income)` | 참거짓 | 배우자·부양가족 기본공제 소득요건(소득금액 100만 이하) |
| `retirementTax.calc(severance, years)` | `{years, serviceDed, converted, convDed, base, national, total}` | 근속연수 올림·최소 1년 |
| `pension.rate(age, {withLocal})` | 연금소득세율 | 기본 국세(5·4·3%), `withLocal`이면 5.5·4.4·3.3% 표(국세×1.1과 끝자리 다를 수 있음). NaN → undefined |
| `pension.retireRatio(paidYears)` | 퇴직소득세 납부 비율 0.7·0.6·0.5 | 실제 수령연차 |
| `pension.limitYear({age, startAge, pre2013})` | 연금수령연차 | `startAge` 기본 `PENSION.minAge`, `pre2013`이면 6년차부터 |
| `pension.payoutLimit(balance, limitYear)` | 연금수령한도 | 11년차부터 Infinity |
| `pension.privateTaxChoice({amount, age, comp, kx})` | `{tax, method: 'comp'\|'low'\|'sep', alt, limit}` | `comp` = 종합과세로 늘어나는 세액(지방세 포함, 계산기가 계산). 1,500만(×kx) 이하 저율, 초과 16.5% 분리과세와 비교해 작은 쪽(같으면 분리과세) |
| `property.houseTaxBase(gongsi, multi)` | 주택 재산세 과세표준 | 1주택 43·44·45%, 다주택 60% |
| `nhis.propertyPoints(taxBase)` | 재산 부과점수 | |
| `nhis.finCounted(fin, {counted, k})` | 건보 반영 이자·배당 | 1,000만(÷k) 초과면 `counted`(기본 fin; 종합과세면 그로스업 포함액), 아니면 0 |
| `nhis.premium(m, {regional, trunc})` | `{health, ltc, monthly, annual, atFloor, atCap}` | 소득월액 → 보험료. `regional`(기본 false)이면 하한. `trunc: false`면 10원 버림 안 함 |
| `nhis.regional({pub, wage, fin, other, taxBase, k, trunc})` | `{income, m, incPrem, pts, propPrem, health, ltc, total, floor, atCap}` | 공적연금·근로 50%, 금융 1인별 1,000만 판정(엔진이 거름), 소득분·재산분 각각 버림 → 장기요양 다시 버림 |
| `nhis.employeeExtra({fin, biz, wage, pension, trunc})` | `{S, ev, m, health, ltc, monthly, annual, atFloor, atCap}` | 직장가입자 보수 외 소득 2,000만 초과분 |
| `nhis.dependent(people, {k})` | `{people: [{inc, biz, bizReg, tb, bizOk, incOk, propOk, ok}], incAll, ok}` | 사람 `{pub, wage, fin, other(사업소득), bizReg, taxBase}`. 소득 요건 부부 함께, 재산 각자. 기준 금액 ÷k |
| `finIncome.tax({interest, divGU, divOther, otherBase, hasWage, year})` | fin-income-tax `finTax`와 같은 필드(`extra`, `extraTotal`, `A`, `B`, `gu`, `dc`, `stdc` …, v2는 `capBase` 추가). v2: `stdc` ≤ 공제기준산출세액(제61조②) | 그로스업율 `grossUpByYear[year]`(기본 `meta.year`, 표 밖이면 가까운 끝 해) |
| `overseasStock.tax(gain, {otherGain, riaDeduction, roundWon, incremental})` | `{base, national, local, tax}` (`incremental`이면 `{tax}`) | `roundWon`: 원 단위 반올림·원 미만 버림(overseas-stock-tax). `incremental`: otherGain 위에 gain을 더해 늘어나는 세액(etf-vs-direct) |
| `trade.tick(kind, price)` | 호가 단위 | `'krx'`(기본)·`'etf'`·`'us'` |
| `trade.krSellTax(amount, market, {floor})` | `{stt, rural, tax}` | `market`: kospi·kosdaq·konex·etf. 기본 원 미만 버림 |
| `nps.startAge(birthYear)` | 노령연금 수급개시연령 | |
| `nps.timingFactor(offset, {clamp})` | 조기·연기 조정률 | `clamp`면 최대 5년(nps-calc), 아니면 그대로(retire-drawdown) |

계산기마다 다른 동작(10원 버림·표준세액공제·물가 배수·금융소득 거르는 시점)은 옵션으로 둡니다. 옵션 기본값은 2026-10-20에 통일한 기준(10원 버림 켬, 표준세액공제 켬)입니다.

### 시험

```bash
node rules/tests/calc-test.js                 # 설치된 rules 버전 전부 (v2026.2 미만은 bind 거부 확인)
node rules/tests/calc-test.js --rules rules/v2026.2/rules.js --verbose
node rules/tests/calc-compare.js [--repos <계산기 폴더>] [--n 5000]   # 계산기 git HEAD 함수와 Object.is 비교
node rules/tools/scan-hardcoded.js rules/calc-v1.js --fail-on-hit
```

`calc-cases/*.json`은 `{ "year": 2026, "cases": [{ fn, input, expect, source, note, tol?, exact? }] }`. 등급 `source`: A 법령 손계산(식을 note에) · B 공식 모의계산 · C 금융사 공개 예시 · D 현재 계산기 출력 회귀값(정답 아님, `exact`). 그해(`year`) 법령 값으로 만든 답이라 rules `meta.year`가 다르면 건너뜁니다. 새해 rules를 내면 새 연도 사례 파일을 추가합니다.

### 버전 정책 (calc)

- `calc-v1.js`는 배포 후 **고치지 않습니다**(rules 버전 폴더와 같음, 허브 CI 불변 검사가 막음). 계산 방식·옵션 기본값·연산 순서를 바꿀 일이 생기면 `calc-v2.js`를 새로 내고, 계산기가 하나씩 옮깁니다.
- 새 rules 버전(v2026.3, v2027.1 …)은 calc-v1과 같이 씁니다. 키를 빼거나 이름을 바꾸지 않는 한(rules 버전 정책 5) calc-v1이 그대로 읽습니다. 새 키가 꼭 필요한 계산은 calc-v2에서.

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
calc-v1.js를 쓰는 계산기는 같은 로더로 `global.TTOKJAE_CALC`도 엔진보다 먼저 둡니다(retire-drawdown `src/test.js` 참고: 페이지의 `<script src>`에서 `rules/v…/rules.js`와 `rules/calc-v….js` 경로를 읽고, 위쪽 폴더의 허브 clone → 없으면 고정 주소 순으로 찾음). 자동 검사(rules-guard)는 허브를 저장소 안 `ttokjaetv.github.io/`에 받아 두므로 clone 경로로 찾습니다. **그래서 새 calc 파일은 허브에 먼저 배포한 뒤 계산기를 배포합니다.**

### 검증 도구

```bash
# rules.js ↔ 계산기 코드 값 대조 (clone 폴더 기본값: ../../../../_점검/calc-verify/consistency/repos 또는 환경변수 TTOKJAE_REPOS)
node rules/tests/check-values.js [clone 폴더] [--rules rules/v2026.2/rules.js] [--only] [--allow-missing]
node rules/tests/check-values.js --rules rules/v2026.2/rules.js --self-only   # 'rules.js 자체' 행만 (clone 없이, 허브 CI)

# 하드코딩 남은 곳 (이관 진행 확인·회귀 감시)
node rules/tools/scan-hardcoded.js --all <clone 폴더> [--summary] [--text] [--json 결과.json] [--fail-on-hit]
node rules/tools/scan-hardcoded.js <repo 경로> …
node rules/tools/scan-hardcoded.js rules/calc-v1.js --fail-on-hit                # 파일 하나만 (공용 엔진 검사)

# 배포한 공용 파일 불변 검사 (허브 CI와 같음)
node rules/tools/check-immutable.js <기준 커밋> [<대상 커밋>]                    # 대상 생략 = 작업 폴더
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
5. 키 이름을 바꾸거나 빼는 변경은 하지 않는 것을 원칙으로 합니다. 꼭 필요하면 새 버전에서 새 키를 추가하고 옛 키를 한동안 같이 둡니다. (calc-v1.js가 읽는 키를 빼면 그 버전에서 `bind`가 거부합니다.)
6. `fill-v1.js`·`calc-v1.js`도 같습니다. 배포 후 고치지 않고 `fill-v2.js`·`calc-v2.js`로 냅니다. 허브 자동 검사(`hub-check.yml`)의 불변 검사가 이미 커밋된 `rules/v*/`·`fill-v*.js`·`calc-v*.js`의 수정·삭제를 실패로 막습니다(새 파일 추가는 통과).

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

- (확인됨, 2026-10-20) `FIN_INCOME.grossUpByYear[2027]` 0.11 — 2027-01-01 이후 지급받는 배당부터 배당가산율 10% → 11%(법인세율 인상에 따른 조정, 한국세무사회 「2026 달라지는 세금제도」). v2026.x 파일 주석의 'TODO 확인 필요'는 배포 후 불변 원칙 때문에 그대로이며, 다음 버전(v2027.1)에서 지운다. fin-income-tax·etf-vs-direct는 기준 연도 표(`grossUpByYear[meta.year]`)를 읽으므로 v2027.1로 올리면 11%가 자동 적용된다(화면 설명의 `RULE.grossUp`도 같이 확인).
- 남은 확인 필요: 지역 건보료 10원 미만 버림 순서(소득분·재산분 각각 vs 합산 뒤 한 번, 월 최대 10원 차이) — 지금은 각각 버림, 실제 고지서로 확인 예정
- (v2026.2에서 해제) `NPS.A` 3,193,511원, 부양가족연금 25,550원·17,030원 — 보건복지부 국민연금 급여 안내로 확인

## rules.js가 해결하지 않는 것 (계산 방식 차이)

값은 같아도 계산 방식이 다른 곳은 그대로입니다(점검 inventory §8·§9).

- 지역 건보 하한: 20,160 ÷ 7.19% = 280,389원이라 소득월액 28만~28.04만 구간은 `max(하한, 소득월액 × 요율)` 가드가 필요(FIT·EVD·PTS·RDD 모두 2026-10-19 기준 반영, 새 계산기도 같은 가드를 둘 것).
- 10원 미만 절사: 2026-10-20부터 FIT·EVD·PTS·RDD 모두 적용(소득분·재산분 각각, 장기요양은 버린 건강보험료 기준으로 다시 버림). calc-v1 `nhis.*`의 기본값.
- 표준세액공제 7만원: 2026-10-20부터 PTS·RDD·FIT·EVD 모두 차감(근로소득 없는 경우). calc-v1 `incomeTax.comprehensive`·`finIncome.tax`의 기본값. 2026-10-23부터 FIT·EVD는 calc-v2로 금융소득종합과세 때 제61조② 한도 적용(B가 고르고 다른 소득이 없으면 0).
- 세액공제율 기본 선택값: isa-maturity 13.2%, retire-check 16.5%.
- trading-cost는 코넥스를 선택지에 두지 않음(rules에는 `konex` 있음).
