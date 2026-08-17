(function () {
  var currentUser = null;
  async function session() {
    try {
      var response = await fetch('/api/session', { credentials: 'same-origin' });
      var data = await response.json();
      currentUser = data.user || null;
      return currentUser;
    } catch (error) { return null; }
  }
  function returnTarget() {
    var params = new URLSearchParams(location.search);
    return params.get('return') || '/account';
  }
  function goLogin(returnUrl) { location.href = '/login?return=' + encodeURIComponent(returnUrl || '/account'); }
  document.addEventListener('DOMContentLoaded', function () {
    var params = new URLSearchParams(location.search);
    var googleLink = document.querySelector('.google-login-button');
    if (googleLink) googleLink.href = '/api/auth/google?return=' + encodeURIComponent(returnTarget());
    var errorEl = document.querySelector('[data-login-error]');
    if (!errorEl) return;
    var error = params.get('error');
    var messages = {
      google_not_configured: 'Google login needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on this server.',
      google_login_failed: 'Google login failed. Try again or use email login.',
      google_unauthorized: 'That Google account is not authorized for this admin.'
    };
    errorEl.textContent = messages[error] || '';
  });
  document.addEventListener('submit', async function (event) {
    var form = event.target.closest('[data-login-form]');
    if (!form) return;
    event.preventDefault();
    var formData = new FormData(form);
    var email = (formData.get('email') || '').toString();
    var password = (formData.get('password') || '').toString();
    var response = await fetch('/api/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, password: password }) });
    if (!response.ok) {
      var data = await response.json().catch(function () { return {}; });
      alert(data.error || 'Login failed.');
      return;
    }
    location.href = returnTarget();
  });
  document.addEventListener('click', async function (event) {
    var logout = event.target.closest('[data-logout]');
    if (logout) { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); location.href = '/login'; return; }
    var purchase = event.target.closest('[data-login-purchase]');
    if (purchase && !currentUser) { event.preventDefault(); goLogin('/shop'); }
  });
  function currentReturnPath() {
    return location.pathname + location.search + location.hash;
  }
  session().then(function (user) {
    if (document.body && document.body.getAttribute('data-auth-required') === 'user' && !user) {
      location.replace('/login?return=' + encodeURIComponent(currentReturnPath()));
    }
  });
})();
