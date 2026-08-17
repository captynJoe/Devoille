(function () {
  if (!window.DevoileAdminData) return;
  var body = document.querySelector('[data-admin-actions]');
  var refresh = document.querySelector('[data-refresh-actions]');
  var escapeHtml = window.DevoileCatalog && window.DevoileCatalog.escapeHtml ? window.DevoileCatalog.escapeHtml : function (value) { return String(value == null ? '' : value); };
  function formatDate(seconds) {
    if (!seconds) return 'Unknown';
    return new Date(Number(seconds) * 1000).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });
  }
  function detail(action) {
    try {
      var payload = action.payload ? JSON.parse(action.payload) : {};
      if (payload.name) return payload.name;
      if (payload.provider) return 'provider: ' + payload.provider;
      if (typeof payload.done !== 'undefined') return 'done: ' + Boolean(payload.done);
      return Object.keys(payload).length ? JSON.stringify(payload) : 'No extra details';
    } catch (error) {
      return action.payload || 'No extra details';
    }
  }
  async function render() {
    if (!body) return;
    var actions = await window.DevoileAdminData.actions();
    body.innerHTML = actions.length ? actions.map(function (action) {
      return '<tr><td>' + escapeHtml(formatDate(action.created_at)) + '</td><td>' + escapeHtml(action.actor_email || 'system') + '</td><td><span class="status paid">' + escapeHtml(action.action) + '</span></td><td>' + escapeHtml(action.target_type || '') + (action.target_id ? ' / ' + escapeHtml(action.target_id) : '') + '</td><td>' + escapeHtml(detail(action)) + '</td></tr>';
    }).join('') : '<tr><td colspan="5">No actions recorded yet.</td></tr>';
  }
  if (refresh) refresh.addEventListener('click', render);
  render();
})();
