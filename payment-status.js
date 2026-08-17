(function () {
  var heading = document.querySelector('[data-payment-heading]');
  var message = document.querySelector('[data-payment-message]');
  function setText(h, m) { if (heading) heading.textContent = h; if (message) message.textContent = m; }
  var params = new URLSearchParams(location.search);
  var orderId = params.get('orderId') || params.get('order_id');
  var tracking = params.get('OrderTrackingId');
  var reference = params.get('OrderMerchantReference');

  function handleLocalStatus(data, attempt) {
    var status = String(data.status || data.payment_status || 'Payment pending');
    if (status.toLowerCase() === 'paid') {
      try { localStorage.removeItem('devoile-basket'); } catch (error) {}
      setText('Payment received.', 'Thank you. Your Dévoilé order has been recorded and will be prepared discreetly.');
      return;
    }
    if (status.toLowerCase().indexOf('failed') !== -1 || status.toLowerCase().indexOf('cancel') !== -1) {
      setText('Payment not completed.', data.mpesa_result_desc || 'The M-PESA prompt was not completed. You can return to checkout and try again.');
      return;
    }
    setText('Waiting for M-PESA.', 'Approve the prompt on your phone. This page will keep checking for confirmation.');
    if (attempt < 36) window.setTimeout(function () { pollMpesa(attempt + 1); }, 5000);
  }

  function pollMpesa(attempt) {
    fetch('/api/payments/mpesa/status?' + new URLSearchParams({ orderId: orderId }).toString(), { credentials: 'same-origin' })
      .then(function (response) { return response.json().then(function (data) { if (!response.ok) throw new Error(data.error || 'Payment check failed'); return data; }); })
      .then(function (data) { handleLocalStatus(data, attempt); })
      .catch(function (error) { setText('Payment check failed.', error.message || 'Please contact support with your payment confirmation.'); });
  }

  if (orderId) { pollMpesa(0); return; }
  if (!tracking) { setText('Payment status unavailable.', 'We did not receive a payment reference. If you paid, contact support with your payment confirmation.'); return; }
  fetch('/api/payments/pesapal/status?' + new URLSearchParams({ OrderTrackingId: tracking, OrderMerchantReference: reference || '' }).toString(), { credentials: 'same-origin' })
    .then(function (response) { return response.json().then(function (data) { if (!response.ok) throw new Error(data.error || 'Payment check failed'); return data; }); })
    .then(function (data) {
      var status = String(data.payment_status_description || data.status || 'pending');
      if (status.toUpperCase() === 'COMPLETED') {
        try { localStorage.removeItem('devoile-basket'); } catch (error) {}
        setText('Payment received.', 'Thank you. Your Dévoilé order has been recorded and will be prepared discreetly.');
      } else {
        setText('Payment ' + status.toLowerCase() + '.', 'Your order is recorded. If payment is still pending, complete it from the PesaPal page or contact support.');
      }
    })
    .catch(function (error) { setText('Payment check failed.', error.message || 'Please contact support with your payment confirmation.'); });
})();
