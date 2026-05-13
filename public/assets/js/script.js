(function () {
  const root = document.documentElement;

  function readPreference(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writePreference(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      return false;
    }

    return true;
  }

  const savedTheme = readPreference('farmavida-theme');
  const preferredDark = Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = savedTheme || (preferredDark ? 'dark' : 'light');

  const loadingBar = document.createElement('div');
  loadingBar.className = 'loading-bar';
  document.body.prepend(loadingBar);
  document.body.classList.add('is-loading-page');
  window.addEventListener('load', () => {
    document.body.classList.remove('is-loading-page');
    document.body.classList.add('is-loaded-page');
    window.setTimeout(() => document.body.classList.remove('is-loaded-page'), 450);
  });

  function setTheme(theme) {
    root.dataset.theme = theme;
    writePreference('farmavida-theme', theme);
    document.querySelectorAll('[data-theme-label]').forEach((node) => {
      node.textContent = theme === 'dark' ? 'Modo escuro' : 'Modo claro';
    });
  }

  document.addEventListener('click', (event) => {
    const themeToggle = event.target.closest('[data-theme-toggle]');
    if (themeToggle) {
      event.preventDefault();
      setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
    }

    const sidebarToggle = event.target.closest('[data-sidebar-toggle]');
    if (sidebarToggle) {
      event.preventDefault();
      if (window.matchMedia('(max-width: 1120px)').matches) {
        document.body.classList.toggle('sidebar-open');
      } else {
        document.querySelector('.admin-shell')?.classList.toggle('is-sidebar-collapsed');
      }
    }

    if (document.body.classList.contains('sidebar-open') && !event.target.closest('.sidebar') && !event.target.closest('[data-sidebar-toggle]')) {
      document.body.classList.remove('sidebar-open');
    }

    const notification = event.target.closest('[data-notification-demo]');
    if (notification && window.toast) {
      event.preventDefault();
      window.toast('Alertas: pedidos pendentes, estoque baixo e receitas aguardando validacao.', 'warning');
    }
  });

  document.addEventListener('submit', (event) => {
    const button = event.target.querySelector('button[type="submit"], button:not([type])');
    if (button && !button.classList.contains('is-loading')) {
      button.classList.add('is-loading');
      window.setTimeout(() => button.classList.remove('is-loading'), 6000);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      document.body.classList.remove('sidebar-open');
    }
  });

  setTheme(root.dataset.theme || 'light');
})();
