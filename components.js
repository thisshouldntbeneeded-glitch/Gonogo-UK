// GoNoGo SA — Shared Components
// Reusable rendering functions for public and admin pages

const LOGO_URL = 'logos/gonogo-square.jpg';
const HERO_LOGO_DARK = 'logos/gonogo-hero-dark.jpg';
const HERO_LOGO_LIGHT = 'logos/gonogo-hero-light.jpg';

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
    const size = className.includes('lg') ? 48 : 32;
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

  toggleMobileNav() {
    const nav = document.getElementById('mobile-nav');
    const icon = document.getElementById('hamburger-icon');
    const isOpen = nav.classList.toggle('open');
    icon.className = isOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
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
    if (consent === 'rejected') return;
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
    const sizeClass = size === 'lg' ? 'score-circle-lg' : '';
    const r = size === 'lg' ? 52 : 34;
    const circumference = 2 * Math.PI * r;
    const offset = circumference - (score / 100) * circumference;
    const color = getScoreColor(score);
    const cx = size === 'lg' ? 60 : 40;
    const cy = cx;
    const viewBox = size === 'lg' ? '0 0 120 120' : '0 0 80 80';

    return `
      <div class="score-circle ${sizeClass}">
        <svg viewBox="${viewBox}">
          <circle cx="${cx}" cy="${cy}" r="${r}" stroke="#2a2a2a" stroke-width="${size === 'lg' ? 8 : 6}" fill="none"/>
          <circle cx="${cx}" cy="${cy}" r="${r}" stroke="${color}" stroke-width="${size === 'lg' ? 8 : 6}" fill="none"
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
      return Math.round((cs.score / cs.max) * 100);
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

  createCompareRadarChart(canvasId, brand1, brand2) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    // Use union of scoring categories
    const allLabels = Object.keys(brand1.categoryScores);
    const data1 = allLabels.map(key => {
      const cs = brand1.categoryScores[key];
      return cs ? Math.round((cs.score / cs.max) * 100) : 0;
    });
    const data2 = allLabels.map(key => {
      const cs = brand2.categoryScores[key];
      return cs ? Math.round((cs.score / cs.max) * 100) : 0;
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
          <input type="password" id="admin-password" placeholder="Enter password" onkeydown="if(event.key==='Enter')Components.submitLogin()">
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
          <input type="password" id="brand-password" placeholder="Enter password" onkeydown="if(event.key==='Enter')Components.submitBrandLogin()">
          <div class="password-error" id="brand-login-error">Incorrect credentials. Try again.</div>
        </div>
        <button class="btn btn-primary w-full" id="brand-login-btn" onclick="Components.submitBrandLogin()">
          <i class="fa-solid fa-lock"></i> Sign In
        </button>
        <p style="margin-top:var(--space-4);font-size:var(--text-xs);color:var(--text-muted)">Contact GoNoGo to set up brand portal access</p>
      </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('brand-email').focus(), 100);
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
      { href: 'brand-insights.html', label: 'Insights', icon: 'fa-chart-line', id: 'insights' }
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
  }
};
