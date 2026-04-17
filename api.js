// GoNoGo SA — API Client (Supabase Edition v2)
// Brands + Categories = Supabase tables (with static JS fallback)
// Reviews = Supabase 'reviews' table
// Admin Users = Supabase 'admin_users' table (via secure RPC)

var GoNoGoAPI = (function () {
  'use strict';

  var SUPABASE_URL = 'https://fnpxaneextqidbessnej.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_132Gl37kwIXtdJc5VHtGCw_iXPxa6cW';
  var SITE_REGION = 'za';

  var REVIEWS_SUPABASE_URL = 'https://kkpbzttwljxvyjbvggqr.supabase.co';
  var REVIEWS_SUPABASE_KEY = 'sb_publishable_y5JnEvpF37HMKB2rcWbrog_6Oe0KYJW';

  var _supabaseBrandsAvailable = null;
  var _categoryCache = null;

  function _sbFetch(baseUrl, apiKey, path, options) {
    options = options || {};
    var url = baseUrl + '/rest/v1/' + path;
    var headers = {
      apikey: apiKey,
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation'
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

  function supabaseRequest(path, options) {
    return _sbFetch(SUPABASE_URL, SUPABASE_ANON_KEY, path, options);
  }

  function reviewsRequest(path, options) {
    return _sbFetch(REVIEWS_SUPABASE_URL, REVIEWS_SUPABASE_KEY, path, options);
  }

  function checkSupabaseBrands() {
    if (_supabaseBrandsAvailable !== null) return Promise.resolve(_supabaseBrandsAvailable);
    return supabaseRequest('brands?region=eq.' + SITE_REGION + '&select=slug&limit=1')
      .then(function () {
        _supabaseBrandsAvailable = true;
        console.log('Supabase brands table: AVAILABLE');
        return true;
      })
      .catch(function () {
        _supabaseBrandsAvailable = false;
        console.log('Supabase brands table: NOT AVAILABLE — using static data fallback');
        return false;
      });
  }

  function loadCategoryCache() {
    if (_categoryCache) return Promise.resolve(_categoryCache);
    return supabaseRequest('categories?select=*&order=sort_order.asc,name.asc').then(function (rows) {
      _categoryCache = {};
      (rows || []).forEach(function (c) {
        _categoryCache[c.slug] = {
          name: c.name,
          icon: c.icon,
          icon_color: c.icon_color || null,
          description: c.description || '',
          scoring_categories: c.scoring_categories,
          category_type: c.category_type || 'brand'
        };
      });
      return _categoryCache;
    });
  }

  // Filter appended to public-facing brand queries (hides inactive / draft brands)
  var LIVE_FILTER = '&is_active=eq.true&status=eq.live';

  function normalizeSBBrand(row, categoryName, categoryIcon, scoringCategories) {
    var categoryScores = {};
    (row.framework_breakdown || []).forEach(function (fb) {
      var parts = String(fb.score || '0/0').split('/');
      categoryScores[fb.category] = {
        score: parseFloat(parts[0]) || 0,
        max: parseFloat(parts[1]) || 0,
        description: fb.description || ''
      };
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
      appRatings: {
        googlePlay: gp,
        ios: ios,
        googlePlayScore: parseFloat(gp) || 0,
        iosScore: parseFloat(ios) || 0
      },
      strengths: row.key_strengths || [],
      concerns: row.key_concerns || [],
      socialSentiment: row.social_sentiment || {},
      overview: row.overview || '',
      ratingSummary: row.rating_summary || '',
      lastUpdated: row.last_updated || '2026-03-01',
      region: row.region || '',
      reviewed_by: row.reviewed_by || '',
      reviewed_at: row.reviewed_at || '',
      created_at: row.created_at || '',
      internal_score_justification: row.internal_score_justification || '',
      scoring_breakdown: row.scoring_breakdown || null,
      is_active: row.is_active !== false,
      status: row.status || 'live'
    };
  }

  return {
    SITE_REGION: SITE_REGION,

    isLive: function () {
      return true;
    },

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
          return Promise.all([
            supabaseRequest('categories?select=*&order=sort_order.asc,name.asc'),
            supabaseRequest('brands?region=eq.' + SITE_REGION + LIVE_FILTER + '&select=slug,category_slug'),
            supabaseRequest('branches?select=branch_id,category_slug').catch(function () {
              return [];
            })
          ]).then(function (results) {
            var cats = results[0] || [];
            var brands = results[1] || [];
            var branches = results[2] || [];
            var counts = {};

            brands.forEach(function (b) {
              counts[b.category_slug] = (counts[b.category_slug] || 0) + 1;
            });

            // Only count branches for categories that have no brands
            branches.forEach(function (b) {
              if (!counts[b.category_slug]) {
                counts[b.category_slug] = (counts[b.category_slug] || 0) + 1;
              }
            });

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

        if (typeof getCategoriesWithBrands === 'function') return getCategoriesWithBrands();
        throw new Error('No data source available');
      });
    },

    getCategories: function () {
      return this.getCategoriesWithBrands();
    },

    updateCategory: function (slug, data) {
      _categoryCache = null;
      var auth = this._getCallerAuth();
      var body = {};

      if (typeof data.name !== 'undefined') body.name = data.name;
      if (typeof data.icon !== 'undefined') body.icon = data.icon;
      if (typeof data.description !== 'undefined') body.description = data.description;
      if (typeof data.icon_color !== 'undefined') body.icon_color = data.icon_color;
      if (typeof data.category_type !== 'undefined') body.category_type = data.category_type;
      if (typeof data.scoring_categories !== 'undefined') body.scoring_categories = data.scoring_categories;

      return supabaseRequest('rpc/admin_save_category', {
        method: 'POST',
        body: {
          p_caller_id: auth.p_caller_id,
          p_caller_hash: auth.p_caller_hash,
          p_slug: slug,
          p_data: body
        }
      }).then(function () {
        return { ok: true };
      });
    },

    // Propagate a category description change into every brand's framework_breakdown
    updateBrandFrameworkDescriptions: function (categorySlug, categoryName, description) {
      var self = this;
      return supabaseRequest(
        'brands?region=eq.' + SITE_REGION + '&category_slug=eq.' + encodeURIComponent(categorySlug) + '&select=slug,framework_breakdown'
      ).then(function (brands) {
        if (!brands || !brands.length) return;
        var auth = self._getCallerAuth();
        return Promise.all(brands.map(function (brand) {
          var fb = (brand.framework_breakdown || []).map(function (entry) {
            if (entry.category === categoryName) {
              return { category: entry.category, score: entry.score, description: description };
            }
            return entry;
          });
          return supabaseRequest('rpc/admin_save_brand', {
            method: 'POST',
            body: {
              p_caller_id: auth.p_caller_id,
              p_caller_hash: auth.p_caller_hash,
              p_slug: brand.slug,
              p_data: { framework_breakdown: fb }
            }
          });
        }));
      });
    },

    // ==========================================
    // BRANDS
    // ==========================================
    getTopBrands: function (count) {
      return checkSupabaseBrands().then(function (hasSB) {
        if (hasSB) {
          return Promise.all([
            supabaseRequest('brands?region=eq.' + SITE_REGION + LIVE_FILTER + '&select=*&order=gonogo_score.desc&limit=' + (count || 6)),
            loadCategoryCache()
          ]).then(function (results) {
            var rows = results[0] || [];
            var cats = results[1] || {};
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
            supabaseRequest('brands?region=eq.' + SITE_REGION + LIVE_FILTER + '&select=*&order=gonogo_score.desc'),
            loadCategoryCache()
          ]).then(function (results) {
            var rows = results[0] || [];
            var cats = results[1] || {};
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

    // Admin: returns ALL brands regardless of status or is_active
    getAllBrandsAdmin: function () {
      return checkSupabaseBrands().then(function (hasSB) {
        if (hasSB) {
          return Promise.all([
            supabaseRequest('brands?region=eq.' + SITE_REGION + '&select=*&order=gonogo_score.desc'),
            loadCategoryCache()
          ]).then(function (results) {
            var rows = results[0] || [];
            var cats = results[1] || {};
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
            supabaseRequest('brands?region=eq.' + SITE_REGION + LIVE_FILTER + '&category_slug=eq.' + encodeURIComponent(slug) + '&select=*&order=gonogo_score.desc'),
            loadCategoryCache()
          ]).then(function (results) {
            var rows = results[0] || [];
            var cats = results[1] || {};
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
            supabaseRequest('brands?region=eq.' + SITE_REGION + LIVE_FILTER + '&slug=eq.' + encodeURIComponent(id) + '&select=*&limit=1'),
            loadCategoryCache()
          ]).then(function (results) {
            var rows = results[0] || [];
            var cats = results[1] || {};
            if (!rows.length) return null;
            var r = rows[0];
            var c = cats[r.category_slug] || {};
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
            supabaseRequest('brands?region=eq.' + SITE_REGION + LIVE_FILTER + '&select=gonogo_score,verdict,category_slug'),
            supabaseRequest('categories?select=slug')
          ]).then(function (results) {
            var brands = results[0] || [];
            var cats = results[1] || [];
            var total = 0;
            var scoreSum = 0;
            var go = 0;
            var caution = 0;
            var nogo = 0;

            brands.forEach(function (b) {
              total++;
              scoreSum += b.gonogo_score || 0;
              var s = b.gonogo_score || 0;
              if (s >= 80) go++;
              else if (s >= 60) go++;
              else nogo++;
            });

            return {
              totalCategories: cats.length,
              totalBrands: total,
              totalReviews: 0,
              averageScore: total > 0 ? Math.round((scoreSum / total) * 10) / 10 : 0,
              goCount: go,
              cautionCount: caution,
              nogoCount: nogo
            };
          });
        }

        if (typeof BRAND_DATA === 'undefined') throw new Error('No data source available');

        var totalBrands = 0;
        var totalScore = 0;
        var goCount = 0;
        var cautionCount = 0;
        var nogoCount = 0;

        BRAND_DATA.forEach(function (c) {
          if (c.brands) {
            c.brands.forEach(function (b) {
              totalBrands++;
              var score = b.gonogo_score || 0;
              totalScore += score;

              if (score >= 60) goCount++;
              else nogoCount++;
            });
          }
        });

        return {
          totalCategories: BRAND_DATA.length,
          totalBrands: totalBrands,
          totalReviews: 0,
          averageScore: totalBrands > 0 ? Math.round((totalScore / totalBrands) * 10) / 10 : 0,
          goCount: goCount,
          cautionCount: cautionCount,
          nogoCount: nogoCount
        };
      });
    },

    // ==========================================
    // REVIEWS
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
      if (reviewData.user_id) body.user_id = reviewData.user_id;

      return reviewsRequest('reviews', {
        method: 'POST',
        body: body,
        prefer: 'return=representation'
      }).then(function () {
        return {
          ok: true,
          status: 'pending',
          message: 'Review submitted — it will appear after approval.'
        };
      });
    },

    getReviews: function (brandName) {
      return reviewsRequest('reviews?brand_name=eq.' + encodeURIComponent(brandName) + '&status=eq.approved&order=created_at.desc')
        .then(function (data) {
          return (data || []).map(function (r) {
            return {
              id: r.id,
              category: r.category_slug,
              brandname: r.brand_name,
              reviewername: r.reviewer_name,
              reviewtext: r.review_text,
              verdict: r.verdict || '',
              date: r.created_at ? new Date(r.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
              status: r.status
            };
          });
        })
        .catch(function () {
          return [];
        });
    },

    getReviewsForBrand: function (brandName) {
      return this.getReviews(brandName);
    },

    getPendingReviewCount: function () {
      return reviewsRequest('reviews?status=eq.pending&select=id', { prefer: 'count=exact' })
        .then(function (rows) { return (rows || []).length; })
        .catch(function () { return 0; });
    },

    getAllReviews: function () {
      return reviewsRequest('reviews?order=created_at.desc')
        .then(function (data) {
          return (data || []).map(function (r) {
            return {
              id: r.id,
              category: r.category_slug,
              brandname: r.brand_name,
              brand_name: r.brand_name,
              BrandName: r.brand_name,
              reviewername: r.reviewer_name,
              ReviewerName: r.reviewer_name,
              reviewtext: r.review_text,
              ReviewText: r.review_text,
              verdict: r.verdict || '',
              createdat: r.created_at ? new Date(r.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
              created_at: r.created_at,
              status: r.status,
              Status: r.status
            };
          });
        })
        .catch(function () {
          return [];
        });
    },

    moderateReview: function (reviewId, newStatus, moderatedBy) {
      return reviewsRequest('rpc/moderate_review', {
        method: 'POST',
        body: {
          p_review_id: reviewId,
          p_status: newStatus,
          p_moderated_by: moderatedBy || 'admin'
        }
      });
    },

    // ==========================================
    // ADMIN AUTH
    // ==========================================
    _hashPassword: function (password) {
      var encoder = new TextEncoder();
      return crypto.subtle.digest('SHA-256', encoder.encode(password)).then(function (buf) {
        return Array.from(new Uint8Array(buf))
          .map(function (b) {
            return b.toString(16).padStart(2, '0');
          })
          .join('');
      });
    },

    adminLogin: function (email, password) {
      return this._hashPassword(password).then(function (hash) {
        return supabaseRequest('rpc/admin_login', {
          method: 'POST',
          body: { p_email: email.toLowerCase().trim(), p_hash: hash }
        })
          .then(function (rows) {
            if (rows && rows.length > 0) return rows[0];
            if (rows && rows.id) return rows;
            return null;
          })
          .catch(function (err) {
            console.error('Admin login failed:', err);
            return null;
          });
      });
    },

    // Helper: get caller auth from stored admin session
    _getCallerAuth: function () {
      var stored = GoNoGoStorage.get('adminUser');
      if (stored && stored.id && stored._ah) return { p_caller_id: stored.id, p_caller_hash: stored._ah };
      return { p_caller_id: null, p_caller_hash: null };
    },

    adminGetUsers: function () {
      var auth = this._getCallerAuth();
      return supabaseRequest('rpc/admin_list_users', {
        method: 'POST',
        body: auth
      }).then(function (rows) { return rows || []; })
        .catch(function () { return []; });
    },

    adminAddUser: function (email, password, displayName, role) {
      var auth = this._getCallerAuth();
      return this._hashPassword(password).then(function (hash) {
        return supabaseRequest('rpc/admin_add_user', {
          method: 'POST',
          body: Object.assign({ p_email: email.toLowerCase().trim(), p_hash: hash, p_display_name: displayName || '', p_role: role || 'admin' }, auth)
        });
      }).then(function (rows) {
        return { ok: true, user: rows && rows[0] ? rows[0] : null };
      });
    },

    adminRemoveUser: function (userId) {
      var auth = this._getCallerAuth();
      return supabaseRequest('rpc/admin_remove_user', {
        method: 'POST',
        body: Object.assign({ p_user_id: userId }, auth)
      }).then(function () {
        return { ok: true };
      });
    },

    adminChangePassword: function (userId, oldPassword, newPassword) {
      var self = this;
      return Promise.all([
        this._hashPassword(oldPassword),
        this._hashPassword(newPassword)
      ]).then(function (hashes) {
        if (!userId) throw new Error('Invalid user session');
        return supabaseRequest('rpc/admin_change_password', {
          method: 'POST',
          body: {
            p_user_id: userId,
            p_old_hash: hashes[0],
            p_new_hash: hashes[1]
          }
        }).then(function (result) {
          if (result === false) throw new Error('Current password is incorrect');
          var stored = GoNoGoStorage.get('adminUser');
          if (stored) { stored._ah = hashes[1]; GoNoGoStorage.set('adminUser', stored); }
          return { ok: true };
        });
      });
    },

    // ==========================================
    // BRAND USERS
    // ==========================================
    getBrandUsers: function () {
      var auth = this._getCallerAuth();
      return supabaseRequest('rpc/admin_list_brand_users', {
        method: 'POST',
        body: auth
      }).then(function (rows) {
        return rows || [];
      }).catch(function () {
        return [];
      });
    },

    addBrandUser: function (email, password, displayName, brandSlug, region) {
      var auth = this._getCallerAuth();
      return this._hashPassword(password).then(function (hash) {
        return supabaseRequest('rpc/admin_add_brand_user', {
          method: 'POST',
          body: Object.assign({
            p_email: email.toLowerCase().trim(),
            p_hash: hash,
            p_display_name: displayName || '',
            p_brand_slug: brandSlug,
            p_region: region || SITE_REGION
          }, auth)
        });
      }).then(function (rows) {
        return { ok: true, user: rows && rows[0] ? rows[0] : null };
      });
    },

    removeBrandUser: function (userId) {
      var auth = this._getCallerAuth();
      return supabaseRequest('rpc/admin_remove_brand_user', {
        method: 'POST',
        body: Object.assign({ p_user_id: userId }, auth)
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
    // BRAND PORTAL AUTH
    // ==========================================
    brandLogin: function (email, password) {
      return this._hashPassword(password).then(function (hash) {
        return supabaseRequest('rpc/brand_login', {
          method: 'POST',
          body: {
            p_email: email.toLowerCase().trim(),
            p_hash: hash
          }
        }).then(function (rows) {
          if (rows && rows.length > 0) return rows[0];
          if (rows && rows.id) return rows;

          return supabaseRequest('rpc/admin_login', {
            method: 'POST',
            body: {
              p_email: email.toLowerCase().trim(),
              p_hash: hash
            }
          }).then(function (adminRows) {
            if (adminRows && adminRows.length > 0) {
              var admin = adminRows[0];
              return {
                id: admin.id,
                email: admin.email,
                display_name: admin.display_name,
                role: 'admin',
                brand_slug: '__admin__',
                region: SITE_REGION
              };
            }
            if (adminRows && adminRows.id) {
              return {
                id: adminRows.id,
                email: adminRows.email,
                display_name: adminRows.display_name,
                role: 'admin',
                brand_slug: '__admin__',
                region: SITE_REGION
              };
            }
            return null;
          }).catch(function () {
            return null;
          });
        }).catch(function () {
          return supabaseRequest('rpc/admin_login', {
            method: 'POST',
            body: {
              p_email: email.toLowerCase().trim(),
              p_hash: hash
            }
          }).then(function (adminRows) {
            if (adminRows && adminRows.length > 0) {
              var admin = adminRows[0];
              return {
                id: admin.id,
                email: admin.email,
                display_name: admin.display_name,
                role: 'admin',
                brand_slug: '__admin__',
                region: SITE_REGION
              };
            }
            if (adminRows && adminRows.id) {
              return {
                id: adminRows.id,
                email: adminRows.email,
                display_name: adminRows.display_name,
                role: 'admin',
                brand_slug: '__admin__',
                region: SITE_REGION
              };
            }
            return null;
          }).catch(function () {
            return null;
          });
        });
      });
    },

    getAllBrandSlugs: function () {
      return supabaseRequest('brands?region=eq.' + SITE_REGION + LIVE_FILTER + '&select=slug,name,gonogo_score,verdict&order=name.asc')
        .then(function (rows) {
          return rows || [];
        })
        .catch(function () {
          return [];
        });
    },

    // ==========================================
    // BRAND-SCOPED DATA
    // ==========================================
    getBrandData: function (slug) {
      return Promise.all([
        supabaseRequest('brands?region=eq.' + SITE_REGION + LIVE_FILTER + '&slug=eq.' + encodeURIComponent(slug) + '&select=*&limit=1'),
        loadCategoryCache()
      ]).then(function (results) {
        var rows = results[0] || [];
        var cats = results[1] || {};
        if (!rows.length) return null;
        var r = rows[0];
        var c = cats[r.category_slug] || {};
        return {
          raw: r,
          normalized: normalizeSBBrand(r, c.name, c.icon, c.scoring_categories),
          category: c
        };
      });
    },

    // Granular per-criterion scores (brand_scores + scoring_templates)
    getBrandGranularScores: function (brandSlug) {
      return supabaseRequest(
        'brand_scores?brand_slug=eq.' + encodeURIComponent(brandSlug) +
        '&select=score,evidence,source_url,scoring_templates(category,subcategory,point_description,max_points,sort_order)'
      ).then(function (rows) {
        if (!rows || !rows.length) return null;
        // Group by category
        var grouped = {};
        rows.forEach(function (r) {
          var t = r.scoring_templates;
          if (!t) return;
          var cat = t.category;
          if (!grouped[cat]) grouped[cat] = { criteria: [], earned: 0, max: 0 };
          var s = parseFloat(r.score) || 0;
          var m = parseFloat(t.max_points) || 0;
          grouped[cat].earned += s;
          grouped[cat].max += m;
          grouped[cat].criteria.push({
            subcategory: t.subcategory,
            description: t.point_description,
            score: s,
            max: m,
            evidence: r.evidence || '',
            source: r.source_url || '',
            sort: t.sort_order || 0
          });
        });
        // Sort criteria within each category
        Object.keys(grouped).forEach(function (cat) {
          grouped[cat].criteria.sort(function (a, b) { return a.sort - b.sort; });
        });
        return grouped;
      }).catch(function () { return null; });
    },

    getBrandReviews: function (brandName) {
      return reviewsRequest('reviews?brand_name=eq.' + encodeURIComponent(brandName) + '&status=eq.approved&order=created_at.desc')
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
        })
        .catch(function () {
          return [];
        });
    },

    getBrandsInCategory: function (categorySlug) {
      return supabaseRequest('brands?region=eq.' + SITE_REGION + LIVE_FILTER + '&category_slug=eq.' + encodeURIComponent(categorySlug) + '&select=name,slug,gonogo_score,verdict&order=gonogo_score.desc')
        .then(function (rows) {
          return rows || [];
        })
        .catch(function () {
          return [];
        });
    },

    // ==========================================
    // REVIEW REPLIES
    // ==========================================
    getReviewReplies: function (brandSlug) {
      return supabaseRequest('review_replies?brand_slug=eq.' + encodeURIComponent(brandSlug) + '&order=created_at.desc')
        .then(function (rows) {
          return rows || [];
        })
        .catch(function () {
          return [];
        });
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
    // BRAND SAVE
    // ==========================================
    saveBrand: function (brandData) {
      var totalScore = 0;
      var totalMax = 0;
      var frameworkBreakdown = [];

      if (brandData.scores) {
        Object.keys(brandData.scores).forEach(function (k) {
          var s = brandData.scores[k];
          totalScore += s.score || 0;
          totalMax += s.max || 0;
          frameworkBreakdown.push({
            category: k,
            score: (s.score || 0) + '/' + (s.max || 0),
            description: s.description || ''
          });
        });
      }

      // Fall back to scoring_breakdown if no individual scores provided
      if (frameworkBreakdown.length === 0 && brandData.scoring_breakdown && typeof brandData.scoring_breakdown === 'object') {
        Object.keys(brandData.scoring_breakdown).forEach(function(k) {
          var s = brandData.scoring_breakdown[k] || {};
          totalScore += s.score || 0;
          totalMax += s.max || 0;
          frameworkBreakdown.push({ category: k, score: (s.score || 0) + '/' + (s.max || 0), description: s.description || '' });
        });
      }
      var overallScore = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : (brandData.gonogo_score || 0);
      var verdict = totalMax > 0
        ? (overallScore >= 80 ? 'TOP PERFORMER' : overallScore >= 60 ? 'GO' : 'NOGO')
        : (brandData.verdict || (overallScore >= 80 ? 'TOP PERFORMER' : overallScore >= 60 ? 'GO' : 'NOGO'));
      var slug = brandData.id || brandData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      var record = {
        gonogo_score: overallScore,
        verdict: verdict,
        region: SITE_REGION,
        framework_breakdown: frameworkBreakdown,
        last_updated: new Date().toISOString().split('T')[0]
      };

      // QA workflow: if _csvImport flag is set, new brands land as draft
      if (brandData._csvImport) {
        record.status = 'draft';
      }
      // Allow explicit overrides
      if ('is_active' in brandData) record.is_active = brandData.is_active;
      if ('status' in brandData && brandData.status) record.status = brandData.status;

      if (brandData.name) record.name = brandData.name;
      if (brandData.categorySlug) record.category_slug = brandData.categorySlug;
      if (brandData.logo) record.logo_url = brandData.logo;
      if (brandData.website) record.website_url = brandData.website;

      if (brandData.googlePlayRating || brandData.iosRating) {
        record.app_ratings = {
          google_play: brandData.googlePlayRating || 'N/A',
          ios: brandData.iosRating || 'N/A'
        };
      }

      if ('keyFeatures' in brandData) record.key_features = brandData.keyFeatures || [];
      if ('pricing' in brandData) record.pricing = brandData.pricing || [];
      if ('strengths' in brandData) record.key_strengths = brandData.strengths || [];
      if ('concerns' in brandData) record.key_concerns = brandData.concerns || [];
      if ('socialSentiment' in brandData) record.social_sentiment = brandData.socialSentiment || {};
      if ('overview' in brandData) record.overview = brandData.overview || '';
      if ('ratingSummary' in brandData) record.rating_summary = brandData.ratingSummary || '';
      if (brandData.reviewed_by) record.reviewed_by = brandData.reviewed_by;
      if (brandData.reviewed_at && /^\d{4}-\d{2}-\d{2}/.test(brandData.reviewed_at)) record.reviewed_at = brandData.reviewed_at;
      if (brandData.created_at && /^\d{4}-\d{2}-\d{2}/.test(brandData.created_at)) record.created_at = brandData.created_at;
      if (brandData.internal_score_justification && typeof brandData.internal_score_justification === 'string' && brandData.internal_score_justification.length > 2) record.internal_score_justification = brandData.internal_score_justification;
      if (brandData.scoring_breakdown && typeof brandData.scoring_breakdown === 'object') record.scoring_breakdown = brandData.scoring_breakdown;

      var auth = this._getCallerAuth();
      record.region = SITE_REGION;
      return supabaseRequest('rpc/admin_save_brand', {
        method: 'POST',
        body: {
          p_caller_id: auth.p_caller_id,
          p_caller_hash: auth.p_caller_hash,
          p_slug: slug,
          p_data: record
        }
      }).then(function () {
        return { ok: true, gonogo_score: overallScore, verdict: verdict, source: 'supabase' };
      });
    },

    deleteBrand: function (slug) {
      var auth = this._getCallerAuth();
      return supabaseRequest('rpc/admin_delete_brand', {
        method: 'POST',
        body: {
          p_caller_id: auth.p_caller_id,
          p_caller_hash: auth.p_caller_hash,
          p_slug: slug,
          p_region: SITE_REGION
        }
      });
    },

    // Set brand active/inactive (hides from site without deleting)
    setBrandActive: function (slug, isActive) {
      var auth = this._getCallerAuth();
      return supabaseRequest('rpc/admin_set_brand_active', {
        method: 'POST',
        body: {
          p_caller_id: auth.p_caller_id,
          p_caller_hash: auth.p_caller_hash,
          p_slug: slug,
          p_is_active: isActive,
          p_region: SITE_REGION
        }
      });
    },

    // Set brand workflow status: 'draft' or 'live'
    setBrandStatus: function (slug, status) {
      var auth = this._getCallerAuth();
      return supabaseRequest('rpc/admin_set_brand_status', {
        method: 'POST',
        body: {
          p_caller_id: auth.p_caller_id,
          p_caller_hash: auth.p_caller_hash,
          p_slug: slug,
          p_status: status,
          p_region: SITE_REGION
        }
      });
    },

    // Bulk approve: set multiple brands to live
    approveBrands: function (slugs) {
      var auth = this._getCallerAuth();
      return supabaseRequest('rpc/admin_approve_brands', {
        method: 'POST',
        body: {
          p_caller_id: auth.p_caller_id,
          p_caller_hash: auth.p_caller_hash,
          p_slugs: slugs,
          p_region: SITE_REGION
        }
      });
    },

    // ==========================================
    // CATEGORY MANAGEMENT
    // ==========================================
    saveCategory: function (categoryData) {
      _categoryCache = null;
      var auth = this._getCallerAuth();
      var data = {
        name: categoryData.name,
        icon: categoryData.icon,
        scoring_categories: categoryData.scoringCategories || [],
        region: SITE_REGION
      };
      if (categoryData.category_type) data.category_type = categoryData.category_type;
      if (categoryData.description !== undefined) data.description = categoryData.description;
      if (categoryData.icon_color !== undefined) data.icon_color = categoryData.icon_color;

      return supabaseRequest('rpc/admin_save_category', {
        method: 'POST',
        body: {
          p_caller_id: auth.p_caller_id,
          p_caller_hash: auth.p_caller_hash,
          p_slug: categoryData.slug,
          p_data: data
        }
      }).then(function () {
        return { ok: true };
      });
    },

    addCategory: function (categoryData) {
      _categoryCache = null;
      var auth = this._getCallerAuth();
      var slug = categoryData.slug || categoryData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      var data = {
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
      if (categoryData.description) data.description = categoryData.description;
      if (categoryData.icon_color) data.icon_color = categoryData.icon_color;
      if (categoryData.category_type) data.category_type = categoryData.category_type;

      return supabaseRequest('rpc/admin_save_category', {
        method: 'POST',
        body: {
          p_caller_id: auth.p_caller_id,
          p_caller_hash: auth.p_caller_hash,
          p_slug: slug,
          p_data: data
        }
      }).then(function () {
        return { ok: true };
      });
    },

    deleteCategory: function (slug) {
      _categoryCache = null;
      var auth = this._getCallerAuth();
      return supabaseRequest('rpc/admin_delete_category', {
        method: 'POST',
        body: {
          p_caller_id: auth.p_caller_id,
          p_caller_hash: auth.p_caller_hash,
          p_slug: slug
        }
      });
    },

    // ==========================================
    // BRANCHES
    // ==========================================
    getBranchById: function (branchId) {
      return supabaseRequest('branches?branch_id=eq.' + encodeURIComponent(branchId) + '&select=*&limit=1')
        .then(function (rows) {
          if (!rows || rows.length === 0) return null;
          return rows[0];
        });
    },

    getBranchesByCategory: function (categorySlug) {
      return supabaseRequest('branches?category_slug=eq.' + encodeURIComponent(categorySlug) + '&select=*&order=total_score.desc')
        .then(function (rows) {
          return rows || [];
        });
    },

    saveBranch: function (branchData) {
      var slug = (branchData.branch_name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
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

    getCategoryType: function (categorySlug) {
      return loadCategoryCache().then(function (cats) {
        var c = cats[categorySlug];
        return c ? (c.category_type || 'brand') : 'brand';
      });
    },

    // ==========================================
    // BRANCH WAIT TIMES & TIPS
    // ==========================================
    submitWaitTime: function (branchId, visitDate, waitMinutes, comment) {
      return supabaseRequest('branch_wait_times', {
        method: 'POST',
        body: {
          branch_id: branchId,
          visit_date: visitDate,
          wait_minutes: parseInt(waitMinutes, 10),
          comment: comment || ''
        },
        prefer: 'return=representation'
      }).then(function () {
        return { ok: true, message: 'Wait time submitted.' };
      });
    },

    getWaitTimes: function (branchId) {
      return supabaseRequest('branch_wait_times?branch_id=eq.' + encodeURIComponent(branchId) + '&order=created_at.desc')
        .then(function (rows) {
          return rows || [];
        })
        .catch(function () {
          return [];
        });
    },

    submitTip: function (branchId, tipText) {
      return supabaseRequest('branch_tips', {
        method: 'POST',
        body: {
          branch_id: branchId,
          tip_text: tipText
        },
        prefer: 'return=representation'
      }).then(function () {
        return { ok: true, message: 'Report submitted anonymously.' };
      });
    },

    // ==========================================
    // SCORING ENGINE
    // ==========================================
    getRubrics: function () {
      return supabaseRequest('rubrics?select=*&order=market.asc')
        .then(function (rows) {
          console.log('getRubrics rows:', rows);
          return rows || [];
        })
        .catch(function (err) {
          console.error('getRubrics error', err);
          return [];
        });
    },

    getRubricVersions: function (rubricId) {
      if (!rubricId) return Promise.resolve([]);
      return supabaseRequest('rubric_versions?rubric_id=eq.' + encodeURIComponent(rubricId) + '&order=created_at.desc')
        .then(function (rows) {
          return rows || [];
        })
        .catch(function (err) {
          console.error('getRubricVersions error', err);
          return [];
        });
    },

    getRubricPromptsForRubric: function (rubricId) {
      if (!rubricId) return Promise.resolve([]);

      return supabaseRequest('rubric_versions?rubric_id=eq.' + encodeURIComponent(rubricId))
        .then(function (versions) {
          versions = versions || [];
          if (versions.length === 0) return [];

          var versionIds = versions.map(function (v) {
            return v.id;
          });

          var versionMap = {};
          versions.forEach(function (v) {
            versionMap[v.id] = v.version;
          });

          var orFilter = versionIds
            .map(function (id) {
              return 'rubric_version_id=eq.' + encodeURIComponent(id);
            })
            .join('&or=');

          return supabaseRequest('rubric_prompts?' + orFilter + '&order=created_at.desc')
            .then(function (prompts) {
              prompts = prompts || [];
              return prompts.map(function (p) {
                p.rubric_version_version = versionMap[p.rubric_version_id] || null;
                return p;
              });
            });
        })
        .catch(function (err) {
          console.error('getRubricPromptsForRubric error', err);
          return [];
        });
    },

    getDecisionRulesForRubric: function (rubricId) {
      if (!rubricId) return Promise.resolve([]);

      return supabaseRequest('rubric_versions?rubric_id=eq.' + encodeURIComponent(rubricId))
        .then(function (versions) {
          versions = versions || [];
          if (versions.length === 0) return [];

          var versionIds = versions.map(function (v) {
            return v.id;
          });

          var orFilter = versionIds
            .map(function (id) {
              return 'rubric_version_id=eq.' + encodeURIComponent(id);
            })
            .join('&or=');

          return supabaseRequest('config_decision_rules?' + orFilter + '&order=created_at.desc')
            .then(function (rules) {
              return rules || [];
            });
        })
        .catch(function (err) {
          console.error('getDecisionRulesForRubric error', err);
          return [];
        });
    },

    createRubric: function (payload) {
      return supabaseRequest('rubrics', {
        method: 'POST',
        body: payload
      });
    },

    createRubricVersion: function (payload) {
      return supabaseRequest('rubric_versions', {
        method: 'POST',
        body: payload
      });
    },

    createRubricPrompt: function (payload) {
      return supabaseRequest('rubric_prompts', {
        method: 'POST',
        body: payload
      });
    },

    createDecisionRule: function (payload) {
      return supabaseRequest('config_decision_rules', {
        method: 'POST',
        body: payload
      });
    },

    // ==========================================
    // PASSWORD RESET
    // ==========================================
    requestPasswordReset: function (email) {
      var origin = window.location.origin;
      return fetch(SUPABASE_URL + '/functions/v1/send-reset-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ email: email.toLowerCase().trim(), site_origin: origin })
      }).then(function (r) { return r.json(); })
      .catch(function () {
        // Fallback: call the RPC directly (token is generated but email won't send)
        return supabaseRequest('rpc/request_brand_password_reset', {
          method: 'POST',
          body: { p_email: email.toLowerCase().trim() }
        });
      });
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
    },

    // Direct Supabase request (for admin pages)
    supabaseRequest: function (path, options) {
      return supabaseRequest(path, options);
    }
  };
})();

console.log('GoNoGoAPI loaded (Supabase v2 — auto-detects brands table)');
