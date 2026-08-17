(function () {
  var storageKey = 'devoile-basket';
  function api() { return window.DevoileCatalog || null; }
  function escapeHtml(value) { return api() && api().escapeHtml ? api().escapeHtml(value) : String(value == null ? '' : value); }
  function money(value) { return api() ? api().money(value).replace('.00', '') : 'KSh ' + value; }
  function loadBasket() { try { return JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch (error) { return {}; } }
  function saveBasket(basket) { try { localStorage.setItem(storageKey, JSON.stringify(basket)); } catch (error) {} }
  function byId(id) { return api() ? api().byId(id) : null; }
  function imageMarkup(product) { return api() ? api().visualMarkup(product) : ''; }
  function activeLines() {
    var basket = loadBasket();
    return Object.keys(basket).filter(function (id) { return basket[id] > 0 && byId(id); }).map(function (id) {
      var product = byId(id);
      var quantity = basket[id];
      return { id: id, product: product, quantity: quantity, total: Number(product.price || 0) * quantity };
    });
  }
  function total(lines) { return lines.reduce(function (sum, line) { return sum + line.total; }, 0); }
  function payload(lines) { return lines.map(function (line) { return { id: line.id, quantity: line.quantity }; }); }
  function setError(message) {
    var target = document.querySelector('[data-checkout-page-error]');
    if (!target) return;
    target.hidden = !message;
    target.textContent = message || '';
  }
  function render() {
    var lines = activeLines();
    var target = document.querySelector('[data-checkout-lines]');
    var totalTarget = document.querySelector('[data-checkout-total]');
    var submit = document.querySelector('[data-checkout-page-submit]');
    if (!target) return;
    if (!lines.length) {
      target.innerHTML = '<div class="checkout-empty"><strong>Your order tray is empty.</strong><p>Choose a Dévoilé item before continuing to payment.</p><a href="/shop">Browse the shelf</a></div>';
      if (submit) submit.disabled = true;
    } else {
      target.innerHTML = lines.map(function (line) {
        return '<article class="checkout-line" data-checkout-line="' + escapeHtml(line.id) + '">' +
          '<div class="checkout-line-media">' + imageMarkup(line.product) + '</div>' +
          '<div class="checkout-line-copy"><h3>' + escapeHtml(line.product.name) + '</h3><span>' + money(line.product.price) + '</span>' +
          '<div class="checkout-line-controls"><button type="button" data-checkout-dec="' + escapeHtml(line.id) + '">−</button><b>' + line.quantity + '</b><button type="button" data-checkout-inc="' + escapeHtml(line.id) + '">+</button><button type="button" data-checkout-remove="' + escapeHtml(line.id) + '">Remove</button></div></div>' +
          '<strong class="checkout-line-total">' + money(line.total) + '</strong>' +
        '</article>';
      }).join('');
      if (submit) submit.disabled = false;
    }
    if (totalTarget) totalTarget.textContent = money(total(lines));
  }
  function mutate(id, action) {
    var basket = loadBasket();
    if (action === 'inc') basket[id] = (basket[id] || 0) + 1;
    if (action === 'dec') basket[id] = Math.max(0, (basket[id] || 0) - 1);
    if (action === 'remove') basket[id] = 0;
    if (!basket[id]) delete basket[id];
    saveBasket(basket);
    render();
  }
  function selectedPaymentMethod(form) {
    var checked = form.querySelector('input[name="payment_method"]:checked');
    return checked ? checked.value : 'mpesa';
  }
  function updateSubmitText(form) {
    var button = document.querySelector('[data-checkout-page-submit]');
    if (!button || button.disabled) return;
    button.textContent = selectedPaymentMethod(form) === 'mpesa' ? 'Send M-PESA prompt' : 'Continue to secure payment';
  }
  function submit(form) {
    var lines = activeLines();
    if (!lines.length) { setError('Add at least one Dévoilé item before payment.'); return; }
    var data = new FormData(form);
    var email = String(data.get('email') || '').trim();
    var phone = String(data.get('phone') || '').trim();
    var paymentMethod = selectedPaymentMethod(form);
    if (!email && !phone) { setError('Enter an email address or phone number so we can confirm the order.'); return; }
    if (paymentMethod === 'mpesa' && !phone) { setError('Enter the Safaricom phone number that should receive the M-PESA prompt.'); return; }
    var button = document.querySelector('[data-checkout-page-submit]');
    setError('');
    if (button) { button.disabled = true; button.textContent = paymentMethod === 'mpesa' ? 'Sending M-PESA prompt...' : 'Opening secure payment...'; }
    fetch(paymentMethod === 'mpesa' ? '/api/checkout/mpesa' : '/api/checkout/pesapal', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: payload(lines),
        customer: {
          name: String(data.get('name') || '').trim(),
          email: email,
          phone: phone,
          mpesaPhone: phone,
          fulfillment: String(data.get('fulfillment') || 'Discreet delivery')
        }
      })
    })
      .then(function (response) { return response.json().then(function (body) { if (!response.ok) throw new Error(body.error || 'Checkout failed'); return body; }); })
      .then(function (body) {
        if (body.redirect_url) { location.href = body.redirect_url; return; }
        if (body.status_url) { location.href = body.status_url; return; }
        if (body.order_id) { location.href = '/payment-status?' + new URLSearchParams({ orderId: body.order_id }).toString(); return; }
        throw new Error(paymentMethod === 'mpesa' ? 'M-PESA did not return a checkout request.' : 'PesaPal did not return a payment page.');
      })
      .catch(function (error) { setError(error.message || 'Checkout failed.'); if (button) { button.disabled = false; updateSubmitText(form); } });
  }
  document.addEventListener('click', function (event) {
    var inc = event.target.closest('[data-checkout-inc]');
    var dec = event.target.closest('[data-checkout-dec]');
    var remove = event.target.closest('[data-checkout-remove]');
    if (inc) mutate(inc.getAttribute('data-checkout-inc'), 'inc');
    if (dec) mutate(dec.getAttribute('data-checkout-dec'), 'dec');
    if (remove) mutate(remove.getAttribute('data-checkout-remove'), 'remove');
  });
  document.addEventListener('submit', function (event) {
    var form = event.target.closest('[data-checkout-page-form]');
    if (!form) return;
    event.preventDefault();
    submit(form);
  });
  document.addEventListener('change', function (event) {
    var form = event.target.closest('[data-checkout-page-form]');
    if (form && event.target.name === 'payment_method') updateSubmitText(form);
  });
  window.addEventListener('devoile-products-updated', render);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { render(); var form = document.querySelector('[data-checkout-page-form]'); if (form) updateSubmitText(form); }); else { render(); var form = document.querySelector('[data-checkout-page-form]'); if (form) updateSubmitText(form); }
})();
