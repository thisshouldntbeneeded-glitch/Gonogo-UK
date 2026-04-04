// GoNoGo SA — API Client (Supabase Edition v2)
// Brands + Categories = Supabase tables (with static JS fallback)
// Reviews = Supabase 'reviews' table
// Admin Users = Supabase 'admin_users' table (via secure RPC)

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
    return supabaseRequest('categories?select=*&order=name.asc').then(function (rows) {
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
            supabaseRequest('categories?select=*&order=name.asc'),
            supabaseRequest('brands?region=eq.' + SITE_REGION + '&select=slug,category_slug')
          ]).then(function (results) {
            var cats = results[0], brands = results[1];
            var counts = {};
            brands.forEach(function (b) { counts[b.category_slug] = (counts[b.category_slug] || 0) + 1; });
            return cats.map(function (c) {
              return {
                id: c.slug,
                slug: c.slug,
                name: c.name,
                icon: c.icon,
                icon_color: c.icon_color || null,
                description: c.description || '',
                brandCount: counts[c.slug] || 0,
                hasBrands: (counts[c.slug] || 0) > 0,
                scoringCategories: c.scoring_categories,
                categoryType: c.category_type || 'brand',
                category_type: c.category_type || 'brand'
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
            supabaseRequest('categories?select=slug')
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
    // ADMIN AUTH — Supabase (secure RPC)
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
        return supabaseRequest('rpc/admin_login', {
          method: 'POST',
          body: { p_email: email.toLowerCase().trim(), p_hash: hash }
        }).then(function (rows) {
          if (rows && rows.length > 0) return rows[0];
          // RPC may return a single object instead of array
          if (rows && rows.id) return rows;
          return null;
        }).catch(function (err) {
          // No fallback — admin_users table must be available
          console.error('Admin login failed:', err);
          return null;
        });
      });
    },

    adminChangePassword: function (userId, oldPassword, newPassword) {
      var self = this;
      return Promise.all([this._hashPassword(oldPassword), this._hashPassword(newPassword)]).then(function (hashes) {
        if (!userId) throw new Error('Invalid user session');
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
      if (brandData.reviewed_by) record.reviewed_by = brandData.reviewed_by;
      if (brandData.reviewed_at) record.reviewed_at = brandData.reviewed_at;

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
    // BRANCH MANAGEMENT
    // ==========================================
    saveBranch: function (branchData) {
      var record = {
        branch_name: branchData.branch_name,
        department_type: branchData.department_type,
        category_slug: branchData.category_slug,
        province: branchData.province || '',
        total_score: branchData.total_score || 0,
        compliance: branchData.compliance || 0,
        customer_satisfaction: branchData.customer_satisfaction || 0,
        service_offering: branchData.service_offering || 0,
        innovation: branchData.innovation || 0,
        customer_support: branchData.customer_support || 0,
        accessibility_security: branchData.accessibility_security || 0,
        region: SITE_REGION
      };

      if (branchData.manager) record.manager = branchData.manager;
      if (branchData.manager_email) record.manager_email = branchData.manager_email;
      if (branchData.telephone) record.telephone = branchData.telephone;
      if (branchData.address) record.address = branchData.address;
      if (branchData.hours) record.hours = branchData.hours;
      if (branchData.services) record.services = branchData.services;

      return supabaseRequest('branches', {
        method: 'POST',
        body: record,
        prefer: 'return=representation'
      }).then(function (rows) {
        return { ok: true, branch: rows && rows[0] ? rows[0] : null };
      });
    },

    // ==========================================
    // CATEGORY MANAGEMENT
    // ==========================================
    saveCategory: function (categoryData) {
      _categoryCache = null; // bust cache
      var patchBody = {
        name: categoryData.name,
        icon: categoryData.icon,
        scoring_categories: categoryData.scoringCategories || []
      };

      if (categoryData.category_type) patchBody.category_type = categoryData.category_type;
      if (categoryData.description !== undefined) patchBody.description = categoryData.description;
      if (categoryData.icon_color !== undefined) patchBody.icon_color = categoryData.icon_color;

      return supabaseRequest('categories?slug=eq.' + encodeURIComponent(categoryData.slug), {
        method: 'PATCH',
        body: patchBody
      }).then(function (rows) {
        if (rows && rows.length > 0) return { ok: true };

        var postBody = {
          slug: categoryData.slug,
          name: categoryData.name,
          icon: categoryData.icon,
          scoring_categories: categoryData.scoringCategories || [],
          region: SITE_REGION
        };

        if (categoryData.category_type) postBody.category_type = categoryData.category_type;
        if (categoryData.description) postBody.description = categoryData.description;
        if (categoryData.icon_color) postBody.icon_color = categoryData.icon_color;

        return supabaseRequest('categories', {
          method: 'POST',
          body: postBody
        }).then(function () { return { ok: true }; });
      });
    },

    addCategory: function (categoryData) {
      _categoryCache = null;
      var slug = categoryData.slug || categoryData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      var postBody = {
        slug: slug,
        name: categoryData.name,
        icon: categoryData.icon || 'fa-tag',
        scoring_categories: categoryData.scoringCategories || categoryData.scoring_categories || [
          { name: 'Compliance', max: 20 },
          { name: 'Customer Satisfaction', max: 25 },
          { name: 'Product Value', max: 35 },
          { name: 'Innovation', max: 10 },
          { name: 'Customer Support', max: 15 },
          { name: 'Accessibility & Security', max: 10 }
        ],
        region: SITE_REGION
      };

      if (categoryData.description) postBody.description = categoryData.description;
      if (categoryData.icon_color) postBody.icon_color = categoryData.icon_color;
      if (categoryData.category_type) postBody.category_type = categoryData.category_type;

      return supabaseRequest('categories', {
        method: 'POST',
        body: postBody
      }).then(function () {
        return { ok: true };
      });
    },

    // Update category name/icon (rename). Updates all brands that reference this category.
    updateCategory: function (slug, newName, newIcon) {
      _categoryCache = null; // bust cache
      var body = {};
      if (newName !== undefined) body.name = newName;
      if (newIcon !== undefined) body.icon = newIcon;
      return supabaseRequest('categories?slug=eq.' + encodeURIComponent(slug), {
        method: 'PATCH',
        body: body
      }).then(function (rows) {
        if (!rows || rows.length === 0) throw new Error('Category not found');
        return { ok: true };
      });
    },

    // Delete a category (only if no brands reference it)
    deleteCategory: function (slug) {
      _categoryCache = null; // bust cache
      // First check if any brands use this category
      return supabaseRequest('brands?category_slug=eq.' + encodeURIComponent(slug) + '&select=slug&limit=1').then(function (rows) {
        if (rows && rows.length > 0) {
          throw new Error('Cannot delete category — it still has brands assigned to it. Remove or reassign all brands first.');
        }
        return supabaseRequest('categories?slug=eq.' + encodeURIComponent(slug), { method: 'DELETE' })
          .then(function () { return { ok: true }; });
      });
    },

    // ==========================================
    // BRAND PORTAL AUTH — tries brand_login first, then admin_login as fallback
    // ==========================================
    brandLogin: function (email, password) {
      var self = this;
      return this._hashPassword(password).then(function (hash) {
        // Try brand login first
        return supabaseRequest('rpc/brand_login', {
          method: 'POST',
          body: { p_email: email.toLowerCase().trim(), p_hash: hash }
        }).then(function (rows) {
          if (rows && rows.length > 0) return rows[0];
          if (rows && rows.id) return rows;
          // No brand user found — try admin login as fallback
          return supabaseRequest('rpc/admin_login', {
            method: 'POST',
            body: { p_email: email.toLowerCase().trim(), p_hash: hash }
          }).then(function (adminRows) {
            if (adminRows && adminRows.length > 0) {
              var admin = adminRows[0];
              return { id: admin.id, email: admin.email, display_name: admin.display_name, role: 'admin', brand_slug: '__admin__', region: SITE_REGION };
            }
            if (adminRows && adminRows.id) {
              return { id: adminRows.id, email: adminRows.email, display_name: adminRows.display_name, role: 'admin', brand_slug: '__admin__', region: SITE_REGION };
            }
            return null;
          }).catch(function () { return null; });
        }).catch(function (err) {
          // brand_login RPC might not exist yet — try admin
          return supabaseRequest('rpc/admin_login', {
            method: 'POST',
            body: { p_email: email.toLowerCase().trim(), p_hash: hash }
          }).then(function (adminRows) {
            if (adminRows && adminRows.length > 0) {
              var admin = adminRows[0];
              return { id: admin.id, email: admin.email, display_name: admin.display_name, role: 'admin', brand_slug: '__admin__', region: SITE_REGION };
            }
            return null;
          }).catch(function () { return null; });
        });
      });
    },

    // Get all brands (for admin brand picker)
    getAllBrandSlugs: function () {
      return supabaseRequest('brands?region=eq.' + SITE_REGION + '&select=slug,name,gonogo_score,verdict&order=name.asc')
        .then(function (rows) { return rows || []; })
        .catch(function () { return []; });
    },

    // Brand user management (admin only)
getBrandUsers: function () {
  return supabaseRequest('rpc/admin_list_brand_users', {
    method: 'POST',
    body: {}
  }).then(function (rows) {
    return rows || [];
  }).catch(function () {
    return [];
  });
},

addBrandUser: function (email, password, displayName, brandSlug, region) {
  return this._hashPassword(password).then(function (hash) {
    return supabaseRequest('rpc/admin_add_brand_user', {
      method: 'POST',
      body: {
        p_email: email.toLowerCase().trim(),
        p_hash: hash,
        p_display_name: displayName || '',
        p_brand_slug: brandSlug,
        p_region: region || SITE_REGION
      }
    });
  }).then(function (rows) {
    return { ok: true, user: rows && rows[0] ? rows[0] : null };
  });
},

removeBrandUser: function (userId) {
  return supabaseRequest('rpc/admin_remove_brand_user', {
    method: 'POST',
    body: { p_user_id: userId }
  }).then(function () {
    return { ok: true };
  });
},

getBrandUser: function () {
  try {
    var stored = GoNoGoStorage.get('brandUser');
    if (stored) {
      var loginTime = GoNoGoStorage.get('brandLoginTime');
      if (loginTime) {
        var elapsed = Date.now() - loginTime;
        if (elapsed > 24 * 60 * 60 * 1000) {
          GoNoGoStorage.remove('brandUser');
          GoNoGoStorage.remove('brandLoginTime');
          return null;
        }
      }
      return stored;
    }
  } catch (e) {}
  return null;
},

    // ==========================================
    // BRAND-SCOPED DATA
    // ==========================================
    getBrandData: function (slug) {
      return Promise.all([
        supabaseRequest('brands?region=eq.' + SITE_REGION + '&slug=eq.' + encodeURIComponent(slug) + '&select=*&limit=1'),
        loadCategoryCache()
      ]).then(function (results) {
        var rows = results[0], cats = results[1];
        if (!rows || rows.length === 0) return null;
        var r = rows[0], c = cats[r.category_slug] || {};
        return {
          raw: r,
          normalized: normalizeSBBrand(r, c.name, c.icon, c.scoring_categories),
          category: c
        };
      });
    },

    getBrandReviews: function (brandName) {
      return reviewsRequest('reviews?brand_name=eq.' + encodeURIComponent(brandName) + '&order=created_at.desc')
        .then(function (data) {
          return (data || []).map(function (r) {
            return {
              id: r.id,
              category: r.category_slug,
              brand_name: r.brand_name,
              reviewer_name: r.reviewer_name,
              review_text: r.review_text,
              verdict: r.verdict || '',
              created_at: r.created_at,
              date: r.created_at ? new Date(r.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
              status: r.status
            };
          });
        }).catch(function () { return []; });
    },

    getBrandsInCategory: function (categorySlug) {
      return supabaseRequest('brands?region=eq.' + SITE_REGION + '&category_slug=eq.' + encodeURIComponent(categorySlug) + '&select=name,slug,gonogo_score,verdict&order=gonogo_score.desc')
        .then(function (rows) { return rows || []; })
        .catch(function () { return []; });
    },

    // ==========================================
    // REVIEW REPLIES (on brands project)
    // ==========================================
    getReviewReplies: function (brandSlug) {
      return supabaseRequest('review_replies?brand_slug=eq.' + encodeURIComponent(brandSlug) + '&order=created_at.desc')
        .then(function (rows) { return rows || []; })
        .catch(function () { return []; });
    },

    submitReply: function (reviewId, brandSlug, replyText, repliedBy) {
      return supabaseRequest('review_replies', {
        method: 'POST',
        body: {
          review_id: reviewId,
          brand_slug: brandSlug,
          reply_text: replyText,
          replied_by: repliedBy,
          created_at: new Date().toISOString()
        },
        prefer: 'return=representation'
      }).then(function (rows) {
        return { ok: true, reply: rows && rows[0] ? rows[0] : null };
      });
    },

    // ==========================================
    // PASSWORD RESET
    // ==========================================
    requestPasswordReset: function (email) {
      return fetch(SUPABASE_URL + '/functions/v1/send-reset-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
          'x-site-origin': window.location.origin
        },
        body: JSON.stringify({ email: email.toLowerCase().trim() })
      }).then(function (r) { return r.json(); });
    },

    verifyResetToken: function (token) {
      return supabaseRequest('rpc/verify_reset_token', {
        method: 'POST',
        body: { p_token: token }
      });
    },

    resetPassword: function (token, newPassword) {
      var self = this;
      return self._hashPassword(newPassword).then(function (hash) {
        return supabaseRequest('rpc/reset_brand_password', {
          method: 'POST',
          body: { p_token: token, p_new_hash: hash }
        });
      });
    }
  };
})();

console.log('GoNoGoAPI loaded (Supabase v2 — auto-detects brands table)');
