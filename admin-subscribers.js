(async function () {
  if (!window.DevoileAdminData) return;
  var body = document.querySelector('[data-admin-subscribers]');
  if (!body) return;
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]; }); }
  function formatDate(seconds) { return seconds ? new Date(Number(seconds) * 1000).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' }) : ''; }
  var subscribers = await window.DevoileAdminData.subscribers();
  body.innerHTML = subscribers.length ? subscribers.map(function (subscriber) {
    if (typeof subscriber === 'number') return '<tr><td colspan="3">Legacy total: ' + escapeHtml(subscriber) + '</td></tr>';
    return '<tr><td>' + escapeHtml(subscriber.email) + '</td><td>' + escapeHtml(subscriber.source || 'footer') + '</td><td>' + escapeHtml(formatDate(subscriber.created_at)) + '</td></tr>';
  }).join('') : '<tr><td colspan="3">No subscribers yet.</td></tr>';
})();
