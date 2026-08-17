(function () {
  var storageKey = 'devoile-theme';
  var root = document.documentElement;

  function applyTheme(theme) {
    root.dataset.theme = theme;
    try { localStorage.setItem(storageKey, theme); } catch (error) {}
    document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
      button.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    });
  }

  function currentTheme() {
    return root.dataset.theme === 'dark' ? 'dark' : 'light';
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-theme-toggle]');
    if (!button) return;
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  });

  applyTheme(currentTheme());
})();
