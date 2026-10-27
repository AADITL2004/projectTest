# Garuda and Amrita

An interactive, illustrated retelling of Garuda's quest for Amrita, built with vanilla HTML, CSS and JavaScript, and GSAP.

## Running it

The story is loaded with `fetch()`, and browsers block `fetch()` on pages opened straight from disk (`file://`). Serve the folder with any local web server, then open `index.html`:

- **VS Code:** right-click `index.html` and choose "Open with Live Server".
- **Node:** `npx serve .` (then open the URL it prints)
- **Python:** `python3 -m http.server 8000` (then open http://localhost:8000)

Everything (GSAP, fonts and artwork) is local, so the site works without an internet connection.

To demonstrate the error state, open `index.html?story=missing.json`.

## Structure

```
index.html          semantic structure: stage layers, passage, controls, intro, states
styles.css          tokens, layout, Madhubani frame, responsive and reduced-motion rules
story.json          20 scenes: text, camera, palette, characters, transitions, ambient effects
js/main.js          bootstrap, loading/error/intro states, scene engine and navigation lock
js/data.js          loadStory() (async/await fetch + validation), validateStoryData(), character art loader
js/world.js         the persistent world: piece positions, layer depths, camera and parallax
js/characters.js    the cast: inline SVG rigs, poses, placement, idle animation
js/transitions.js   reusable GSAP transition timelines (glide, foliage, canopy, dissolve,
                    lotus-wipe, wind, push-through, cloud-rise, celestial-reveal,
                    rapid-still, sky-return, back, reduced)
js/atmosphere.js    sky, haze, light, colour grade, frame tint, sun/moon, props
js/ambient.js       one canvas particle system (petals, leaves, dust, motes, embers), birds, rays, wind
js/narrative.js     passage text (textContent only), progress, button states
js/input.js         command dispatcher, keyboard navigation, pointer parallax
vendor/gsap.min.js  GSAP 3 (free standard licence)
assets/             original SVG artwork and local fonts (SIL OFL)
```

## How it works

- **One continuous world.** Every piece of scenery has a fixed position in a single world: a long earthly landscape at ground level, and the heavens about two screen heights above it. Each scene only sets a camera position (`camera.x`, `camera.y`, `camera.zoom`). Moving between scenes travels through the world.
- **Parallax.** The layers (sky, far, back, main, fore) move by `camera × depth`, which gives depth during camera moves. Pointer parallax adds a small offset per layer. Its strength comes from each scene's `parallax` values, and it is turned off on touch devices, on narrow screens and in reduced-motion mode.
- **Transitions.** `scene.transition.type` chooses a GSAP timeline that coordinates the camera, the atmosphere, the characters, the overlays and the text. Navigation is locked while a transition runs. Extra presses speed up the current transition and queue the next one, and a watchdog makes sure the lock is always released.
- **Future mudra input.** Inputs only dispatch commands. A hand-tracking module can call `window.garudaStory.dispatch('next')` (or `'prev'`), with no changes to the engine.

## Accessibility

The controls are real buttons with labels, and the story can be navigated by keyboard (arrow keys, Space, Page Up/Down, Home, End). Passages are announced through `aria-live`. Each scene has a text description of its illustration, and the decorative stage is hidden from screen readers. The site follows `prefers-reduced-motion`, has toggles for motion and parallax, and shows visible focus rings. On phones, the illustration sits above the text instead of behind it.
