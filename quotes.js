/* Draws a random statement into the featured card.
   Each statement keeps its main line, a translation, an author (Chinese and/or
   English) and a source; the featured card just copies one of them. */

(() => {
  const stage = document.querySelector('[data-quote-stage]');
  if (!stage) return;

  const cards = Array.from(document.querySelectorAll('.statement'));
  if (cards.length === 0) return;

  const text = (node) => (node ? node.textContent.replace(/\s+/g, ' ').trim() : '');
  const lang = (node, fallback) => (node && node.getAttribute('lang')) || fallback;

  const statements = cards.map((card) => {
    const main = card.querySelector('[data-quote-main]');
    const translation = card.querySelector('[data-quote-translation]');
    return {
      main: text(main),
      mainLang: lang(main, 'zh-CN'),
      translation: text(translation),
      translationLang: lang(translation, 'en'),
      author: text(card.querySelector('[data-author]')),
      authorEn: text(card.querySelector('[data-author-en]')),
      source: text(card.querySelector('.source')),
    };
  });

  const out = {
    main: stage.querySelector('[data-quote-main]'),
    translation: stage.querySelector('[data-quote-translation]'),
    author: stage.querySelector('[data-author]'),
    authorEn: stage.querySelector('[data-author-en]'),
    source: stage.querySelector('[data-source]'),
    count: stage.querySelector('[data-count]'),
    button: stage.querySelector('[data-draw]'),
    body: stage.querySelector('.featured__body'),
  };

  const pad = (value) => String(value).padStart(2, '0');
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
    current = index;

    out.main.textContent = statement.main;
    out.main.setAttribute('lang', statement.mainLang);

    out.translation.textContent = statement.translation;
    out.translation.setAttribute('lang', statement.translationLang);

    out.author.textContent = statement.author;
    if (out.authorEn) {
      out.authorEn.textContent = statement.authorEn;
      out.authorEn.hidden = statement.authorEn === '';
    }

    out.source.textContent = statement.source;
    out.count.textContent = `${pad(index + 1)} / ${pad(statements.length)}`;
  }

  function showWithSwap(index) {
    show(index);
    out.body.classList.remove('is-swapping');
    void out.body.offsetWidth; /* restart the animation */
    out.body.classList.add('is-swapping');
  }

  out.body.addEventListener('animationend', () => out.body.classList.remove('is-swapping'));

  if (out.button) {
    out.button.addEventListener('click', () => showWithSwap(nextIndex()));
  }

  show(Math.floor(Math.random() * statements.length));
})();
