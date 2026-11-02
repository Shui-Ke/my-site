/* Red thread: one hub pin, a sagging line to every linked card.
   Coordinates are read from the rendered layout, so the threads survive resizes. */

(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const boards = Array.from(document.querySelectorAll('[data-board]'));
  if (boards.length === 0) return;

  const pointOn = (element, boardRect, anchor) => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left - boardRect.left + rect.width / 2,
      y: rect.top - boardRect.top + (anchor === 'top' ? 12 : rect.height / 2),
    };
  };

  function drawThreads(board) {
    const svg = board.querySelector('.board-lines');
    const hub = board.querySelector('[data-hub]');
    const links = Array.from(board.querySelectorAll('[data-link]'));
    if (!svg || !hub) return;

    const boardRect = board.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${Math.round(boardRect.width)} ${Math.round(boardRect.height)}`);
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    /* On phones the cards stack, and threads across a long column read as noise. */
    if (boardRect.width < 620) return;

    const from = pointOn(hub, boardRect, 'center');

    links.forEach((link) => {
      const to = pointOn(link, boardRect, 'top');
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 60) return;

      const sag = Math.min(70, 12 + distance * 0.16);
      const controlX = (from.x + to.x) / 2;
      const controlY = Math.max(from.y, to.y) + sag;

      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute(
        'd',
        `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} ` +
          `Q ${controlX.toFixed(1)} ${controlY.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`
      );
      svg.appendChild(path);
    });
  }

  let frame = 0;
  const redraw = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => boards.forEach(drawThreads));
  };

  redraw();
  window.addEventListener('resize', redraw, { passive: true });
  window.addEventListener('load', redraw);

  if ('fonts' in document) document.fonts.ready.then(redraw);
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(redraw);
    boards.forEach((board) => observer.observe(board));
  }
})();
