# rules.js 변경 기록

배포한 버전 폴더는 고치지 않습니다. 바뀐 값은 새 버전 폴더로 내고 여기에 적습니다. (정책: `README.md` "버전 정책")

## v2026.1 — 2026-10-19 (처음)

- 25개 계산기(ttokjaeTV 조직) 배포본에 흩어져 있던 제도 상수를 한 파일로 모음: `rules/v2026.1/rules.js`
  - 그룹: `meta`, `NHIS`, `PROPERTY`, `INCOME_TAX`, `FIN_INCOME`, `PENSION`, `RETIREMENT_INCOME_TAX`, `PENSION_SAVINGS`, `ISA`, `NPS`, `OVERSEAS_STOCK`, `TRADE`, `MARKET_DEFAULTS`
  - 기준: 2026년 귀속 소득세법, 2026년 건강보험료(2026-01-01 시행 고시), 2026-07 국민연금 기준소득월액, 2026-01-01 양도분 증권거래세, SEC fee(2026-04-04~)·FINRA TAF(2026-01-01~)
- 값은 2026-10-19 계산기 배포본과 **같은 값**(계산기 간 충돌 0건, `tests/check-values.js` 311건 일치). 계산기를 옮겨도 결과는 바뀌지 않음.
- 원문 미확인으로 `TODO 확인 필요` 표시: `NPS.A`(3,193,511), `NPS.familyBenefitSpouseMonthly`(25,550)·`familyBenefitOtherMonthly`(17,030), `FIN_INCOME.grossUpByYear[2027]`(0.11).
- 계산기 쪽 이관은 아직 하지 않음(이 버전은 상수 파일·검증 도구만).
