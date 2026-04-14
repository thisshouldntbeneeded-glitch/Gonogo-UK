// GoNoGo UK — Shared Components
// Reusable rendering functions for public and admin pages

const LOGO_URL = 'logos/gonogo-square.jpg';
const HERO_LOGO_DARK = 'logos/gonogo-hero-dark.jpg';
const HERO_LOGO_LIGHT = 'logos/gonogo-hero-light.jpg';
const SITE_REGION = 'uk';

// Supabase Auth client (public accounts — separate from admin/brand auth)
const supabaseAuth = (typeof supabase !== 'undefined' && supabase.createClient)
  ? supabase.createClient(
      'https://fnpxaneextqidbessnej.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZucHhhbmVleHRxaWRiZXNzbmVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NzI5NzUsImV4cCI6MjA4ODU0ODk3NX0.dX140oHkk_AfBjFPo-MfJvMVJLsJ7WJJZGAIJBeC10I'
    )
  : null;

const Components = {
  // ============================================================
  // HTML ESCAPING (XSS prevention)
  // ============================================================
  escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  // ============================================================
  // LOGO HELPER
  // ============================================================
  getBrandInitials(name) {
    // Strip parenthesised text and non-alpha chars, then take first letters
    const clean = name.replace(/\s*\([^)]*\)/g, '').trim();
    const words = clean.split(/\s+/).filter(w => /^[A-Za-z]/.test(w));
    if (words.length === 0) return name.substring(0, 2).toUpperCase();
    return words.map(w => w[0]).join('').substring(0, 2).toUpperCase();
  },

  getLogoFallback(name, size = 48) {
    const colors = ['#e74c3c', '#3b82f6', '#11a551', '#ff9800', '#8b5cf6', '#06b6d4', '#ec4899', '#f59e0b'];
    const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const color = colors[hash % colors.length];
    const initials = this.getBrandInitials(name);
    const fontSize = size * 0.38;
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size*0.16}" fill="${color}"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="white" font-family="Inter,system-ui,sans-serif" font-weight="700" font-size="${fontSize}">${initials}</text></svg>`)}`;
  },

  renderLogo(brand, className = 'brand-logo') {
    const size = className.includes('hero') ? 120 : className.includes('xl') ? 96 : className.includes('lg') ? 48 : 32;
    const fallback = this.getLogoFallback(brand.name, size);
    if (brand.logo) {
      return `<img src="${brand.logo}" alt="${brand.name}" class="${className}" loading="lazy" onerror="this.onerror=null;this.src='${fallback}'">`;
    }
    return `<img src="${fallback}" alt="${brand.name}" class="${className}">`;
  },

  // ============================================================
  // NAVIGATION
  // ============================================================
 renderPublicNav(activePage) {
  const links = [
    { href: 'index.html', label: 'Home', icon: 'fa-house', id: 'home' },
    { href: 'compare.html', label: 'Compare', icon: 'fa-code-compare', id: 'compare' },
    { href: 'about.html', label: 'About', icon: 'fa-circle-info', id: 'about' },
    { href: 'business.html', label: 'For Business', icon: 'fa-briefcase', id: 'business' },
    // Admin link hidden from public nav — access via /admin.html directly
  ];

    var themeIcon = document.documentElement.classList.contains('light-mode') ? 'fa-moon' : 'fa-sun';

    return `
      <header class="site-header">
        <div class="container">
          <a href="index.html" class="logo">
            <img src="${LOGO_URL}" alt="GoNoGo" style="height:32px;width:auto;border-radius:6px;">
          </a>
          <nav>
            <ul class="nav-links">
              ${links.map(l => `
                <li><a href="${l.href}" class="${activePage === l.id ? 'active' : ''}">
                  <i class="fa-solid ${l.icon}"></i> ${l.label}
                </a></li>
              `).join('')}
              <li>
                <button class="theme-toggle nav-theme-toggle" onclick="Components.toggleTheme()" aria-label="Toggle light/dark mode" title="Toggle light/dark mode">
                  <i class="fa-solid ${themeIcon} theme-toggle-icon"></i>
                </button>
              </li>
              <li id="nav-auth-desktop">
                <button class="btn btn-sm btn-auth-nav" onclick="Components.showAuthModal()">
                  <i class="fa-solid fa-user"></i> Sign In
                </button>
              </li>
            </ul>
          </nav>
          <button class="hamburger" onclick="Components.toggleMobileNav()" aria-label="Menu">
            <i class="fa-solid fa-bars" id="hamburger-icon"></i>
          </button>
        </div>
      </header>
      <div class="mobile-nav" id="mobile-nav">
        ${links.map(l => `
          <a href="${l.href}" class="${activePage === l.id ? 'active' : ''}">
            <i class="fa-solid ${l.icon}"></i> ${l.label}
          </a>
        `).join('')}
        <button class="theme-toggle" onclick="Components.toggleTheme()" aria-label="Toggle light/dark mode">
          <i class="fa-solid ${themeIcon} theme-toggle-icon"></i>
          <span class="theme-toggle-label">Toggle Theme</span>
        </button>
        <div id="nav-auth-mobile">
          <button class="btn btn-sm btn-auth-nav" onclick="Components.showAuthModal()" style="margin-top:var(--space-2);width:100%">
            <i class="fa-solid fa-user"></i> Sign In
          </button>
        </div>
      </div>
    `;
  },

  renderAdminSidebar(activePage) {
    const links = [
      { href: 'admin.html', label: 'Dashboard', icon: 'fa-gauge', id: 'dashboard' },
      { href: 'admin-brands.html', label: 'Brands', icon: 'fa-tags', id: 'brands' },
      { href: 'admin-comments.html', label: 'Comments', icon: 'fa-comments', id: 'comments' },
      { href: 'admin-research.html', label: 'Research', icon: 'fa-flask', id: 'research' },
      { href: 'admin-api.html', label: 'API Portal', icon: 'fa-plug', id: 'api' },
      { href: 'admin-settings.html', label: 'Settings', icon: 'fa-gear', id: 'settings' }
    ];

    return `
      <aside class="admin-sidebar" id="admin-sidebar">
        <a href="index.html" class="logo">
          <img src="${LOGO_URL}" alt="GoNoGo" style="height:28px;width:auto;">
        </a>
        <div style="background:#1e3a5f;color:#60a5fa;font-size:11px;font-weight:700;text-align:center;padding:6px 12px;border-radius:6px;margin:8px 16px 4px;letter-spacing:0.05em;text-transform:uppercase">
          <i class="fa-solid fa-globe"></i> United Kingdom
        </div>
        <nav class="admin-sidebar-nav">
          ${links.map(l => `
            <a href="${l.href}" class="admin-sidebar-link ${activePage === l.id ? 'active' : ''}">
              <i class="fa-solid ${l.icon}"></i> ${l.label}
              ${l.id === 'comments' ? '<span id="pending-review-badge" class="pending-badge" style="display:none"></span>' : ''}
            </a>
          `).join('')}
          <div style="flex:1"></div>
          <a href="index.html" class="admin-sidebar-link">
            <i class="fa-solid fa-arrow-left"></i> Back to Site
          </a>
          <a href="#" class="admin-sidebar-link" onclick="Components.adminLogout(); return false;">
            <i class="fa-solid fa-right-from-bracket"></i> Logout
          </a>
        </nav>
      </aside>
      <button class="admin-mobile-toggle" onclick="Components.toggleAdminSidebar()">
        <i class="fa-solid fa-bars"></i>
      </button>
    `;
  },

  loadPendingReviewBadge() {
    if (typeof GoNoGoAPI === 'undefined' || !GoNoGoAPI.getPendingReviewCount) return;
    GoNoGoAPI.getPendingReviewCount().then(function (count) {
      var badge = document.getElementById('pending-review-badge');
      if (!badge) return;
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    });
  },

  toggleMobileNav() {
    const nav = document.getElementById('mobile-nav');
    const icon = document.getElementById('hamburger-icon');
    const isOpen = nav.classList.toggle('open');
    icon.className = isOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
  },
  
  // ============================================================
  // INIT (public pages)
  // ============================================================
  init() {
    // Initialise theme and cookie consent on public pages
    this.initTheme();
  },
  
  // ============================================================
  // THEME (Light / Dark)
  // ============================================================
  initTheme() {
    var saved = localStorage.getItem('gonogo_theme');
    if (saved === 'light') {
      document.body.classList.add('light-mode');
      document.documentElement.classList.add('light-mode');
    } else if (!saved && window.matchMedia('(prefers-color-scheme: light)').matches) {
      document.body.classList.add('light-mode');
      document.documentElement.classList.add('light-mode');
    }
    this.updateThemeIcon();
    this.initCookieConsent();
    this.loadPendingReviewBadge();
    this.injectPendingBadgeStyles();
  },

  injectPendingBadgeStyles() {
    if (document.getElementById('pending-badge-css')) return;
    var style = document.createElement('style');
    style.id = 'pending-badge-css';
    style.textContent = '.pending-badge{background:#ef4444;color:#fff;font-size:11px;font-weight:700;min-width:18px;height:18px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;padding:0 5px;margin-left:auto;line-height:1;}';
    document.head.appendChild(style);
  },

  // ============================================================
  // COOKIE CONSENT + GOOGLE ANALYTICS
  // ============================================================
  _GA_ID: 'G-2C18K0YYXM',

  initCookieConsent() {
  var consent = localStorage.getItem('gonogo_cookie_consent');

  if (consent === 'accepted') {
    this.loadGA();
    return;
  }

  if (consent === 'rejected') {
    return;
  }

  // Any other value (including null) – treat as no decision
  this.showCookieBanner();
},

  showCookieBanner() {
    if (document.getElementById('cookie-banner')) return;
    var banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.id = 'cookie-banner';
    banner.innerHTML =
      '<p>We use cookies to analyse site usage and improve your experience. ' +
      'This includes Google Analytics for anonymous usage statistics. ' +
      'By clicking \"Accept\", you consent to the use of cookies in accordance with ' +
      '<a href="/privacy">our Privacy Policy</a>, the UK GDPR and the Privacy and Electronic Communications Regulations (PECR).</p>' +
      '<div class="cookie-banner-buttons">' +
        '<button class="cookie-btn-reject" onclick="Components.cookieReject()">Reject</button>' +
        '<button class="cookie-btn-accept" onclick="Components.cookieAccept()">Accept</button>' +
      '</div>';
    document.body.appendChild(banner);
  },

  cookieAccept() {
    localStorage.setItem('gonogo_cookie_consent', 'accepted');
    var banner = document.getElementById('cookie-banner');
    if (banner) banner.remove();
    this.loadGA();
  },

  cookieReject() {
    localStorage.setItem('gonogo_cookie_consent', 'rejected');
    var banner = document.getElementById('cookie-banner');
    if (banner) banner.remove();
  },

  loadGA() {
    if (window._gaLoaded) return;
    window._gaLoaded = true;
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + this._GA_ID;
    document.head.appendChild(script);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', Components._GA_ID, { anonymize_ip: true });
  },

  toggleTheme() {
    var isLight = document.body.classList.toggle('light-mode');
    document.documentElement.classList.toggle('light-mode');
    localStorage.setItem('gonogo_theme', isLight ? 'light' : 'dark');
    this.updateThemeIcon();
    // Re-render any active Chart.js radar charts with correct colours
    this._updateChartsForTheme();
  },

  updateThemeIcon() {
    var isLight = document.body.classList.contains('light-mode');
    var icons = document.querySelectorAll('.theme-toggle-icon');
    icons.forEach(function(icon) {
      icon.className = 'fa-solid ' + (isLight ? 'fa-moon' : 'fa-sun') + ' theme-toggle-icon';
    });
    var labels = document.querySelectorAll('.theme-toggle-label');
    labels.forEach(function(label) {
      label.textContent = isLight ? 'Dark Mode' : 'Light Mode';
    });
    // Swap hero logo for theme
    var heroLogos = document.querySelectorAll('.hero-logo');
    heroLogos.forEach(function(img) {
      img.src = isLight ? HERO_LOGO_LIGHT : HERO_LOGO_DARK;
    });
  },

  _getChartThemeColors() {
    var isLight = document.body.classList.contains('light-mode');
    return {
      tickColor: isLight ? '#888888' : '#666',
      labelColor: isLight ? '#555555' : '#a0a0a0',
      gridColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
      tooltipBg: isLight ? '#ffffff' : '#1a1a1a',
      tooltipTitle: isLight ? '#1a1a1a' : '#fff',
      tooltipBody: isLight ? '#555555' : '#a0a0a0',
      tooltipBorder: isLight ? '#e0e0e0' : '#2a2a2a',
      legendColor: isLight ? '#555555' : '#a0a0a0'
    };
  },

  _updateChartsForTheme() {
    var colors = this._getChartThemeColors();
    if (typeof Chart === 'undefined') return;
    var instances = Object.values(Chart.instances || {});
    instances.forEach(function(chart) {
      if (!chart || chart.config.type !== 'radar') return;
      var r = chart.options.scales.r;
      if (r) {
        r.ticks.color = colors.tickColor;
        r.pointLabels.color = colors.labelColor;
        r.grid.color = colors.gridColor;
        r.angleLines.color = colors.gridColor;
      }
      var tooltip = chart.options.plugins.tooltip;
      if (tooltip) {
        tooltip.backgroundColor = colors.tooltipBg;
        tooltip.titleColor = colors.tooltipTitle;
        tooltip.bodyColor = colors.tooltipBody;
        tooltip.borderColor = colors.tooltipBorder;
      }
      var legend = chart.options.plugins.legend;
      if (legend && legend.labels) {
        legend.labels.color = colors.legendColor;
      }
      chart.update();
    });
  },

  toggleAdminSidebar() {
    document.getElementById('admin-sidebar').classList.toggle('mobile-open');
  },

  togglePasswordVisibility(inputId, btn) {
    var input = document.getElementById(inputId);
    if (!input) return;
    var icon = btn.querySelector('i');
    if (input.type === 'password') {
      input.type = 'text';
      icon.className = 'fa-solid fa-eye-slash';
      btn.setAttribute('aria-label', 'Hide password');
    } else {
      input.type = 'password';
      icon.className = 'fa-solid fa-eye';
      btn.setAttribute('aria-label', 'Show password');
    }
  },

  // ============================================================
  // FOOTER
  // ============================================================
  renderFooter() {
    return `
      <footer class="site-footer">
        <div class="container">
          <div class="footer-content">
            <div class="footer-links">
              <a href="index.html">Home</a>
              <a href="compare.html">Compare</a>
              <a href="about.html">About</a>
              <a href="privacy.html">Privacy Policy</a>
              <a href="cookies.html">Cookie Policy</a>
              <a href="terms.html">Terms & Conditions</a>
              <a href="https://www.gonogo.co.uk" target="_blank">GoNoGo UK</a>
            </div>
            <div class="footer-attribution">
              &copy; 2026 GoNoGo Ratings and Reviews Ltd. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    `;
  },

  // ============================================================
  // SCORE BADGE
  // ============================================================
  getScoreClass(score) {
    if (score >= 80) return 'score-high';
    if (score >= 60) return 'score-mid';
    return 'score-low';
  },

  renderScoreBadge(score) {
    return `<span class="badge badge-score ${this.getScoreClass(score)}">${score}/100</span>`;
  },

  renderVerdictBadge(verdict) {
    let cls, icon;
    if (verdict === 'GO') {
      cls = 'badge-go'; icon = 'fa-circle-check';
    } else if (verdict === 'NOGO') {
      cls = 'badge-nogo'; icon = 'fa-circle-xmark';
    } else {
      cls = 'badge-caution'; icon = 'fa-triangle-exclamation';
    }
    return `<span class="badge ${cls}">
      <i class="fa-solid ${icon}"></i>
      ${verdict}
    </span>`;
  },

  // ============================================================
  // SCORE CIRCLE (SVG)
  // ============================================================
  renderScoreCircle(score, size = 'md') {
    const sizeClass = size === 'xl' ? 'score-circle-xl' : size === 'hero' ? 'score-circle-hero' : size === 'lg' ? 'score-circle-lg' : '';
    const r = size === 'xl' ? 72 : size === 'hero' ? 52 : size === 'lg' ? 52 : 34;
    const sw = size === 'xl' ? 10 : size === 'hero' ? 8 : size === 'lg' ? 8 : 6;
    const circumference = 2 * Math.PI * r;
    const offset = circumference - (score / 100) * circumference;
    const color = getScoreColor(score);
    const cx = size === 'xl' ? 82 : size === 'hero' ? 60 : size === 'lg' ? 60 : 40;
    const cy = cx;
    const viewBox = size === 'xl' ? '0 0 164 164' : size === 'hero' ? '0 0 120 120' : size === 'lg' ? '0 0 120 120' : '0 0 80 80';

    return `
      <div class="score-circle ${sizeClass}">
        <svg viewBox="${viewBox}">
          <circle cx="${cx}" cy="${cy}" r="${r}" stroke="#2a2a2a" stroke-width="${sw}" fill="none"/>
          <circle cx="${cx}" cy="${cy}" r="${r}" stroke="${color}" stroke-width="${sw}" fill="none"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
            stroke-linecap="round" style="transition: stroke-dashoffset 800ms cubic-bezier(0.16,1,0.3,1)"/>
        </svg>
        <span class="score-value" style="color:${color}">${score}</span>
      </div>
    `;
  },

  // ============================================================
  // SCORE BAR
  // ============================================================
  renderScoreBar(score, maxScore) {
    const pct = Math.round((score / maxScore) * 100);
    const color = getScoreColor(pct);
    return `
      <div class="score-bar">
        <div class="score-bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
    `;
  },

  // ============================================================
  // RADAR CHART (Chart.js wrapper)
  // ============================================================
  createRadarChart(canvasId, brand, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const labels = Object.keys(brand.categoryScores);
    const data = labels.map(key => {
      const cs = brand.categoryScores[key];
      return cs.max > 0 ? Math.round((cs.score / cs.max) * 100) : Math.min(100, Math.round(cs.score || 0));
    });

    // Shorten labels for radar
    const shortLabels = labels.map(l => {
      if (l.length > 18) return l.substring(0, 16) + '…';
      return l;
    });

    const color = getScoreColor(brand.overallScore);
    const bgColor = color + '20';
    const tc = this._getChartThemeColors();

    return new Chart(canvas, {
      type: 'radar',
      data: {
        labels: shortLabels,
        datasets: [{
          label: brand.name,
          data: data,
          backgroundColor: bgColor,
          borderColor: color,
          borderWidth: 2,
          pointBackgroundColor: color,
          pointBorderColor: color,
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: color,
          pointRadius: options.pointRadius !== undefined ? options.pointRadius : 3,
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 25,
              display: options.showTicks !== false,
              color: tc.tickColor,
              backdropColor: 'transparent',
              font: { size: 9 }
            },
            pointLabels: {
              color: tc.labelColor,
              font: {
                family: 'Inter, sans-serif',
                size: options.labelSize || 10,
                weight: '500'
              }
            },
            grid: { color: tc.gridColor },
            angleLines: { color: tc.gridColor }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: tc.tooltipBg,
            titleColor: tc.tooltipTitle,
            bodyColor: tc.tooltipBody,
            borderColor: tc.tooltipBorder,
            borderWidth: 1,
            cornerRadius: 8,
            padding: 10,
            titleFont: { family: 'Inter', weight: '600' },
            bodyFont: { family: 'Inter' },
            callbacks: {
              label: function(ctx) {
                return labels[ctx.dataIndex] + ': ' + ctx.raw + '%';
              }
            }
          }
        },
        animation: { duration: 800, easing: 'easeOutQuart' }
      }
    });
  },

  createCompareRadarChart(canvasId, brand1, brand2, filteredLabels) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    // Use union of scoring categories (or a filtered subset)
    const allLabels = filteredLabels || Object.keys(brand1.categoryScores);
    const data1 = allLabels.map(key => {
      const cs = brand1.categoryScores[key];
      return cs ? (cs.max > 0 ? Math.round((cs.score / cs.max) * 100) : Math.min(100, Math.round(cs.score || 0))) : 0;
    });
    const data2 = allLabels.map(key => {
      const cs = brand2.categoryScores[key];
      return cs ? (cs.max > 0 ? Math.round((cs.score / cs.max) * 100) : Math.min(100, Math.round(cs.score || 0))) : 0;
    });

    const shortLabels = allLabels.map(l => l.length > 18 ? l.substring(0, 16) + '…' : l);
    const color1 = '#11a551';
    const color2 = '#ff9800';
    const tc = this._getChartThemeColors();

    return new Chart(canvas, {
      type: 'radar',
      data: {
        labels: shortLabels,
        datasets: [
          {
            label: brand1.name,
            data: data1,
            backgroundColor: color1 + '20',
            borderColor: color1,
            borderWidth: 2,
            pointBackgroundColor: color1,
            pointBorderColor: color1,
            pointRadius: 3
          },
          {
            label: brand2.name,
            data: data2,
            backgroundColor: color2 + '20',
            borderColor: color2,
            borderWidth: 2,
            pointBackgroundColor: color2,
            pointBorderColor: color2,
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: { stepSize: 25, display: true, color: tc.tickColor, backdropColor: 'transparent', font: { size: 9 } },
            pointLabels: { color: tc.labelColor, font: { family: 'Inter, sans-serif', size: 11, weight: '500' } },
            grid: { color: tc.gridColor },
            angleLines: { color: tc.gridColor }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { color: tc.legendColor, font: { family: 'Inter', size: 12 }, usePointStyle: true, pointStyle: 'circle', padding: 20 }
          },
          tooltip: { backgroundColor: tc.tooltipBg, titleColor: tc.tooltipTitle, bodyColor: tc.tooltipBody, borderColor: tc.tooltipBorder, borderWidth: 1, cornerRadius: 8, padding: 10 }
        },
        animation: { duration: 800, easing: 'easeOutQuart' }
      }
    });
  },

  // ============================================================
  // BRAND CARD (Public listing)
  // ============================================================
  renderBrandCard(brand, index = 0) {
    const staggerClass = index < 6 ? `stagger-${index + 1}` : '';
    const chartId = `radar-${brand.id}`;

    return `
      <a href="brand.html?id=${brand.id}" class="brand-card animate-in ${staggerClass}">
        <div class="brand-card-top">
          ${this.renderLogo(brand, 'brand-logo brand-logo-lg')}
          <div class="brand-card-info">
            <div class="brand-card-name">${brand.name}</div>
            <div class="brand-card-meta">
              ${this.renderVerdictBadge(brand.verdict)}
              ${this.renderScoreBadge(brand.overallScore)}
            </div>
          </div>
        </div>
        <div class="brand-card-chart">
          <canvas id="${chartId}"></canvas>
        </div>
        <div class="brand-card-stats">
          <span><i class="fa-brands fa-google-play"></i> ${brand.appRatings.googlePlay}</span>
          <span><i class="fa-brands fa-apple"></i> ${brand.appRatings.ios}</span>
          <span><i class="fa-solid fa-tags"></i> ${brand.categoryName}</span>
        </div>
      </a>
    `;
  },

  // ============================================================
  // COMMENT CARD
  // ============================================================
  renderCommentCard(comment, brandName = '') {
    return `
      <div class="comment-card">
        <div class="comment-header">
          <div>
            <span class="comment-author">${comment.author || 'Anonymous'}</span>
            ${brandName ? `<span class="text-xs text-muted" style="margin-left:var(--space-2)">on ${brandName}</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:var(--space-2)">
            <span class="sentiment-badge sentiment-${comment.sentiment || 'neutral'}">${comment.sentiment || 'neutral'}</span>
            <span class="comment-date">${this.formatDate(comment.date)}</span>
          </div>
        </div>
        <div class="comment-text">${comment.text}</div>
      </div>
    `;
  },

  // ============================================================
  // URL PARAMETER HELPERS
  // ============================================================
  getParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  },

  setParam(name, value) {
    const params = new URLSearchParams(window.location.search);
    params.set(name, value);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  },

  // ============================================================
  // DATE FORMATTING
  // ============================================================
  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  },

  formatRelativeDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff} days ago`;
    if (diff < 30) return `${Math.floor(diff / 7)} weeks ago`;
    return this.formatDate(dateStr);
  },

  // ============================================================
  // TOAST NOTIFICATIONS
  // ============================================================
  showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ${message}`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => { toast.classList.add('show'); });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  },

  // ============================================================
  // ADMIN AUTH (Supabase-backed multi-user)
  // ============================================================
  _adminUser: null,

  getAdminUser() {
    if (this._adminUser) return this._adminUser;
    try {
      var stored = GoNoGoStorage.get('adminUser');
      if (stored) {
        // Check session expiry (24 hours)
        var loginTime = GoNoGoStorage.get('adminLoginTime');
        if (loginTime) {
          var elapsed = Date.now() - loginTime;
          var twentyFourHours = 24 * 60 * 60 * 1000;
          if (elapsed > twentyFourHours) {
            // Session expired — force re-login
            this._adminUser = null;
            GoNoGoStorage.remove('adminUser');
            GoNoGoStorage.remove('adminLoginTime');
            return null;
          }
        }
        this._adminUser = stored;
      }
    } catch(e) {}
    return this._adminUser;
  },

  checkAdminAuth() {
    var user = this.getAdminUser();
    if (!user) {
      this.showLoginPrompt();
      return false;
    }
    return true;
  },

  showLoginPrompt() {
    const overlay = document.createElement('div');
    overlay.className = 'password-overlay';
    overlay.id = 'password-overlay';
    overlay.innerHTML = `
      <div class="password-box">
        <div class="logo" style="justify-content:center">
          <img src="${LOGO_URL}" alt="GoNoGo" style="height:32px;width:auto;">
        </div>
        <p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:var(--space-5)">Sign in to access the admin dashboard</p>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" id="admin-email" placeholder="admin@gonogo.co.uk" onkeydown="if(event.key==='Enter')document.getElementById('admin-password').focus()">
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <div style="position:relative">
            <input type="password" id="admin-password" placeholder="Enter password" onkeydown="if(event.key==='Enter')Components.submitLogin()" style="padding-right:40px">
            <button type="button" onclick="Components.togglePasswordVisibility('admin-password',this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-muted);padding:4px;font-size:var(--text-sm)" aria-label="Show password"><i class="fa-solid fa-eye"></i></button>
          </div>
          <div class="password-error" id="password-error">Incorrect credentials. Try again.</div>
        </div>
        <button class="btn btn-primary w-full" id="login-btn" onclick="Components.submitLogin()">
          <i class="fa-solid fa-lock"></i> Sign In
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('admin-email').focus(), 100);
  },

  async submitLogin() {
    const emailInput = document.getElementById('admin-email');
    const passInput = document.getElementById('admin-password');
    const error = document.getElementById('password-error');
    const btn = document.getElementById('login-btn');
    var email = emailInput.value.trim().toLowerCase();
    var password = passInput.value;

    if (!email || !password) {
      error.textContent = 'Please enter both email and password.';
      error.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';
    error.style.display = 'none';

    try {
      var user = await GoNoGoAPI.adminLogin(email, password);
      if (user) {
        // Store password hash for caller-auth on secured RPCs
        var pwHash = await GoNoGoAPI._hashPassword(password);
        user._ah = pwHash;
        Components._adminUser = user;
        GoNoGoStorage.set('adminUser', user);
        GoNoGoStorage.set('adminLoginTime', Date.now());
        document.getElementById('password-overlay').remove();
        if (typeof initAdminPage === 'function') initAdminPage();
      } else {
        error.textContent = 'Incorrect credentials. Try again.';
        error.style.display = 'block';
        passInput.value = '';
        passInput.focus();
      }
    } catch(e) {
      error.textContent = 'Login error: ' + e.message;
      error.style.display = 'block';
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-lock"></i> Sign In';
  },

  adminLogout() {
    this._adminUser = null;
    GoNoGoStorage.remove('adminUser');
    GoNoGoStorage.remove('adminLoginTime');
    window.location.href = 'index.html';
  },

  // ============================================================
  // CSV EXPORT
  // ============================================================
  exportCSV(data, filename) {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        let val = row[h];
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
          val = '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  // ============================================================
  // SORT HELPER
  // ============================================================
  sortData(data, key, direction = 'asc') {
    return [...data].sort((a, b) => {
      let aVal = typeof a[key] === 'string' ? a[key].toLowerCase() : a[key];
      let bVal = typeof b[key] === 'string' ? b[key].toLowerCase() : b[key];
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  },

  // ============================================================
  // BRAND PORTAL AUTH
  // ============================================================
  _brandUser: null,

  getBrandUser() {
    if (this._brandUser) return this._brandUser;
    try {
      var stored = GoNoGoStorage.get('brandUser');
      if (stored) {
        var loginTime = GoNoGoStorage.get('brandLoginTime');
        if (loginTime) {
          var elapsed = Date.now() - loginTime;
          if (elapsed > 24 * 60 * 60 * 1000) {
            this._brandUser = null;
            GoNoGoStorage.remove('brandUser');
            GoNoGoStorage.remove('brandLoginTime');
            return null;
          }
        }
        this._brandUser = stored;
      }
    } catch (e) {}
    return this._brandUser;
  },

  checkBrandAuth() {
    var user = this.getBrandUser();
    if (!user) {
      this.showBrandLoginPrompt();
      return false;
    }
    return true;
  },

  showBrandLoginPrompt() {
    const overlay = document.createElement('div');
    overlay.className = 'password-overlay';
    overlay.id = 'brand-login-overlay';
    overlay.innerHTML = `
      <div class="password-box">
        <div class="logo" style="justify-content:center">
          <img src="${LOGO_URL}" alt="GoNoGo" style="height:32px;width:auto;">
        </div>
        <h3 style="font-size:var(--text-lg);font-weight:700;margin-bottom:var(--space-2)">Brand Portal</h3>
        <p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:var(--space-5)">Sign in to access your brand dashboard</p>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" id="brand-email" placeholder="brand@example.co.uk" onkeydown="if(event.key==='Enter')document.getElementById('brand-password').focus()">
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <div style="position:relative">
            <input type="password" id="brand-password" placeholder="Enter password" onkeydown="if(event.key==='Enter')Components.submitBrandLogin()" style="padding-right:40px">
            <button type="button" onclick="Components.togglePasswordVisibility('brand-password',this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-muted);padding:4px;font-size:var(--text-sm)" aria-label="Show password"><i class="fa-solid fa-eye"></i></button>
          </div>
          <div class="password-error" id="brand-login-error">Incorrect credentials. Try again.</div>
        </div>
        <button class="btn btn-primary w-full" id="brand-login-btn" onclick="Components.submitBrandLogin()">
          <i class="fa-solid fa-lock"></i> Sign In
        </button>
        <p style="margin-top:var(--space-3);text-align:center">
          <a href="#" id="forgot-pw-link" onclick="Components.showForgotPassword();return false" style="font-size:var(--text-xs);color:var(--primary);">Forgot password?</a>
        </p>
        <p style="margin-top:var(--space-2);font-size:var(--text-xs);color:var(--text-muted)">Contact GoNoGo to set up brand portal access</p>
      </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('brand-email').focus(), 100);
  },

  showForgotPassword() {
    var overlay = document.getElementById('brand-login-overlay');
    overlay.querySelector('.password-box').innerHTML = `
      <div class="logo" style="justify-content:center">
        <img src="${LOGO_URL}" alt="GoNoGo" style="height:32px;width:auto;">
      </div>
      <h3 style="font-size:var(--text-lg);font-weight:700;margin-bottom:var(--space-2)">Reset Password</h3>
      <p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:var(--space-5)">Enter your email and we'll send a reset link</p>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" id="reset-email" placeholder="brand@example.co.uk" onkeydown="if(event.key==='Enter')Components.submitResetRequest()">
      </div>
      <div class="password-error" id="reset-error" style="display:none"></div>
      <div id="reset-success" style="display:none;padding:var(--space-3);background:rgba(17,165,81,0.1);border:1px solid var(--primary);border-radius:var(--radius-md);color:var(--primary);font-size:var(--text-sm);margin-bottom:var(--space-3)"></div>
      <button class="btn btn-primary w-full" id="reset-btn" onclick="Components.submitResetRequest()">
        <i class="fa-solid fa-paper-plane"></i> Send Reset Link
      </button>
      <p style="margin-top:var(--space-3);text-align:center">
        <a href="#" onclick="Components.backToLogin();return false" style="font-size:var(--text-xs);color:var(--primary);"><i class="fa-solid fa-arrow-left"></i> Back to sign in</a>
      </p>
    `;
    setTimeout(() => document.getElementById('reset-email').focus(), 100);
  },

  async submitResetRequest() {
    var emailInput = document.getElementById('reset-email');
    var error = document.getElementById('reset-error');
    var success = document.getElementById('reset-success');
    var btn = document.getElementById('reset-btn');
    var email = emailInput.value.trim().toLowerCase();

    if (!email) {
      error.textContent = 'Please enter your email address.';
      error.style.display = 'block';
      success.style.display = 'none';
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
    error.style.display = 'none';
    success.style.display = 'none';

    try {
      await GoNoGoAPI.requestPasswordReset(email);
      success.innerHTML = '<i class="fa-solid fa-check-circle"></i> If an account exists with that email, a reset link has been sent. Check your inbox (and spam folder).';
      success.style.display = 'block';
      emailInput.disabled = true;
      btn.style.display = 'none';
    } catch (e) {
      error.textContent = 'Something went wrong. Please try again.';
      error.style.display = 'block';
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Reset Link';
  },

  backToLogin() {
    document.getElementById('brand-login-overlay').remove();
    this.showBrandLoginPrompt();
  },

  async submitBrandLogin() {
    const emailInput = document.getElementById('brand-email');
    const passInput = document.getElementById('brand-password');
    const error = document.getElementById('brand-login-error');
    const btn = document.getElementById('brand-login-btn');
    var email = emailInput.value.trim().toLowerCase();
    var password = passInput.value;

    if (!email || !password) {
      error.textContent = 'Please enter both email and password.';
      error.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';
    error.style.display = 'none';

    try {
      var user = await GoNoGoAPI.brandLogin(email, password);
      if (user) {
        if (user.role === 'admin' && user.brand_slug === '__admin__') {
          // Admin user — show brand picker
          Components._pendingAdminUser = user;
          Components.showAdminBrandPicker();
        } else {
          Components._brandUser = user;
          GoNoGoStorage.set('brandUser', user);
          GoNoGoStorage.set('brandLoginTime', Date.now());
          document.getElementById('brand-login-overlay').remove();
          if (typeof initBrandPage === 'function') initBrandPage();
        }
      } else {
        error.textContent = 'Incorrect credentials. Try again.';
        error.style.display = 'block';
        passInput.value = '';
        passInput.focus();
      }
    } catch (e) {
      error.textContent = 'Login error: ' + e.message;
      error.style.display = 'block';
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-lock"></i> Sign In';
  },

  async showAdminBrandPicker() {
    var brands = await GoNoGoAPI.getAllBrandSlugs();
    var overlay = document.getElementById('brand-login-overlay');
    overlay.querySelector('.password-box').innerHTML = `
      <div class="logo" style="justify-content:center">
        <img src="${LOGO_URL}" alt="GoNoGo" style="height:32px;width:auto;">
      </div>
      <h3 style="font-size:var(--text-lg);font-weight:700;margin-bottom:var(--space-2)">Admin Access</h3>
      <p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:var(--space-5)">Select a brand to view their portal</p>
      <div class="form-group">
        <label class="form-label">Brand</label>
        <input type="text" id="brand-picker-search" placeholder="Search brands..." oninput="Components.filterBrandPicker()" style="margin-bottom:var(--space-2);">
        <div id="brand-picker-list" style="max-height:300px;overflow-y:auto;border:1px solid var(--border-primary);border-radius:var(--radius-md);">
        </div>
      </div>
    `;
    var listHtml = '';
    brands.forEach(function(b) {
      var verdictColor = b.verdict === 'GO' ? 'var(--green)' : b.verdict === 'NOGO' ? 'var(--red)' : 'var(--orange)';
      listHtml += '<div class="brand-picker-item" data-slug="' + b.slug + '" data-name="' + Components.escapeHTML(b.name) + '" ' +
        'onclick="Components.selectAdminBrand(\'' + b.slug + '\', \'' + Components.escapeHTML(b.name).replace(/'/g, "\\'") + '\')" ' +
        'style="padding:10px 12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border-subtle);font-size:var(--text-sm);transition:background 0.15s;"' +
        ' onmouseover="this.style.background=\'var(--surface-2)\'" onmouseout="this.style.background=\'\'">'+
        '<span style="font-weight:500;">' + Components.escapeHTML(b.name) + '</span>' +
        '<span style="font-size:var(--text-xs);font-weight:700;color:' + verdictColor + ';">' + b.gonogo_score + '/100</span>' +
      '</div>';
    });
    document.getElementById('brand-picker-list').innerHTML = listHtml;
  },

  filterBrandPicker() {
    var search = (document.getElementById('brand-picker-search').value || '').toLowerCase();
    var items = document.querySelectorAll('.brand-picker-item');
    items.forEach(function(item) {
      var name = (item.getAttribute('data-name') || '').toLowerCase();
      item.style.display = name.indexOf(search) !== -1 ? '' : 'none';
    });
  },

  selectAdminBrand(slug, name) {
    var admin = Components._pendingAdminUser;
    var user = { id: admin.id, email: admin.email, display_name: admin.display_name + ' (viewing ' + name + ')', role: 'admin', brand_slug: slug, region: admin.region };
    Components._brandUser = user;
    GoNoGoStorage.set('brandUser', user);
    GoNoGoStorage.set('brandLoginTime', Date.now());
    document.getElementById('brand-login-overlay').remove();
    if (typeof initBrandPage === 'function') initBrandPage();
  },

  brandLogout() {
    this._brandUser = null;
    GoNoGoStorage.remove('brandUser');
    GoNoGoStorage.remove('brandLoginTime');
    window.location.href = 'brand-dashboard.html';
  },

  // ============================================================
  // BRAND PORTAL SIDEBAR
  // ============================================================
  renderBrandSidebar(activePage) {
    const user = this.getBrandUser();
    const brandName = user ? Components.escapeHTML(user.display_name || user.brand_slug || 'Brand') : 'Brand Portal';
    const links = [
      { href: 'brand-dashboard.html', label: 'Dashboard', icon: 'fa-gauge', id: 'dashboard' },
      { href: 'brand-reviews.html', label: 'Reviews', icon: 'fa-comments', id: 'reviews' },
      { href: 'brand-badge.html', label: 'Score Badge', icon: 'fa-code', id: 'badge' },
      { href: 'brand-qr.html', label: 'Review QR', icon: 'fa-qrcode', id: 'qr' }
    ];

    return `
      <aside class="admin-sidebar" id="admin-sidebar">
        <a href="brand-dashboard.html" class="logo">
          <img src="${LOGO_URL}" alt="GoNoGo" style="height:28px;width:auto;">
        </a>
        <div style="background:#1e3a5f;color:#60a5fa;font-size:11px;font-weight:700;text-align:center;padding:6px 12px;border-radius:6px;margin:8px 16px 4px;letter-spacing:0.05em;text-transform:uppercase">
          <i class="fa-solid fa-globe"></i> United Kingdom
        </div>
        <div style="padding:8px 16px;margin-top:4px;font-size:var(--text-sm);color:var(--text-secondary);font-weight:600;">
          <i class="fa-solid fa-building" style="color:var(--green);margin-right:6px;"></i> ${brandName}
        </div>
        <nav class="admin-sidebar-nav">
          ${links.map(l => `
            <a href="${l.href}" class="admin-sidebar-link ${activePage === l.id ? 'active' : ''}">
              <i class="fa-solid ${l.icon}"></i> ${l.label}
            </a>
          `).join('')}
          <div style="flex:1"></div>
          <a href="index.html" class="admin-sidebar-link">
            <i class="fa-solid fa-arrow-left"></i> Back to Site
          </a>
          <a href="#" class="admin-sidebar-link" onclick="Components.brandLogout(); return false;">
            <i class="fa-solid fa-right-from-bracket"></i> Logout
          </a>
        </nav>
      </aside>
      <button class="admin-mobile-toggle" onclick="Components.toggleAdminSidebar()">
        <i class="fa-solid fa-bars"></i>
      </button>
    `;
  },

  // ============================================================
  // PUBLIC ACCOUNT AUTH (Supabase Auth — email/password)
  // ============================================================
  _currentUser: null,

  initPublicAuth() {
    if (!supabaseAuth) return;
    supabaseAuth.auth.getSession().then(function(res) {
      var session = res.data && res.data.session;
      Components._currentUser = session ? session.user : null;
      Components._updateNavAuth();
    });
    supabaseAuth.auth.onAuthStateChange(function(event, session) {
      Components._currentUser = session ? session.user : null;
      Components._updateNavAuth();
    });
  },

  _updateNavAuth() {
    var user = this._currentUser;
    var displayName = '';
    if (user) {
      displayName = (user.user_metadata && user.user_metadata.display_name) || user.email.split('@')[0];
    }

    // Desktop nav
    var desktop = document.getElementById('nav-auth-desktop');
    if (desktop) {
      if (user) {
        desktop.innerHTML =
          '<div class="auth-user-menu">' +
            '<button class="btn btn-sm btn-auth-nav btn-auth-signed-in" onclick="Components.toggleUserMenu()">' +
              '<i class="fa-solid fa-user-check"></i> ' + Components.escapeHTML(displayName) +
              ' <i class="fa-solid fa-chevron-down" style="font-size:10px;margin-left:4px"></i>' +
            '</button>' +
            '<div class="auth-dropdown" id="auth-dropdown-desktop">' +
              '<div class="auth-dropdown-header">' + Components.escapeHTML(user.email) + '</div>' +
              '<a href="#" class="auth-dropdown-item" onclick="Components.publicSignOut(); return false;">' +
                '<i class="fa-solid fa-right-from-bracket"></i> Sign Out' +
              '</a>' +
            '</div>' +
          '</div>';
      } else {
        desktop.innerHTML =
          '<button class="btn btn-sm btn-auth-nav" onclick="Components.showAuthModal()">' +
            '<i class="fa-solid fa-user"></i> Sign In' +
          '</button>';
      }
    }

    // Mobile nav
    var mobile = document.getElementById('nav-auth-mobile');
    if (mobile) {
      if (user) {
        mobile.innerHTML =
          '<div style="padding:var(--space-2) 0;border-top:1px solid var(--border-primary);margin-top:var(--space-2)">' +
            '<div class="text-sm" style="padding:var(--space-2) var(--space-3);color:var(--text-secondary)">' +
              '<i class="fa-solid fa-user-check" style="color:var(--green)"></i> ' + Components.escapeHTML(displayName) +
            '</div>' +
            '<button class="btn btn-sm btn-ghost" onclick="Components.publicSignOut()" style="width:100%;text-align:left;padding:var(--space-2) var(--space-3)">' +
              '<i class="fa-solid fa-right-from-bracket"></i> Sign Out' +
            '</button>' +
          '</div>';
      } else {
        mobile.innerHTML =
          '<button class="btn btn-sm btn-auth-nav" onclick="Components.showAuthModal()" style="margin-top:var(--space-2);width:100%">' +
            '<i class="fa-solid fa-user"></i> Sign In' +
          '</button>';
      }
    }

    // Update review form if on brand page
    if (typeof window._updateReviewFormAuth === 'function') {
      window._updateReviewFormAuth(user);
    }
  },

  toggleUserMenu() {
    var dd = document.getElementById('auth-dropdown-desktop');
    if (dd) dd.classList.toggle('open');
    // Close on outside click
    if (dd && dd.classList.contains('open')) {
      setTimeout(function() {
        document.addEventListener('click', Components._closeUserMenu, { once: true });
      }, 10);
    }
  },

  _closeUserMenu(e) {
    var dd = document.getElementById('auth-dropdown-desktop');
    if (dd) dd.classList.remove('open');
  },

  showAuthModal(defaultTab) {
    // Remove existing
    var existing = document.getElementById('auth-modal-overlay');
    if (existing) existing.remove();

    var tab = defaultTab || 'signin';
    var overlay = document.createElement('div');
    overlay.className = 'auth-modal-overlay';
    overlay.id = 'auth-modal-overlay';
    overlay.innerHTML =
      '<div class="auth-modal">' +
        '<button class="auth-modal-close" onclick="Components.closeAuthModal()" aria-label="Close">' +
          '<i class="fa-solid fa-xmark"></i>' +
        '</button>' +
        '<div class="auth-modal-logo">' +
          '<img src="' + LOGO_URL + '" alt="GoNoGo" style="height:40px;width:auto;border-radius:8px">' +
        '</div>' +
        '<div class="auth-tabs">' +
          '<button class="auth-tab ' + (tab === 'signin' ? 'active' : '') + '" id="auth-tab-signin" onclick="Components.switchAuthTab(\'signin\')">Sign In</button>' +
          '<button class="auth-tab ' + (tab === 'signup' ? 'active' : '') + '" id="auth-tab-signup" onclick="Components.switchAuthTab(\'signup\')">Create Account</button>' +
        '</div>' +
        '<div id="auth-form-area">' +
          (tab === 'signin' ? this._renderSignInForm() : this._renderSignUpForm()) +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    // Close on backdrop click
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) Components.closeAuthModal();
    });
    // Focus first input
    setTimeout(function() {
      var input = overlay.querySelector('input');
      if (input) input.focus();
    }, 100);
  },

  closeAuthModal() {
    var el = document.getElementById('auth-modal-overlay');
    if (el) el.remove();
  },

  switchAuthTab(tab) {
    document.getElementById('auth-tab-signin').className = 'auth-tab' + (tab === 'signin' ? ' active' : '');
    document.getElementById('auth-tab-signup').className = 'auth-tab' + (tab === 'signup' ? ' active' : '');
    var area = document.getElementById('auth-form-area');
    area.innerHTML = tab === 'signin' ? Components._renderSignInForm() : Components._renderSignUpForm();
    var input = area.querySelector('input');
    if (input) input.focus();
  },

  _renderSignInForm() {
    return (
      '<div class="form-group">' +
        '<label class="form-label">Email</label>' +
        '<input type="email" id="auth-email" placeholder="you@example.com" onkeydown="if(event.key===\'Enter\')Components.publicSignIn()">' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Password</label>' +
        '<div style="position:relative">' +
          '<input type="password" id="auth-password" placeholder="Your password" onkeydown="if(event.key===\'Enter\')Components.publicSignIn()">' +
          '<button type="button" class="password-eye" onclick="Components._togglePasswordVis(\'auth-password\')" aria-label="Show password">' +
            '<i class="fa-solid fa-eye"></i>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="auth-error" id="auth-error"></div>' +
      '<button class="btn btn-primary w-full" id="auth-submit-btn" onclick="Components.publicSignIn()">' +
        '<i class="fa-solid fa-right-to-bracket"></i> Sign In' +
      '</button>' +
      '<div class="auth-footer">' +
        'Don\'t have an account? <a href="#" onclick="Components.switchAuthTab(\'signup\'); return false;">Create one</a>' +
      '</div>'
    );
  },

  _renderSignUpForm() {
    return (
      '<div class="form-group">' +
        '<label class="form-label">Display Name</label>' +
        '<input type="text" id="auth-name" placeholder="How you want to appear" onkeydown="if(event.key===\'Enter\')Components.publicSignUp()">' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Email</label>' +
        '<input type="email" id="auth-email" placeholder="you@example.com" onkeydown="if(event.key===\'Enter\')Components.publicSignUp()">' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Password</label>' +
        '<div style="position:relative">' +
          '<input type="password" id="auth-password" placeholder="Min 6 characters" onkeydown="if(event.key===\'Enter\')Components.publicSignUp()">' +
          '<button type="button" class="password-eye" onclick="Components._togglePasswordVis(\'auth-password\')" aria-label="Show password">' +
            '<i class="fa-solid fa-eye"></i>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Confirm Password</label>' +
        '<div style="position:relative">' +
          '<input type="password" id="auth-password-confirm" placeholder="Re-enter password" onkeydown="if(event.key===\'Enter\')Components.publicSignUp()">' +
          '<button type="button" class="password-eye" onclick="Components._togglePasswordVis(\'auth-password-confirm\')" aria-label="Show password">' +
            '<i class="fa-solid fa-eye"></i>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="auth-error" id="auth-error"></div>' +
      '<button class="btn btn-primary w-full" id="auth-submit-btn" onclick="Components.publicSignUp()">' +
        '<i class="fa-solid fa-user-plus"></i> Create Account' +
      '</button>' +
      '<div class="auth-footer">' +
        'Already have an account? <a href="#" onclick="Components.switchAuthTab(\'signin\'); return false;">Sign in</a>' +
      '</div>'
    );
  },

  _togglePasswordVis(inputId) {
    var inp = document.getElementById(inputId);
    if (!inp) return;
    var isPass = inp.type === 'password';
    inp.type = isPass ? 'text' : 'password';
    var icon = inp.parentNode.querySelector('.password-eye i');
    if (icon) icon.className = isPass ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
  },

  async publicSignIn() {
    if (!supabaseAuth) return;
    var email = document.getElementById('auth-email').value.trim();
    var password = document.getElementById('auth-password').value;
    var errEl = document.getElementById('auth-error');
    var btn = document.getElementById('auth-submit-btn');

    if (!email || !password) {
      errEl.textContent = 'Please enter your email and password.';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';
    errEl.style.display = 'none';

    try {
      var res = await supabaseAuth.auth.signInWithPassword({ email: email, password: password });
      if (res.error) throw res.error;
      Components.closeAuthModal();
      Components.showToast('Welcome back, ' + ((res.data.user.user_metadata && res.data.user.user_metadata.display_name) || email.split('@')[0]) + '!');
    } catch (err) {
      errEl.textContent = err.message || 'Sign in failed. Please try again.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In';
    }
  },

  async publicSignUp() {
    if (!supabaseAuth) return;
    var name = document.getElementById('auth-name').value.trim();
    var email = document.getElementById('auth-email').value.trim();
    var password = document.getElementById('auth-password').value;
    var confirm = document.getElementById('auth-password-confirm').value;
    var errEl = document.getElementById('auth-error');
    var btn = document.getElementById('auth-submit-btn');

    if (!name || !email || !password) {
      errEl.textContent = 'Please fill in all fields.';
      errEl.style.display = 'block';
      return;
    }
    if (password.length < 6) {
      errEl.textContent = 'Password must be at least 6 characters.';
      errEl.style.display = 'block';
      return;
    }
    if (password !== confirm) {
      errEl.textContent = 'Passwords do not match.';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating account...';
    errEl.style.display = 'none';

    try {
      var res = await supabaseAuth.auth.signUp({
        email: email,
        password: password,
        options: {
          data: { display_name: name, region: SITE_REGION }
        }
      });
      if (res.error) throw res.error;

      // Check if email confirmation is required
      if (res.data.user && res.data.user.identities && res.data.user.identities.length === 0) {
        errEl.textContent = 'An account with this email already exists.';
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Account';
        return;
      }

      // Show confirmation message
      document.getElementById('auth-form-area').innerHTML =
        '<div style="text-align:center;padding:var(--space-6) 0">' +
          '<i class="fa-solid fa-envelope-circle-check" style="font-size:48px;color:var(--green);margin-bottom:var(--space-4);display:block"></i>' +
          '<h3 style="font-size:var(--text-lg);font-weight:700;margin-bottom:var(--space-3)">Check your email</h3>' +
          '<p class="text-sm text-secondary" style="margin-bottom:var(--space-4)">' +
            'We\'ve sent a confirmation link to <strong>' + Components.escapeHTML(email) + '</strong>. ' +
            'Click the link to activate your account.' +
          '</p>' +
          '<button class="btn btn-ghost" onclick="Components.closeAuthModal()">Close</button>' +
        '</div>';
    } catch (err) {
      errEl.textContent = err.message || 'Sign up failed. Please try again.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Account';
    }
  },

  async publicSignOut() {
    if (!supabaseAuth) return;
    await supabaseAuth.auth.signOut();
    Components.showToast('You have been signed out.');
    // Close dropdown if open
    var dd = document.getElementById('auth-dropdown-desktop');
    if (dd) dd.classList.remove('open');
  }
};
