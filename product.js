(function () {
  function api() { return window.DevoileCatalog; }

  function productIdFromPath() {
    var match = location.pathname.match(/^\/product\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  var currentProduct = null;
  var qty = 1;

  function setQty(next) {
    qty = Math.max(1, Math.min(99, next));
    var qtyEl = document.querySelector('[data-pdp-qty-value]');
    if (qtyEl) qtyEl.textContent = String(qty);
  }

  function galleryFor(product) {
    var a = api();
    var images = (a.galleryImages ? a.galleryImages(product) : [a.imageSrc(product)]).filter(Boolean);
    return images.length ? images : [a.imageSrc(product)];
  }

  function renderGallery(product) {
    var mainEl = document.querySelector('[data-pdp-gallery-main]');
    var thumbsEl = document.querySelector('[data-pdp-gallery-thumbs]');
    var a = api();
    var images = galleryFor(product);
    if (mainEl) mainEl.innerHTML = '<img class="product-upload-image" src="' + a.escapeHtml(images[0]) + '" alt="' + a.escapeHtml(product.name) + '" />';
    if (thumbsEl) {
      thumbsEl.innerHTML = images.length > 1 ? images.map(function (src, index) {
        return '<button type="button" class="pdp-thumb' + (index === 0 ? ' active' : '') + '" data-pdp-thumb="' + index + '" aria-label="Show photo ' + (index + 1) + '"><img src="' + a.escapeHtml(src) + '" alt="" /></button>';
      }).join('') : '';
    }
  }

  function renderDescription(product) {
    var target = document.querySelector('[data-pdp-description]');
    var wrap = document.querySelector('[data-pdp-description-wrap]');
    var a = api();
    var text = String(product.description || '').trim();
    if (!text) { if (wrap) wrap.hidden = true; return; }
    if (wrap) wrap.hidden = false;
    if (target) {
      target.innerHTML = text.split(/\n\s*\n/).map(function (block) {
        return '<p>' + a.escapeHtml(block.trim()).replace(/\n/g, '<br />') + '</p>';
      }).join('');
    }
  }

  function renderPurchaseActions(product) {
    var target = document.querySelector('[data-pdp-actions]');
    if (!target) return;
    var a = api();
    var isSold = a.isSoldOut(product);
    if (isSold) {
      target.innerHTML = '<button type="button" disabled>Notify me when restocked</button>';
      return;
    }
    target.innerHTML = '<button type="button" data-pdp-add-to-basket>Add to basket</button><button type="button" data-pdp-buy-now>Buy it now</button>';
  }

  function renderRelated(product, allProducts) {
    var section = document.querySelector('[data-pdp-related]');
    var grid = document.querySelector('[data-pdp-related-grid]');
    if (!section || !grid) return;
    var a = api();
    var sameCategory = allProducts.filter(function (item) { return item.id !== product.id && item.category === product.category; });
    var pool = sameCategory.length ? sameCategory : allProducts.filter(function (item) { return item.id !== product.id; });
    var picks = a.sortByShelfPriority(pool).slice(0, 4);
    if (!picks.length) { section.hidden = true; return; }
    section.hidden = false;
    grid.innerHTML = picks.map(a.productCard).join('');
  }

  function render() {
    var a = api();
    if (!a) return;
    var id = productIdFromPath();
    var product = id ? a.byId(id) : null;
    var loading = document.querySelector('[data-pdp-loading]');
    var notFound = document.querySelector('[data-pdp-not-found]');
    var layout = document.querySelector('[data-pdp-layout]');
    if (loading) loading.hidden = true;
    if (!product) {
      if (notFound) notFound.hidden = false;
      if (layout) layout.hidden = true;
      return;
    }
    currentProduct = product;
    if (notFound) notFound.hidden = true;
    if (layout) layout.hidden = false;

    var breadcrumb = document.querySelector('[data-pdp-breadcrumb]');
    if (breadcrumb) {
      var nameCrumb = breadcrumb.querySelector('[data-pdp-breadcrumb-name]');
      if (!nameCrumb) {
        var separator = document.createElement('span');
        separator.setAttribute('aria-hidden', 'true');
        separator.textContent = '/';
        nameCrumb = document.createElement('span');
        nameCrumb.setAttribute('data-pdp-breadcrumb-name', '');
        nameCrumb.setAttribute('aria-current', 'page');
        breadcrumb.appendChild(separator);
        breadcrumb.appendChild(nameCrumb);
      }
      nameCrumb.textContent = product.name;
    }

    renderGallery(product);
    var categoryEl = document.querySelector('[data-pdp-category]');
    if (categoryEl) categoryEl.textContent = product.category || 'Dévoilé shelf';
    var nameEl = document.querySelector('[data-pdp-name]');
    if (nameEl) nameEl.textContent = product.name;
    document.title = product.name + ' - Dévoilé Essentials';

    var priceEl = document.querySelector('[data-pdp-price]');
    if (priceEl) {
      var badgeText = a.badge(product);
      priceEl.innerHTML = (product.compareAt ? '<s>' + a.money(product.compareAt) + '</s><strong>' + a.money(product.price) + '</strong>' : '<strong>' + a.money(product.price) + '</strong>') +
        (badgeText ? '<span>' + a.escapeHtml(badgeText) + '</span>' : '');
    }
    var stockEl = document.querySelector('[data-pdp-stock]');
    if (stockEl) {
      var isSold = a.isSoldOut(product);
      stockEl.textContent = isSold ? 'Sold out / restock needed' : (Number(product.stock || 0) <= 6 ? 'Low stock / ' + product.stock + ' left' : 'In stock');
      stockEl.classList.toggle('low', !isSold && Number(product.stock || 0) <= 6);
      stockEl.classList.toggle('sold', isSold);
    }

    renderDescription(product);
    renderPurchaseActions(product);
    renderRelated(product, a.read());
    setQty(1);
  }

  document.addEventListener('click', function (event) {
    var thumb = event.target.closest('[data-pdp-thumb]');
    if (thumb && currentProduct) {
      var a = api();
      var images = galleryFor(currentProduct);
      var index = Number(thumb.getAttribute('data-pdp-thumb'));
      var src = images[index];
      if (src) {
        document.querySelectorAll('[data-pdp-thumb]').forEach(function (el) { el.classList.toggle('active', el === thumb); });
        var mainEl = document.querySelector('[data-pdp-gallery-main]');
        if (mainEl) mainEl.innerHTML = '<img class="product-upload-image" src="' + a.escapeHtml(src) + '" alt="' + a.escapeHtml(currentProduct.name) + '" />';
      }
      return;
    }

    if (event.target.closest('[data-pdp-qty-inc]')) { setQty(qty + 1); return; }
    if (event.target.closest('[data-pdp-qty-dec]')) { setQty(qty - 1); return; }

    if (event.target.closest('[data-pdp-add-to-basket]') && currentProduct && window.DevoileBasket) {
      window.DevoileBasket.addItem(currentProduct.id, qty);
      return;
    }
    if (event.target.closest('[data-pdp-buy-now]') && currentProduct && window.DevoileBasket) {
      window.DevoileBasket.buyNow(currentProduct.id, qty);
      return;
    }
  });

  window.addEventListener('devoile-products-updated', render);
})();
