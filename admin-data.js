(function () {
  async function getJson(url, fallback) {
    try {
      var response = await fetch(url, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(url + ' failed');
      return await response.json();
    } catch (error) {
      console.warn('[devoile-admin] using fallback for ' + url, error);
      return fallback;
    }
  }
  window.DevoileAdminData = {
    orders: function () { return getJson('/api/orders', []); },
    subscribers: function () { return getJson('/api/subscribers', []); },
    tasks: function () { return getJson('/api/tasks', []); },
    actions: function () { return getJson('/api/admin/actions', []); },
    settings: function () { return getJson('/api/admin/settings', {}); },
    saveSettings: async function (settings) {
      var response = await fetch('/api/admin/settings', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.error || 'Settings failed to save');
      return data;
    },
    updateTask: async function (id, done) {
      await fetch('/api/tasks/' + encodeURIComponent(id), { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done: done }) });
    }
  };
})();
