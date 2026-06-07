/* ============================================================
   БАЛКОН-МСК — UI ENHANCEMENTS
   Dark mode · scroll progress · back-to-top · scroll reveal
   · range-fill. Purely additive; never rebinds app.js logic.
   ============================================================ */
(function () {
    'use strict';

    var STORAGE_KEY = 'balcony-theme';
    var root = document.documentElement;
    var prefersDark = window.matchMedia
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : { matches: false, addEventListener: function () {} };
    var reducedMotion = window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

    /* ---- Theme: read stored choice or fall back to system ---- */
    function storedTheme() {
        try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    }
    function saveTheme(value) {
        try { localStorage.setItem(STORAGE_KEY, value); } catch (e) { /* ignore */ }
    }
    function resolveTheme() {
        var saved = storedTheme();
        if (saved === 'light' || saved === 'dark') return saved;
        return prefersDark.matches ? 'dark' : 'light';
    }
    function applyTheme(theme) {
        root.setAttribute('data-theme', theme);
        var btns = document.querySelectorAll('.theme-toggle');
        for (var i = 0; i < btns.length; i++) {
            btns[i].setAttribute('aria-pressed', String(theme === 'dark'));
            btns[i].setAttribute(
                'aria-label',
                theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'
            );
        }
    }

    // Apply immediately (the inline head script may have already done this;
    // this keeps things correct if that script is absent).
    applyTheme(resolveTheme());

    // React to OS changes only while the user hasn't made an explicit choice.
    if (prefersDark.addEventListener) {
        prefersDark.addEventListener('change', function (e) {
            if (!storedTheme()) applyTheme(e.matches ? 'dark' : 'light');
        });
    }

    function wireThemeToggles() {
        var btns = document.querySelectorAll('.theme-toggle');
        for (var i = 0; i < btns.length; i++) {
            btns[i].addEventListener('click', function () {
                var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                saveTheme(next);
                applyTheme(next);
            });
        }
    }

    /* ---- Scroll progress bar ---- */
    function wireScrollProgress() {
        var bar = document.querySelector('.scroll-progress');
        if (!bar) return;
        var ticking = false;
        function update() {
            var doc = document.documentElement;
            var max = doc.scrollHeight - doc.clientHeight;
            var ratio = max > 0 ? Math.min(1, doc.scrollTop / max) : 0;
            bar.style.setProperty('--scroll', ratio.toFixed(4));
            ticking = false;
        }
        window.addEventListener('scroll', function () {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }, { passive: true });
        update();
    }

    /* ---- Back-to-top ---- */
    function wireBackToTop() {
        var btn = document.querySelector('.back-to-top');
        if (!btn) return;
        var ticking = false;
        function update() {
            btn.classList.toggle('is-visible', window.scrollY > 600);
            ticking = false;
        }
        window.addEventListener('scroll', function () {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }, { passive: true });
        btn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
        });
        update();
    }

    /* ---- Scroll reveal via IntersectionObserver ---- */
    function wireReveal() {
        var nodes = document.querySelectorAll('[data-reveal]');
        if (!nodes.length) return;
        if (reducedMotion || !('IntersectionObserver' in window)) {
            for (var i = 0; i < nodes.length; i++) nodes[i].classList.add('is-revealed');
            return;
        }
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-revealed');
                    io.unobserve(entry.target);
                }
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
        for (var j = 0; j < nodes.length; j++) io.observe(nodes[j]);
    }

    /* ---- Range-fill: paint the gold progress on sliders ---- */
    function paintRange(el) {
        var min = parseFloat(el.min) || 0;
        var max = parseFloat(el.max);
        if (isNaN(max)) max = 100;
        var val = parseFloat(el.value);
        if (isNaN(val)) val = min;
        var pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
        el.style.setProperty('--range-fill', pct.toFixed(2) + '%');
    }
    function wireRanges() {
        var ranges = document.querySelectorAll('.form-range');
        for (var i = 0; i < ranges.length; i++) {
            (function (el) {
                paintRange(el);
                el.addEventListener('input', function () { paintRange(el); });
            })(ranges[i]);
        }
        // Sliders whose value is set programmatically (e.g. presets) — repaint periodically-lite
        document.addEventListener('balcony:rangesync', function () { wireRanges(); });
    }

    /* ---- Tablet/mobile section switcher (LAYOUT-V2) ----
       Shows/hides the REAL left/right panels (never clones — that would
       duplicate element IDs and drop app.js's bound listeners). For the
       material/furniture/lighting sections it clicks the existing
       right-panel sub-tab so app.js's own switchTab logic runs unchanged. */
    function wireSectionTabs() {
        var bar = document.getElementById('vtabBar');
        if (!bar) return;
        var leftPanel = document.querySelector('.left-panel');
        var rightPanel = document.querySelector('.right-panel');

        function activate(vtab) {
            var btns = bar.querySelectorAll('.vtab-btn');
            for (var i = 0; i < btns.length; i++) {
                btns[i].classList.toggle('active', btns[i].dataset.vtab === vtab);
            }

            var showLeft = (vtab === 'dimensions' || vtab === 'extras');
            if (leftPanel) leftPanel.classList.toggle('active', showLeft);
            if (rightPanel) rightPanel.classList.toggle('active', !showLeft);

            if (!showLeft && rightPanel) {
                // Drive the existing right-panel sub-tab (app.js handles it).
                var sub = rightPanel.querySelector('.sidebar-tabs .tab-btn[data-tab="' + vtab + '"]');
                if (sub) sub.click();
            } else if (vtab === 'extras') {
                var extrasInput = document.getElementById('needInsulation');
                var block = extrasInput && extrasInput.closest('.config-block');
                if (block && block.scrollIntoView) block.scrollIntoView({ block: 'start' });
            }
        }

        bar.addEventListener('click', function (e) {
            var btn = e.target.closest('.vtab-btn');
            if (!btn) return;
            activate(btn.dataset.vtab);
        });

        // Initial state (harmless on desktop, where the tab bar is hidden
        // and the .active class is ignored by the layout).
        activate('dimensions');
    }

    /* ---- Marketing scroll reveal + stat hooks (Phase 3) ---- */
    function wireMarketingReveal() {
        if (reducedMotion || !('IntersectionObserver' in window)) return;

        var revealEls = document.querySelectorAll('.stat-item, .hero-badge');
        var revealObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

        revealEls.forEach(function (el, i) {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'opacity 0.5s ease ' + (i * 0.07) + 's, transform 0.5s ease ' + (i * 0.07) + 's';
            revealObserver.observe(el);
        });

        // Stat-number hook: adds .counted when in view (count-up logic can attach later).
        var counterObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('counted');
                    counterObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        document.querySelectorAll('.stat-number').forEach(function (s) { counterObserver.observe(s); });
    }

    /* ---- Page boot loader: fade out once the 3D canvas paints a frame ---- */
    function initPageLoader() {
        var loader = document.getElementById('pageLoader');
        if (!loader) return;

        var done = false;
        function hide() {
            if (done) return;
            done = true;
            loader.classList.add('hidden');
            setTimeout(function () { if (loader.parentNode) loader.remove(); }, 600);
        }

        // Hard cap: never trap the page behind the loader.
        var fallback = setTimeout(hide, 3500);

        // Three.js appends a real <canvas> inside #balcony3d once it renders.
        // Poll for it having a non-zero backing store (= at least one frame drawn).
        (function poll() {
            if (done) return;
            var cv = document.querySelector('#balcony3d canvas, .balcony-3d-canvas canvas');
            if (cv && cv.width > 0 && cv.height > 0) {
                clearTimeout(fallback);
                setTimeout(hide, 400);
                return;
            }
            requestAnimationFrame(poll);
        })();
    }

    /* ---- Header scroll class ---- */
    function wireHeaderScroll() {
        var header = document.getElementById('header');
        if (!header) return;
        var ticking = false;
        function update() {
            header.classList.toggle('scrolled', window.scrollY > 50);
            ticking = false;
        }
        window.addEventListener('scroll', function () {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }, { passive: true });
        update();
    }

    /* ---- Mobile menu toggle ---- */
    function wireMobileMenu() {
        var btn = document.getElementById('mobileMenuBtn');
        var menu = document.getElementById('navMenu');
        if (!btn || !menu) return;

        function syncAria(isOpen) {
            btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            btn.setAttribute('aria-label', isOpen ? 'Закрыть меню' : 'Открыть меню');
        }
        btn.addEventListener('click', function () {
            var willOpen = !menu.classList.contains('active');
            menu.classList.toggle('active');
            btn.classList.toggle('active');
            document.body.classList.toggle('menu-open', willOpen);
            syncAria(willOpen);
        });
        menu.querySelectorAll('.nav-link').forEach(function (link) {
            link.addEventListener('click', function () {
                menu.classList.remove('active');
                btn.classList.remove('active');
                document.body.classList.remove('menu-open');
                syncAria(false);
            });
        });
        syncAria(false);
    }

    /* ---- Toast helper for landing page ---- */
    var SAFE_TOAST_TYPES = { success: true, error: true, warning: true, info: true };
    function showLandingToast(message, type) {
        var container = document.getElementById('toastContainer');
        if (!container) return;
        var toast = document.createElement('div');
        toast.className = 'toast ' + (SAFE_TOAST_TYPES[type] ? type : 'info');
        var content = document.createElement('span');
        content.className = 'toast-content';
        var title = document.createElement('span');
        title.className = 'toast-title';
        title.textContent = String(message || '');
        content.appendChild(title);
        toast.appendChild(content);
        container.appendChild(toast);
        setTimeout(function () {
            toast.style.transition = 'opacity 0.3s';
            toast.style.opacity = '0';
            setTimeout(function () { toast.remove(); }, 350);
        }, 4000);
    }

    /* ---- Request-call modal + form ---- */
    function wireRequestModal() {
        var overlay = document.getElementById('requestModal');
        if (!overlay) return;

        window.openRequestModal = function () {
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
            var first = overlay.querySelector('input:not([type="hidden"])');
            if (first) { setTimeout(function () { first.focus(); }, 80); }
        };
        window.closeRequestModal = function () {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        };

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) { window.closeRequestModal(); }
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && overlay.classList.contains('active')) {
                window.closeRequestModal();
            }
        });

        var form = document.getElementById('requestForm');
        if (!form) return;

        /* Phone auto-format */
        var phoneInput = document.getElementById('requestPhone');
        if (phoneInput) {
            phoneInput.addEventListener('input', function () {
                var digits = this.value.replace(/\D/g, '');
                if (digits.startsWith('7') || digits.startsWith('8')) { digits = digits.slice(1); }
                var v = '+7';
                if (digits.length > 0) { v += ' (' + digits.slice(0, 3); }
                if (digits.length >= 3) { v += ') ' + digits.slice(3, 6); }
                if (digits.length >= 6) { v += '-' + digits.slice(6, 8); }
                if (digits.length >= 8) { v += '-' + digits.slice(8, 10); }
                this.value = v;
            });
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var nameVal = (document.getElementById('requestName') || {}).value || '';
            var phoneVal = (document.getElementById('requestPhone') || {}).value || '';
            var digits = phoneVal.replace(/\D/g, '');
            if (digits.length < 10) {
                if (phoneInput) { phoneInput.focus(); }
                showLandingToast('Укажите корректный номер телефона', 'error');
                return;
            }

            var submitBtn = form.querySelector('[type="submit"]');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Отправляем…'; }

            fetch('/api/request-call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: nameVal.trim(), phone: phoneVal.trim() })
            })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.success) {
                    form.innerHTML = [
                        '<div class="modal-success">',
                        '<div class="modal-success-icon"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 13l4 4L19 7"/></svg></div>',
                        '<h2>Заявка принята!</h2>',
                        '<p class="modal-success-lead">Перезвоним в течение 15 минут.</p>',
                        '<p class="modal-success-sub">Если не дозвонимся — сами свяжитесь по <a href="tel:+79088360606">+7 (908) 836-06-06</a></p>',
                        '</div>'
                    ].join('');
                    setTimeout(function () { window.closeRequestModal(); }, 3500);
                } else {
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Жду звонка'; }
                    showLandingToast(data.error || 'Ошибка. Попробуйте ещё раз.', 'error');
                }
            })
            .catch(function () {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Жду звонка'; }
                showLandingToast('Не удалось отправить. Позвоните нам напрямую.', 'error');
            });
        });
    }

    function init() {
        initPageLoader();
        wireThemeToggles();
        wireHeaderScroll();
        wireMobileMenu();
        wireRequestModal();
        wireScrollProgress();
        wireBackToTop();
        wireReveal();
        wireRanges();
        wireSectionTabs();
        wireMarketingReveal();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
