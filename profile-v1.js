/*!
 * 똑재TV 계산기 공용 '내 정보' (profile-v1.js)
 * ------------------------------------------------------------
 * 나이·은퇴 나이·생활비·자산·국민연금처럼 여러 계산기가 같이 묻는 값을 한 번만 넣게 한다.
 * 한 계산기에서 손으로 넣은 값을 이 브라우저(localStorage 'tj-profile-v1')에 저장하고,
 * 다른 계산기를 열면 그 값으로 미리 채운다. 서버로는 아무것도 보내지 않는다.
 * 모든 계산기가 ttokjaetv.github.io 한 주소 아래에 있어서 저장소를 같이 쓸 수 있다.
 *
 * ■ 배포 후 고치지 않는다. 바꿀 일이 생기면 profile-v2.js 로 낸다(rules/calc-v*.js 와 같은 정책).
 *
 * ■ 계산기에서 쓰는 법
 *   1) <head> 에 한 줄:  <script src="https://ttokjaetv.github.io/profile-v1.js"></script>
 *      (계산기 스크립트보다 먼저. 첫 주소의 ?쿼리를 계산기가 바꾸기 전에 기억해 둔다)
 *   2) 넣을 자리:        <div id="tj-profile"></div>
 *   3) 계산기 시작(init) 코드가 끝난 뒤:
 *        if (window.TJProfile) TJProfile.attach({
 *          map: { 'age': 'age', 'retire-age': 'retireAge', 'me-isa': 'isa' },   // 입력칸 id → 항목
 *          clicks: '#livingChips .chip',     // (선택) 값을 넣어 주는 버튼도 사용자 입력으로 친다
 *        });
 *   - 채울 때는 값을 넣고 input·change 이벤트를 보낸다. 계산기의 원래 입력 처리(쉼표·다시 계산·자기 저장)가 그대로 돈다.
 *   - 저장은 사용자가 그 칸을 직접 고쳤을 때만 한다(예시 숫자·공유 링크 값은 저장하지 않음).
 *   - 주소에 ?쿼리(공유 링크)가 있으면 채우지 않고 '내 정보로 채우기' 버튼만 보인다.
 *   - 멤버십 기능: member-lock.js 가 잠겨 있으면(TJLock.locked()) 채우기·저장을 하지 않고 안내 띠만 보인다.
 *     계산기는 그대로 다 쓸 수 있다. 스위치가 꺼져 있거나(LOCK.on=false) 회원이면 모두에게 열린다.
 *     회원 판정이 늦게 끝나면(tjlock-change) 그때 채운다. member-lock.js 는 이 파일보다 먼저 불러온다.
 *   - TJProfile.offer({ nps: 123.4, npsAge: 65 }, '이 계산 결과') : 계산 결과를 내 정보로 저장하는 버튼을 띄운다.
 *     (항목 하나면 TJProfile.offer('nps', 123.4, '라벨')도 된다. 결과가 없어지면 TJProfile.offer(null))
 *
 * ■ 항목 (돈은 모두 만원, 나이는 세)
 *   기본: birth 출생연도 · retireAge · endAge(몇 세까지 계획) · spend 월 생활비(오늘 돈 가치)
 *         income 월 수입(세후) · saving 월 저축·적립액 · inflation 물가상승률(%)
 *   자산: sev 퇴직금 · svcYears 근속연수 · ps 연금저축 · irp IRP 개인 납입분 · noded 세액공제 안 받은 원금
 *         tc 세액공제 받은 원금·수익 · isa · gen 일반계좌·예금 · fin 금융자산 합계
 *   연금: nps 국민연금 예상 월액 · npsAge 받기 시작 나이 · wAge 연금계좌 첫 인출 나이
 *   배우자: spBirth · spNps 배우자 공적연금 월액
 *   계산 항목: age(=올해−birth) · spAge · retireYears(=endAge−retireAge+1)
 *     tc 는 직접 넣은 값과 (연금저축+IRP−세액공제 안 받은 원금) 중 더 최근에 넣은 쪽,
 *     fin 은 직접 넣은 값과 (연금저축+IRP+ISA+일반) 중 더 최근에 넣은 쪽을 쓴다. 퇴직금은 따로 받는 목돈으로 보고 뺀다.
 */
(function (root) {
  'use strict';
  var KEY = 'tj-profile-v1';
  var SKIP_KEY = 'tj-profile-v1-skip:';          // sessionStorage: 이 페이지는 이번 방문 동안 예시 숫자로
  var Y = new Date().getFullYear();
  var START_SEARCH = (root.location && root.location.search) || '';   // 계산기가 주소를 바꾸기 전 첫 쿼리

  /* ---------- 항목 정의 ---------- */
  var F = {
    birth:     { label: '출생연도', unit: '년', min: 1900, max: Y, int: true, g: 'base' },
    retireAge: { label: '은퇴 나이', unit: '세', min: 20, max: 100, int: true, g: 'base' },
    endAge:    { label: '몇 세까지 계획', unit: '세', min: 50, max: 120, int: true, g: 'base' },
    spend:     { label: '월 생활비 (오늘 돈 가치)', unit: '만원', min: 0, max: 100000, g: 'base' },
    income:    { label: '월 수입 (세후)', unit: '만원', min: 0, max: 100000, g: 'base' },
    saving:    { label: '월 저축·적립액', unit: '만원', min: 0, max: 100000, g: 'base' },
    inflation: { label: '물가상승률 (연)', unit: '%', min: 0, max: 20, g: 'base' },
    sev:       { label: '퇴직금', unit: '만원', min: 0, max: 1e7, g: 'asset' },
    svcYears:  { label: '근속연수', unit: '년', min: 0, max: 60, int: true, g: 'asset' },
    ps:        { label: '연금저축', unit: '만원', min: 0, max: 1e7, g: 'asset' },
    irp:       { label: 'IRP (개인 납입분)', unit: '만원', min: 0, max: 1e7, g: 'asset' },
    noded:     { label: '연금계좌 중 세액공제 안 받은 원금', unit: '만원', min: 0, max: 1e7, g: 'asset' },
    tc:        { label: '연금계좌 중 세액공제 받은 원금·수익', unit: '만원', min: 0, max: 1e7, g: 'asset',
                 sum: ['ps', 'irp'], minus: ['noded'] },
    isa:       { label: 'ISA', unit: '만원', min: 0, max: 1e7, g: 'asset' },
    gen:       { label: '일반계좌·예금', unit: '만원', min: 0, max: 1e7, g: 'asset' },
    fin:       { label: '금융자산 합계 (퇴직금 제외)', unit: '만원', min: 0, max: 1e8, g: 'asset',
                 sum: ['ps', 'irp', 'isa', 'gen'], minus: [] },
    nps:       { label: '국민연금 예상 월액', unit: '만원', min: 0, max: 1000, g: 'pension' },
    npsAge:    { label: '국민연금 받기 시작 나이', unit: '세', min: 55, max: 75, int: true, g: 'pension' },
    wAge:      { label: '연금계좌 첫 인출 나이', unit: '세', min: 40, max: 100, int: true, g: 'pension' },
    spBirth:   { label: '배우자 출생연도', unit: '년', min: 1900, max: Y, int: true, g: 'spouse' },
    spNps:     { label: '배우자 공적연금 월액', unit: '만원', min: 0, max: 1000, g: 'spouse' }
  };
  // 계산 항목: 읽을 때 만들고, 쓸 때 원 항목으로 바꾼다
  var D = {
    age:   { label: '현재 나이', unit: '세', min: 15, max: 120, int: true, g: 'base', from: ['birth'],
             get: function (p) { return has(p, 'birth') ? Y - p.v.birth : undefined; },
             set: function (v) { return { birth: Y - v }; } },
    spAge: { label: '배우자 현재 나이', unit: '세', min: 15, max: 120, int: true, g: 'spouse', from: ['spBirth'],
             get: function (p) { return has(p, 'spBirth') ? Y - p.v.spBirth : undefined; },
             set: function (v) { return { spBirth: Y - v }; } },
    retireYears: { label: '은퇴 기간', unit: '년', min: 1, max: 80, int: true, g: 'base', from: ['endAge', 'retireAge'],
             get: function (p) { return has(p, 'endAge') && has(p, 'retireAge') ? p.v.endAge - p.v.retireAge + 1 : undefined; },
             set: function (v, p) { return has(p, 'retireAge') ? { endAge: p.v.retireAge + v - 1 } : null; } }
  };
  var GROUPS = [['base', '기본'], ['asset', '자산'], ['pension', '연금'], ['spouse', '배우자']];
  // '내 정보' 창에 보여 줄 순서 (birth 대신 age로 보여 준다)
  var VIEW = ['age', 'retireAge', 'endAge', 'spend', 'income', 'saving', 'inflation',
    'fin', 'sev', 'svcYears', 'ps', 'irp', 'noded', 'tc', 'isa', 'gen',
    'nps', 'npsAge', 'wAge', 'spAge', 'spNps'];
  var CALCS = [
    ['retire-check', '은퇴 5년 전 점검 가이드'], ['retire-drawdown', '노후 자금 고갈 시뮬레이터'],
    ['retirement', '현금흐름 역산 계산기'], ['goal-calc', '목표금액 계산기'], ['freedom', '경제적 자유 계산기'],
    ['human-capital', '미래 소득 현재가치 계산기'], ['nps-calc', '국민연금 계산기'], ['pension-tax-sim', '연금 인출 세금 시뮬레이터']
  ];

  /* ---------- 저장소 ---------- */
  function has(p, k) { return p && p.v && typeof p.v[k] === 'number' && isFinite(p.v[k]); }
  function blank() { return { v: {}, t: {}, s: {}, off: false }; }
  function load() {
    try {
      var o = JSON.parse(root.localStorage.getItem(KEY) || 'null');
      if (o && typeof o === 'object' && o.v) return { v: o.v || {}, t: o.t || {}, s: o.s || {}, off: !!o.off };
    } catch (e) {}
    return blank();
  }
  function store(p) { try { root.localStorage.setItem(KEY, JSON.stringify(p)); return true; } catch (e) { return false; } }

  /* 항목 값 읽기 (계산 항목·합계 포함). 없으면 undefined */
  function read(p, k) {
    if (D[k]) return D[k].get(p);
    var f = F[k]; if (!f) return undefined;
    if (!f.sum) return has(p, k) ? p.v[k] : undefined;
    var parts = f.sum.filter(function (x) { return has(p, x); });
    if (!parts.length) return has(p, k) ? p.v[k] : undefined;
    var tParts = 0;
    f.sum.concat(f.minus).forEach(function (x) { if (has(p, x)) tParts = Math.max(tParts, p.t[x] || 0); });
    if (has(p, k) && (p.t[k] || 0) >= tParts) return p.v[k];
    var s = 0;
    parts.forEach(function (x) { s += p.v[x]; });
    f.minus.forEach(function (x) { if (has(p, x)) s -= p.v[x]; });
    return Math.max(0, s);
  }
  /* 값 하나가 그 항목에 맞는지 (범위 밖·빈칸이면 null) */
  function clean(k, v) {
    var f = D[k] || F[k]; if (!f) return null;
    if (typeof v === 'string') v = parseFloat(v.replace(/[,\s]/g, ''));
    if (typeof v !== 'number' || !isFinite(v)) return null;
    if (f.int) v = Math.round(v);
    if (v < f.min || v > f.max) return null;
    return v;
  }
  /* 항목에 쓰기 → 실제로 바뀐 원 항목 목록 */
  function write(p, k, v, src, now) {
    v = clean(k, v); if (v == null) return [];
    now = now || Date.now();
    var obj = {};
    if (D[k]) { obj = D[k].set(v, p); if (!obj) return []; }
    else obj[k] = v;
    var changed = [];
    Object.keys(obj).forEach(function (x) {
      var nv = clean(x, obj[x]); if (nv == null) return;
      if (p.v[x] !== nv) changed.push(x);
      p.v[x] = nv; p.t[x] = now; if (src) p.s[x] = src;
    });
    return changed;
  }
  function remove(p, k) {
    var ks = D[k] ? D[k].from.slice(0, 1) : [k];
    ks.forEach(function (x) { delete p.v[x]; delete p.t[x]; delete p.s[x]; });
  }
  function count(p) { return Object.keys(p.v).filter(function (k) { return has(p, k); }).length; }

  /* ---------- 표시 ---------- */
  function fmtMan(v) {
    v = Math.round(v);
    if (v === 0) return '0원';
    var neg = v < 0; v = Math.abs(v);
    var eok = Math.floor(v / 10000), man = v % 10000;
    var s = eok ? eok.toLocaleString('ko-KR') + '억' + (man ? ' ' + man.toLocaleString('ko-KR') + '만원' : '원') : man.toLocaleString('ko-KR') + '만원';
    return (neg ? '-' : '') + s;
  }
  function fmt(k, v) {
    var f = D[k] || F[k];
    if (v == null) return '';
    if (f.unit === '만원') return fmtMan(v);
    if (f.unit === '%') return v + '%';
    if (f.unit === '년' && (k === 'birth' || k === 'spBirth')) return v + '년생';
    return v.toLocaleString('ko-KR') + f.unit;
  }
  function labelOf(k) { return (D[k] || F[k]).label; }
  function calcName(path) { if (path === 'profile') return '내 정보 창'; for (var i = 0; i < CALCS.length; i++) if (CALCS[i][0] === path) return CALCS[i][1]; return path; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- 페이지 ---------- */
  var CSS = '' +
    '.tjp-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin:0 0 14px;padding:10px 14px;border:1px solid var(--border,#E5DCC8);border-radius:10px;background:#fff;color:var(--ink,#1A1A1A);font-size:13.5px;line-height:1.5;text-align:left}' +
    '.tjp-bar .tjp-ic{flex:none;width:22px;height:22px;border-radius:50%;background:var(--accent,#D9542B);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}' +
    '.tjp-bar .tjp-msg{flex:1 1 220px;min-width:0}' +
    '.tjp-bar .tjp-msg b{font-weight:700}' +
    '.tjp-bar .tjp-sub{display:block;color:#6b6358;font-size:12.5px;margin-top:1px}' +
    '.tjp-acts{display:flex;flex-wrap:wrap;gap:6px}' +
    '.tjp-btn{appearance:none;border:1px solid var(--accent,#D9542B);background:#fff;color:var(--accent,#D9542B);border-radius:7px;padding:4px 10px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap}' +
    '.tjp-btn:hover{background:#FBEDE5}' +
    '.tjp-btn.tjp-quiet{border-color:#D6CCBA;color:#5b544a}' +
    '.tjp-btn.tjp-quiet:hover{background:#F5EFE6}' +
    '.tjp-saved{color:#1b7a43;font-weight:600}' +
    '.tjp-ov{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,35,.45);display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto}' +
    '.tjp-dlg{width:100%;max-width:520px;background:#fff;color:var(--ink,#1A1A1A);border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.25);padding:20px 20px 16px;font-size:14px;line-height:1.5;text-align:left}' +
    '.tjp-dlg h3{margin:0 0 4px;font-size:18px}' +
    '.tjp-dlg .tjp-note{margin:0 0 12px;color:#6b6358;font-size:12.5px}' +
    '.tjp-dlg h4{margin:14px 0 6px;font-size:13px;color:var(--accent,#D9542B)}' +
    '.tjp-row{display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid #F0EADF}' +
    '.tjp-row label{flex:1 1 auto;min-width:0;font-size:13.5px}' +
    '.tjp-row .tjp-src{display:block;color:#9a9083;font-size:11.5px}' +
    '.tjp-row input{width:110px;flex:none;padding:5px 8px;border:1px solid #D6CCBA;border-radius:7px;background:#fff;color:inherit;font:inherit;font-size:14px;text-align:right;box-shadow:none}' +
    '.tjp-row .tjp-u{width:34px;flex:none;color:#6b6358;font-size:12.5px}' +
    '.tjp-row .tjp-x{flex:none;width:26px;height:26px;border:0;background:none;color:#a89f92;font-size:16px;cursor:pointer;border-radius:6px}' +
    '.tjp-row .tjp-x:hover{background:#F5EFE6;color:#c0392b}' +
    '.tjp-links{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}' +
    '.tjp-links a{font-size:12.5px;color:var(--accent,#D9542B);text-decoration:none;border:1px solid var(--accent-soft,#F4D5C4);border-radius:999px;padding:3px 10px}' +
    '.tjp-links a:hover{background:#FBEDE5}' +
    '.tjp-foot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;margin-top:16px}' +
    '.tjp-empty{color:#9a9083;font-size:13px;padding:6px 0}' +
    '@media (max-width:480px){.tjp-row input{width:92px}.tjp-dlg{padding:16px 14px 12px}}';
  var cssDone = false;
  function addCss() {
    if (cssDone) return; cssDone = true;
    var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
  }
  function pagePath() { var m = (root.location.pathname || '').split('/').filter(Boolean); return m[0] || ''; }
  function meaningfulQuery() {
    var q = new URLSearchParams(START_SEARCH), n = 0;
    q.forEach(function (v, k) { if (!/^(utm_|fbclid$|gclid$|ref$|from$|lock$|tjp$)/.test(k)) n++; });
    return n > 0;
  }
  function skipSession(on) {
    try {
      if (on === undefined) return root.sessionStorage.getItem(SKIP_KEY + pagePath()) === '1';
      if (on) root.sessionStorage.setItem(SKIP_KEY + pagePath(), '1'); else root.sessionStorage.removeItem(SKIP_KEY + pagePath());
    } catch (e) {}
    return false;
  }
  function numOf(el) { var v = parseFloat(String(el.value).replace(/[,\s]/g, '')); return isFinite(v) ? v : null; }
  function setEl(el, v) {
    if (numOf(el) === v) return false;
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  var A = null;     // 붙은 페이지 상태
  var LOCK_LABEL = '내 정보 이어쓰기';
  function locked() { try { return !!(root.TJLock && root.TJLock.locked()); } catch (e) { return false; } }

  function attach(opt) {
    if (A || !opt || !opt.map) return;
    if (!root.localStorage) return;
    addCss();
    var entries = [];
    Object.keys(opt.map).forEach(function (id) {
      var el = document.getElementById(id), k = opt.map[id];
      if (el && (F[k] || D[k])) entries.push({ id: id, el: el, k: k, orig: null });
    });
    if (!entries.length) return;
    var box = document.getElementById(opt.anchor || 'tj-profile');
    if (!box) { box = document.createElement('div'); entries[0].el.closest('form,section,div').prepend(box); }
    A = { entries: entries, box: box, filled: [], mode: 'none', saved: null, offer: null, timer: null };

    start();
    root.addEventListener('tjlock-change', function () { if (A.mode === 'locked' && !locked()) { start(); render(); } });

    entries.forEach(function (e) {
      var h = function (ev) { if (ev.isTrusted) queueSave(e); };
      e.el.addEventListener('input', h);
      e.el.addEventListener('change', h);
    });
    if (opt.clicks) {
      document.addEventListener('click', function (ev) {
        if (!ev.isTrusted || !ev.target.closest || !ev.target.closest(opt.clicks)) return;
        var before = entries.map(function (e) { return numOf(e.el); });
        setTimeout(function () {
          entries.forEach(function (e, i) { if (numOf(e.el) !== before[i]) queueSave(e); });
        }, 0);
      }, true);
    }
    root.addEventListener('storage', function (ev) { if (ev.key === KEY) render(); });
    render();
  }

  /* 처음 상태 정하기: 잠김 · 꺼짐 · 공유 링크 · 예시 · 채우기 */
  function start() {
    var entries = A.entries, p = load();
    if (locked()) A.mode = 'locked';
    else if (p.off) A.mode = 'off';
    else if (meaningfulQuery()) {
      // 입력값을 주소에 붙여 두는 계산기를 새로고침한 경우처럼 주소 값이 내 정보와 같으면 링크로 보지 않는다
      var differs = entries.some(function (e) { var v = read(p, e.k), cur = numOf(e.el); return v != null && cur != null && cur !== v; });
      if (count(p) && !differs) fill(p); else A.mode = 'link';
    }
    else if (skipSession()) A.mode = 'example';
    else if (count(p)) fill(p);
    else A.mode = 'empty';
  }

  /* 내 정보로 채우기 */
  function fill(p) {
    A.filled = [];
    var keys = {};
    A.entries.forEach(function (e) {
      var v = read(p, e.k); if (v == null) return;
      var cur = numOf(e.el);
      if (e.orig === null) e.orig = e.el.value;
      if (setEl(e.el, v) || cur === v) { if (!keys[e.k]) { keys[e.k] = 1; A.filled.push(e.k); } }
    });
    A.mode = A.filled.length ? 'filled' : 'empty';
  }
  /* 예시 숫자로 되돌리기: 칸의 원래 예시값(HTML value), 없으면 채우기 전 값 */
  function unfill() {
    A.entries.forEach(function (e) {
      if (e.orig === null) return;
      var back = String(e.el.defaultValue || '').trim() !== '' ? e.el.defaultValue : e.orig;
      var v = parseFloat(String(back).replace(/[,\s]/g, ''));
      if (isFinite(v)) setEl(e.el, v);
      else if (e.el.value !== back) { e.el.value = back; e.el.dispatchEvent(new Event('input', { bubbles: true })); e.el.dispatchEvent(new Event('change', { bubbles: true })); }
    });
  }

  var pending = {};
  function queueSave(e) {
    var p = load(); if (p.off || A.mode === 'locked') return;
    pending[e.id] = e;
    clearTimeout(A.timer);
    A.timer = setTimeout(flush, 500);
  }
  function flush() {
    var p = load(); if (p.off) { pending = {}; return; }
    var now = Date.now(), changed = [];
    Object.keys(pending).forEach(function (id) {
      var e = pending[id], v = numOf(e.el);
      if (v == null) return;
      if (write(p, e.k, v, pagePath(), now).length) changed.push(e.k);
    });
    pending = {};
    if (!changed.length) return;
    store(p);
    A.saved = changed;
    if (A.mode === 'link' || A.mode === 'example' || A.mode === 'empty') A.mode = 'saving';
    render();
  }

  function render() {
    if (!A) return;
    var p = load(), b = A.box, h = '', acts = '';
    var n = count(p);
    if (A.mode === 'locked') {
      b.innerHTML = '<div class="tjp-bar tjp-lock" role="note"><span class="tjp-ic" aria-hidden="true">나</span><span class="tjp-msg"><b>멤버십 · 내 정보 이어쓰기</b>'
        + '<span class="tjp-sub">나이·생활비·자산·국민연금을 한 번만 넣으면 노후 계산기 8곳에 자동으로 채워져요. 지금 화면의 계산은 그대로 다 쓸 수 있어요.</span></span>'
        + '<span class="tjp-acts"><button type="button" class="tjp-btn" data-a="lock">자세히 보기</button></span></div>';
      b.onclick = function (ev) { if (ev.target.closest('[data-a="lock"]') && root.TJLock) root.TJLock.prompt(LOCK_LABEL); };
      return;
    }
    var listKeys = function (ks) {
      var seen = {}, out = [];
      ks.forEach(function (k) { if (seen[k]) return; seen[k] = 1; var v = read(p, k); if (v != null) out.push(esc(shortLabel(k)) + ' ' + esc(fmt(k, v))); });
      return out.slice(0, 5).join(' · ') + (out.length > 5 ? ' 외 ' + (out.length - 5) + '개' : '');
    };
    if (A.mode === 'off') {
      h = '내 정보 저장이 꺼져 있어요.<span class="tjp-sub">켜면 여기 넣은 나이·생활비·자산이 다른 노후 계산기에 이어서 채워져요.</span>';
      acts += '<button type="button" class="tjp-btn tjp-quiet" data-a="on">켜기</button>';
    } else if (A.mode === 'filled') {
      h = '<b>내 정보로 ' + A.filled.length + '칸을 채웠어요.</b><span class="tjp-sub">' + listKeys(A.filled) + '</span>';
      acts += '<button type="button" class="tjp-btn" data-a="open">내 정보 보기</button><button type="button" class="tjp-btn tjp-quiet" data-a="example">예시 숫자로 보기</button>';
    } else if (A.mode === 'link') {
      h = '공유 링크에 담긴 숫자로 열었어요.' + (n ? '<span class="tjp-sub">저장해 둔 내 정보 ' + n + '개가 있어요.</span>' : '');
      if (n) acts += '<button type="button" class="tjp-btn" data-a="fill">내 정보로 채우기</button>';
    } else if (A.mode === 'example') {
      h = '예시 숫자로 보고 있어요.';
      if (n) acts += '<button type="button" class="tjp-btn" data-a="fill">내 정보로 채우기</button>';
    } else if (A.mode === 'saving') {
      h = '<span class="tjp-saved">✓ 내 정보에 저장했어요.</span> ' + (A.saved ? esc(listKeys(A.saved)) : '') + '<span class="tjp-sub">다른 노후 계산기를 열면 이 값으로 채워져요. 이 브라우저에만 저장돼요.</span>';
      acts += '<button type="button" class="tjp-btn tjp-quiet" data-a="open">내 정보 보기</button>';
    } else {
      h = '여기 넣은 나이·생활비·자산은 <b>이 브라우저에만</b> 저장돼, 다른 노후 계산기를 열면 자동으로 채워져요.<span class="tjp-sub">서버로 보내지 않아요.</span>';
      acts += '<button type="button" class="tjp-btn tjp-quiet" data-a="off">저장 안 하기</button>';
    }
    if (A.mode === 'filled' && A.saved) h = '<b>내 정보로 ' + A.filled.length + '칸을 채웠어요.</b> <span class="tjp-saved">✓ 고친 값도 저장했어요.</span><span class="tjp-sub">' + listKeys(A.filled.concat(A.saved)) + '</span>';
    // 계산 결과를 내 정보로 (예: 국민연금 계산기의 예상 월액)
    if (A.offer && !p.off) {
      var ok = Object.keys(A.offer.vals), same = ok.every(function (k) { return read(p, k) === A.offer.vals[k]; });
      var txt = ok.map(function (k) { return esc(shortLabel(k)) + ' ' + esc(fmt(k, A.offer.vals[k])); }).join(' · ');
      h += '<span class="tjp-sub">' + esc(A.offer.label) + ': <b>' + txt + '</b>' + (same ? ' — 내 정보와 같아요.' : '') + '</span>';
      if (!same) acts = '<button type="button" class="tjp-btn" data-a="offer">이 결과를 내 정보에 저장</button>' + acts;
    }
    b.innerHTML = '<div class="tjp-bar" role="status"><span class="tjp-ic" aria-hidden="true">나</span><span class="tjp-msg">' + h + '</span><span class="tjp-acts">' + acts + '</span></div>';
    b.onclick = function (ev) {
      var t = ev.target.closest('[data-a]'); if (!t) return;
      var a = t.getAttribute('data-a'), q = load();
      if (a === 'open') openDlg();
      else if (a === 'example') { skipSession(true); unfill(); A.mode = 'example'; A.saved = null; render(); }
      else if (a === 'fill') { skipSession(false); A.saved = null; fill(load()); render(); }
      else if (a === 'off') { q.off = true; store(q); A.mode = 'off'; render(); }
      else if (a === 'on') {
        q.off = false; store(q);
        if (meaningfulQuery()) A.mode = 'link'; else if (count(q)) fill(q); else A.mode = 'empty';
        render();
      }
      else if (a === 'offer') {
        var now = Date.now(), ks = Object.keys(A.offer.vals);
        ks.forEach(function (k) { write(q, k, A.offer.vals[k], pagePath(), now); });
        store(q); A.saved = ks; if (A.mode !== 'filled') A.mode = 'saving'; render();
      }
    };
  }
  function shortLabel(k) {
    return ({ spend: '생활비', income: '수입', saving: '월 저축', inflation: '물가', retireAge: '은퇴', endAge: '계획 나이', age: '나이',
      nps: '국민연금', npsAge: '국민연금 시작', fin: '금융자산', noded: '세액공제 안 받은 원금', tc: '세액공제 받은 원금·수익',
      irp: 'IRP', spAge: '배우자 나이', spNps: '배우자 공적연금', retireYears: '은퇴 기간', svcYears: '근속', wAge: '첫 인출' })[k] || labelOf(k);
  }

  /* '내 정보' 창 */
  function openDlg() {
    var p = load();
    var ov = document.createElement('div'); ov.className = 'tjp-ov';
    var rows = '';
    GROUPS.forEach(function (g) {
      var r = '';
      VIEW.forEach(function (k) {
        var f = D[k] || F[k]; if (f.g !== g[0]) return;
        var v = read(p, k), srcK = D[k] ? D[k].from[0] : k, src = p.s[srcK], t = p.t[srcK];
        var derived = F[k] && F[k].sum && v != null && !isExplicitNewest(p, k);
        var srcTxt = derived ? '합계로 계산 (' + F[k].sum.map(shortLabel).join('+') + (F[k].minus.length ? '−' + F[k].minus.map(shortLabel).join('') : '') + ')'
          : src ? calcName(src) + (t ? ' · ' + new Date(t).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) : '') : '';
        r += '<div class="tjp-row"><label for="tjp-' + k + '">' + esc(f.label) + (srcTxt ? '<span class="tjp-src">' + esc(srcTxt) + '</span>' : '') + '</label>' +
          '<input id="tjp-' + k + '" data-k="' + k + '" inputmode="decimal" value="' + (v == null ? '' : esc(dlgNum(k, v))) + '" placeholder="—">' +
          '<span class="tjp-u">' + esc(f.unit) + '</span>' +
          '<button type="button" class="tjp-x" data-x="' + k + '" title="지우기" aria-label="' + esc(f.label) + ' 지우기">×</button></div>';
      });
      rows += '<h4>' + g[1] + '</h4>' + r;
    });
    var links = CALCS.filter(function (c) { return c[0] !== pagePath(); }).map(function (c) {
      return '<a href="/' + c[0] + '/">' + esc(c[1]) + '</a>';
    }).join('');
    ov.innerHTML = '<div class="tjp-dlg" role="dialog" aria-modal="true" aria-label="내 정보">' +
      '<h3>내 정보</h3><p class="tjp-note">노후 계산기 여러 곳에서 같이 쓰는 값이에요. 이 브라우저에만 저장되고 서버로 보내지 않아요. 여기서 고치면 계산기를 열 때 이 값으로 채워져요.</p>' +
      rows +
      '<h4>이 정보로 이어서 보기</h4><div class="tjp-links">' + links + '</div>' +
      '<div class="tjp-foot"><span><button type="button" class="tjp-btn tjp-quiet" data-d="clear">모두 지우기</button> <button type="button" class="tjp-btn tjp-quiet" data-d="off">' + (p.off ? '저장 켜기' : '저장 끄기') + '</button></span>' +
      '<button type="button" class="tjp-btn" data-d="close">닫기</button></div></div>';
    document.body.appendChild(ov);
    var dirty = false;
    var close = function () {
      ov.remove();
      document.removeEventListener('keydown', onKey);
      if (dirty && A) { var q = load(); if (!q.off && A.mode !== 'link' && A.mode !== 'example') { fill(q); } }
      render();
    };
    var onKey = function (ev) { if (ev.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', function (ev) {
      if (ev.target === ov) return close();
      var d = ev.target.getAttribute && ev.target.getAttribute('data-d'), x = ev.target.getAttribute && ev.target.getAttribute('data-x');
      var q = load();
      if (d === 'close') close();
      else if (d === 'clear') { if (!confirm('저장한 내 정보를 모두 지울까요? 계산기에 지금 보이는 숫자는 그대로예요.')) return; q = blank(); q.off = load().off; store(q); dirty = false; close(); }
      else if (d === 'off') { q.off = !q.off; store(q); if (A) A.mode = q.off ? 'off' : 'empty'; close(); }
      else if (x) { remove(q, x); store(q); dirty = true; var inp = ov.querySelector('#tjp-' + x); if (inp) inp.value = ''; refreshDerived(ov); }
    });
    ov.addEventListener('change', function (ev) {
      var k = ev.target.getAttribute('data-k'); if (!k) return;
      var q = load();
      if (String(ev.target.value).trim() === '') { remove(q, k); store(q); dirty = true; refreshDerived(ov); return; }
      if (write(q, k, ev.target.value, 'profile').length || clean(k, ev.target.value) != null) { store(q); dirty = true; ev.target.style.borderColor = ''; refreshDerived(ov); }
      else ev.target.style.borderColor = '#c0392b';
    });
    var first = ov.querySelector('input'); if (first) first.focus();
  }
  function dlgNum(k, v) { var f = D[k] || F[k]; return f.unit === '만원' ? Math.round(v).toLocaleString('ko-KR') : String(v); }
  function isExplicitNewest(p, k) {
    var f = F[k]; if (!f || !f.sum) return true;
    var tParts = 0;
    f.sum.concat(f.minus).forEach(function (x) { if (has(p, x)) tParts = Math.max(tParts, p.t[x] || 0); });
    return has(p, k) && (p.t[k] || 0) >= tParts;
  }
  function refreshDerived(ov) {
    var p = load();
    ['tc', 'fin', 'age', 'spAge'].forEach(function (k) {
      var inp = ov.querySelector('#tjp-' + k); if (!inp || inp === document.activeElement) return;
      var v = read(p, k); inp.value = v == null ? '' : dlgNum(k, v);
    });
  }

  /* 계산 결과를 내 정보로 저장하는 버튼 */
  function offer(k, v, label) {
    if (!A) return;
    var vals = {}, n = 0;
    if (k && typeof k === 'object') { label = v; Object.keys(k).forEach(function (x) { var c = clean(x, k[x]); if (c != null) { vals[x] = c; n++; } }); }
    else if (k) { var c = clean(k, v); if (c != null) { vals[k] = c; n++; } label = label || labelOf(k); }
    var prev = JSON.stringify(A.offer);
    A.offer = n ? { vals: vals, label: label || '계산 결과' } : null;
    if (prev !== JSON.stringify(A.offer)) render();
  }

  root.TJProfile = {
    version: 1,
    attach: attach,
    offer: offer,
    get: function (k) { return read(load(), k); },
    set: function (k, v, src) { var p = load(); if (p.off || locked()) return false; var c = write(p, k, v, src || pagePath()); if (c.length) store(p); return c.length > 0; },
    clear: function () { var off = load().off; var p = blank(); p.off = off; store(p); },
    _core: { F: F, D: D, read: read, write: write, clean: clean, remove: remove, blank: blank, fmt: fmt }
  };
  if (typeof module === 'object' && module.exports) module.exports = root.TJProfile;
})(typeof window !== 'undefined' ? window : globalThis);
