/* Shared page chrome.
   1. Nav and footer are written once and fetched into every page (hence Live Server).
   2. Internal links fade the page out before the next one fades in. */

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

  /* ---- page transition ------------------------------------------------- */

  const FADE_MS = 220;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function isInternalNavigation(link, event) {
    if (reduceMotion.matches) return false;
    if (event.defaultPrevented || event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (link.target && link.target !== '_self') return false;
    if (link.hasAttribute('download')) return false;

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    /* anchor links on the same page should jump, not fade */
    if (url.pathname === window.location.pathname && url.search === window.location.search) return false;
    return true;
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || !isInternalNavigation(link, event)) return;

    event.preventDefault();
    document.body.classList.add('is-leaving');
    window.setTimeout(() => {
      window.location.href = link.href;
    }, FADE_MS);
  });

  window.addEventListener('pageshow', () => {
    document.body.classList.remove('is-leaving');
  });

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
