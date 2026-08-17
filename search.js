(function () {
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]; });
  }
  function ensureSearch() {
    if (document.querySelector('[data-search-panel]')) return;
    var shell = document.createElement('div');
    shell.className = 'search-shell';
    shell.hidden = true;
    shell.style.cssText = 'position:fixed;inset:0;z-index:120;display:flex;align-items:flex-start;justify-content:center;padding:96px 18px 18px;pointer-events:none;';
    shell.innerHTML = '' +
      '<div class="search-backdrop" data-search-close style="position:absolute;inset:0;background:rgba(0,0,0,.78);opacity:0;transition:opacity 180ms ease;"></div>' +
      '<section class="search-panel" data-search-panel aria-hidden="true" role="dialog" aria-modal="true" aria-label="Search Dévoilé" style="position:relative;width:min(100%,760px);max-height:calc(100svh - 112px);overflow:auto;margin:0;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:#070707;color:#eee9e4;box-shadow:0 34px 110px rgba(0,0,0,.62);opacity:0;transform:translateY(-16px) scale(.98);transition:transform 180ms ease, opacity 180ms ease;">' +
        '<div class="search-panel-head"><span>Search the Dévoilé shelf</span><button type="button" data-search-close aria-label="Close search">×</button></div>' +
        '<label class="search-field"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16.2 16.2 4.3 4.3"/></svg><input data-search-input type="search" placeholder="Search scent, candle, Classic, delivery..." autocomplete="off" /></label>' +
        '<div class="search-suggestions" data-search-suggestions></div>' +
        '<div class="search-results" data-search-results></div>' +
      '</section>';
    document.body.appendChild(shell);
    renderSuggestions();
  }
  function suggestions() {
    var products = window.DevoileCatalog ? window.DevoileCatalog.read() : [];
    var names = products.filter(function (product) {
      return !(window.DevoileCatalog && window.DevoileCatalog.isSoldOut && window.DevoileCatalog.isSoldOut(product));
    }).slice(0, 5).map(function (product) { return product.name; });
    return names.length ? names : ['Aroma 30ml', 'Classic 250ml', 'Mint Sensation', 'Signature Candle'];
  }
  function renderSuggestions() {
    var suggestionTarget = document.querySelector('[data-search-suggestions]');
    if (!suggestionTarget) return;
    suggestionTarget.innerHTML = suggestions().map(function (item) { return '<button type="button" data-search-suggestion="' + escapeHtml(item) + '">' + escapeHtml(item) + '</button>'; }).join('');
  }
  function products() { return window.DevoileCatalog ? window.DevoileCatalog.read() : []; }
  function productText(product) { return [product.name, product.category, product.short, product.status].join(' ').toLowerCase(); }
  function render(query) {
    var target = document.querySelector('[data-search-results]');
    if (!target) return;
    var q = String(query || '').trim().toLowerCase();
    var matches = products().filter(function (product) { return !q || productText(product).indexOf(q) !== -1; }).slice(0, 6);
    target.innerHTML = matches.length ? matches.map(function (product) {
      var price = window.DevoileCatalog ? window.DevoileCatalog.money(product.price).replace('.00', '') : '';
      return '<a href="/shop?search=' + encodeURIComponent(product.name) + '"><strong>' + escapeHtml(product.name) + '</strong><span>' + escapeHtml(product.category) + ' · ' + escapeHtml(price) + '</span></a>';
    }).join('') : '<p>No matching products. Try Aroma, Classic, Mint, Candle, or delivery.</p>';
  }
  function openSearch() {
    ensureSearch();
    var shell = document.querySelector('.search-shell');
    if (shell) { shell.hidden = false; shell.style.pointerEvents = 'auto'; }
    render('');
    document.body.classList.add('search-open');
    var panel = document.querySelector('[data-search-panel]');
    var backdrop = document.querySelector('.search-backdrop');
    if (backdrop) backdrop.style.opacity = '1';
    panel.style.opacity = '1';
    panel.style.transform = 'translateY(0) scale(1)';
    panel.setAttribute('aria-hidden', 'false');
    setTimeout(function () { var input = document.querySelector('[data-search-input]'); if (input) input.focus(); }, 40);
  }
  function closeSearch() {
    document.body.classList.remove('search-open');
    var panel = document.querySelector('[data-search-panel]');
    var backdrop = document.querySelector('.search-backdrop');
    if (backdrop) backdrop.style.opacity = '0';
    if (panel) { panel.setAttribute('aria-hidden', 'true'); panel.style.opacity = '0'; panel.style.transform = 'translateY(-16px) scale(.98)'; }
    var shell = document.querySelector('.search-shell');
    if (shell) setTimeout(function () { if (!document.body.classList.contains('search-open')) { shell.hidden = true; shell.style.pointerEvents = 'none'; } }, 200);
  }
  document.addEventListener('click', function (event) {
    if (event.target.closest('[data-search-open]')) { event.preventDefault(); openSearch(); return; }
    if (event.target.closest('[data-search-close]')) { closeSearch(); return; }
    var suggestion = event.target.closest('[data-search-suggestion]');
    if (suggestion) {
      var input = document.querySelector('[data-search-input]');
      var value = suggestion.getAttribute('data-search-suggestion') || '';
      if (input) input.value = value;
      render(value);
    }
  });
  document.addEventListener('input', function (event) { if (event.target.matches('[data-search-input]')) render(event.target.value); });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape') closeSearch(); });
  window.addEventListener('devoile-products-updated', function () { var input = document.querySelector('[data-search-input]'); renderSuggestions(); if (document.body.classList.contains('search-open')) render(input ? input.value : ''); });
  ensureSearch();
})();
