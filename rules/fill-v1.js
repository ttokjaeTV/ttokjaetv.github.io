/*
 * 똑재TV 계산기 — 설명 문구 숫자 채우기 (fill-v1)
 *
 * 정적 HTML 문구에 적힌 제도 숫자('7.19%', '1,500만원' 등)를 rules.js(TTOKJAE_RULES) 값으로 채운다.
 * 계산은 하지 않고 글자만 바꾼다. 이 파일도 rules 버전 폴더처럼 배포 후 고치지 않는다(바꿀 일이 생기면 fill-v2.js).
 *
 *   <script src="https://ttokjaetv.github.io/rules/v2026.1/rules.js"></script>
 *   <script src="https://ttokjaetv.github.io/rules/fill-v1.js"></script>
 *
 *   건보료율 <span data-rule="NHIS.healthRate*100">7.19</span>%
 *   분리과세 기준 연 <span data-rule="PENSION.separateLimit/1e4">1,500</span>만원
 *   최고 <span data-rule="INCOME_TAX.brackets.7.1*(1+INCOME_TAX.local)*100">49.5</span>%
 *   거래세 <span data-rule="(TRADE.securitiesTransactionTax.kospi.stt+TRADE.securitiesTransactionTax.kospi.rural)*100" data-fmt="f2">0.20</span>%
 *   <input data-rule="TRADE.secFeePerMillionUsd" data-rule-attr="placeholder" placeholder="20.6">
 *
 * data-rule  : 식. 숫자, rules 경로(점으로 잇고 배열은 번호: INCOME_TAX.brackets.0.1), + − × ÷, 괄호만 쓸 수 있다(eval 안 씀).
 * data-fmt   : 표시 형식. 생략 = 천 단위 쉼표, 소수는 필요한 만큼(부동소수 잡음은 소수 10자리에서 반올림해 지움)
 *              fN = 쉼표 없이 소수 N자리 고정(toFixed) · nN = 쉼표 + 소수 N자리 고정 · i = 쉼표 없이 그대로(연도 등)
 * data-rule-attr : 글자 대신 이 속성 값을 바꾼다.
 * 원래 글자는 그대로 남겨 둔다 → rules.js를 못 불러오면 원래 글자가 보이고, 불러오면 rules 값으로 바뀐다.
 *
 * 페이지 주소에 ?rulescheck 를 붙이면 채운 글자가 원래 글자와 다른 곳을 콘솔에 표로 보여 준다(값이 바뀐 새 버전 확인용).
 * 문서가 다 읽힌 뒤(DOMContentLoaded) 한 번 자동으로 채운다. 나중에 만든 요소는 TTOKJAE_FILL(그 요소)로 채운다.
 */
(function (root) {
  'use strict';

  function evaluate(expr, R) {
    var s = String(expr), i = 0;
    function ws() { while (i < s.length && /\s/.test(s[i])) i++; }
    function fail(msg) { throw new Error(msg + ' (' + s + ')'); }
    function factor() {
      ws();
      var c = s[i];
      if (c === '(') { i++; var v = sum(); ws(); if (s[i] !== ')') fail('괄호가 닫히지 않음'); i++; return v; }
      if (c === '-') { i++; return -factor(); }
      if (c === '+') { i++; return factor(); }
      var m = /^(?:\d+(?:\.\d+)?(?:e[+-]?\d+)?|\.\d+)/i.exec(s.slice(i));
      if (m) { i += m[0].length; return Number(m[0]); }
      m = /^[A-Za-z_]\w*(?:\.\w+)*/.exec(s.slice(i));
      if (m) {
        i += m[0].length;
        var o = R;
        m[0].split('.').forEach(function (k) {
          if (o == null || !(k in Object(o))) fail('rules에 없는 경로: ' + m[0]);
          o = o[k];
        });
        if (typeof o !== 'number') fail('숫자가 아닌 경로: ' + m[0]);
        return o;
      }
      fail('읽을 수 없는 식');
    }
    function prod() {
      var v = factor();
      for (;;) { ws(); var c = s[i]; if (c === '*') { i++; v *= factor(); } else if (c === '/') { i++; v /= factor(); } else return v; }
    }
    function sum() {
      var v = prod();
      for (;;) { ws(); var c = s[i]; if (c === '+') { i++; v += prod(); } else if (c === '-') { i++; v -= prod(); } else return v; }
    }
    var v = sum(); ws();
    if (i < s.length) fail('식 끝에 남은 글자');
    return v;
  }

  function format(v, fmt) {
    var clean = Number(v.toFixed(10));
    var m;
    if (!fmt) return clean.toLocaleString('ko-KR', { maximumFractionDigits: 10 });
    if (fmt === 'i') return String(clean);
    if ((m = /^f(\d+)$/.exec(fmt))) return clean.toFixed(+m[1]);
    if ((m = /^n(\d+)$/.exec(fmt))) return clean.toLocaleString('ko-KR', { minimumFractionDigits: +m[1], maximumFractionDigits: +m[1] });
    throw new Error('모르는 data-fmt: ' + fmt);
  }

  function fill(scope) {
    var R = root.TTOKJAE_RULES;
    if (!R || typeof document === 'undefined') return [];
    var base = scope || document;
    var els = Array.prototype.slice.call(base.querySelectorAll('[data-rule]'));
    if (base.nodeType === 1 && base.hasAttribute('data-rule')) els.unshift(base);
    var diffs = [];
    els.forEach(function (el) {
      try {
        var out = format(evaluate(el.getAttribute('data-rule'), R), el.getAttribute('data-fmt'));
        var attr = el.getAttribute('data-rule-attr');
        var before = attr ? el.getAttribute(attr) : el.textContent;
        if (before !== out) diffs.push({ rule: el.getAttribute('data-rule'), 원래: before, 채움: out });
        if (attr) el.setAttribute(attr, out); else el.textContent = out;
      } catch (e) {
        if (root.console) console.warn('[fill-v1]', e.message, el);
      }
    });
    if (diffs.length && /[?&]rulescheck\b/.test((root.location && root.location.search) || '') && root.console) {
      console.warn('[fill-v1] 원래 글자와 다른 곳 ' + diffs.length + '개');
      if (console.table) console.table(diffs);
    }
    return diffs;
  }

  root.TTOKJAE_FILL = fill;
  if (typeof module !== 'undefined' && module.exports) module.exports = { fill: fill, evaluate: evaluate, format: format };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { fill(); });
    else fill();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
