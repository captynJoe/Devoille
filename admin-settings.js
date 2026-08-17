(function () {
  var form = document.querySelector('[data-settings-form]');
  var status = document.querySelector('[data-settings-status]');
  if (!form) return;
  function setStatus(message, isError) {
    if (!status) return;
    status.textContent = message || '';
    status.classList.toggle('is-error', !!isError);
  }
  function fill(settings) {
    ['facebook_url', 'instagram_url', 'tiktok_url', 'contact_email', 'privacy_url', 'footer_blurb'].forEach(function (key) {
      var field = form.elements[key];
      if (field) field.value = settings[key] || '';
    });
  }
  async function load() {
    try {
      var settings = await window.DevoileAdminData.settings();
      fill(settings);
    } catch (error) {
      setStatus('Could not load settings.', true);
    }
  }
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    setStatus('Saving...');
    var payload = Object.fromEntries(new FormData(form).entries());
    try {
      var settings = await window.DevoileAdminData.saveSettings(payload);
      fill(settings);
      setStatus('Settings saved. Storefront footer links are live.');
    } catch (error) {
      setStatus(error.message || 'Settings failed to save.', true);
    }
  });
  load();
})();
