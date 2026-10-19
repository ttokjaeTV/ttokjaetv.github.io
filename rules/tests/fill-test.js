#!/usr/bin/env node
// fill-v1.js 식 계산·표시 형식 시험:  node rules/tests/fill-test.js [--rules rules/v2026.1/rules.js]
'use strict';
const path = require('path');
const i = process.argv.indexOf('--rules');
const R = require(path.resolve(i > 0 ? process.argv[i + 1] : path.join(__dirname, '../v2026.1/rules.js')));
const { evaluate, format } = require('../fill-v1.js');
let bad = 0, n = 0;
const show = (expr, fmt) => format(evaluate(expr, R), fmt);
function eq(expr, fmt, want) {
  n++;
  let got;
  try { got = show(expr, fmt); } catch (e) { got = 'ERR ' + e.message; }
  if (got !== want) { bad++; console.log(`FAIL ${expr} [${fmt || ''}] → ${got} (기대 ${want})`); }
}
function throws(expr) { n++; try { evaluate(expr, R); bad++; console.log('FAIL 오류가 나야 함: ' + expr); } catch (e) { /* ok */ } }

eq('NHIS.healthRate*100', '', '7.19');
eq('NHIS.ltcRate*100', '', '0.9448');
eq('NHIS.ltcRate/NHIS.healthRate*100', 'f2', '13.14');
eq('NHIS.premiumCapMonthly', '', '4,591,740');
eq('NHIS.premiumFloorMonthly', '', '20,160');
eq('NHIS.perPoint', '', '211.5');
eq('FIN_INCOME.withholdingWithLocal*100', '', '15.4');
eq('FIN_INCOME.withholding*100', '', '14');
eq('FIN_INCOME.withholding*INCOME_TAX.local*100', '', '1.4');
eq('FIN_INCOME.threshold/1e4', '', '2,000');
eq('PENSION.separateLimit/1e4', '', '1,500');
eq('PENSION.rateByAge.0.1*100', '', '5.5');
eq('PENSION.rateByAge.2.1*100', '', '3.3');
eq('PENSION.otherIncomeRate*100', '', '16.5');
eq('INCOME_TAX.brackets.0.1*(1+INCOME_TAX.local)*100', '', '6.6');
eq('INCOME_TAX.brackets.7.1*(1+INCOME_TAX.local)*100', '', '49.5');
eq('INCOME_TAX.brackets.7.1*100', '', '45');
eq('ISA.excessRate*100', '', '9.9');
eq('OVERSEAS_STOCK.basicDeduction/1e4', '', '250');
eq('OVERSEAS_STOCK.rate*100', '', '22');
eq('(TRADE.securitiesTransactionTax.kospi.stt+TRADE.securitiesTransactionTax.kospi.rural)*100', 'f2', '0.20');
eq('TRADE.securitiesTransactionTax.kospi.stt*100', 'f2', '0.05');
eq('TRADE.secFeePerMillionUsd', 'f2', '20.60');
eq('NPS.A', '', '3,193,511');
eq('NPS.premiumRateByYear.2026*100', '', '9.5');
eq('NHIS.dependent.propLow/1e8', '', '5.4');
eq('NHIS.dependent.propHigh/1e8', '', '9');
eq('meta.year', 'i', '2026');
eq('meta.year+1', 'i', '2027');
eq('PENSION_SAVINGS.creditLimitTotal/1e4', 'n0', '900');
eq('-2 * (3 + 4) / 7', '', '-2');
throws('NHIS.nope');
throws('NHIS');            // 객체는 숫자가 아님
throws('alert(1)');
throws('NHIS.healthRate; 1');
console.log(`fill-v1 시험 ${n}건 — ${bad ? '실패 ' + bad : '모두 통과'}`);
process.exit(bad ? 1 : 0);
