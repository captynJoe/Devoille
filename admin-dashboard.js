(async function () {
  if (!window.DevoileCatalog || !window.DevoileAdminData) return;
  function set(selector, value) { var node = document.querySelector(selector); if (node) node.textContent = value; }
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]; }); }
  function itemRow(title, meta) { return '<a class="admin-list-row" href="/admin/products"><strong>' + escapeHtml(title) + '</strong><span>' + escapeHtml(meta) + '</span></a>'; }

  await window.DevoileCatalog.refresh();
  var products = window.DevoileCatalog.read();
  var orders = await window.DevoileAdminData.orders();
  var actions = await window.DevoileAdminData.actions();
  var totalRevenue = orders.reduce(function (sum, order) { return sum + Number(order.total || 0); }, 0);
  var lowStock = products.filter(function (product) { return product.status === 'sold_out' || Number(product.stock || 0) <= 6; });

  set('[data-dashboard-revenue]', window.DevoileCatalog.money(totalRevenue).replace('.00', ''));
  set('[data-dashboard-orders]', orders.length);
  set('[data-dashboard-products]', products.length);
  set('[data-dashboard-low-stock]', lowStock.length);
  set('[data-dashboard-actions]', actions.length);

  var alerts = document.querySelector('[data-dashboard-low-stock-list]');
  if (alerts) {
    alerts.innerHTML = lowStock.length ? lowStock.slice(0, 6).map(function (product) {
      return itemRow(product.name, Number(product.stock || 0) <= 0 ? 'Out of stock' : product.stock + ' left');
    }).join('') : '<p class="admin-empty-state">No low stock items.</p>';
  }

  var recent = document.querySelector('[data-dashboard-recent-orders]');
  if (recent) {
    recent.innerHTML = orders.length ? orders.slice(0, 6).map(function (order) {
      return '<a class="admin-list-row" href="/admin/orders"><strong>' + escapeHtml(order.id) + '</strong><span>' + escapeHtml(order.status || 'Recorded') + ' / ' + window.DevoileCatalog.money(order.total).replace('.00', '') + '</span></a>';
    }).join('') : '<p class="admin-empty-state">No orders yet.</p>';
  }
})();
