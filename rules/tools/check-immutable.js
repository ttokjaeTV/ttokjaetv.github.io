#!/usr/bin/env node
/*
 * 배포한 공용 파일이 고쳐지거나 지워지지 않았는지 확인 (허브 CI hub-check.yml의 '불변 검사')
 *
 *   node rules/tools/check-immutable.js <기준 커밋> [<대상 커밋>]
 *     대상 커밋을 빼면 작업 폴더(커밋 전 수정 포함)와 비교한다.
 *
 * 지킬 파일: rules/v<버전>/ 아래 모든 파일(rules.js 등), rules/fill-v<N>.js, rules/calc-v<N>.js
 *   - 기준 커밋에 있던 파일이 수정(M)·삭제(D)·이름 바뀜(R)·형식 바뀜(T)이면 실패(종료 코드 1).
 *   - 새 파일 추가(A)는 허용 (새 버전 폴더 v2027.1, fill-v2.js, calc-v2.js …).
 * 고칠 일이 생기면 새 이름으로 낸다(rules/README.md '버전 정책').
 */
'use strict';
const cp = require('child_process');
const [base, head] = process.argv.slice(2);
if (!base) { console.error('사용법: node rules/tools/check-immutable.js <기준 커밋> [<대상 커밋>]'); process.exit(2); }
const git = args => cp.execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 26 });
try { git(['rev-parse', '--verify', '--quiet', base + '^{commit}']); } catch (e) { console.error('기준 커밋을 찾지 못함: ' + base); process.exit(2); }

const GUARDED = /^rules\/(v\d+\.\d+\/.+|fill-v\d+\.js|calc-v\d+\.js)$/;
const out = git(['diff', '--name-status', '-M', base].concat(head ? [head] : []).concat(['--', 'rules'])).trim();
const bad = [];
for (const line of out ? out.split('\n') : []) {
  const [st, a, b] = line.split('\t');
  const s = st[0];
  if (s === 'A') continue;
  if (GUARDED.test(a)) bad.push(`${s === 'M' ? '수정' : s === 'D' ? '삭제' : s === 'R' ? '이름 바뀜 → ' + b : s}  ${a}`);
}
console.log(`불변 검사: ${base.slice(0, 12)} → ${head ? head.slice(0, 12) : '작업 폴더'}`);
if (bad.length) {
  bad.forEach(x => console.log('::error::배포한 공용 파일을 바꿈 — ' + x));
  console.log('배포한 rules 버전 폴더·fill-v*.js·calc-v*.js는 고치지 않습니다. 새 이름(v2026.3, fill-v2.js, calc-v2.js 등)으로 내세요. (rules/README.md 버전 정책)');
  process.exit(1);
}
console.log('통과 — 배포한 공용 파일 변경 없음 (새 파일 추가만 허용)');
