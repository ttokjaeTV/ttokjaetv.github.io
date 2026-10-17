/*!
 * 똑재TV 투자 Tool 멤버십 — 기능 일부 잠금 (member-lock.js)
 * ------------------------------------------------------------
 * 무료 계산은 그대로 두고, 멤버십 전용 기능만 잠근다. 도구 전체를 잠그는 member-gate.js 와 다르다.
 *
 * ■ 스위치 (지금은 꺼져 있음)
 *   LOCK.on = false  → 아무것도 바뀌지 않는다. 모든 기능이 누구에게나 열린다.
 *   LOCK.on = true   → 멤버십 회원이 아니면 표시한 기능에 안내가 뜬다.
 *   켜기 전에 isMember() 를 강의실 로그인(lecture-room 의 tool-gate.js, my_access('tools'))과 연결해야 한다.
 *
 * ■ 켜진 모습 미리 보기 (주인만, 스위치와 상관없이)
 *   주소 끝에 ?lock=preview  → 이 브라우저에서 비회원 화면으로 보인다.
 *   ?lock=off                → 미리 보기를 끈다.
 *
 * ■ 도구에 표시하는 법
 *   1) <head> 에 한 줄:  <script src="https://ttokjaetv.github.io/member-lock.js"></script>
 *   2) 패널·카드 전체:   <div data-member="연차별 표와 엑셀"> … </div>
 *        → 잠기면 안을 흐리게 가리고 가운데에 안내 카드를 띄운다.
 *   3) 버튼·탭·칩 하나: <button data-member-click="엑셀 내려받기"> … </button>
 *        → 누르면 원래 동작 대신 안내 창이 뜬다.
 *   4) 코드 안 제한(종목 수 등):
 *        if (window.TJLock && !TJLock.allow('종목 4개 이상')) return;
 *      allow() 는 스위치가 꺼져 있거나 회원이면 true, 아니면 안내 창을 띄우고 false.
 *      조용히 확인만: TJLock.ok()
 *   * 이 파일을 못 불러와도 도구가 멈추지 않게, 도구 쪽은 항상 window.TJLock 이 있는지 먼저 본다.
 */
(function () {
  'use strict';
  if (window.TJLock) return;

  var LOCK = {
    on: false,                                               // ← 판매 시작할 때 true
    shopUrl: 'https://ttokjaetv.github.io/lecture-room/tools-shop.html',
    loginUrl: 'https://ttokjaetv.github.io/lecture-room/classroom.html',
    price: '월 8,900원',
    previewKey: 'tjlock-preview'
  };

  // ---- 미리 보기 스위치 (?lock=preview / ?lock=off) ----
  var preview = false;
  try {
    var q = new URLSearchParams(location.search).get('lock');
    if (q === 'preview') localStorage.setItem(LOCK.previewKey, '1');
    if (q === 'off') localStorage.removeItem(LOCK.previewKey);
    preview = localStorage.getItem(LOCK.previewKey) === '1';
  } catch (e) {}

  var member = false;   // 켜진 상태에서 회원 여부. isMember() 결과로 채운다.
  function active() { return (LOCK.on || preview) && !member; }

  // 회원 확인 — 스위치를 켤 때 강의실 로그인과 연결한다. 지금은 아무도 회원이 아닌 것으로 본다.
  function isMember() {
    if (preview) return Promise.resolve(false);
    if (window.ToolGate && typeof window.ToolGate.check === 'function') {
      return Promise.resolve(window.ToolGate.check('tools')).then(function (a) { return !!a; }, function () { return false; });
    }
    return Promise.resolve(false);
  }

  // ---- 스타일 (켜졌을 때만 넣는다) ----
  var CSS = [
    '.tjl-box{position:relative!important}',
    '.tjl-box>*:not(.tjl-cover){filter:blur(5px);opacity:.55;pointer-events:none!important;user-select:none}',
    '.tjl-cover{position:absolute;inset:0;z-index:30;display:flex;align-items:flex-start;justify-content:center;padding:28px 14px;background:linear-gradient(180deg,rgba(245,239,230,.35),rgba(245,239,230,.75));border-radius:inherit}',
    '.tjl-card,.tjl-modal .tjl-card{position:sticky;top:24px;max-width:360px;width:100%;background:#FBF7F0;border:1px solid #E5DCC8;border-radius:16px;padding:20px 20px 18px;box-shadow:0 18px 40px -22px rgba(58,47,38,.45);text-align:center;font-family:"Pretendard","Pretendard Variable",-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#1A1A1A}',
    '.tjl-tag{display:inline-block;font-size:12px;font-weight:800;color:#8B6F47;background:#EFE7DA;border:1px solid #C4A57B;border-radius:999px;padding:4px 11px}',
    '.tjl-t{margin:10px 0 4px;font-size:17px;font-weight:900;letter-spacing:-.4px;line-height:1.4}',
    '.tjl-d{margin:0 0 14px;font-size:13.5px;font-weight:600;color:#4A4A4A;line-height:1.6}',
    '.tjl-acts{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}',
    '.tjl-acts a{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 16px;border-radius:10px;font-size:14px;font-weight:800;text-decoration:none}',
    '.tjl-go{background:#D9542B;color:#FBF7F0!important}',
    '.tjl-in{background:#fff;color:#3A2F26!important;border:1.5px solid #E5DCC8}',
    '[data-member-click].tjl-mark{position:relative}',
    '[data-member-click].tjl-mark::after{content:"🔒";font-size:.8em;margin-left:5px}',
    '.tjl-modal{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(58,47,38,.38)}',
    '.tjl-modal .tjl-card{position:relative;top:auto}',
    '.tjl-x{position:absolute;right:10px;top:8px;border:0;background:none;font-size:22px;line-height:1;color:#8B8276;cursor:pointer;padding:4px 8px}',
    // 칸이 낮을 때: 설명을 빼고(.tjl-compact), 더 낮으면 한 줄 알약(.tjl-mini)
    '.tjl-compact>.tjl-cover{align-items:center;padding:10px}',
    '.tjl-compact .tjl-cover .tjl-d{display:none}',
    '.tjl-compact .tjl-cover .tjl-card{padding:14px 16px 14px;position:relative;top:auto}',
    '.tjl-compact .tjl-cover .tjl-t{margin:6px 0 10px;font-size:15px}',
    '.tjl-mini>.tjl-cover{align-items:center;padding:4px 8px}',
    '.tjl-mini .tjl-cover .tjl-card{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;max-width:none;width:auto;padding:6px 8px 6px 12px;border-radius:999px;position:relative;top:auto}',
    '.tjl-mini .tjl-cover .tjl-d,.tjl-mini .tjl-cover .tjl-in{display:none}',
    '.tjl-mini .tjl-cover .tjl-t{margin:0;font-size:13px}',
    '.tjl-mini .tjl-cover .tjl-tag{padding:2px 8px;font-size:11px}',
    '.tjl-mini .tjl-cover .tjl-acts a{min-height:30px;padding:0 12px;font-size:12.5px;border-radius:999px}',
    '.tjl-badge{position:fixed;left:12px;bottom:12px;z-index:2147482000;font:800 12px/1 -apple-system,"Malgun Gothic",sans-serif;color:#FBF7F0;background:#3A2F26;border-radius:999px;padding:8px 12px;opacity:.9}',
    '.tjl-badge a{color:#F8E04A;margin-left:6px}'
  ].join('');
  var styled = false;
  function style() {
    if (styled) return; styled = true;
    var s = document.createElement('style'); s.id = 'tjl-style'; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function card(label) {
    return '<span class="tjl-tag">🔒 투자 Tool 멤버십</span>' +
      '<p class="tjl-t">' + esc(label || '멤버십 전용 기능') + '</p>' +
      '<p class="tjl-d">기본 계산은 무료예요. 이 기능은 멤버십 회원(' + esc(LOCK.price) + ')에게 열립니다.<br>내 강의실 계정으로 로그인하면 바로 쓸 수 있어요.</p>' +
      '<div class="tjl-acts"><a class="tjl-go" href="' + LOCK.shopUrl + '" target="_blank" rel="noopener">멤버십 알아보기</a><a class="tjl-in" href="' + LOCK.loginUrl + '" target="_blank" rel="noopener">로그인</a></div>';
  }

  // ---- 안내 창 ----
  function modal(label) {
    style();
    var old = document.querySelector('.tjl-modal'); if (old) old.remove();
    var m = document.createElement('div');
    m.className = 'tjl-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = '<div class="tjl-card"><button class="tjl-x" type="button" aria-label="닫기">×</button>' + card(label) + '</div>';
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('.tjl-x')) m.remove(); });
    document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { m.remove(); document.removeEventListener('keydown', k); } });
    document.body.appendChild(m);
  }

  // ---- 패널 가리기 ----
  function hasCover(el) {
    for (var i = 0; i < el.children.length; i++) if (el.children[i].classList.contains('tjl-cover')) return true;
    return false;
  }
  function cover(el) {
    if (hasCover(el)) return;   // 칸이 내용을 통째로 다시 그려 안내 카드가 지워졌으면 다시 붙인다
    el.classList.add('tjl-box');
    var c = document.createElement('div');
    c.className = 'tjl-cover';
    c.innerHTML = '<div class="tjl-card">' + card(el.getAttribute('data-member')) + '</div>';
    el.appendChild(c);
    fit(el);
  }
  // 칸 높이에 맞춰 안내 카드 크기를 고른다 (넘쳐서 아래 칸을 덮지 않게)
  function fit(el) {
    el.classList.remove('tjl-compact', 'tjl-mini');
    var h = el.getBoundingClientRect().height;
    if (h && h < 150) el.classList.add('tjl-mini');
    else if (h && h < 300) el.classList.add('tjl-compact');
  }
  function uncoverAll() {
    Array.prototype.forEach.call(document.querySelectorAll('.tjl-box'), function (el) {
      el.classList.remove('tjl-box', 'tjl-compact', 'tjl-mini');
      var c = el.querySelector(':scope > .tjl-cover'); if (c) c.remove();
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tjl-mark'), function (el) { el.classList.remove('tjl-mark'); });
  }
  function apply() {
    if (!active()) { uncoverAll(); return; }
    style();
    Array.prototype.forEach.call(document.querySelectorAll('[data-member]'), function (el) {
      if (hasCover(el)) fit(el); else cover(el);
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-member-click]'), function (el) { el.classList.add('tjl-mark'); });
  }

  // 버튼·탭 누름 가로채기 (캡처 단계라 도구의 원래 동작보다 먼저 막는다)
  document.addEventListener('click', function (e) {
    if (!active()) return;
    var t = e.target && e.target.closest ? e.target.closest('[data-member-click]') : null;
    if (!t) return;
    e.preventDefault(); e.stopImmediatePropagation();
    modal(t.getAttribute('data-member-click'));
  }, true);
  // 잠긴 칸 안의 입력·선택도 막는다 (키보드 포함)
  document.addEventListener('focusin', function (e) {
    if (!active()) return;
    var box = e.target && e.target.closest ? e.target.closest('.tjl-box') : null;
    if (box && !e.target.closest('.tjl-cover')) { e.target.blur(); }
  }, true);

  // 화면이 다시 그려져도 표시가 유지되게
  var mo = null;
  function watch() {
    if (mo || !active() || !window.MutationObserver) return;
    var queued = false;
    mo = new MutationObserver(function () {
      if (queued) return; queued = true;
      requestAnimationFrame(function () { queued = false; apply(); });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // 탭 전환·창 크기 변경으로 숨어 있던 칸이 보이면 카드 크기를 다시 맞춘다
  function later() { if (active()) requestAnimationFrame(function () { setTimeout(apply, 0); }); }
  document.addEventListener('click', later);
  window.addEventListener('resize', later);

  function start() {
    if (preview) {
      style();
      var b = document.createElement('div');
      b.className = 'tjl-badge';
      b.innerHTML = '멤버십 잠금 미리 보기<a href="?lock=off">끄기</a>';
      document.body.appendChild(b);
    }
    apply(); watch();
    if (LOCK.on && !preview) {
      isMember().then(function (yes) {
        member = !!yes;
        if (member) { uncoverAll(); if (mo) { mo.disconnect(); mo = null; } }
        try { window.dispatchEvent(new CustomEvent('tjlock-change', { detail: { member: member } })); } catch (e) {}
      });
    }
  }

  window.TJLock = {
    /** 지금 잠겨 있는가(안내 없이) */
    locked: function () { return active(); },
    /** 써도 되면 true. 아니면 false (안내 없이) */
    ok: function () { return !active(); },
    /** 써도 되면 true. 아니면 안내 창을 띄우고 false */
    allow: function (label) { if (!active()) return true; modal(label); return false; },
    /** 안내 창만 띄우기 */
    prompt: modal,
    /** 동적으로 그린 칸에 다시 표시 적용 */
    refresh: function () { apply(); },
    config: LOCK
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
