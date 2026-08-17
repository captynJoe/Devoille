(function () {
  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }
  function safeUrl(value, fallback) {
    var url = String(value || '').trim();
    if (!url) return fallback || '#';
    if (/^(https?:|mailto:|tel:)/i.test(url) || url.indexOf('./') === 0 || url.charAt(0) === '/') return url;
    return fallback || '#';
  }
  function apply(settings) {
    document.querySelectorAll('.site-footer').forEach(function (footer) {
      if (!footer.querySelector('.footer-brand-block')) {
        var block = document.createElement('div');
        block.className = 'footer-brand-block';
        block.innerHTML = '<strong>Dévoilé Essentials</strong><p data-footer-blurb></p>';
        footer.insertBefore(block, footer.firstChild);
      }
      var blurb = footer.querySelector('[data-footer-blurb]');
      if (blurb) blurb.textContent = settings.footer_blurb || 'Private scent, comfort, and care essentials with discreet delivery.';
      var meta = footer.querySelector('.footer-meta');
      if (meta) {
        meta.innerHTML = '' +
          '<span>© 2026, Dévoilé Essentials</span>' +
          '<span class="footer-social-links">' +
            '<a href="' + escapeHtml(safeUrl(settings.facebook_url, '#')) + '" target="_blank" rel="noopener noreferrer">Facebook</a>' +
            '<a href="' + escapeHtml(safeUrl(settings.instagram_url, '#')) + '" target="_blank" rel="noopener noreferrer">Instagram</a>' +
            '<a href="' + escapeHtml(safeUrl(settings.tiktok_url, '#')) + '" target="_blank" rel="noopener noreferrer">TikTok</a>' +
            '<a href="mailto:' + escapeHtml(settings.contact_email || 'Devoilessentials@gmail.com') + '">Email</a>' +
          '</span>' +
          '<a href="' + escapeHtml(safeUrl(settings.privacy_url, '/privacy')) + '">Privacy policy</a>';
      }
    });
  }

  function bindSignupForms() {
    document.addEventListener('submit', function (event) {
      var form = event.target.closest('.footer-form');
      if (!form) return;
      var input = form.querySelector('input[type="email"]');
      if (!input) return;
      event.preventDefault();
      var status = form.querySelector('.footer-form-status');
      if (!status) {
        status = document.createElement('span');
        status.className = 'footer-form-status';
        form.appendChild(status);
      }
      status.textContent = 'Saving...';
      fetch('/api/subscribers', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: input.value, source: location.pathname || '/' })
      })
        .then(function (response) { return response.json().then(function (data) { return { ok: response.ok, data: data }; }); })
        .then(function (result) {
          if (!result.ok) throw new Error(result.data.error || 'Signup failed');
          input.value = '';
          status.textContent = 'Saved.';
        })
        .catch(function (error) { status.textContent = error.message || 'Try again.'; });
    });
  }
  fetch('/api/settings', { credentials: 'same-origin' })
    .then(function (response) { return response.ok ? response.json() : {}; })
    .then(apply)
    .catch(function () { apply({}); });
  bindSignupForms();
})();
