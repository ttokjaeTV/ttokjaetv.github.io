/*!
 * 똑재TV 투자 Tool 멤버십 잠금 (tool-gate.js)
 * ------------------------------------------------------------
 * 쓰는 법: 잠글 도구의 <head> 맨 위(charset 바로 아래)에 한 줄
 *   <script src="https://ttokjaetv.github.io/tool-gate.js"></script>
 *   (다른 상품으로 잠그려면 data-product="영문이름", 오른쪽 아래 배지를 끄려면 data-badge="off")
 *
 * 어떻게 확인하나
 *   - 강의실(ttokjaetv.github.io/lecture-room/)과 같은 Supabase 로그인을 쓴다.
 *     모든 도구가 ttokjaetv.github.io 한 주소 아래 있어서, 강의실에서 로그인했으면 도구에서도 로그인돼 있다.
 *   - 로그인한 회원에게 my_access('tools') 를 물어 멤버십이 유효할 때만 화면을 연다.
 *     멤버십은 강의실 관리자 화면에서 [이용 권한 부여]로 준다 (결제가 붙으면 결제가 대신 넣는다).
 *
 * 한계 (중요)
 *   - 화면 가리기는 브라우저에서 하는 일이라, 코드를 뜯어보는 사람은 계산기 로직을 볼 수 있다.
 *   - 진짜로 지켜야 할 데이터(ETF 프리셋·과표·분배금 이력 등)는 Supabase 의 tool_data 테이블에 넣고
 *     ToolGate.data('키') 로 읽는다. 이 테이블은 서버가 멤버십 회원에게만 내준다.
 *
 * 도구 코드에서 쓰는 것
 *   ToolGate.ready.then(function (info) { ... })   // 잠금이 풀린 뒤 실행. info = { user, access }
 *   ToolGate.data('etf-presets').then(function (json) { ... })   // 회원 전용 데이터
 *   window.addEventListener('tool-gate-unlocked', fn)
 *   ToolGate.logout()
 */
(function () {
  'use strict';

  var me = document.currentScript;
  var over = window.TOOL_GATE_CONFIG || {};
  var CFG = {
    supabaseUrl: over.supabaseUrl || 'https://vpphzfbuzkmhlojvfkjr.supabase.co',
    supabaseKey: over.supabaseKey || 'sb_publishable_KsEHk7U9y729c6w9L5KF3Q_9WTRTF5j',  // 공개용 키 (secret 키 절대 금지)
    product: over.product || (me && me.getAttribute('data-product')) || 'tools',
    badge: over.badge != null ? over.badge : !(me && me.getAttribute('data-badge') === 'off'),
    roomUrl: over.roomUrl || 'https://ttokjaetv.github.io/lecture-room/classroom.html',
    shopUrl: over.shopUrl || 'https://ttokjaetv.github.io/lecture-room/tools-shop.html',
    hubUrl: over.hubUrl || 'https://ttokjaetv.github.io/',
    sdk: over.sdk || 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
    recheckMin: 10   // 탭으로 돌아왔을 때 이만큼(분) 지났으면 멤버십을 다시 확인
  };

  var root = document.documentElement;
  root.classList.add('tg-locked');

  // ---- 화면 가리기 (본문은 렌더링되게 visibility 로만 숨김: 차트 크기 계산 보존) ----
  var css = [
    'html.tg-locked, html.tg-locked body { overflow: hidden !important; }',
    'html.tg-locked body > *:not(#tg-gate) { visibility: hidden !important; }',
    '#tg-gate { position: fixed; inset: 0; z-index: 2147483000; background: #F5EFE6; display: flex; align-items: center; justify-content: center; padding: 24px 16px; font-family: "Pretendard", "Pretendard Variable", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; color: #1A1A1A; -webkit-font-smoothing: antialiased; overflow-y: auto; }',
    'html:not(.tg-locked) #tg-gate { display: none; }',
    '#tg-gate * { box-sizing: border-box; }',
    '#tg-gate .tg-card { width: 100%; max-width: 440px; background: #FBF7F0; border: 1px solid #E5DCC8; border-radius: 20px; padding: 32px 28px; box-shadow: 0 18px 40px -24px rgba(58,47,38,.35); }',
    '#tg-gate .tg-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 22px; }',
    '#tg-gate .tg-logo i { width: 34px; height: 34px; border-radius: 9px; background: #3A2F26; color: #FBF7F0; display: flex; align-items: center; justify-content: center; font-style: normal; font-weight: 900; font-size: 17px; }',
    '#tg-gate .tg-logo b { font-size: 16px; font-weight: 900; letter-spacing: -.4px; }',
    '#tg-gate .tg-tag { display: inline-block; font-size: 12px; font-weight: 800; color: #8B6F47; background: #EFE7DA; border: 1px solid #C4A57B; border-radius: 999px; padding: 5px 12px; margin-bottom: 14px; }',
    '#tg-gate h1 { font-size: 24px; font-weight: 900; letter-spacing: -.6px; line-height: 1.35; margin: 0 0 10px; }',
    '#tg-gate p { font-size: 15px; font-weight: 500; color: #4A4A4A; line-height: 1.7; margin: 0 0 18px; }',
    '#tg-gate p b { color: #1A1A1A; font-weight: 800; }',
    '#tg-gate form { display: grid; gap: 8px; }',
    '#tg-gate input { width: 100%; font: inherit; font-size: 16px; font-weight: 600; color: #1A1A1A; background: #fff; border: 1.5px solid #E5DCC8; border-radius: 12px; padding: 13px 14px; }',
    '#tg-gate input:focus { outline: none; border-color: #D9542B; box-shadow: 0 0 0 3px #F4D5C4; }',
    '#tg-gate .tg-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; font: inherit; font-size: 16px; font-weight: 800; color: #FBF7F0; background: #D9542B; border: 0; border-radius: 12px; padding: 14px 18px; cursor: pointer; text-decoration: none; width: 100%; }',
    '#tg-gate .tg-btn[disabled] { opacity: .6; cursor: default; }',
    '#tg-gate .tg-btn.ghost { color: #1A1A1A; background: #fff; border: 1.5px solid #E5DCC8; }',
    '#tg-gate .tg-actions { display: grid; gap: 8px; }',
    '#tg-gate .tg-msg { min-height: 22px; font-size: 14px; font-weight: 700; margin-top: 4px; color: #A03D1F; }',
    '#tg-gate .tg-who { font-size: 13px; font-weight: 600; color: #8B8276; margin: -6px 0 16px; word-break: break-all; }',
    '#tg-gate .tg-links { display: flex; gap: 14px; flex-wrap: wrap; padding-top: 16px; margin-top: 18px; border-top: 1px solid #E5DCC8; font-size: 13px; font-weight: 700; }',
    '#tg-gate .tg-links a, #tg-gate .tg-links button { color: #4A4A4A; text-decoration: underline; text-underline-offset: 3px; background: none; border: 0; padding: 0; font: inherit; cursor: pointer; }',
    '#tg-gate .tg-spin { width: 28px; height: 28px; border-radius: 50%; border: 3px solid #E5DCC8; border-top-color: #D9542B; animation: tg-spin .8s linear infinite; margin: 6px auto 14px; }',
    '@keyframes tg-spin { to { transform: rotate(360deg); } }',
    '#tg-badge { position: fixed; left: 14px; bottom: 14px; z-index: 2147482000; font-family: "Pretendard", -apple-system, "Malgun Gothic", sans-serif; }',
    '#tg-badge > button { font: inherit; font-size: 12.5px; font-weight: 800; color: #3A2F26; background: #FBF7F0; border: 1px solid #E5DCC8; border-radius: 999px; padding: 7px 12px; cursor: pointer; box-shadow: 0 6px 16px -10px rgba(58,47,38,.5); }',
    '#tg-badge .tg-pop { position: absolute; left: 0; bottom: calc(100% + 8px); width: 240px; background: #FBF7F0; border: 1px solid #E5DCC8; border-radius: 14px; padding: 14px; box-shadow: 0 18px 40px -20px rgba(58,47,38,.45); font-size: 13px; color: #4A4A4A; line-height: 1.6; }',
    '#tg-badge .tg-pop[hidden] { display: none; }',
    '#tg-badge .tg-pop b { color: #1A1A1A; }',
    '#tg-badge .tg-pop a, #tg-badge .tg-pop button { display: block; width: 100%; text-align: center; margin-top: 8px; font: inherit; font-weight: 800; font-size: 13px; color: #1A1A1A; background: #fff; border: 1px solid #E5DCC8; border-radius: 9px; padding: 8px; text-decoration: none; cursor: pointer; }',
    'html.tg-locked #tg-badge { display: none; }',
    '@media (max-width: 480px) { #tg-gate .tg-card { padding: 26px 20px; } #tg-gate h1 { font-size: 21px; } }'
  ].join('\n');
  var st = document.createElement('style');
  st.id = 'tg-style';
  st.textContent = css;
  (document.head || root).appendChild(st);

  // ---- 공용 ----
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function fmtDate(v) { var d = new Date(v); return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()); }
  function daysLeft(v) { return Math.ceil((new Date(v).getTime() - Date.now()) / 86400000); }
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res;
      s.onerror = function () { rej(new Error('sdk')); };
      document.head.appendChild(s);
    });
  }
  function koErr(e) {
    var m = (e && e.message) || String(e || '');
    if (/Invalid login credentials/i.test(m)) return '이메일 또는 비밀번호가 맞지 않아요.';
    if (/Email not confirmed/i.test(m)) return '이메일 인증을 먼저 완료해 주세요. 받은편지함(스팸함 포함)을 확인해 주세요.';
    if (/fetch|network|Failed/i.test(m)) return '연결이 불안정해요. 잠시 후 다시 시도해 주세요.';
    return '확인하지 못했어요. 잠시 후 다시 시도해 주세요.';
  }

  var client = null, user = null, access = null, lastCheck = 0, unlocked = false;
  var resolveReady;
  var ready = new Promise(function (r) { resolveReady = r; });

  // ---- 입장 화면 ----
  var gate = null;
  function card(inner) {
    if (!gate) {
      gate = document.createElement('div');
      gate.id = 'tg-gate';
      gate.setAttribute('role', 'dialog');
      gate.setAttribute('aria-modal', 'true');
      gate.setAttribute('aria-labelledby', 'tg-title');
      document.body.appendChild(gate);
    }
    gate.innerHTML = '<div class="tg-card"><div class="tg-logo"><i>똑</i><b>똑재TV</b></div>' + inner + '</div>';
    return gate;
  }
  var links = function (extra) {
    return '<div class="tg-links">' + (extra || '') + '<a href="' + esc(CFG.hubUrl) + '">계산기 모음으로</a></div>';
  };

  function showChecking() {
    card('<div class="tg-spin" aria-hidden="true"></div><p style="text-align:center;margin:0" id="tg-title">멤버십을 확인하고 있어요…</p>');
  }

  function showLogin(msg) {
    var g = card(
      '<span class="tg-tag">🔒 투자 Tool 멤버십 전용</span>' +
      '<h1 id="tg-title">멤버십 계정으로<br>로그인해 주세요</h1>' +
      '<p>강의실과 <b>같은 계정</b>을 씁니다. 강의실에서 로그인했다면 이 화면 없이 바로 열려요.</p>' +
      '<form autocomplete="on" novalidate>' +
        '<input id="tg-email" type="email" autocomplete="username" placeholder="이메일" aria-label="이메일" required>' +
        '<input id="tg-pw" type="password" autocomplete="current-password" placeholder="비밀번호" aria-label="비밀번호" required>' +
        '<button class="tg-btn" type="submit">로그인</button>' +
        '<div class="tg-msg" id="tg-msg" aria-live="polite">' + esc(msg || '') + '</div>' +
      '</form>' +
      links('<a href="' + esc(CFG.roomUrl) + '">회원가입 · 비밀번호 찾기</a><a href="' + esc(CFG.shopUrl) + '">멤버십 알아보기</a>'));
    var form = g.querySelector('form'), btn = g.querySelector('button[type=submit]'), m = g.querySelector('#tg-msg');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = g.querySelector('#tg-email').value.trim(), pw = g.querySelector('#tg-pw').value;
      if (!email || !pw) { m.textContent = '이메일과 비밀번호를 입력해 주세요.'; return; }
      btn.disabled = true; m.textContent = '';
      client.auth.signInWithPassword({ email: email, password: pw }).then(function (res) {
        if (res.error) throw res.error;
        user = res.data.user;
        return check(true);
      }).catch(function (err) {
        btn.disabled = false; m.textContent = koErr(err);
      });
    });
    setTimeout(function () { try { g.querySelector('#tg-email').focus(); } catch (e) {} }, 50);
  }

  function showNoAccess(a) {
    var expired = a.reason === 'expired' && a.expires_at;
    var pending = a.reason === 'not_started' && a.starts_at;
    var title = expired ? '멤버십 기간이<br>끝났어요' : pending ? '멤버십 시작 전이에요' : a.reason === 'not_found' ? '아직 열리지 않은<br>멤버십이에요' : '투자 Tool 멤버십<br>회원 전용 도구예요';
    var body = expired ? '<b>' + fmtDate(a.expires_at) + '</b>에 이용 기간이 끝났어요. 연장하면 바로 다시 쓸 수 있어요.'
      : pending ? '<b>' + fmtDate(a.starts_at) + '</b>부터 쓸 수 있어요.'
      : a.reason === 'not_found' ? '멤버십 상품이 아직 공개 전이에요. 열리면 이 계정으로 바로 쓸 수 있어요.'
      : '배당 · 절세계좌 · 은퇴 자금 · 물타기 계산기를 <b>멤버십 회원</b>에게 드리고 있어요.';
    var shop = a.shop_url ? (/^https?:/.test(a.shop_url) ? a.shop_url : CFG.shopUrl) : CFG.shopUrl;
    var g = card(
      '<span class="tg-tag">🔒 투자 Tool 멤버십 전용</span>' +
      '<h1 id="tg-title">' + title + '</h1>' +
      '<p class="tg-who">로그인: ' + esc(user && user.email) + '</p>' +
      '<p>' + body + '</p>' +
      '<div class="tg-actions">' + (a.reason === 'not_found' || pending ? '' : '<a class="tg-btn" href="' + esc(shop) + '">' + (expired ? '멤버십 연장하기' : '멤버십 알아보기') + '</a>') +
        '<button class="tg-btn ghost" type="button" data-tg="switch">다른 계정으로 로그인</button></div>' +
      links('<a href="' + esc(CFG.roomUrl) + '">내 강의실</a>'));
    g.querySelector('[data-tg="switch"]').addEventListener('click', function () {
      client.auth.signOut().finally(function () { user = null; showLogin(); });
    });
  }

  function showError(msg) {
    var g = card('<h1 id="tg-title">잠시 확인이 어려워요</h1><p>' + esc(msg) + '</p><div class="tg-actions"><button class="tg-btn" type="button" data-tg="retry">다시 시도</button></div>' + links());
    g.querySelector('[data-tg="retry"]').addEventListener('click', function () { start(); });
  }

  // ---- 잠금 풀림 ----
  function badge() {
    if (!CFG.badge || !document.body) return;
    var b = document.getElementById('tg-badge');
    if (!b) { b = document.createElement('div'); b.id = 'tg-badge'; document.body.appendChild(b); }
    var period = access && access.admin ? '관리자' : access && access.expires_at ? 'D-' + Math.max(0, daysLeft(access.expires_at)) : '기간 무제한';
    b.innerHTML = '<button type="button" aria-expanded="false">🔓 멤버십 · ' + esc(period) + '</button>' +
      '<div class="tg-pop" hidden><b>' + esc(user && user.email) + '</b><br>' +
      (access && access.expires_at ? fmtDate(access.expires_at) + '까지 이용할 수 있어요.' : '이용 기간 제한이 없어요.') +
      '<a href="' + esc(CFG.roomUrl) + '">내 강의실</a><button type="button" data-tg="logout">로그아웃</button></div>';
    var btn = b.querySelector('button'), pop = b.querySelector('.tg-pop');
    btn.addEventListener('click', function () { pop.hidden = !pop.hidden; btn.setAttribute('aria-expanded', String(!pop.hidden)); });
    b.querySelector('[data-tg="logout"]').addEventListener('click', function () { api.logout(); });
  }

  function unlock() {
    root.classList.remove('tg-locked');
    badge();
    if (!unlocked) {
      unlocked = true;
      var info = { user: { id: user.id, email: user.email }, access: access };
      resolveReady(info);
      try { window.dispatchEvent(new CustomEvent('tool-gate-unlocked', { detail: info })); } catch (e) {}
    }
  }
  function relock(view) {
    root.classList.add('tg-locked');
    view();
  }

  // ---- 확인 ----
  function check(fromLogin) {
    if (!fromLogin && !unlocked) showChecking();
    return client.rpc('my_access', { p_slug: CFG.product }).then(function (res) {
      if (res.error) throw res.error;
      access = res.data || { ok: false, reason: 'error' };
      lastCheck = Date.now();
      if (access.ok) unlock();
      else if (access.reason === 'login') relock(function () { showLogin(); });
      else relock(function () { showNoAccess(access); });
    });
  }

  function start() {
    showChecking();
    var sdk = window.supabase && window.supabase.createClient ? Promise.resolve() : loadScript(CFG.sdk);
    sdk.then(function () {
      if (!client) {
        client = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
        });
        client.auth.onAuthStateChange(function (event, session) {
          // 다른 탭(강의실 등)에서 로그아웃하면 여기도 잠근다
          if (event === 'SIGNED_OUT') { user = null; access = null; relock(function () { showLogin(); }); }
        });
      }
      return client.auth.getSession();
    }).then(function (res) {
      var s = res && res.data && res.data.session;
      if (!s) { showLogin(); return; }
      user = s.user;
      return check();
    }).catch(function (e) {
      showError(e && e.message === 'sdk' ? '로그인 도구를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.' : koErr(e));
    });
  }

  // 오래 열어 둔 탭으로 돌아오면 멤버십을 다시 확인 (기간 만료·해지 반영)
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && client && user && Date.now() - lastCheck > CFG.recheckMin * 60000) {
      check().catch(function () {});
    }
  });

  var api = {
    ready: ready,
    get client() { return client; },
    get user() { return user; },
    get access() { return access; },
    // 회원 전용 데이터 (Supabase tool_data 테이블). 없으면 null
    data: function (key) {
      return ready.then(function () {
        return client.from('tool_data').select('data').eq('key', key).maybeSingle();
      }).then(function (res) {
        if (res.error) throw res.error;
        return res.data ? res.data.data : null;
      });
    },
    logout: function () {
      if (!client) { location.reload(); return; }
      client.auth.signOut().finally(function () { location.reload(); });
    }
  };
  window.ToolGate = api;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
