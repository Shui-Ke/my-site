/* Draws a random statement into the featured card.
   The fifteen statements live in the HTML; this file only reads them. */

(() => {
  const stage = document.querySelector('[data-quote-stage]');
  if (!stage) return;

  const cards = Array.from(document.querySelectorAll('.statement'));
  if (cards.length === 0) return;

  const statements = cards.map((card) => ({
    quote: card.querySelector('blockquote').textContent.trim().replace(/\s+/g, ' '),
    author: card.querySelector('cite').textContent.trim(),
    source: card.querySelector('.source').textContent.trim(),
  }));

  const out = {
    quote: stage.querySelector('[data-quote]'),
    author: stage.querySelector('[data-author]'),
    source: stage.querySelector('[data-source]'),
    count: stage.querySelector('[data-count]'),
    button: stage.querySelector('[data-draw]'),
    body: stage.querySelector('.featured__body'),
  };

  const pad = (value) => String(value).padStart(2, '0');
  let previous = -1;
  let current = -1;

  function nextIndex() {
    if (statements.length === 1) return 0;
    let index = current;
    while (index === current) {
      index = Math.floor(Math.random() * statements.length);
    }
    return index;
  }

  function show(index) {
    const statement = statements[index];
    previous = current;
    current = index;

    out.quote.textContent = statement.quote;
    out.author.textContent = statement.author;
    out.source.textContent = statement.source;
    out.count.textContent = `${pad(index + 1)} / ${pad(statements.length)}`;

    if (previous !== -1) {
      out.body.classList.remove('is-swapping');
      void out.body.offsetWidth; /* restart the animation */
      out.body.classList.add('is-swapping');
    }
  }

  out.body.addEventListener('animationend', () => out.body.classList.remove('is-swapping'));

  if (out.button) {
    out.button.addEventListener('click', () => show(nextIndex()));
  }

  show(Math.floor(Math.random() * statements.length));
})();
