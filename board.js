/* Red thread. Two modes, both driven by the rendered layout:
   - hub:   one pin, a sagging line to every [data-link] card (index page)
   - chain: the statement cards tied to each other, plus a few cross lines (quotes page) */

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

  function thread(svg, from, to, sag, wobble) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.hypot(dx, dy) < 40) return;

    const controlX = (from.x + to.x) / 2 + wobble;
    const controlY = Math.max(from.y, to.y) + sag;

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute(
      'd',
      `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} ` +
        `Q ${controlX.toFixed(1)} ${(controlY + 2).toFixed(1)} ${to.x.toFixed(1)} ${(to.y + 2).toFixed(1)}`
    );
    path.setAttribute('class', 'thread-shadow');
    svg.appendChild(path);

    const line = document.createElementNS(SVG_NS, 'path');
    line.setAttribute(
      'd',
      `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} ` +
        `Q ${controlX.toFixed(1)} ${controlY.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`
    );
    svg.appendChild(line);
  }

  function drawHub(board, svg, boardRect) {
    const hub = board.querySelector('[data-hub]');
    if (!hub) return;

    const from = pointOn(hub, boardRect, 'center');
    board.querySelectorAll('[data-link]').forEach((link, index) => {
      const to = pointOn(link, boardRect, 'top');
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      if (distance < 60) return;
      thread(svg, from, to, Math.min(70, 12 + distance * 0.16), index % 2 ? 8 : -8);
    });
  }

  function drawChain(board, svg, boardRect) {
    const cards = Array.from(board.querySelectorAll('.statement'));
    if (cards.length < 2) return;

    const pins = cards.map((card) => pointOn(card, boardRect, 'top'));
    const overCards = board.querySelector('.board-lines--front');

    /* reading order, one line to the next — these sit behind the paper */
    pins.forEach((pin, index) => {
      const next = pins[index + 1];
      if (!next) return;
      const distance = Math.hypot(next.x - pin.x, next.y - pin.y);
      thread(svg, pin, next, Math.min(46, 10 + distance * 0.12), index % 2 ? 12 : -12);
    });

    /* longer lines that stay behind the cards, so the web still reads as a web */
    const BEHIND = [
      [0, 3],
      [1, 5],
      [2, 7],
      [4, 9],
      [6, 11],
      [8, 13],
    ];
    BEHIND.forEach(([a, b], index) => {
      if (!pins[a] || !pins[b]) return;
      thread(svg, pins[a], pins[b], 46 + (index % 4) * 14, index % 2 ? -28 : 28);
    });

    /* a few threads laid over the cards, as on a real board */
    const OVER = [
      [0, 7],
      [5, 10],
      [2, 9],
      [7, 14],
      [1, 11],
      [4, 13],
    ];
    if (!overCards) return;
    OVER.forEach(([a, b], index) => {
      if (!pins[a] || !pins[b]) return;
      thread(overCards, pins[a], pins[b], 70 + (index % 3) * 18, index % 2 ? 38 : -38);
    });
  }

  function drawPair(board, svg, boardRect) {
    const from = board.querySelector('[data-from]');
    const to = board.querySelector('[data-to]');
    if (!from || !to) return;

    const a = pointOn(from, boardRect, 'center');
    const b = pointOn(to, boardRect, 'center');
    thread(svg, a, b, 70, 0);
  }

  function render(board) {
    const svg = board.querySelector('.board-lines');
    if (!svg) return;

    const front = board.querySelector('.board-lines--front');
    const layers = [svg, front].filter(Boolean);
    const boardRect = board.getBoundingClientRect();
    const box = `0 0 ${Math.round(boardRect.width)} ${Math.round(boardRect.height)}`;

    layers.forEach((layer) => {
      layer.setAttribute('viewBox', box);
      while (layer.firstChild) layer.removeChild(layer.firstChild);
    });

    /* On phones the cards stack, and threads across a long column read as noise. */
    if (boardRect.width < 620) return;

    if (board.dataset.thread === 'chain') drawChain(board, svg, boardRect);
    else if (board.dataset.thread === 'pair') drawPair(board, front || svg, boardRect);
    else drawHub(board, svg, boardRect);
  }

  let frame = 0;
  const redraw = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => boards.forEach(render));
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
