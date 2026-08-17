(function () {
  function catalog() { return window.DevoileCatalog || null; }
  function selectHighlights(products) {
    var api = catalog();
    var sorted = api && api.sortByShelfPriority ? api.sortByShelfPriority(products) : products.slice();
    return sorted.slice(0, 4);
  }
  function renderFocus(product) {
    var media = document.querySelector('[data-home-featured-media]');
    var info = document.querySelector('[data-home-featured-info]');
    var api = catalog();
    if (!product || !api) return;
    var src = api.focusImageSrc ? api.focusImageSrc(product) : (api.imageSrc ? api.imageSrc(product) : product.image);
    var img = src ? '<img class="product-upload-image" src="' + api.escapeHtml(src) + '" alt="' + api.escapeHtml(product.name) + '" />' : api.visualMarkup(product);
    var isSold = api.isSoldOut ? api.isSoldOut(product) : product.status === 'sold_out';
    var badgeText = api.badge(product);
    var price = product.compareAt ? '<s>Regular price ' + api.money(product.compareAt) + '</s><strong>Sale price ' + api.money(product.price) + '</strong>' : '<strong>' + api.money(product.price) + '</strong>';
    var href = '/product/' + encodeURIComponent(product.id);
    if (media) {
      media.innerHTML = '<span class="media-note">Product detail</span><a class="focus-bottle-wrap" href="' + href + '" aria-label="View ' + api.escapeHtml(product.name) + '">' + img + '</a>';
    }
    if (info) {
      info.innerHTML = '<p class="eyebrow">' + api.escapeHtml(product.category || 'Current shelf') + '</p>' +
        '<h2 id="product-focus-heading"><a href="' + href + '">' + api.escapeHtml(product.name) + '</a></h2>' +
        (product.short ? '<p class="focus-copy">' + api.escapeHtml(product.short) + '</p>' : '') +
        '<div class="focus-price">' + price + (badgeText ? '<span>' + api.escapeHtml(badgeText) + '</span>' : '') + '</div>' +
        '<div class="quantity-box" aria-label="Quantity selector"><label>Quantity</label><div><button type="button" aria-label="Decrease quantity for ' + api.escapeHtml(product.name) + '">-</button><span>1</span><button type="button" aria-label="Increase quantity for ' + api.escapeHtml(product.name) + '">+</button></div></div>' +
        '<div class="purchase-actions">' +
          (isSold ? '<button type="button" disabled>Notify me</button>' : '<button type="button" data-add-to-basket data-product-id="' + api.escapeHtml(product.id) + '">Add to basket</button><button type="button" data-buy-now data-product-id="' + api.escapeHtml(product.id) + '">Buy it now</button>') +
        '</div>' +
        '<div class="share-row"><a href="/shop">See shelf</a><a href="/care-journal">Read care notes</a></div>';
    }
  }
  function render() {
    var api = catalog();
    var grid = document.querySelector('[data-home-products]');
    if (!api || !grid) return;
    var products = api.read();
    grid.innerHTML = selectHighlights(products).map(api.productCard).join('');
    renderFocus(api.featuredProduct ? api.featuredProduct(products) : products[0]);
  }
  window.addEventListener('devoile-products-updated', render);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
