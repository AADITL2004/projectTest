/*
 * main.js: bootstraps the experience and runs the scene engine.
 *
 * Flow: loading state → fetch story.json and the character art (async/await) →
 * validate → build the world → intro screen → story.
 */

import { loadStory, loadCharacterArt, storyUrlFromLocation } from './data.js';
import { World } from './world.js';
import { Cast } from './characters.js';
import { Atmosphere } from './atmosphere.js';
import { Ambient } from './ambient.js';
import { Narrative } from './narrative.js';
import { buildTransition } from './transitions.js';
import { Commands, initialiseKeyboardNavigation, initialiseParallax } from './input.js';

const app = document.getElementById('app');
const stage = document.getElementById('stage');

/* ------------------------------------------------------------ preferences */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};
const systemReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const prefs = {
  motion: store.get('garuda.motion'),            // 'reduced' | 'full' | null (follow system)
  parallax: store.get('garuda.parallax') !== 'off',
};
const isReduced = () => (prefs.motion ? prefs.motion === 'reduced' : systemReduced.matches);
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

/* ------------------------------------------------------------ app state */
const state = {
  story: null,
  index: 0,
  mode: 'loading',       // loading | error | intro | story
  transitioning: false,
  pending: null,
  timeline: null,
  watchdog: 0,
};

const camera = { x: 0, y: 0, zoom: 1, shakeX: 0, shakeY: 0 };
const pointer = { x: 0, y: 0 };
const parallaxAmp = { sky: 0.1, background: 0.25, midground: 0.5, foreground: 0.8 };

let world, cast, atmosphere, ambient, narrative, ctx;
const commands = new Commands();

/* ------------------------------------------------------------ UI states */
function setMode(mode) {
  state.mode = mode;
  app.dataset.state = mode;
}

function showError(err) {
  console.error(err);
  setMode('error');
  const box = document.getElementById('error');
  box.querySelector('.error-message').textContent = err.message || 'Something went wrong.';
  box.querySelector('.error-detail').textContent = err.detail || '';
  box.querySelector('button').focus();
}

/* ------------------------------------------------------------ loading */
let loadController;
async function start() {
  setMode('loading');
  loadController?.abort();
  loadController = new AbortController();
  try {
    const [story, art] = await Promise.all([
      loadStory(storyUrlFromLocation(), { signal: loadController.signal }),
      loadCharacterArt({ signal: loadController.signal }),
    ]);
    state.story = story;
    initialiseWorld(art);
    showIntro();
  } catch (err) {
    if (err.name !== 'AbortError') showError(err);
  }
}

/* ------------------------------------------------------------ world setup */
let worldReady = false;
function initialiseWorld(art) {
  const { story } = state;
  if (!worldReady) {
    world = new World(stage);
    world.build();
    cast = new Cast(stage.querySelector('[data-layer="cast"]'));
    for (const [id, svgText] of Object.entries(art)) cast.add(id, svgText);
    atmosphere = new Atmosphere(stage, world);
    ambient = new Ambient(stage);
    narrative = new Narrative(app);
    ctx = {
      camera, world, cast, atmosphere, ambient, narrative,
      fx: {
        veil: stage.querySelector('.fx-veil'),
        clouds: [...stage.querySelectorAll('.fx-cloud')],
        branchA: stage.querySelector('.fx-branch-a'),
        branchB: stage.querySelector('.fx-branch-b'),
        mandala: stage.querySelector('.fx-mandala'),
        streaks: stage.querySelector('.fx-streaks'),
        light: stage.querySelector('.fx-light'),
      },
      markDirty: () => {},
      isLast: (scene) => scene === story.scenes[story.scenes.length - 1],
      finalLine: story.finalLine,
    };
    gsap.set([ctx.fx.veil, ...ctx.fx.clouds, ctx.fx.branchA, ctx.fx.branchB, ctx.fx.mandala, ctx.fx.streaks, ctx.fx.light], { autoAlpha: 0 });
    gsap.set(ctx.fx.clouds, { xPercent: -50, yPercent: 0 });
    gsap.set(ctx.fx.mandala, { xPercent: -50, yPercent: -50 });
    gsap.set(ctx.fx.light, { xPercent: -50, yPercent: -50 });
    narrative.buildProgress(story.scenes, (i) => commands.dispatch('goto', i, 'progress'));
    handleResize();
    window.addEventListener('resize', () => requestAnimationFrame(handleResize));
    gsap.ticker.add(renderFrame);
    initialiseParallax(stage, pointer, () => prefs.parallax && !isReduced() && finePointer.matches && world.W >= 720);
    applyMotionPreference();
    worldReady = true;
  }
  fillIntro(story);
  // the opening composition: scene 1, slightly lifted, so starting the story settles into it
  const first = story.scenes[0];
  Object.assign(camera, { x: first.camera.x - 0.12, y: first.camera.y + 0.1, zoom: 1.06 });
  atmosphere.setNow(first);
  setParallaxAmp(first);
  cast.setNow([]);
  ambient.setScene(first);
}

/* One shared frame loop: compose camera and pointer into the layer transforms. */
function renderFrame() {
  world.apply(camera, pointer, parallaxAmp);
}

function handleResize() {
  if (!world) return;
  world.layout();
  cast.layout(world.W, world.H);
  cast.refresh();
  ambient.resize(world.W, world.H, world.mobile);
  if (!ambient.reduced && state.story) ambient.setBirds((currentScene()?.ambientEffects || []).includes('birds') && !isReduced());
}

function setParallaxAmp(scene, duration = 0) {
  const p = scene.parallax || {};
  const target = {
    sky: p.sky ?? 0.1, background: p.background ?? 0.25,
    midground: p.midground ?? 0.5, foreground: p.foreground ?? 0.8,
  };
  if (duration) gsap.to(parallaxAmp, { ...target, duration });
  else Object.assign(parallaxAmp, target);
}

/* ------------------------------------------------------------ intro */
function fillIntro(story) {
  document.querySelector('.intro-title').textContent = story.title;
  document.querySelector('.intro-subtitle').textContent = story.subtitle || '';
  document.querySelector('.intro-text').textContent = story.intro || '';
  document.title = `${story.title} · ${story.subtitle || 'An illustrated story'}`;
  const about = document.querySelector('.about-body');
  about.textContent = '';
  (story.about || []).forEach((para) => {
    const p = document.createElement('p');
    p.textContent = para;
    about.appendChild(p);
  });
}

function showIntro() {
  setMode('intro');
  const intro = document.getElementById('intro');
  gsap.fromTo(intro.querySelectorAll('.intro-reveal'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: isReduced() ? 0.01 : 0.9, stagger: 0.12, ease: 'power2.out' });
  intro.querySelector('.start-button').focus({ preventScroll: true });
}

function beginStory() {
  if (state.mode !== 'intro') return;
  setMode('story');
  state.index = 0;
  const first = state.story.scenes[0];
  const intro = document.getElementById('intro');
  narrative.updateProgress(0);
  const tl = gsap.timeline();
  tl.to(intro, { autoAlpha: 0, duration: isReduced() ? 0.2 : 0.7, ease: 'power1.in' }, 0);
  if (isReduced()) {
    Object.assign(camera, { x: first.camera.x, y: first.camera.y, zoom: first.camera.zoom ?? 1 });
  } else {
    tl.to(camera, { x: first.camera.x, y: first.camera.y, zoom: first.camera.zoom ?? 1, duration: 1.8, ease: 'power2.inOut' }, 0);
  }
  tl.add(narrative.show(first, false, ''), isReduced() ? 0.2 : 1.1);
  tl.call(() => document.getElementById('passage').focus({ preventScroll: true }), null, '>');
}

/* ------------------------------------------------------------ navigation */
const currentScene = () => state.story?.scenes[state.index];

function navigateToScene(target, { jump = false } = {}) {
  const scenes = state.story.scenes;
  if (target < 0) target = scenes.length + target; // -1 → last
  target = Math.max(0, Math.min(scenes.length - 1, target));
  if (target === state.index) return;

  if (state.transitioning) {
    // Don't start a second animation on top. Hurry the current one, then queue this request.
    state.pending = { target, jump };
    state.timeline?.timeScale(3);
    return;
  }

  const from = scenes[state.index];
  const to = scenes[target];
  const direction = target > state.index ? 1 : -1;
  const adjacent = Math.abs(target - state.index) === 1;
  state.transitioning = true;
  state.index = target;
  narrative.updateProgress(target);
  app.dataset.scene = to.slug;

  const tl = buildTransition(ctx, from, to, { direction, reduced: isReduced(), jump: jump || !adjacent });
  tl.add(() => { setParallaxAmp(to, 1.2); ambient.setScene(to); }, 0);
  state.timeline = tl;
  const done = () => finishTransition(tl, to);
  tl.eventCallback('onComplete', done);
  // Safety net: interaction can never stay locked, even if a tween is interrupted.
  clearTimeout(state.watchdog);
  state.watchdog = setTimeout(() => { if (state.timeline === tl) { tl.progress(1); done(); } }, (tl.duration() + 2) * 1000);
}

function finishTransition(tl, scene) {
  if (state.timeline !== tl) return;
  clearTimeout(state.watchdog);
  state.timeline = null;
  state.transitioning = false;
  tl.kill();
  if (state.pending) {
    const { target, jump } = state.pending;
    state.pending = null;
    navigateToScene(target, { jump });
  }
}

/* ------------------------------------------------------------ commands */
commands.on('start', beginStory);
commands.on('next', () => {
  if (state.mode !== 'story') return;
  const base = state.pending ? state.pending.target : state.index;
  navigateToScene(base + 1);
});
commands.on('prev', () => {
  if (state.mode !== 'story') return;
  const base = state.pending ? state.pending.target : state.index;
  navigateToScene(base - 1);
});
commands.on('goto', (i) => { if (state.mode === 'story') navigateToScene(i, { jump: true }); });
commands.on('restart', () => {
  if (state.mode !== 'story') return;
  navigateToScene(0, { jump: true });
  setTimeout(() => document.querySelector('[data-command="next"]').focus({ preventScroll: true }), 50);
});

/* ------------------------------------------------------------ preferences UI */
function applyMotionPreference() {
  const reduced = isReduced();
  app.classList.toggle('is-reduced-motion', reduced);
  const motionBtn = document.querySelector('[data-toggle="motion"]');
  motionBtn.setAttribute('aria-pressed', String(reduced));
  motionBtn.querySelector('.toggle-state').textContent = reduced ? 'Reduced' : 'Full';
  const parallaxBtn = document.querySelector('[data-toggle="parallax"]');
  const parallaxOn = prefs.parallax && !reduced;
  parallaxBtn.setAttribute('aria-pressed', String(parallaxOn));
  parallaxBtn.querySelector('.toggle-state').textContent = parallaxOn ? 'On' : 'Off';
  parallaxBtn.disabled = reduced;
  if (!world) return;
  if (!parallaxOn) gsap.to(pointer, { x: 0, y: 0, duration: 0.6 });
  cast.reducedMotion = reduced;
  ambient.setReduced(reduced);
  cast.startIdle();
  world.piecesWith('spin').forEach((p) => {
    gsap.killTweensOf(p.el);
    if (!reduced) gsap.to(p.el, { rotation: 360, duration: p.def.spin, ease: 'none', repeat: -1 });
  });
  world.piecesWith('drift').forEach((p, i) => {
    gsap.killTweensOf(p.el);
    if (!reduced) gsap.to(p.el, { x: world.H * 0.18, duration: 14 + i * 3, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  });
  world.piecesWith('flicker').forEach((p) => {
    gsap.killTweensOf(p.el);
    if (!reduced) gsap.to(p.el, { scale: 1.04, rotation: 4, duration: 0.35, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  });
  if (state.mode === 'story' || state.mode === 'intro') ambient.setScene(currentScene() || state.story.scenes[0]);
}

document.querySelector('[data-toggle="motion"]').addEventListener('click', () => {
  prefs.motion = isReduced() ? 'full' : 'reduced';
  store.set('garuda.motion', prefs.motion);
  applyMotionPreference();
});
document.querySelector('[data-toggle="parallax"]').addEventListener('click', () => {
  prefs.parallax = !prefs.parallax;
  store.set('garuda.parallax', prefs.parallax ? 'on' : 'off');
  applyMotionPreference();
});
systemReduced.addEventListener('change', () => { if (!prefs.motion) applyMotionPreference(); });

/* ------------------------------------------------------------ wiring */
app.querySelectorAll('[data-command]').forEach((btn) => {
  btn.addEventListener('click', () => commands.dispatch(btn.dataset.command, null, 'button'));
});
document.getElementById('retry').addEventListener('click', start);

const about = document.getElementById('about');
document.querySelector('[data-open="about"]').addEventListener('click', () => about.showModal());
about.querySelector('.dialog-close').addEventListener('click', () => about.close());
about.addEventListener('click', (e) => { if (e.target === about) about.close(); });

initialiseKeyboardNavigation(commands, () => state.mode);

// Pause decorative motion while the tab is hidden.
document.addEventListener('visibilitychange', () => {
  if (!ambient) return;
  if (document.hidden) ambient.stop();
  else if (state.story) ambient.setScene(currentScene());
});

// Expose a tiny hook for future input methods (for example mudra recognition).
window.garudaStory = { dispatch: (name, arg) => commands.dispatch(name, arg, 'external') };

start();
