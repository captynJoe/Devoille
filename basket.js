(function () {
  var storageKey = 'devoile-basket';

  function catalog() {
    if (window.DevoileCatalog) return window.DevoileCatalog.read();
    return [];
  }

  function byId(id) {
    if (window.DevoileCatalog) return window.DevoileCatalog.byId(id);
    return null;
  }

  function money(value) {
    return window.DevoileCatalog ? window.DevoileCatalog.money(value).replace('.00', '') : 'KSh ' + value;
  }

  function loadBasket() {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch (error) { return {}; }
  }

  function saveBasket(basket) {
    try { localStorage.setItem(storageKey, JSON.stringify(basket)); } catch (error) {}
  }

  function countItems(basket) {
    return Object.keys(basket).reduce(function (sum, id) { return sum + basket[id]; }, 0);
  }

  function basketTotal(basket) {
    return Object.keys(basket).reduce(function (sum, id) {
      var product = byId(id);
      return sum + ((product ? product.price : 0) * basket[id]);
    }, 0);
  }

  function ensureDrawer() {
    if (document.querySelector('[data-basket-drawer]')) return;
    var shell = document.createElement('div');
    shell.className = 'basket-shell';
    shell.hidden = true; shell.style.pointerEvents = 'none';
    shell.style.cssText = 'position:fixed;inset:0;z-index:80;pointer-events:none;';
    shell.innerHTML = '' +
      '<div class="basket-backdrop" data-basket-close></div>' +
      '<aside class="basket-drawer" data-basket-drawer aria-label="Shopping basket" aria-hidden="true">' +
        '<div class="basket-head"><div><span>Dévoilé</span><h2>Order tray</h2></div><button type="button" data-basket-close aria-label="Close basket">×</button></div>' +
        '<div class="basket-items" data-basket-items></div>' +
        '<div class="basket-summary"><div><span>Subtotal</span><strong data-basket-total>KSh 0</strong></div><p>Review contact, fulfilment, and PesaPal payment on the private checkout page.</p><a class="basket-checkout-link" href="/checkout">Go to checkout</a><a href="/shop">Continue shopping</a></div>' +
      '</aside>';
    document.body.appendChild(shell);
  }

  function ensureCheckoutModal() {
    if (document.querySelector('[data-checkout-modal]')) return;
    var modal = document.createElement('div');
    modal.className = 'checkout-modal-shell';
    modal.hidden = true;
    modal.innerHTML = '' +
      '<div class="checkout-backdrop" data-checkout-close></div>' +
      '<section class="checkout-modal" data-checkout-modal aria-hidden="true" aria-label="Checkout">' +
        '<div class="checkout-head"><div><span>Secure checkout</span><h2>PesaPal payment</h2></div><button type="button" data-checkout-close aria-label="Close checkout">×</button></div>' +
        '<form data-checkout-form>' +
          '<label>Full name<input name="name" type="text" autocomplete="name" required placeholder="Your name" /></label>' +
          '<label>Email<input name="email" type="email" autocomplete="email" placeholder="you@example.com" /></label>' +
          '<label>Phone<input name="phone" type="tel" autocomplete="tel" placeholder="07..." /></label>' +
          '<label>Fulfillment<select name="fulfillment"><option>Discreet delivery</option><option>Nairobi CBD pickup</option></select></label>' +
          '<p data-checkout-error class="checkout-error" hidden></p>' +
          '<button type="submit" data-checkout-submit>Continue to PesaPal</button>' +
        '</form>' +
      '</section>';
    document.body.appendChild(modal);
  }

  function basketPayload() {
    var basket = loadBasket();
    return Object.keys(basket).filter(function (id) { return basket[id] > 0 && byId(id); }).map(function (id) { return { id: id, quantity: basket[id] }; });
  }

  function openCheckout() {
    renderBasket();
    if (!basketPayload().length) return;
      var shell = document.querySelector('.checkout-modal-shell');
    var modal = document.querySelector('[data-checkout-modal]');
    if (shell) shell.hidden = false;
    if (modal) modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('checkout-open');
  }

  function closeCheckout() {
    document.body.classList.remove('checkout-open');
    var modal = document.querySelector('[data-checkout-modal]');
    if (modal) modal.setAttribute('aria-hidden', 'true');
    var shell = document.querySelector('.checkout-modal-shell');
    if (shell) shell.hidden = true;
  }

  function setCheckoutError(message) {
    var error = document.querySelector('[data-checkout-error]');
    if (!error) return;
    error.hidden = !message;
    error.textContent = message || '';
  }

  function submitCheckout(form) {
    var submit = document.querySelector('[data-checkout-submit]');
    var data = new FormData(form);
    var email = String(data.get('email') || '').trim();
    var phone = String(data.get('phone') || '').trim();
    if (!email && !phone) { setCheckoutError('Enter an email address or phone number.'); return; }
    setCheckoutError('');
    if (submit) { submit.disabled = true; submit.textContent = 'Opening PesaPal...'; }
    fetch('/api/checkout/pesapal', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: basketPayload(),
        customer: {
          name: String(data.get('name') || '').trim(),
          email: email,
          phone: phone,
          fulfillment: String(data.get('fulfillment') || 'Discreet delivery')
        }
      })
    })
      .then(function (response) { return response.json().then(function (payload) { if (!response.ok) throw new Error(payload.error || 'Checkout failed'); return payload; }); })
      .then(function (payload) { if (payload.redirect_url) location.href = payload.redirect_url; else throw new Error('PesaPal did not return a checkout URL'); })
      .catch(function (error) { setCheckoutError(error.message || 'Checkout failed.'); if (submit) { submit.disabled = false; submit.textContent = 'Continue to PesaPal'; } });
  }

  function updateBadges() {
    var basket = loadBasket();
    var count = countItems(basket);
    document.querySelectorAll('.basket-button').forEach(function (button) {
      button.dataset.count = String(count);
      button.classList.toggle('has-items', count > 0);
    });
  }

  function renderBasket() {
    ensureDrawer();
    var basket = loadBasket();
    var container = document.querySelector('[data-basket-items]');
    var total = document.querySelector('[data-basket-total]');
    var ids = Object.keys(basket).filter(function (id) { return byId(id) && basket[id] > 0; });
    if (!ids.length) {
      container.innerHTML = '<div class="empty-basket"><strong>Your basket is empty.</strong><p>Add a Dévoilé essential to start your order.</p></div>';
    } else {
      container.innerHTML = ids.map(function (id) {
        var product = byId(id);
        var qty = basket[id];
        return '<article class="basket-item">' +
          '<div class="basket-thumb"></div>' +
          '<div><h3>' + product.name + '</h3><span>' + money(product.price) + '</span>' +
          '<div class="basket-qty"><button type="button" data-basket-dec="' + id + '">−</button><b>' + qty + '</b><button type="button" data-basket-inc="' + id + '">+</button><button type="button" data-basket-remove="' + id + '">Remove</button></div></div>' +
        '</article>';
      }).join('');
    }
    total.textContent = money(basketTotal(basket));
    updateBadges();
  }

  function openBasket() {
    renderBasket();
    var shell = document.querySelector('.basket-shell');
    if (shell) { shell.hidden = false; shell.style.pointerEvents = 'auto'; }
    document.body.classList.add('basket-open');
    document.querySelector('[data-basket-drawer]').setAttribute('aria-hidden', 'false');
  }

  function closeBasket() {
    document.body.classList.remove('basket-open');
    var drawer = document.querySelector('[data-basket-drawer]');
    if (drawer) drawer.setAttribute('aria-hidden', 'true');
    var shell = document.querySelector('.basket-shell');
    if (shell) setTimeout(function () { if (!document.body.classList.contains('basket-open')) shell.hidden = true; shell.style.pointerEvents = 'none'; }, 220);
  }

  function addItem(id, quantity) {
    var product = byId(id);
    if (!product || product.status === 'sold_out' || Number(product.stock || 0) <= 0) return;
    var basket = loadBasket();
    basket[id] = (basket[id] || 0) + (quantity || 1);
    saveBasket(basket);
    openBasket();
  }

  document.addEventListener('click', function (event) {
    var addButton = event.target.closest('[data-add-to-basket]');
    if (addButton) {
      addItem(addButton.getAttribute('data-product-id'), 1);
      return;
    }

    var buyNow = event.target.closest('[data-buy-now]');
    if (buyNow) {
      addItem(buyNow.getAttribute('data-product-id'), 1);
      closeBasket();
      openCheckout();
      return;
    }

    if (event.target.closest('[data-basket-open]')) {
      event.preventDefault();
      openBasket();
      return;
    }

    if (event.target.closest('[data-basket-close]')) {
      closeBasket();
      return;
    }

    if (event.target.closest('[data-checkout-close]')) {
      closeCheckout();
      return;
    }

    var inc = event.target.closest('[data-basket-inc]');
    var dec = event.target.closest('[data-basket-dec]');
    var remove = event.target.closest('[data-basket-remove]');
    if (inc || dec || remove) {
      var id = (inc || dec || remove).getAttribute(inc ? 'data-basket-inc' : dec ? 'data-basket-dec' : 'data-basket-remove');
      var basket = loadBasket();
      if (inc) basket[id] = (basket[id] || 0) + 1;
      if (dec) basket[id] = Math.max(0, (basket[id] || 0) - 1);
      if (remove) basket[id] = 0;
      if (!basket[id]) delete basket[id];
      saveBasket(basket);
      renderBasket();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { closeBasket(); closeCheckout(); }
  });

  document.addEventListener('submit', function (event) {
    var form = event.target.closest('[data-checkout-form]');
    if (!form) return;
    event.preventDefault();
    submitCheckout(form);
  });

  window.addEventListener('devoile-products-updated', renderBasket);
  ensureDrawer();
  renderBasket();

  window.DevoileBasket = {
    addItem: addItem,
    buyNow: function (id, quantity) {
      addItem(id, quantity);
      closeBasket();
      openCheckout();
    }
  };
})();
