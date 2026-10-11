/*!
 * 똑재TV 우수회원 입장 게이트 (member-gate.js)
 * ------------------------------------------------------------
 * 쓰는 곳: 포트폴리오 관리 도구, 하락장 물타기 계산기
 *   <head> 맨 위(charset 바로 아래)에
 *   <script src="https://ttokjaetv.github.io/member-gate.js"></script>
 *
 * 코드 교체(분기마다 또는 유출 의심 시):
 *   1) 아래 GATE.version 을 새 값으로, GATE.verifier 를 새 코드의 검증값으로 바꾼다.
 *      검증값 = base64( PBKDF2-SHA256(정규화된 코드, "ttokjae-member-verify-v1", 200000회, 32바이트) )
 *      (README.md 에 계산 명령이 있다)
 *   2) Water-Calc 레포 Settings → Secrets → Actions 의 MEMBER_CODE 를 새 코드로 바꾸고
 *      Actions 에서 "데이터 갱신 및 배포"를 deploy 로 한 번 실행한다 (데이터 재암호화).
 *   버전이 바뀌면 회원 기기에 저장된 예전 코드는 무효가 되어 새 코드를 다시 묻는다.
 *
 * 한계: 브라우저에서 확인하는 방식이라 코드를 아는 사람의 공유까지는 막지 못한다.
 * 물타기 계산기의 데이터는 이 코드로 암호화돼 있어 코드 없이는 읽을 수 없다.
 */
(function () {
  'use strict';

  var GATE = {
    version: '2026-10',
    verifySalt: 'ttokjae-member-verify-v1',
    keySalt: 'ttokjae-member-key-v1',
    iterations: 200000,
    verifier: 'dC4LGmnW9vnBmxcHabgO1X/0HhddHOB/8PB7g0ELcBo=',
    storeKey: 'ttokjae-member',
    cafeUrl: 'https://cafe.naver.com/ttokjae',
    hubUrl: 'https://ttokjaetv.github.io/'
  };

  var root = document.documentElement;
  root.classList.add('mg-locked');

  // ---- 화면 가리기 (본문은 렌더링되도록 visibility 로만 숨긴다: 차트 크기 계산 보존) ----
  var css = [
    'html.mg-locked, html.mg-locked body { overflow: hidden !important; }',
    'html.mg-locked body > *:not(#mg-gate) { visibility: hidden !important; }',
    '#mg-gate { position: fixed; inset: 0; z-index: 2147483000; background: #F5EFE6; display: flex; align-items: center; justify-content: center; padding: 24px 16px; font-family: "Pretendard", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; color: #1A1A1A; -webkit-font-smoothing: antialiased; overflow-y: auto; }',
    'html:not(.mg-locked) #mg-gate { display: none; }',
    '#mg-gate .mg-card { width: 100%; max-width: 440px; background: #FBF7F0; border: 1px solid #E5DCC8; border-radius: 20px; padding: 32px 28px; box-shadow: 0 18px 40px -24px rgba(58,47,38,.35); }',
    '#mg-gate .mg-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 22px; }',
    '#mg-gate .mg-logo i { width: 34px; height: 34px; border-radius: 9px; background: #3A2F26; color: #FBF7F0; display: flex; align-items: center; justify-content: center; font-style: normal; font-weight: 900; font-size: 17px; }',
    '#mg-gate .mg-logo b { font-size: 16px; font-weight: 900; letter-spacing: -.4px; }',
    '#mg-gate .mg-tag { display: inline-block; font-size: 12px; font-weight: 800; color: #8B6F47; background: #EFE7DA; border: 1px solid #C4A57B; border-radius: 999px; padding: 5px 12px; margin-bottom: 14px; }',
    '#mg-gate h1 { font-size: 24px; font-weight: 900; letter-spacing: -.6px; line-height: 1.35; margin: 0 0 10px; }',
    '#mg-gate p { font-size: 15px; font-weight: 500; color: #4A4A4A; line-height: 1.7; margin: 0 0 20px; }',
    '#mg-gate p b { color: #1A1A1A; font-weight: 800; }',
    '#mg-gate form { display: flex; gap: 8px; }',
    '#mg-gate input { flex: 1; min-width: 0; font: inherit; font-size: 17px; font-weight: 700; color: #1A1A1A; background: #fff; border: 1.5px solid #E5DCC8; border-radius: 12px; padding: 14px 14px; }',
    '#mg-gate input:focus { outline: none; border-color: #D9542B; box-shadow: 0 0 0 3px #F4D5C4; }',
    '#mg-gate button { font: inherit; font-size: 16px; font-weight: 800; color: #FBF7F0; background: #D9542B; border: 0; border-radius: 12px; padding: 0 20px; cursor: pointer; white-space: nowrap; }',
    '#mg-gate button[disabled] { opacity: .6; cursor: default; }',
    '#mg-gate .mg-msg { min-height: 22px; font-size: 14px; font-weight: 700; margin-top: 10px; color: #A03D1F; }',
    '#mg-gate .mg-msg.ok { color: #4A5A4A; }',
    '#mg-gate .mg-hint { font-size: 13px; font-weight: 500; color: #8B8276; margin: 6px 0 22px; line-height: 1.6; }',
    '#mg-gate .mg-links { display: flex; gap: 8px; flex-wrap: wrap; padding-top: 18px; border-top: 1px solid #E5DCC8; }',
    '#mg-gate .mg-links a { font-size: 13px; font-weight: 700; color: #1A1A1A; text-decoration: none; background: #fff; border: 1.5px solid #E5DCC8; border-radius: 8px; padding: 8px 12px; display: inline-flex; align-items: center; gap: 6px; }',
    '#mg-gate .mg-links a .n { width: 16px; height: 16px; border-radius: 3px; background: #03C75A; color: #fff; font-weight: 900; font-size: 11px; display: inline-flex; align-items: center; justify-content: center; }',
    '@media (max-width: 480px) { #mg-gate .mg-card { padding: 26px 20px; } #mg-gate h1 { font-size: 21px; } #mg-gate form { flex-direction: column; } #mg-gate button { padding: 14px; } }'
  ].join('\n');
  var st = document.createElement('style');
  st.id = 'mg-style';
  st.textContent = css;
  (document.head || root).appendChild(st);

  // ---- 공용 함수 ----
  var enc = new TextEncoder();
  function norm(s) { return String(s || '').trim().toLowerCase().replace(/[\s\-_.]+/g, ''); }
  function b64(buf) { var s = '', a = new Uint8Array(buf); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
  function unb64(s) { var bin = atob(s), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
  function load() { try { return JSON.parse(localStorage.getItem(GATE.storeKey) || 'null'); } catch (e) { return null; } }
  function save(code) { try { localStorage.setItem(GATE.storeKey, JSON.stringify({ v: GATE.version, code: code })); } catch (e) {} }
  function forget() { try { localStorage.removeItem(GATE.storeKey); } catch (e) {} }

  function pbkdf2Bits(code, salt) {
    return crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveBits'])
      .then(function (k) {
        return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: GATE.iterations }, k, 256);
      });
  }
  function verify(code) {
    return pbkdf2Bits(code, GATE.verifySalt).then(function (bits) { return b64(bits) === GATE.verifier; });
  }

  var resolveReady;
  var ready = new Promise(function (r) { resolveReady = r; });
  var keyPromise = null;

  function unlock(code) {
    save(code);
    root.classList.remove('mg-locked');
    resolveReady(code);
    try { window.dispatchEvent(new CustomEvent('member-unlocked')); } catch (e) {}
  }

  // 물타기 계산기 데이터 복호화: {"__enc":1,"iv":..,"ct":..} → 원문 문자열
  function decrypt(text) {
    return ready.then(function (code) {
      if (!keyPromise) {
        keyPromise = crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey'])
          .then(function (k) {
            return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(GATE.keySalt), iterations: GATE.iterations },
              k, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
          });
      }
      return keyPromise;
    }).then(function (key) {
      var env = JSON.parse(text);
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, key, unb64(env.ct)).then(function (plain) {
        if (env.z && typeof DecompressionStream !== 'undefined') {
          var ds = new Blob([plain]).stream().pipeThrough(new DecompressionStream('deflate'));
          return new Response(ds).text();
        }
        if (env.z) throw new Error('이 브라우저는 압축 해제를 지원하지 않습니다. 브라우저를 최신 버전으로 업데이트해 주세요.');
        return new TextDecoder().decode(plain);
      });
    });
  }

  window.MemberGate = {
    ready: ready,
    decrypt: decrypt,
    isEncrypted: function (text) { return typeof text === 'string' && text.slice(0, 12).indexOf('"__enc"') !== -1; },
    logout: function () { forget(); location.reload(); }
  };

  // ---- 입장 화면 ----
  function build() {
    if (document.getElementById('mg-gate')) return;
    var g = document.createElement('div');
    g.id = 'mg-gate';
    g.setAttribute('role', 'dialog');
    g.setAttribute('aria-modal', 'true');
    g.innerHTML =
      '<div class="mg-card">' +
        '<div class="mg-logo"><i>똑</i><b>똑재TV</b></div>' +
        '<span class="mg-tag">🔒 우수회원 전용</span>' +
        '<h1>우수회원 입장 코드를<br>입력해 주세요</h1>' +
        '<p>이 도구는 <b>평생 ETF 투자 카페 우수회원 이상</b>에게 드리는 도구입니다. 입장 코드는 카페 <b>우수회원 게시판 공지</b>에서 확인할 수 있습니다.</p>' +
        '<form autocomplete="off"><input id="mg-input" type="text" inputmode="text" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="입장 코드" aria-label="입장 코드"><button type="submit">입장</button></form>' +
        '<div class="mg-msg" id="mg-msg" aria-live="polite"></div>' +
        '<div class="mg-hint">한 번 입력하면 이 기기에서는 다시 묻지 않습니다. 코드가 바뀌면 새 코드를 한 번 더 입력하시면 됩니다.</div>' +
        '<div class="mg-links"><a href="' + GATE.cafeUrl + '" target="_blank" rel="noopener"><span class="n">N</span>평생 ETF 투자 카페</a><a href="' + GATE.hubUrl + '">다른 무료 계산기 보기</a></div>' +
      '</div>';
    document.body.appendChild(g);
    var form = g.querySelector('form'), input = g.querySelector('#mg-input'), msg = g.querySelector('#mg-msg'), btn = g.querySelector('button');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var code = norm(input.value);
      if (!code) { msg.className = 'mg-msg'; msg.textContent = '입장 코드를 입력해 주세요.'; input.focus(); return; }
      btn.disabled = true; msg.className = 'mg-msg ok'; msg.textContent = '확인 중…';
      verify(code).then(function (ok) {
        btn.disabled = false;
        if (ok) { unlock(code); }
        else { msg.className = 'mg-msg'; msg.textContent = '코드가 맞지 않습니다. 카페 공지의 최신 코드를 확인해 주세요.'; input.select(); }
      }).catch(function () {
        btn.disabled = false; msg.className = 'mg-msg';
        msg.textContent = '이 브라우저에서는 확인할 수 없습니다. 크롬·사파리 최신 버전으로 열어 주세요.';
      });
    });
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 50);
  }

  function start() {
    var saved = load();
    if (saved && saved.v === GATE.version && saved.code && window.crypto && crypto.subtle) {
      verify(saved.code).then(function (ok) {
        if (ok) unlock(saved.code); else { forget(); build(); }
      }).catch(build);
      // 확인이 끝날 때까지 잠깐 비어 보이지 않도록 화면은 미리 만들어 둔다
      if (document.body) build();
    } else {
      build();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
