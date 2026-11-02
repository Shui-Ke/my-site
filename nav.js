/* Navigation is written once: nav.html and footer.html are fetched into every page.
   This is why the site needs Live Server (or any static server) instead of file://. */

(() => {
  const header = document.getElementById('site-header');
  const footer = document.getElementById('site-footer');

  const currentFile = () => {
    const file = window.location.pathname.split('/').pop();
    return file === '' ? 'index.html' : file;
  };

  const markCurrent = (root) => {
    const here = currentFile();
    root.querySelectorAll('a[href]').forEach((link) => {
      const href = link.getAttribute('href').split('#')[0];
      if (href === here) link.setAttribute('aria-current', 'page');
    });
  };

  const syncNavHeight = () => {
    if (!header) return;
    const height = Math.ceil(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--nav-h', `${height}px`);
  };

  async function inject(target, file) {
    if (!target) return;
    try {
      const response = await fetch(file, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`${file} returned ${response.status}`);
      target.innerHTML = await response.text();
    } catch (error) {
      if (target === header) {
        target.innerHTML =
          '<p class="nav-fallback">Navigation needs a local server — run Live Server on this folder, then reload.</p>';
      }
      if (target === footer) target.hidden = true;
      console.warn('[nav]', error);
    }
  }

  (async () => {
    await inject(header, 'nav.html');
    await inject(footer, 'footer.html');
    if (header) markCurrent(header);
    syncNavHeight();

    if (header && 'ResizeObserver' in window) {
      new ResizeObserver(syncNavHeight).observe(header);
    }
    window.addEventListener('resize', syncNavHeight, { passive: true });
  })();
})();
