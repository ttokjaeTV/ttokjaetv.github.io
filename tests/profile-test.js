#!/usr/bin/env node
/* profile-v1.js 저장·읽기 규칙 시험:  node tests/profile-test.js */
'use strict';
const P = require('../profile-v1.js');
const C = P._core;
const Y = new Date().getFullYear();
let fail = 0, n = 0;
const eq = (name, got, want) => { n++; if (got !== want) { fail++; console.log(`✗ ${name}: ${got} (기대 ${want})`); } };

// 나이 ↔ 출생연도
let p = C.blank();
C.write(p, 'age', 53, 'retire-drawdown', 1);
eq('age→birth', p.v.birth, Y - 53);
eq('age 읽기', C.read(p, 'age'), 53);
eq('범위 밖 나이 무시', C.write(p, 'age', 5).length, 0);
eq('빈칸 무시', C.write(p, 'spend', '').length, 0);
eq('쉼표 숫자', (C.write(p, 'spend', '1,250'), p.v.spend), 1250);
eq('정수 항목 반올림', (C.write(p, 'retireAge', '60.4'), p.v.retireAge), 60);

// 은퇴 기간 = 계획 나이 − 은퇴 나이 + 1 ('그 나이 해까지 포함')
C.write(p, 'endAge', 90);
eq('은퇴 기간', C.read(p, 'retireYears'), 31);
C.write(p, 'retireYears', 36);
eq('은퇴 기간 → 계획 나이', p.v.endAge, 95);
let q = C.blank();
eq('은퇴 나이 없으면 은퇴 기간 저장 안 함', C.write(q, 'retireYears', 30).length, 0);

// 금융자산 합계: 계좌별 값과 직접 넣은 합계 중 최근 것
p = C.blank();
C.write(p, 'ps', 13000, 'retire-check', 10);
C.write(p, 'irp', 5000, 'retire-check', 10);
C.write(p, 'isa', 4000, 'retire-check', 10);
C.write(p, 'gen', 6000, 'retire-check', 10);
C.write(p, 'sev', 20000, 'retire-check', 10);
eq('합계 = 계좌 합 (퇴직금 제외)', C.read(p, 'fin'), 28000);
C.write(p, 'fin', 30000, 'goal-calc', 20);
eq('나중에 직접 넣은 합계', C.read(p, 'fin'), 30000);
C.write(p, 'isa', 5000, 'retire-check', 30);
eq('그 뒤 계좌를 고치면 다시 계좌 합', C.read(p, 'fin'), 29000);

// 세액공제 받은 원금·수익 = 연금저축 + IRP − 세액공제 안 받은 원금
C.write(p, 'noded', 3000, 'retire-check', 40);
eq('tc 계산', C.read(p, 'tc'), 15000);
C.write(p, 'tc', 20000, 'pension-tax-sim', 50);
eq('tc 직접', C.read(p, 'tc'), 20000);
p = C.blank();
C.write(p, 'noded', 9000, 'x', 1); C.write(p, 'ps', 1000, 'x', 1);
eq('tc 음수 안 됨', C.read(p, 'tc'), 0);

// 지우기
p = C.blank(); C.write(p, 'age', 40); C.remove(p, 'age');
eq('나이 지우면 출생연도도', p.v.birth, undefined);

// 표시
eq('만원 표시', C.fmt('fin', 48000), '4억 8,000만원');
eq('나이 표시', C.fmt('age', 53), '53세');

console.log(fail ? `실패 ${fail}/${n}` : `통과 ${n}개`);
process.exit(fail ? 1 : 0);
