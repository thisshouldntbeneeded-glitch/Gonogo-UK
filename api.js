// GoNoGo SA — API Client (Supabase Edition v2)
// Brands + Categories = Supabase tables (with static JS fallback)
// Reviews = Supabase 'reviews' table
// Admin Users = Supabase 'admin_users' table (with local fallback)

var GoNoGoAPI = (function () {
  'use strict';

  var SUPABASE_URL = 'https://fnpxaneextqidbessnej.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_132Gl37kwIXtdJc5VHtGCw_iXPxa6cW';
  var SITE_REGION = 'uk';

  // Reviews are on the original customer ratings project
  var REVIEWS_SUPABASE_URL = 'https://kkpbzttwljxvyjbvggqr.supabase.co';
  var REVIEWS_SUPABASE_KEY = 'sb_publishable_y5JnEvpF37HMKB2rcWbrog_6Oe0KYJW';

  // Track whether Supabase brands table is available
  var _supabaseBrandsAvailable = null; // null = unknown, true/false = tested

  function _sbFetch(baseUrl, apiKey, path, options) {
    options = options || {};
    var url = baseUrl + '/rest/v1/' + path;
    var headers = {
      'apikey': apiKey,
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation'
    };
    return fetch(url, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          console.error('Supabase error:', r.status, t);
          throw new Error('Supabase request failed: ' + r.status);
        });
      }
      var ct = r.headers.get('content-type') || '';
      if (ct.indexOf('json') !== -1) return r.json();
      return r.text();
    });
  }

  // Main project (brands, categories, admin_users)
  function supabaseRequest(path, options) {
    return _sbFetch(SUPABASE_URL, SUPABASE_ANON_KEY, path, options);
  }

  // Reviews project
  function reviewsRequest(path, options) {
    return _sbFetch(REVIEWS_SUPABASE_URL, REVIEWS_SUPABASE_KEY, path, options);
  }

  // Check if Supabase brands table exists (cached)
  function checkSupabaseBrands() {
    if (_supabaseBrandsAvailable !== null) return Promise.resolve(_supabaseBrandsAvailable);
    return supabaseRequest('brands?region=eq.' + SITE_REGION + '&select=slug&limit=1').then(function (rows) {
      _supabaseBrandsAvailable = true;
      console.log('Supabase brands table: AVAILABLE');
      return true;
    }).catch(function () {
      _supabaseBrandsAvailable = false;
      console.log('Supabase brands table: NOT AVAILABLE — using static data fallback');
      return false;
    });
  }

  // Normalize a Supabase brand row to match the format the UI expects
  function normalizeSBBrand(row, categoryName, categoryIcon, scoringCategories) {
    var categoryScores = {};
    (row.framework_breakdown || []).forEach(function (fb) {
      var parts = fb.score.split('/');
      categoryScores[fb.category] = { score: parseFloat(parts[0]), max: parseFloat(parts[1]), description: fb.description };
    });
    var gp = (row.app_ratings && row.app_ratings.google_play) || 'N/A';
    var ios = (row.app_ratings && row.app_ratings.ios) || 'N/A';
    return {
      id: row.slug,
      name: row.name,
      categorySlug: row.category_slug,
      categoryName: categoryName || '',
      categoryIcon: categoryIcon || 'fa-tag',
      logo: row.logo_url || '',
      website: row.website_url || '',
      overallScore: row.gonogo_score,
      verdict: row.verdict,
      categoryScores: categoryScores,
      scoringCategories: scoringCategories || [],
      keyFeatures: row.key_features || [],
      pricing: row.pricing || [],
      appRatings: { googlePlay: gp, ios: ios, googlePlayScore: parseFloat(gp) || 0, iosScore: parseFloat(ios) || 0 },
      strengths: row.key_strengths || [],
      concerns: row.key_concerns || [],
      socialSentiment: row.social_sentiment || {},
      overview: row.overview || '',
      ratingSummary: row.rating_summary || '',
      lastUpdated: row.last_updated || '2026-03-01'
    };
  }

  // Category cache for Supabase mode
  var _categoryCache = null;
  function loadCategoryCache() {
    if (_categoryCache) return Promise.resolve(_categoryCache);
    return supabaseRequest('categories?region=eq.' + SITE_REGION + '&select=*&order=name.asc').then(function (rows) {
      _categoryCache = {};
      rows.forEach(function (c) {
        _categoryCache[c.slug] = { name: c.name, icon: c.icon, scoring_categories: c.scoring_categories };
      });
      return _categoryCache;
    });
  }

  return {

    isLive: function () { return true; },

    // Force re-check of Supabase availability (useful after running setup)
    resetCache: function () {
      _supabaseBrandsAvailable = null;
      _categoryCache = null;
    },

    // ==========================================
    // CATEGORIES
    // ==========================================
    getCategoriesWithBrands: function () {
      return checkSupabaseBrands().then(function (hasSB) {
        if (hasSB) {
          // Get categories with brand counts from Supabase
          return Promise.all([
            supabaseRequest('categories?region=eq.' + SITE_REGION + '&select=*&order=name.asc'),
            supabaseRequest('brands?region=eq.' + SITE_REGION + '&select=slug,category_slug')
          ]).then(function (results) {
            var cats = results[0], brands = results[1];
            var counts = {};
            brands.forEach(function (b) { counts[b.category_slug] = (counts[b.category_slug] || 0) + 1; });
            return cats.map(function (c) {
              return {
                id: c.slug, name: c.name, icon: c.icon,
                brandCount: counts[c.slug] || 0,
                hasBrands: (counts[c.slug] || 0) > 0,
                scoringCategories: c.scoring_categories
              };
            });
          });
        }
        // Fallback to static
        if (typeof getCategoriesWithBrands === 'function') return getCategoriesWithBrands();
        throw new Error('No data source available');
      });
    },

    getCategories: function () { return this.getCategoriesWithBrands(); },

    // ==========================================
    // BRANDS
    // ==========================================
    getTopBrands: function (count) {
      return checkSupabaseBrands().then(function (hasSB) {
        if (hasSB) {
          return Promise.all([
            supabaseRequest('brands?region=eq.' + SITE_REGION + '&select=*&order=gonogo_score.desc&limit=' + (count || 6)),
            loadCategoryCache()
          ]).then(function (results) {
            var rows = results[0], cats = results[1];
            return rows.map(function (r) {
              var c = cats[r.category_slug] || {};
              return normalizeSBBrand(r, c.name, c.icon, c.scoring_categories);
            });
          });
        }
        if (typeof getTopBrands === 'function') return getTopBrands(count || 6);
        throw new Error('No data source available');
      });
    },

    getAllBrands: function () {
      return checkSupabaseBrands().then(function (hasSB) {
        if (hasSB) {
          return Promise.all([
            supabaseRequest('brands?region=eq.' + SITE_REGION + '&select=*&order=gonogo_score.desc'),
            loadCategoryCache()
          ]).then(function (results) {
            var rows = results[0], cats = results[1];
            return rows.map(function (r) {
              var c = cats[r.category_slug] || {};
              return normalizeSBBrand(r, c.name, c.icon, c.scoring_categories);
            });
          });
        }
        if (typeof getAllBrands === 'function') return getAllBrands();
        throw new Error('No data source available');
      });
    },

    getBrandsByCategory: function (slug) {
      return checkSupabaseBrands().then(function (hasSB) {
        if (hasSB) {
          return Promise.all([
            supabaseRequest('brands?region=eq.' + SITE_REGION + '&category_slug=eq.' + encodeURIComponent(slug) + '&select=*&order=gonogo_score.desc'),
            loadCategoryCache()
          ]).then(function (results) {
            var rows = results[0], cats = results[1];
            var c = cats[slug] || {};
            return rows.map(function (r) {
              return normalizeSBBrand(r, c.name, c.icon, c.scoring_categories);
            });
          });
        }
        if (typeof getBrandsByCategory === 'function') return getBrandsByCategory(slug);
        throw new Error('No data source available');
      });
    },

    getBrandById: function (id) {
      return checkSupabaseBrands().then(function (hasSB) {
        if (hasSB) {
          return Promise.all([
            supabaseRequest('brands?region=eq.' + SITE_REGION + '&slug=eq.' + encodeURIComponent(id) + '&select=*&limit=1'),
            loadCategoryCache()
          ]).then(function (results) {
            var rows = results[0], cats = results[1];
            if (!rows || rows.length === 0) return null;
            var r = rows[0], c = cats[r.category_slug] || {};
            return normalizeSBBrand(r, c.name, c.icon, c.scoring_categories);
          });
        }
        if (typeof getBrandById === 'function') return getBrandById(id);
        throw new Error('No data source available');
      });
    },

    getStats: function () {
      return checkSupabaseBrands().then(function (hasSB) {
        if (hasSB) {
          return Promise.all([
            supabaseRequest('brands?region=eq.' + SITE_REGION + '&select=gonogo_score,verdict,category_slug'),
            supabaseRequest('categories?region=eq.' + SITE_REGION + '&select=slug')
          ]).then(function (results) {
            var brands = results[0], cats = results[1];
            var total = 0, scoreSum = 0, go = 0, caution = 0, nogo = 0;
            brands.forEach(function (b) {
              total++;
              scoreSum += b.gonogo_score || 0;
              var v = (b.verdict || '').toUpperCase().trim();
              if (v === 'CAUTION') v = 'GO WITH CAUTION';
              if (v === 'GO') go++;
              else if (v === 'GO WITH CAUTION') caution++;
              else if (v === 'NOGO') nogo++;
              else if (b.gonogo_score >= 80) go++;
              else if (b.gonogo_score >= 60) caution++;
              else nogo++;
            });
            return {
              totalCategories: cats.length,
              totalBrands: total,
              totalReviews: 0,
              averageScore: total > 0 ? Math.round((scoreSum / total) * 10) / 10 : 0,
              goCount: go, cautionCount: caution, nogoCount: nogo
            };
          });
        }
        // Fallback to static
        if (typeof BRAND_DATA === 'undefined') throw new Error('No data source available');
        var totalBrands = 0, totalScore = 0, goCount = 0, cautionCount = 0, nogoCount = 0;
        BRAND_DATA.forEach(function (c) {
          if (c.brands) c.brands.forEach(function (b) {
            totalBrands++;
            var score = b.gonogo_score || 0;
            totalScore += score;
            var verdict = (b.verdict || '').toUpperCase().trim();
            if (verdict === 'CAUTION') verdict = 'GO WITH CAUTION';
            if (verdict === 'GO') goCount++;
            else if (verdict === 'GO WITH CAUTION') cautionCount++;
            else if (verdict === 'NOGO') nogoCount++;
            else if (score >= 80) goCount++;
            else if (score >= 60) cautionCount++;
            else nogoCount++;
          });
        });
        return {
          totalCategories: BRAND_DATA.length, totalBrands: totalBrands, totalReviews: 0,
          averageScore: totalBrands > 0 ? Math.round((totalScore / totalBrands) * 10) / 10 : 0,
          goCount: goCount, cautionCount: cautionCount, nogoCount: nogoCount
        };
      });
    },

    // ==========================================
    // REVIEWS — Supabase 'reviews' table
    // ==========================================
    submitReview: function (reviewData) {
      var body = {
        brand_name: reviewData.brandName || reviewData.brand_name || '',
        category_slug: reviewData.categorySlug || reviewData.category_slug || reviewData.category || '',
        reviewer_name: reviewData.reviewerName || reviewData.reviewer_name || '',
        review_text: reviewData.reviewText || reviewData.review_text || '',
        status: 'pending'
      };
      if (reviewData.verdict) body.verdict = reviewData.verdict;
      return reviewsRequest('reviews', {
        method: 'POST',
        body: body,
        prefer: 'return=representation'
      }).then(function () {
        return { ok: true, status: 'pending', message: 'Review submitted — it will appear after approval.' };
      });
    },

    getReviews: function (brandName) {
      return reviewsRequest('reviews?brand_name=eq.' + encodeURIComponent(brandName) + '&status=eq.approved&order=created_at.desc')
        .then(function (data) {
          return (data || []).map(function (r) {
            return {
              id: r.id, category: r.category_slug, brandname: r.brand_name,
              reviewername: r.reviewer_name, reviewtext: r.review_text,
              verdict: r.verdict || '',
              date: r.created_at ? new Date(r.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
              status: r.status
            };
          });
        }).catch(function () { return []; });
    },

    getReviewsForBrand: function (brandName) { return this.getReviews(brandName); },

    getAllReviews: function () {
      return reviewsRequest('reviews?order=created_at.desc')
        .then(function (data) {
          return (data || []).map(function (r) {
            return {
              id: r.id, category: r.category_slug,
              brandname: r.brand_name, brand_name: r.brand_name, BrandName: r.brand_name,
              reviewername: r.reviewer_name, ReviewerName: r.reviewer_name,
              reviewtext: r.review_text, ReviewText: r.review_text,
              verdict: r.verdict || '',
              createdat: r.created_at ? new Date(r.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
              created_at: r.created_at, status: r.status, Status: r.status
            };
          });
        }).catch(function () { return []; });
    },

    moderateReview: function (reviewId, newStatus, moderatedBy) {
      return reviewsRequest('reviews?id=eq.' + encodeURIComponent(reviewId), {
        method: 'PATCH',
        body: { status: newStatus, moderated_by: moderatedBy || 'admin', moderated_at: new Date().toISOString() },
        prefer: 'return=representation'
      }).then(function () { return { ok: true, id: reviewId, status: newStatus }; });
    },

    // ==========================================
    // ADMIN AUTH — Supabase with local fallback
    // ==========================================
    _hashPassword: function (password) {
      var encoder = new TextEncoder();
      return crypto.subtle.digest('SHA-256', encoder.encode(password)).then(function (buf) {
        return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      });
    },

    adminLogin: function (email, password) {
      var self = this;
      return this._hashPassword(password).then(function (hash) {
        return supabaseRequest(
          'admin_users?email=eq.' + encodeURIComponent(email) + '&password_hash=eq.' + encodeURIComponent(hash) + '&select=id,email,display_name,role'
        ).then(function (rows) {
          if (rows && rows.length > 0) return rows[0];
          return null;
        }).catch(function () {
          // Fallback if admin_users table doesn't exist
          var LOCAL_ADMIN = { email: 'admin@gonogo.co.uk', password_hash: '7e716a4d519a3b21539308c8a969e50567c747b1e04492a4bfcf67f92981c6d1' };
          if (email.toLowerCase().trim() === LOCAL_ADMIN.email && hash === LOCAL_ADMIN.password_hash) {
            return { id: 'local-admin', email: LOCAL_ADMIN.email, display_name: 'Admin', role: 'admin' };
          }
          return null;
        });
      });
    },

    adminChangePassword: function (userId, oldPassword, newPassword) {
      var self = this;
      return Promise.all([this._hashPassword(oldPassword), this._hashPassword(newPassword)]).then(function (hashes) {
        if (userId === 'local-admin') throw new Error('Run supabase-setup.sql first to enable password changes');
        return supabaseRequest('admin_users?id=eq.' + encodeURIComponent(userId) + '&password_hash=eq.' + encodeURIComponent(hashes[0]) + '&select=id')
          .then(function (rows) {
            if (!rows || rows.length === 0) throw new Error('Current password is incorrect');
            return supabaseRequest('admin_users?id=eq.' + encodeURIComponent(userId), { method: 'PATCH', body: { password_hash: hashes[1] } });
          }).then(function () { return { ok: true }; });
      });
    },

    adminGetUsers: function () {
      return supabaseRequest('admin_users?select=id,email,display_name,role,created_at&order=created_at.asc')
        .then(function (rows) { return rows || []; })
        .catch(function () {
          var stored = GoNoGoStorage.get('adminUser');
          if (stored) return [{ id: stored.id, email: stored.email, display_name: stored.display_name, role: stored.role, created_at: new Date().toISOString() }];
          return [];
        });
    },

    adminAddUser: function (email, password, displayName, role) {
      return this._hashPassword(password).then(function (hash) {
        return supabaseRequest('admin_users', {
          method: 'POST',
          body: { email: email.toLowerCase().trim(), password_hash: hash, display_name: displayName || '', role: role || 'admin' }
        });
      }).then(function (rows) { return { ok: true, user: rows && rows[0] ? rows[0] : null }; });
    },

    adminRemoveUser: function (userId) {
      return supabaseRequest('admin_users?id=eq.' + encodeURIComponent(userId), { method: 'DELETE' })
        .then(function () { return { ok: true }; });
    },

    // ==========================================
    // BRAND SAVE — writes to Supabase (with localStorage fallback)
    // ==========================================
    saveBrand: function (brandData) {
      var totalScore = 0, totalMax = 0;
      var frameworkBreakdown = [];
      if (brandData.scores) {
        Object.keys(brandData.scores).forEach(function (k) {
          var s = brandData.scores[k];
          totalScore += s.score || 0;
          totalMax += s.max || 0;
          frameworkBreakdown.push({ category: k, score: (s.score||0) + '/' + (s.max||0), description: s.description || '' });
        });
      }
      // GoNoGo score = percentage of points earned vs max possible
      var overallScore = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
      var verdict = overallScore >= 80 ? 'GO' : overallScore >= 60 ? 'GO WITH CAUTION' : 'NOGO';
      var slug = brandData.id || brandData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      // Build the update record — only include fields that were actually provided
      var record = {
        gonogo_score: overallScore,
        verdict: verdict,
        region: SITE_REGION,
        framework_breakdown: frameworkBreakdown,
        last_updated: new Date().toISOString().split('T')[0]
      };
      // Always include these basic fields
      if (brandData.name) record.name = brandData.name;
      if (brandData.categorySlug) record.category_slug = brandData.categorySlug;
      // Only overwrite optional fields if they were explicitly provided (not empty defaults)
      if (brandData.logo) record.logo_url = brandData.logo;
      if (brandData.website) record.website_url = brandData.website;
      if (brandData.googlePlayRating || brandData.iosRating) {
        record.app_ratings = { google_play: brandData.googlePlayRating || 'N/A', ios: brandData.iosRating || 'N/A' };
      }
      // Save arrays/objects if they're explicitly provided in the form data
      if ('keyFeatures' in brandData) record.key_features = brandData.keyFeatures || [];
      if ('pricing' in brandData) record.pricing = brandData.pricing || [];
      if ('strengths' in brandData) record.key_strengths = brandData.strengths || [];
      if ('concerns' in brandData) record.key_concerns = brandData.concerns || [];
      if ('socialSentiment' in brandData) record.social_sentiment = brandData.socialSentiment || {};
      if ('overview' in brandData) record.overview = brandData.overview || '';
      if ('ratingSummary' in brandData) record.rating_summary = brandData.ratingSummary || '';

      return checkSupabaseBrands().then(function (hasSB) {
        if (hasSB) {
          // Try PATCH first (existing brand)
          return supabaseRequest('brands?region=eq.' + SITE_REGION + '&slug=eq.' + encodeURIComponent(slug), {
            method: 'PATCH',
            body: record,
            prefer: 'return=representation'
          }).then(function (rows) {
            if (rows && rows.length > 0) return { ok: true, gonogo_score: overallScore, verdict: verdict, source: 'supabase' };
            // Brand doesn't exist — INSERT with full record + slug
            record.slug = slug;
            return supabaseRequest('brands', { method: 'POST', body: record }).then(function () {
              return { ok: true, gonogo_score: overallScore, verdict: verdict, source: 'supabase' };
            });
          });
        }
        // Fallback to localStorage
        var overrides = GoNoGoStorage.get('brandOverrides') || {};
        overrides[slug] = record;
        GoNoGoStorage.set('brandOverrides', overrides);
        return { ok: true, gonogo_score: overallScore, verdict: verdict, source: 'localStorage' };
      });
    },

    // ==========================================
    // BRAND DELETE
    // ==========================================
    deleteBrand: function (slug) {
      return checkSupabaseBrands().then(function (hasSB) {
        if (hasSB) {
          return supabaseRequest('brands?region=eq.' + SITE_REGION + '&slug=eq.' + encodeURIComponent(slug), { method: 'DELETE' })
            .then(function () { return { ok: true }; });
        }
        throw new Error('Cannot delete brands without Supabase');
      });
    },

    // ==========================================
    // CATEGORY MANAGEMENT
    // ==========================================
    saveCategory: function (categoryData) {
      return supabaseRequest('categories?slug=eq.' + encodeURIComponent(categoryData.slug), {
        method: 'PATCH',
        body: { name: categoryData.name, icon: categoryData.icon, scoring_categories: categoryData.scoringCategories || [] }
      }).then(function (rows) {
        if (rows && rows.length > 0) return { ok: true };
        return supabaseRequest('categories', {
          method: 'POST',
          body: { slug: categoryData.slug, name: categoryData.name, icon: categoryData.icon, scoring_categories: categoryData.scoringCategories || [], region: SITE_REGION }
        }).then(function () { return { ok: true }; });
      });
    }
  };
})();

console.log('GoNoGoAPI loaded (Supabase v2 — auto-detects brands table)');
