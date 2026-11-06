/* Types prose in, one character at a time.
   Only elements marked [data-type] are touched: headings and short intros.
   Labels, stamps, tags, navigation and the pinned cards keep still.
   The text is split into word spans (so wrapping survives) and character spans. */

(() => {
  const targets = Array.from(document.querySelectorAll('[data-type]'));
  if (targets.length === 0) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const split = (element) => {
    const text = element.textContent.replace(/\s+/g, ' ').trim();
    if (text === '') return;

    element.style.setProperty('--start', `${Number(element.dataset.typeStart || 200)}ms`);

    const fragment = document.createDocumentFragment();
    const words = text.split(' ');
    let index = 0;

    words.forEach((word, wordIndex) => {
      const wordEl = document.createElement('span');
      wordEl.className = 'tw-word';

      Array.from(word).forEach((char) => {
        const charEl = document.createElement('span');
        charEl.className = 'tw-char';
        charEl.style.setProperty('--i', index);
        charEl.textContent = char;
        wordEl.appendChild(charEl);
        index += 1;
      });

      fragment.appendChild(wordEl);
      if (wordIndex < words.length - 1) fragment.appendChild(document.createTextNode(' '));
    });

    element.textContent = '';
    element.appendChild(fragment);
    element.classList.add('is-typing');
  };

  targets.forEach(split);
})();
