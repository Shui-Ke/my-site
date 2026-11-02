# CLUE. — Jiaming Guo

An evidence board, built by hand for the Web Technologies course (2026).

The site is one case file split into five pages: a board, fifteen statements, five open cases,
a subject file and one useless machine. Cork, paper, pins, red thread and a red marker — no
framework, no build step, no stock photos.

## Run it

The navigation is fetched from `nav.html` / `footer.html`, so `file://` will not work.
Use Live Server in VS Code, or any static server:

```powershell
python -m http.server 8777
```

Then open <http://127.0.0.1:8777/>.

## Pages

| File | What it is |
| --- | --- |
| `index.html` | The board: hero evidence photo, intro, four pinned files |
| `quotes.html` | Fifteen statements, one of them drawn at random |
| `project.html` | Five open cases, each with a person it is for |
| `about.html` | The subject file and the contact address |
| `machine.html` | Framed exhibit: `useless-machine/` in an iframe |

## How it is put together

- `nav.html` + `footer.html` + `nav.js` — navigation is written once and injected into every page.
- `style.css` — one stylesheet: cork board, paper cards, stamps, hand-drawn circles.
- `board.js` — draws the red threads from the hub pin to each card, and redraws on resize.
- `quotes.js` — reads the fifteen statements from the page and draws a random one.
- `useless-machine/` — the Three.js automaton (see its own README).
- `images/hero.jpg` — 1600 × 900 evidence photo, made from the machine still.

## Notes

- The site is set in Georgia (display), Courier New (labels) and Bahnschrift (stamps); all local.
- Icons are generated with `learning-html-plan/tools/make-icons.py`, outside this repository.
- Reduced motion is respected; threads are skipped on narrow screens.
