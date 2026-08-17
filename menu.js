(function () {
  function ensureMenu() {
    if (document.querySelector('[data-mobile-menu]')) return;
    var isAdmin = location.pathname.indexOf('/admin') === 0;
    var nav = isAdmin
      ? [
          ['Dashboard', '/admin'],
          ['Orders', '/admin/orders'],
          ['Products', '/admin/products'],
          ['Subscribers', '/admin/subscribers'],
          ['Activity', '/admin/actions'],
          ['Settings', '/admin/settings'],
          ['Storefront', '/']
        ]
      : [
          ['Home', '/'],
          ['Shop', '/shop'],
          ['Scent Room', '/scent-room'],
          ['Care Journal', '/care-journal'],
          ['Checkout', '/checkout'],
          ['Account', '/account'],
          ['Admin', '/admin']
        ];
    var shell = document.createElement('div');
    shell.className = 'mobile-menu-shell';
    shell.hidden = true; shell.style.pointerEvents = 'none';
    shell.style.cssText = 'position:fixed;inset:0;z-index:90;pointer-events:none;';
    shell.innerHTML = '' +
      '<div class="mobile-menu-backdrop" data-menu-close></div>' +
      '<aside class="mobile-menu" data-mobile-menu aria-hidden="true">' +
        '<div class="mobile-menu-head"><div><span>Dévoilé</span><h2>Menu</h2></div><button type="button" data-menu-close aria-label="Close menu">×</button></div>' +
        '<nav class="mobile-menu-nav" aria-label="Mobile navigation">' +
          nav.map(function (item) { return '<a href="' + item[1] + '">' + item[0] + '</a>'; }).join('') +
        '</nav>' +
        '<div class="mobile-menu-actions"><button type="button" data-theme-toggle>Toggle dark mode</button><button type="button" data-basket-open>Open basket</button></div>' +
      '</aside>';
    document.body.appendChild(shell);
  }

  function openMenu() {
    ensureMenu();
    var shell = document.querySelector('.mobile-menu-shell');
    if (shell) { shell.hidden = false; shell.style.pointerEvents = 'auto'; }
    document.body.classList.add('menu-open');
    document.querySelector('[data-mobile-menu]').setAttribute('aria-hidden', 'false');
    document.querySelectorAll('[data-menu-toggle]').forEach(function (button) {
      button.setAttribute('aria-expanded', 'true');
    });
  }

  function closeMenu() {
    document.body.classList.remove('menu-open');
    var menu = document.querySelector('[data-mobile-menu]');
    if (menu) menu.setAttribute('aria-hidden', 'true');
    var shell = document.querySelector('.mobile-menu-shell');
    if (shell) setTimeout(function () { if (!document.body.classList.contains('menu-open')) shell.hidden = true; shell.style.pointerEvents = 'none'; }, 220);
    document.querySelectorAll('[data-menu-toggle]').forEach(function (button) {
      button.setAttribute('aria-expanded', 'false');
    });
  }

  document.addEventListener('click', function (event) {
    if (event.target.closest('[data-menu-toggle]')) {
      event.preventDefault();
      openMenu();
      return;
    }
    if (event.target.closest('[data-menu-close]')) {
      closeMenu();
      return;
    }
    if (event.target.closest('.mobile-menu-nav a')) {
      closeMenu();
    }
    if (event.target.closest('.mobile-menu-actions [data-basket-open]')) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeMenu();
  });

  ensureMenu();
})();
