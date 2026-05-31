/*!
 * GoNoGo Feedback Widget (v2)
 *
 * Drop-in script with rich customisation:
 *   <script src="https://gonogo.co.uk/cx-widget.js"
 *           data-token="abc123"
 *           data-mode="tab"
 *           data-position="right"
 *           data-vertical="middle"
 *           data-label="Feedback"
 *           data-icon="chat"
 *           data-color="#11a551"
 *           data-text-color="#ffffff"
 *           data-radius="8"
 *           data-size="md"
 *           data-pulse="false"
 *           data-trigger="manual"
 *           data-delay="5"
 *           data-scroll="50"
 *           data-frequency="session"
 *           data-include="*"
 *           data-exclude=""
 *           data-sample="100"
 *           data-animation="slide"
 *   ></script>
 *
 * Modes: tab | bubble | inline | modal
 * Triggers: manual | time | scroll | exit_intent | click
 * Frequency: always | session | day | week | once_dismissed | once_submitted
 *
 * Public API:
 *   window.GoNoGoCx.open(), .close(), .reload(config)
 *   window.gonogoOnSubmit(payload)  // user-defined callback
 */
(function () {
  'use strict';
  if (window.__gonogoCxWidget) return;
  window.__gonogoCxWidget = true;

  var script = document.currentScript || (function () {
    var all = document.getElementsByTagName('script');
    return all[all.length - 1];
  })();
  if (!script) return;

  // -------- read config from data-* (with sensible defaults) --------
  var d = script.dataset || {};
  var cfg = {
    token: d.token || '',
    mode: (d.mode || 'tab').toLowerCase(),
    position: (d.position || 'right').toLowerCase(),
    vertical: (d.vertical || 'middle').toLowerCase(),  // top | middle | bottom
    label: d.label || 'Feedback',
    icon: (d.icon || 'chat').toLowerCase(),            // chat | star | smiley | megaphone | none
    color: d.color || '#11a551',
    textColor: d.textColor || '#ffffff',
    radius: parseInt(d.radius || '8', 10),
    size: (d.size || 'md').toLowerCase(),              // sm | md | lg
    pulse: String(d.pulse || 'false').toLowerCase() === 'true',
    ping: String(d.ping || 'false').toLowerCase() === 'true',
    tooltip: d.tooltip || '',
    trigger: (d.trigger || 'manual').toLowerCase(),    // manual | time | scroll | exit_intent | click
    delay: parseInt(d.delay || '0', 10),                // seconds
    scroll: parseInt(d.scroll || '50', 10),             // % of page
    selector: d.selector || '',                         // for trigger=click
    frequency: (d.frequency || 'always').toLowerCase(),
    include: d.include || '*',                          // comma-separated URL patterns
    exclude: d.exclude || '',
    sample: parseInt(d.sample || '100', 10),            // % of visitors
    animation: (d.animation || 'slide').toLowerCase(),  // slide | fade | scale
    target: d.target || '#gonogo-cx',                   // inline target
    src: d.src || (d.mode || 'tab').toLowerCase(),
    closable: String(d.closable || 'true').toLowerCase() !== 'false'
  };
  if (!cfg.token) { console.warn('[GoNoGo] cx-widget.js: data-token is required'); return; }

  // expose for runtime reconfiguration (used by preview)
  var host = (function () {
    try { return new URL(script.src, location.href).origin; }
    catch (e) { return 'https://gonogo.co.uk'; }
  })();
  function surveyUrl() {
    // Use clean URL (no .html) so Vercel doesn't 308-redirect inside the iframe
    return host + '/cx-survey?t=' + encodeURIComponent(cfg.token) +
           '&embed=1&src=' + encodeURIComponent(cfg.src || cfg.mode);
  }

  // -------- frequency / targeting helpers --------
  var keyBase = 'gonogo_cx_' + cfg.token + '_';
  function lsGet(k){ try { return localStorage.getItem(keyBase + k); } catch(_) { return null; } }
  function lsSet(k,v){ try { localStorage.setItem(keyBase + k, v); } catch(_) {} }
  function ssGet(k){ try { return sessionStorage.getItem(keyBase + k); } catch(_) { return null; } }
  function ssSet(k,v){ try { sessionStorage.setItem(keyBase + k, v); } catch(_) {} }

  function frequencyAllows() {
    var freq = cfg.frequency;
    if (freq === 'always') return true;
    if (freq === 'once_submitted' && lsGet('submitted')) return false;
    if (freq === 'once_dismissed' && lsGet('dismissed')) return false;
    if (freq === 'session' && ssGet('shown')) return false;
    if (freq === 'day') {
      var last = parseInt(lsGet('shown_at') || '0', 10);
      if (Date.now() - last < 24 * 3600 * 1000) return false;
    }
    if (freq === 'week') {
      var last2 = parseInt(lsGet('shown_at') || '0', 10);
      if (Date.now() - last2 < 7 * 24 * 3600 * 1000) return false;
    }
    return true;
  }
  function markShown() {
    ssSet('shown', '1');
    lsSet('shown_at', String(Date.now()));
  }

  function urlMatches(patterns, href) {
    if (!patterns) return false;
    var parts = String(patterns).split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p === '*') return true;
      // glob: convert * to .*, escape other regex chars
      var rx = new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
      if (rx.test(href)) return true;
    }
    return false;
  }
  function targetingAllows() {
    var href = location.href;
    if (!urlMatches(cfg.include, href)) return false;
    if (cfg.exclude && urlMatches(cfg.exclude, href)) return false;
    if (cfg.sample < 100) {
      // stable bucket per visitor
      var bucket = parseInt(lsGet('bucket') || '', 10);
      if (isNaN(bucket)) { bucket = Math.floor(Math.random() * 100); lsSet('bucket', String(bucket)); }
      if (bucket >= cfg.sample) return false;
    }
    return true;
  }

  // -------- icon set (inline SVG) --------
  var ICONS = {
    chat: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z"/></svg>',
    star: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="m12 2 3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/></svg>',
    smiley: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/></svg>',
    megaphone: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M3 11v2a2 2 0 0 0 2 2h2l5 4V5L7 9H5a2 2 0 0 0-2 2zm14-4v10a4 4 0 0 0 0-10z"/></svg>',
    none: ''
  };

  // -------- styles --------
  var STYLE_ID = 'gng-cx-style';
  if (!document.getElementById(STYLE_ID)) {
    var styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = [
      '.gng-cx-launcher{position:fixed;z-index:2147483600;border:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-weight:600;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.18);transition:transform .15s ease,opacity .15s ease,box-shadow .15s ease;letter-spacing:.2px;display:inline-flex;align-items:center;gap:8px;line-height:1}',
      '.gng-cx-launcher:hover{transform:translateY(-1px);opacity:.96;box-shadow:0 12px 28px rgba(0,0,0,.22)}',
      '.gng-cx-launcher.size-sm{padding:8px 14px;font-size:12px}',
      '.gng-cx-launcher.size-md{padding:11px 18px;font-size:14px}',
      '.gng-cx-launcher.size-lg{padding:14px 22px;font-size:15px}',

      '.gng-cx-launcher.tab-right{right:0;transform-origin:right top;border-radius:8px 8px 0 0}',
      '.gng-cx-launcher.tab-left{left:0;transform-origin:left top;border-radius:8px 8px 0 0}',
      '.gng-cx-launcher.tab-right.v-top{top:80px;transform:rotate(-90deg) translateX(100%)}',
      '.gng-cx-launcher.tab-right.v-middle{top:50%;transform:rotate(-90deg) translate(50%,-50%)}',
      '.gng-cx-launcher.tab-right.v-bottom{bottom:80px;transform:rotate(-90deg) translateX(100%)}',
      '.gng-cx-launcher.tab-left.v-top{top:80px;transform:rotate(90deg) translateX(-100%)}',
      '.gng-cx-launcher.tab-left.v-middle{top:50%;transform:rotate(90deg) translate(-50%,-50%)}',
      '.gng-cx-launcher.tab-left.v-bottom{bottom:80px;transform:rotate(90deg) translateX(-100%)}',

      '.gng-cx-launcher.bubble{border-radius:999px}',
      '.gng-cx-launcher.bubble.pos-bottom-right,.gng-cx-launcher.bubble.pos-right{right:20px;bottom:20px}',
      '.gng-cx-launcher.bubble.pos-bottom-left,.gng-cx-launcher.bubble.pos-left{left:20px;bottom:20px}',

      '.gng-cx-launcher.pulse{animation:gngPulse 2.2s ease-out infinite}',
      '@keyframes gngPulse{0%{box-shadow:0 8px 24px rgba(0,0,0,.18),0 0 0 0 rgba(17,165,81,.55)}70%{box-shadow:0 8px 24px rgba(0,0,0,.18),0 0 0 14px rgba(17,165,81,0)}100%{box-shadow:0 8px 24px rgba(0,0,0,.18),0 0 0 0 rgba(17,165,81,0)}}',

      '.gng-cx-ping{position:absolute;top:-4px;right:-4px;width:10px;height:10px;border-radius:50%;background:#ef4444;box-shadow:0 0 0 2px #fff}',
      '.gng-cx-launcher .gng-cx-ping-wrap{position:relative;display:inline-flex}',

      '.gng-cx-tooltip{position:absolute;background:#0f172a;color:#fff;padding:6px 10px;border-radius:6px;font-size:12px;font-weight:500;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .15s}',
      '.gng-cx-launcher:hover .gng-cx-tooltip{opacity:1}',

      '.gng-cx-overlay{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:2147483601;opacity:0;transition:opacity .2s ease;pointer-events:none}',
      '.gng-cx-overlay.open{opacity:1;pointer-events:auto}',

      '.gng-cx-panel{position:fixed;z-index:2147483602;background:#fff;box-shadow:0 12px 48px rgba(0,0,0,.25);display:flex;flex-direction:column;transition:transform .25s cubic-bezier(.2,.7,.2,1),opacity .25s ease}',
      '.gng-cx-panel.side{top:0;bottom:0;width:min(440px,100vw)}',
      '.gng-cx-panel.side.from-right{right:0;transform:translateX(100%)}',
      '.gng-cx-panel.side.from-left{left:0;transform:translateX(-100%)}',
      '.gng-cx-panel.side.open{transform:translateX(0)}',
      '.gng-cx-panel.modal{left:50%;top:50%;transform:translate(-50%,-50%) scale(.94);opacity:0;width:min(520px,calc(100vw - 32px));height:min(640px,calc(100vh - 32px));border-radius:14px;overflow:hidden}',
      '.gng-cx-panel.modal.open{transform:translate(-50%,-50%) scale(1);opacity:1}',
      '.gng-cx-panel.anim-fade.side{transform:none;opacity:0}',
      '.gng-cx-panel.anim-fade.side.open{opacity:1}',
      '@media (max-width:540px){.gng-cx-panel.side{width:100vw}.gng-cx-panel.modal{width:100vw;height:100vh;border-radius:0}}',

      '.gng-cx-panel-head{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #e5e7eb;background:#fff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif}',
      '.gng-cx-panel-title{font-size:14px;font-weight:600;color:#0f172a;display:flex;align-items:center;gap:8px}',
      '.gng-cx-close{appearance:none;background:transparent;border:0;font-size:22px;line-height:1;color:#64748b;cursor:pointer;padding:4px 8px;border-radius:6px}',
      '.gng-cx-close:hover{background:#f1f5f9;color:#0f172a}',
      '.gng-cx-frame{flex:1;width:100%;border:0;background:#f8fafc}',

      '.gng-cx-inline-wrap{width:100%;min-height:520px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff}',
      '.gng-cx-inline-frame{width:100%;height:100%;min-height:520px;border:0;display:block}',

      '@media (prefers-reduced-motion: reduce){.gng-cx-panel,.gng-cx-overlay,.gng-cx-launcher,.gng-cx-launcher.pulse{transition:none;animation:none}}'
    ].join('\n');
    document.head.appendChild(styleEl);
  }

  // -------- inline mode --------
  function mountInline() {
    var target = document.querySelector(cfg.target);
    if (!target) { console.warn('[GoNoGo] cx-widget.js: inline target not found:', cfg.target); return; }
    target.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'gng-cx-inline-wrap';
    var f = document.createElement('iframe');
    f.className = 'gng-cx-inline-frame';
    f.src = surveyUrl();
    f.setAttribute('title', cfg.label);
    f.setAttribute('loading', 'lazy');
    wrap.appendChild(f);
    target.appendChild(wrap);
    markShown();
  }

  // -------- modal / panel --------
  var overlay, panel, frame, launcher;
  var isOpen = false;
  var lastFocus = null;

  function buildPanel() {
    overlay = document.createElement('div');
    overlay.className = 'gng-cx-overlay';
    if (cfg.closable) overlay.addEventListener('click', close);

    panel = document.createElement('div');
    var isModal = (cfg.mode === 'modal');
    var animCls = 'anim-' + cfg.animation;
    if (isModal) {
      panel.className = 'gng-cx-panel modal ' + animCls;
    } else {
      var side = (cfg.position === 'left' || cfg.position === 'bottom-left') ? 'from-left' : 'from-right';
      panel.className = 'gng-cx-panel side ' + side + ' ' + animCls;
    }
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', cfg.label);

    var head = document.createElement('div');
    head.className = 'gng-cx-panel-head';
    var title = document.createElement('div');
    title.className = 'gng-cx-panel-title';
    title.innerHTML = (ICONS[cfg.icon] || '') + '<span>' + escapeHTML(cfg.label) + '</span>';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gng-cx-close';
    btn.innerHTML = '&times;';
    btn.setAttribute('aria-label', 'Close');
    btn.addEventListener('click', close);
    head.appendChild(title);
    if (cfg.closable) head.appendChild(btn);

    frame = document.createElement('iframe');
    frame.className = 'gng-cx-frame';
    frame.setAttribute('title', cfg.label);
    frame.setAttribute('loading', 'lazy');

    panel.appendChild(head);
    panel.appendChild(frame);
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
  }

  function open() {
    if (isOpen) return;
    if (!panel) buildPanel();
    if (!frame.src) frame.src = surveyUrl();
    lastFocus = document.activeElement;
    overlay.classList.add('open');
    requestAnimationFrame(function () { panel.classList.add('open'); });
    isOpen = true;
    markShown();
    document.addEventListener('keydown', onKey);
  }
  function close() {
    if (!isOpen) return;
    panel.classList.remove('open');
    overlay.classList.remove('open');
    isOpen = false;
    document.removeEventListener('keydown', onKey);
    lsSet('dismissed', '1');
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (_) {} }
  }
  function onKey(e) { if (e.key === 'Escape' && cfg.closable) close(); }

  // -------- launcher --------
  function buildLauncher() {
    launcher = document.createElement('button');
    launcher.type = 'button';
    var iconHtml = ICONS[cfg.icon] || '';
    var labelHtml = cfg.label ? '<span>' + escapeHTML(cfg.label) + '</span>' : '';
    var pingHtml = cfg.ping ? '<span class="gng-cx-ping-wrap">' + iconHtml + '<span class="gng-cx-ping"></span></span>' : iconHtml;
    var tooltipHtml = cfg.tooltip ? '<span class="gng-cx-tooltip" style="bottom:calc(100% + 8px);left:50%;transform:translateX(-50%)">' + escapeHTML(cfg.tooltip) + '</span>' : '';
    launcher.innerHTML = pingHtml + labelHtml + tooltipHtml;

    var sizeCls = 'size-' + (['sm','md','lg'].indexOf(cfg.size) >= 0 ? cfg.size : 'md');
    var pulseCls = cfg.pulse ? ' pulse' : '';
    if (cfg.mode === 'bubble') {
      launcher.className = 'gng-cx-launcher bubble pos-' + cfg.position + ' ' + sizeCls + pulseCls;
    } else if (cfg.mode === 'tab') {
      var side = cfg.position === 'left' ? 'left' : 'right';
      var vCls = 'v-' + (['top','middle','bottom'].indexOf(cfg.vertical) >= 0 ? cfg.vertical : 'middle');
      launcher.className = 'gng-cx-launcher tab-' + side + ' ' + vCls + ' ' + sizeCls + pulseCls;
    } else {
      launcher.className = 'gng-cx-launcher bubble pos-bottom-right ' + sizeCls + pulseCls;
    }
    launcher.style.background = cfg.color;
    launcher.style.color = cfg.textColor;
    if (cfg.radius != null) launcher.style.borderRadius = cfg.radius + 'px';
    launcher.addEventListener('click', open);
    document.body.appendChild(launcher);
  }

  // -------- triggers --------
  function setupTriggers() {
    if (cfg.trigger === 'manual') return; // launcher click opens it
    var fired = false;
    function fire() {
      if (fired) return; fired = true;
      open();
    }
    if (cfg.trigger === 'time') {
      setTimeout(fire, Math.max(0, cfg.delay * 1000));
    } else if (cfg.trigger === 'scroll') {
      var pct = Math.max(1, Math.min(100, cfg.scroll || 50));
      var onScroll = function () {
        var h = document.documentElement;
        var sp = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
        if (sp >= pct) { window.removeEventListener('scroll', onScroll); fire(); }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
    } else if (cfg.trigger === 'exit_intent') {
      var onLeave = function (e) {
        if (e.clientY <= 0 || e.relatedTarget == null) { document.removeEventListener('mouseout', onLeave); fire(); }
      };
      document.addEventListener('mouseout', onLeave);
      // mobile fallback: visibilitychange
      var onHide = function () { if (document.visibilityState === 'hidden') { document.removeEventListener('visibilitychange', onHide); fire(); } };
      document.addEventListener('visibilitychange', onHide);
    } else if (cfg.trigger === 'click') {
      if (!cfg.selector) return;
      document.addEventListener('click', function (e) {
        if (e.target && e.target.closest && e.target.closest(cfg.selector)) { fire(); }
      });
    }
  }

  // -------- submit message from survey --------
  window.addEventListener('message', function (e) {
    if (!e || !e.data) return;
    var data = e.data;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch (_) { return; } }
    if (data && data.type === 'gonogo:cx:submitted') {
      lsSet('submitted', '1');
      setTimeout(close, 1800);
      try { if (typeof window.gonogoOnSubmit === 'function') window.gonogoOnSubmit(data); } catch (_) {}
    }
  });

  // -------- escape --------
  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }

  // -------- boot --------
  function boot() {
    if (cfg.mode === 'inline') { mountInline(); return; }
    if (!targetingAllows()) return;
    if (!frequencyAllows()) return;
    // always build a launcher unless trigger=manual+mode=modal explicitly hides it; keeping launcher is friendly
    if (cfg.mode !== 'modal' || cfg.trigger === 'manual') buildLauncher();
    setupTriggers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // -------- public API (for runtime reconfig / preview iframe) --------
  window.GoNoGoCx = {
    open: open,
    close: close,
    config: function () { return Object.assign({}, cfg); },
    reload: function (newCfg) {
      // tear down
      if (launcher) launcher.remove();
      if (panel) panel.remove();
      if (overlay) overlay.remove();
      launcher = panel = overlay = frame = null;
      isOpen = false;
      Object.assign(cfg, newCfg || {});
      // re-boot (skip frequency/targeting in preview mode)
      if (cfg.mode === 'inline') { mountInline(); return; }
      if (cfg._preview || (targetingAllows() && frequencyAllows())) {
        if (cfg.mode !== 'modal' || cfg.trigger === 'manual') buildLauncher();
        setupTriggers();
      }
    }
  };
})();
