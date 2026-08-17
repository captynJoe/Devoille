(function () {
  var defaults = [
    { id: 'aroma-30', name: 'Aroma 30ml', category: 'Aroma', price: 2500, compareAt: null, status: 'in_stock', stock: 18, visual: 'dropper', tone: 'scent', image: '/assets/products/aroma-card.webp', short: 'A concentrated scent oil that stays close, clean, and intentional.' },
    { id: 'classic-jumbo-500', name: 'Dèvoilè Classic Jumbo | 500ml', category: 'Lubricants', price: 1099, compareAt: 1599, status: 'sale', stock: 6, visual: 'jumbo', tone: '', image: '/assets/products/amber-card.webp', short: 'The larger amber bottle for customers who keep Classic in regular rotation.' },
    { id: 'classic-250', name: 'Dèvoilè Classic | 250ml', category: 'Lubricants', price: 599, compareAt: 899, status: 'sale', stock: 42, visual: 'tall', tone: 'featured', image: '/assets/products/classic-card.webp', short: 'The signature 250ml bottle: clean feel, easy reset, discreet enough for the shelf.' },
    { id: 'mint-85', name: 'Dèvoilè Mint Sensation Lubricant | 85ml', category: 'Lubricants', price: 649, compareAt: null, status: 'in_stock', stock: 21, visual: 'small mint', tone: '', image: '/assets/products/amber-card.webp', short: 'A pocket 85ml formula with a crisp, cooling finish.' },
    { id: 'painless-85', name: 'Dèvoilè Painless Lubricant | 85ml', category: 'Lubricants', price: 649, compareAt: null, status: 'in_stock', stock: 5, visual: 'small rose', tone: '', image: '/assets/products/classic-card.webp', short: 'A gentler comfort bottle for customers who want a softer first experience.' },
    { id: 'signature-candle', name: 'Dèvoilè Signature Scented Candle', category: 'Ambiance', price: 1499, compareAt: null, status: 'sold_out', stock: 0, visual: 'candle', tone: 'sold', image: '/assets/products/dark-card.webp', short: 'A room-setting candle for scent layering, shelf styling, and evening atmosphere.' },
    { id: 'original-aroma-10', name: 'Original Aroma | 10ml', category: 'Aroma', price: 1200, compareAt: null, status: 'sold_out', stock: 0, visual: 'mini-dropper', tone: 'sold scent', image: '/assets/products/aroma-card.webp', short: 'A 10ml scent trial for travel pouches, gifting, and quiet restocks.' }
  ];
  var cache = defaults.slice();
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]; }); }
  function dispatch() { window.dispatchEvent(new Event('devoile-products-updated')); }
  function readProducts() { return cache.slice(); }
  function money(value) { return 'KSh' + Number(value || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function badge(product) { return product.status === 'sold_out' ? 'Sold out' : product.status === 'sale' ? 'Sale' : ''; }
  function productById(id) { return cache.find(function (product) { return product.id === id; }) || null; }
  function isSoldOut(product) { return !product || product.status === 'sold_out' || Number(product.stock || 0) <= 0; }
  function sortByShelfPriority(products) {
    return products.slice().sort(function (a, b) {
      var scoreA = (isSoldOut(a) ? 0 : 20) + (a.status === 'sale' ? 8 : 0) + (String(a.tone || '').indexOf('featured') !== -1 ? 10 : 0) + Math.min(Number(a.stock || 0), 10) / 10;
      var scoreB = (isSoldOut(b) ? 0 : 20) + (b.status === 'sale' ? 8 : 0) + (String(b.tone || '').indexOf('featured') !== -1 ? 10 : 0) + Math.min(Number(b.stock || 0), 10) / 10;
      return scoreB - scoreA || String(a.name || '').localeCompare(String(b.name || ''));
    });
  }
  function featuredProduct(products) {
    var list = sortByShelfPriority(products || cache);
    return list.find(function (product) { return !isSoldOut(product); }) || list[0] || null;
  }
  function categories(products) {
    var seen = {};
    return (products || cache).reduce(function (items, product) {
      var category = String(product.category || '').trim();
      if (category && !seen[category]) {
        seen[category] = true;
        items.push(category);
      }
      return items;
    }, []).sort(function (a, b) { return a.localeCompare(b); });
  }
  function priceRange(products) {
    var prices = (products || cache).map(function (product) { return Number(product.price || 0); }).filter(function (price) { return Number.isFinite(price) && price > 0; });
    if (!prices.length) return { min: 0, max: 0 };
    return { min: Math.min.apply(Math, prices), max: Math.max.apply(Math, prices) };
  }
  function safeVisual(value) { return String(value || 'tall').replace(/[^a-z -]/g, '').trim() || 'tall'; }
  function isImageSrc(value) { return /^data:image\//.test(value) || /^(?:\.\/|\/)assets\/[^"'<>]+$/.test(value); }
  function defaultImage(product) {
    var byId = {
      'aroma-30': '/assets/products/aroma-card.webp',
      'classic-jumbo-500': '/assets/products/amber-card.webp',
      'classic-250': '/assets/products/classic-card.webp',
      'mint-85': '/assets/products/amber-card.webp',
      'painless-85': '/assets/products/classic-card.webp',
      'signature-candle': '/assets/products/dark-card.webp',
      'original-aroma-10': '/assets/products/aroma-card.webp'
    };
    if (product && byId[product.id]) return byId[product.id];
    if (product && product.visual === 'candle') return '/assets/products/dark-card.webp';
    if (product && String(product.category || '').toLowerCase() === 'aroma') return '/assets/products/aroma-card.webp';
    if (product && String(product.tone || '').indexOf('scent') !== -1) return '/assets/products/aroma-card.webp';
    return '/assets/products/classic-card.webp';
  }
  function imageSrc(product) {
    if (product && product.image && isImageSrc(product.image)) return String(product.image).replace(/^\.\/assets\//, '/assets/');
    return defaultImage(product);
  }
  function focusImageSrc(product) {
    var src = imageSrc(product);
    if (product && product.id === 'classic-250' && src === '/assets/products/classic-card.webp') return '/assets/products/classic-focus.webp';
    return src;
  }
  function galleryImages(product) {
    var seen = {};
    var out = [];
    var main = imageSrc(product);
    if (main) { seen[main] = true; out.push(main); }
    (product && Array.isArray(product.images) ? product.images : []).forEach(function (item) {
      if (isImageSrc(item) && !seen[item]) { seen[item] = true; out.push(item); }
    });
    return out;
  }
  function visualMarkup(product) {
    var src = imageSrc(product);
    if (src) return '<img class="product-upload-image" src="' + escapeHtml(src) + '" alt="' + escapeHtml(product && product.name ? product.name : 'Dévoilé product') + '" />';
    if (product.visual === 'candle') return '<div class="candle"></div>';
    return '<div class="bottle ' + escapeHtml(safeVisual(product.visual)) + '"></div>';
  }
  function productCard(product) {
    var tone = product.tone ? ' ' + escapeHtml(String(product.tone).replace(/[^a-z -]/g, '').trim()) : '';
    var isSold = isSoldOut(product);
    var badgeText = badge(product);
    var price = product.compareAt ? '<s>' + money(product.compareAt) + '</s><strong>' + money(product.price) + '</strong>' : '<strong>' + money(product.price) + '</strong>';
    var href = '/product/' + encodeURIComponent(product.id);
    return '<article class="product-card compact-product' + tone + '">' +
      (badgeText ? '<span class="badge ' + (product.status === 'sale' ? 'sale' : '') + '">' + badgeText + '</span>' : '') +
      '<a class="product-card-link" href="' + href + '" aria-label="View ' + escapeHtml(product.name) + '">' +
        '<div class="product-media">' + visualMarkup(product) + '</div>' +
        '<h3>' + escapeHtml(product.name) + '</h3>' +
        '<div class="price">' + price + '</div>' +
      '</a>' +
      '<div class="product-card-actions">' +
        '<a class="product-card-view" href="' + href + '">View product</a>' +
        (isSold ? '<button type="button" disabled>Notify me</button>' : '<button type="button" data-buy-now data-product-id="' + escapeHtml(product.id) + '">Buy now</button>') +
      '</div>' +
    '</article>';
  }
  async function refresh() {
    try {
      var response = await fetch('/api/products', { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Product API failed');
      cache = await response.json();
      dispatch();
    } catch (error) {
      console.warn('[devoile] using fallback products:', error);
      dispatch();
    }
    return cache;
  }
  async function save(product) {
    var response = await fetch('/api/products', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(product) });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error || 'Failed to save product');
    await refresh();
  }
  async function remove(id) {
    var response = await fetch('/api/products/' + encodeURIComponent(id), { method: 'DELETE', credentials: 'same-origin' });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error || 'Failed to remove product');
    await refresh();
  }
  async function reset() {
    var response = await fetch('/api/products/reset', { method: 'POST', credentials: 'same-origin' });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error || 'Failed to reset catalog');
    await refresh();
  }
  window.DevoileCatalog = { defaults: defaults, read: readProducts, refresh: refresh, save: save, remove: remove, reset: reset, byId: productById, money: money, badge: badge, productCard: productCard, visualMarkup: visualMarkup, imageSrc: imageSrc, focusImageSrc: focusImageSrc, galleryImages: galleryImages, escapeHtml: escapeHtml, isSoldOut: isSoldOut, sortByShelfPriority: sortByShelfPriority, featuredProduct: featuredProduct, categories: categories, priceRange: priceRange };
  refresh();
})();
