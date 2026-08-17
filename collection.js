(function () {
  var grid = document.querySelector('[data-products-grid]');
  if (!grid || !window.DevoileCatalog) return;

  var sort = document.querySelector('[data-product-sort]');
  var count = document.querySelector('[data-product-count]');
  var clear = document.querySelector('[data-clear-filters]');
  var categoryTarget = document.querySelector('[data-category-filters]');
  var priceTarget = document.querySelector('[data-price-range]');
  var urlQuery = new URLSearchParams(location.search).get('search') || '';
  function escapeHtml(value) { return window.DevoileCatalog.escapeHtml(value); }
  function money(value) { return window.DevoileCatalog.money(value).replace('.00', ''); }

  function renderDynamicFilters(products) {
    if (categoryTarget) {
      categoryTarget.innerHTML = window.DevoileCatalog.categories(products).map(function (category) {
        return '<label><input type="checkbox" data-filter="category" value="' + escapeHtml(category) + '" /> ' + escapeHtml(category) + '</label>';
      }).join('');
    }
    if (priceTarget) {
      var range = window.DevoileCatalog.priceRange(products);
      priceTarget.innerHTML = '<span>' + money(range.min) + '</span><span>' + money(range.max) + '</span>';
    }
  }

  function checked(name) {
    return Array.prototype.slice.call(document.querySelectorAll('[data-filter="' + name + '"]:checked')).map(function (input) {
      return input.value;
    });
  }

  function matches(product) {
    var availability = checked('availability');
    var categories = checked('category');
    if (availability.length) {
      var available = product.status === 'sold_out' || Number(product.stock || 0) <= 0 ? 'sold_out' : product.status === 'sale' ? 'sale' : 'in_stock';
      if (availability.indexOf(available) === -1) return false;
    }
    if (categories.length && categories.indexOf(product.category) === -1) return false;
    if (urlQuery && [product.name, product.category, product.short].join(' ').toLowerCase().indexOf(urlQuery.toLowerCase()) === -1) return false;
    return true;
  }

  function sorted(products) {
    var mode = sort ? sort.value : 'az';
    return products.slice().sort(function (a, b) {
      if (mode === 'price-low') return a.price - b.price;
      if (mode === 'price-high') return b.price - a.price;
      if (mode === 'availability') return a.status.localeCompare(b.status) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
  }

  function render() {
    var allProducts = window.DevoileCatalog.read();
    var products = sorted(allProducts.filter(matches));
    grid.innerHTML = products.length
      ? products.map(window.DevoileCatalog.productCard).join('')
      : '<div class="empty-products"><strong>No products match these filters.</strong><p>Clear filters to view the full shop.</p></div>';
    if (count) count.textContent = products.length + (products.length === 1 ? ' product' : ' products') + (urlQuery ? ' for "' + urlQuery + '"' : '');
  }

  document.addEventListener('change', function (event) {
    if (event.target.matches('[data-filter], [data-product-sort]')) render();
  });

  if (clear) {
    clear.addEventListener('click', function () {
      document.querySelectorAll('[data-filter]').forEach(function (input) { input.checked = false; });
      urlQuery = '';
      history.replaceState(null, '', '/shop');
      render();
    });
  }

  window.addEventListener('devoile-products-updated', function () {
    renderDynamicFilters(window.DevoileCatalog.read());
    render();
  });
  renderDynamicFilters(window.DevoileCatalog.read());
  render();
})();
