# rules.js 변경 기록

배포한 버전 폴더는 고치지 않습니다. 바뀐 값은 새 버전 폴더로 내고 여기에 적습니다. (정책: `README.md` "버전 정책")

## calc-v1.js — 2026-10-20 (값 변경 없음)

- 공용 계산 엔진 추가(`rules/calc-v1.js`, 전역 `TTOKJAE_CALC`, `bind(R)` — rules v2026.2 이상). 누진세·한계세율·연금소득공제·연금소득 종합과세(표준세액공제·경로우대·물가 배수 kx)·배우자공제 소득요건·퇴직소득세·연금소득세율·퇴직소득세 감면 비율·연금수령연차·수령한도·과세 방식 선택·주택 과세표준·재산 점수·건보 금융소득 판정·건보료(지역·직장 보수 외, 10원 버림)·피부양자·금융소득종합과세·해외주식 양도세·호가·거래세·국민연금 개시 나이·조기·연기 조정률. 함수 표는 README.
- 연산 순서는 2026-10-20 계산기 식과 같음: pension-tax-sim·retire-drawdown·fin-income-tax·etf-vs-direct·overseas-stock-tax·trading-cost·nps-calc의 git HEAD 함수와 무작위·경계값 비교 Object.is 일치(`tests/calc-compare.js`).
- 시험 `tests/calc-test.js` + `tests/calc-cases/*.json`(법령 손계산 A·공개 예시 C·회귀값 D), 허브 자동 검사 `.github/workflows/hub-check.yml`(불변 검사 `tools/check-immutable.js` 포함).
- 도구: `scan-hardcoded.js`가 파일 경로 인자를 받음, `check-values.js --self-only`('rules.js 자체' 행만).

## v2026.2 — 2026-10-20

v2026.1 값은 모두 그대로이고 키만 추가했습니다(옮겨도 결과가 바뀌지 않음). 계산기는 새 키가 필요할 때만 올리면 됩니다.

- 추가 `NPS.bWeightUntilYear` 1998 · `NPS.bWeightOld` 0.75 — 1998년 이전 가입기간 기본연금액 2.4 × (A + 0.75B) (국민연금법 부칙 1998.12.31., 국민연금공단 '연금급여' 안내). nps-calc가 사용.
- 추가 `INCOME_TAX.dependentIncomeLimit` 100만원 — 배우자·부양가족 기본공제 소득요건(소득세법 제50조①). retire-drawdown이 사용.
- `TODO 확인 필요` 해제: `NPS.A` 3,193,511원, 부양가족연금 배우자 연 306,630원(월 25,550원)·자녀·부모 연 204,360원(월 17,030원) — 보건복지부 국민연금 급여 안내에서 확인.
- 주석 수정: 비례상수 → 소득대체율 환산식(비례상수 × (1 + B 반영률) ÷ 6; 1999년 이후 = 비례상수 ÷ 3).
- 남은 `TODO 확인 필요`: `FIN_INCOME.grossUpByYear[2027]` 0.11 (개정 원문 미확인).

## fill-v1.js — 2026-10-19 (값 변경 없음)

- 정적 HTML 설명 문구의 숫자를 `data-rule` 식으로 rules 값에서 채우는 도우미 추가(`rules/fill-v1.js`, 시험 `tests/fill-test.js`).
- `tools/scan-hardcoded.js --text`가 `data-rule` 요소 안 글자를 세지 않도록 수정.

## v2026.1 — 2026-10-19 (처음)

- 25개 계산기(ttokjaeTV 조직) 배포본에 흩어져 있던 제도 상수를 한 파일로 모음: `rules/v2026.1/rules.js`
  - 그룹: `meta`, `NHIS`, `PROPERTY`, `INCOME_TAX`, `FIN_INCOME`, `PENSION`, `RETIREMENT_INCOME_TAX`, `PENSION_SAVINGS`, `ISA`, `NPS`, `OVERSEAS_STOCK`, `TRADE`, `MARKET_DEFAULTS`
  - 기준: 2026년 귀속 소득세법, 2026년 건강보험료(2026-01-01 시행 고시), 2026-07 국민연금 기준소득월액, 2026-01-01 양도분 증권거래세, SEC fee(2026-04-04~)·FINRA TAF(2026-01-01~)
- 값은 2026-10-19 계산기 배포본과 **같은 값**(계산기 간 충돌 0건, `tests/check-values.js` 311건 일치). 계산기를 옮겨도 결과는 바뀌지 않음.
- 원문 미확인으로 `TODO 확인 필요` 표시: `NPS.A`(3,193,511), `NPS.familyBenefitSpouseMonthly`(25,550)·`familyBenefitOtherMonthly`(17,030), `FIN_INCOME.grossUpByYear[2027]`(0.11).
- 계산기 쪽 이관은 아직 하지 않음(이 버전은 상수 파일·검증 도구만).
