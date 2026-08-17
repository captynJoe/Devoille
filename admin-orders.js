(async function () {
  if (!window.DevoileCatalog || !window.DevoileAdminData) return;
  var body = document.querySelector('[data-admin-orders]');
  if (!body) return;
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]; }); }
  var orders = await window.DevoileAdminData.orders();
  body.innerHTML = orders.length ? orders.map(function (order) {
    var payment = [order.paymentProvider, order.paymentMethod, order.confirmationCode].filter(Boolean).join(' / ') || 'Not set';
    return '<tr><td>' + escapeHtml(order.id) + '</td><td>' + escapeHtml(order.customer) + '</td><td>' + escapeHtml(order.items) + '</td><td>' + escapeHtml(order.fulfillment) + '</td><td><span class="status ' + escapeHtml(order.statusTone) + '">' + escapeHtml(order.status) + '</span></td><td>' + escapeHtml(payment) + '</td><td>' + window.DevoileCatalog.money(order.total).replace('.00', '') + '</td></tr>';
  }).join('') : '<tr><td colspan="7">No orders yet.</td></tr>';
})();
