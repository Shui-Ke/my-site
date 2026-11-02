# The Useless Machine

An interactive, museum-style automaton built with **Three.js**.

Pull the brass lever. The lid opens, a porcelain hand rises from the box, flips
the lever back off, and disappears again. Repeat as often as you like.

## Run it

Open `index.html` directly in a modern browser. It also works via any static
server, for example:

```powershell
python -m http.server 8777
```

Then visit `http://127.0.0.1:8777/`.

Everything is local and works offline. No build step, no network requests, no
external images or models.

## Controls

- **Click / tap the brass lever** to start the machine. Its brass halo glows as a
  hover affordance; there is no other on-screen HUD by design.
- **Space / Enter** pulls the lever while the page has focus.
- **Sound on / off** sits at the top right. Mechanical sounds are synthesized with
  Web Audio after the first interaction.
- The page respects `prefers-reduced-motion` for the decorative camera motion.

The visible interface is deliberately limited to the title lockup and the sound
control.

## What is inside

- One self-contained scene in `app.js`: procedural wood, velvet, travertine and
  plaster textures; an environment map for the brass and varnish; soft studio
  lighting; articulated finger rig; two-bone IK for the arm; hand-keyed motion
  timeline and synthesized machine audio.
- `index.html` contains the interface, styling and the embedded Switzer font.
- `vendor/three.min.js` is Three.js r152 (MIT, license header included).
- The machine, hand and all decorative geometry are generated at runtime.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page, UI styling, embedded interface font |
| `app.js` | Three.js scene, model, animation, pointer/keyboard interaction, sound |
| `vendor/three.min.js` | Three.js r152 |
| `vendor/THREE-LICENSE.txt` | Three.js MIT license |
| `fonts/SOURCE.md` | Source note for the Switzer typeface |
| `preview-desktop.png` | Still frame of the desktop composition |
| `preview-mobile.png` | Still frame of the mobile composition |

## Notes

- The design uses a warm, low-contrast museum palette: European walnut, aged
  brass, porcelain, dark green velvet and a travertine display dais.
- The brass inlay on the lid, the gear train and the clock-face gauge are little
  narrative details: the machine has a mechanism, even if that mechanism exists
  only to undo your one useful action.
- Built for current Chromium, Firefox and Safari with WebGL 2. A WebGL fallback
  message is included.
