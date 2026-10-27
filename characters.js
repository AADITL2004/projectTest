/*
 * characters.js: the cast. Each character is an inline SVG with jointed parts
 * (wings, arms, head, and so on) so it can change pose and move independently.
 * story.json only names a pose. How a pose looks is defined here, once.
 */

export const CHARACTER_ART = {
  garuda: { src: 'assets/characters/garuda.svg', height: 0.6, label: 'Garuda' },
  vinata: { src: 'assets/characters/vinata.svg', height: 0.5, label: 'Vinata' },
  kadru: { src: 'assets/characters/kadru.svg', height: 0.5, label: 'Kadru' },
  serpents: { src: 'assets/characters/serpents.svg', height: 0.42, label: 'The serpents' },
  guardians: { src: 'assets/characters/guardians.svg', height: 0.55, label: 'The divine guardians' },
  vishnu: { src: 'assets/characters/vishnu.svg', height: 0.66, label: 'Vishnu' },
  amrita: { src: 'assets/characters/amrita.svg', height: 0.36, label: 'The vessel of Amrita' },
};

/* Joint angles (degrees) for each named pose. `flap` is wing-beat strength. */
const GARUDA_STAND = { wingL: -92, wingR: -92, armL: 12, 'armL.fore': -6, armR: 12, 'armR.fore': -6, head: 0, flap: 0, vessel: 0, crown: 1 };
export const POSES = {
  garuda: {
    stand: GARUDA_STAND,
    young: { ...GARUDA_STAND, wingL: -80, wingR: -80, head: 6, crown: 0 },
    fly: { wingL: 0, wingR: 0, armL: 34, 'armL.fore': -24, armR: 34, 'armR.fore': -24, head: -4, flap: 1, vessel: 0, crown: 1 },
    rise: { wingL: 30, wingR: 30, armL: 52, 'armL.fore': -40, armR: 52, 'armR.fore': -40, head: -12, flap: 0.25, vessel: 0, crown: 1 },
    carry: { wingL: 12, wingR: 12, armL: 156, 'armL.fore': 40, armR: 156, 'armR.fore': 40, head: -10, flap: 0.18, vessel: 1, crown: 1 },
    bow: { wingL: -58, wingR: -58, armL: -14, 'armL.fore': -112, armR: -14, 'armR.fore': -112, head: 16, flap: 0, vessel: 0, crown: 1 },
  },
  vinata: {
    stand: { armR: -6, 'armR.fore': -4, head: 0 },
    tender: { armR: -34, 'armR.fore': -46, head: 16 },
    sorrow: { armR: 4, 'armR.fore': -14, head: 20 },
    bless: { armR: -150, 'armR.fore': 18, head: -6 },
    joy: { armR: -165, 'armR.fore': 8, head: -10 },
  },
  kadru: {
    stand: { armR: -6, 'armR.fore': -4, head: 0 },
    proud: { armR: -10, 'armR.fore': -8, head: -8 },
    command: { armR: -96, 'armR.fore': -8, head: -6 },
  },
  serpents: { sway: {} },
  guardians: { stand: {} },
  vishnu: { grace: { head: 0 } },
  amrita: { guarded: { kusha: 0 }, rest: { kusha: 1 } },
};

export class Cast {
  constructor(layer) {
    this.layer = layer;
    this.members = {};
    this.W = 1; this.H = 1;
    this.reducedMotion = false;
  }

  /* Adds a character from SVG text that has already been fetched. */
  add(id, svgText) {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const svg = doc.documentElement;
    if (svg.nodeName !== 'svg') throw new Error(`Character art for "${id}" is not valid SVG.`);
    const node = document.importNode(svg, true);
    node.setAttribute('aria-hidden', 'true');
    node.setAttribute('focusable', 'false');
    node.removeAttribute('width');
    node.removeAttribute('height');
    // make gradient ids unique per document
    node.querySelectorAll('[id]').forEach((el) => {
      const old = el.id, neu = `${id}-${old}`;
      el.id = neu;
      node.querySelectorAll(`[fill="url(#${old})"]`).forEach((r) => r.setAttribute('fill', `url(#${neu})`));
    });

    const vb = node.viewBox.baseVal;
    const wrap = document.createElement('div');
    wrap.className = 'character';
    wrap.dataset.character = id;
    const facing = document.createElement('div');
    facing.className = 'facing';
    const bob = document.createElement('div');
    bob.className = 'bob';
    bob.appendChild(node);
    facing.appendChild(bob);
    wrap.appendChild(facing);
    this.layer.appendChild(wrap);

    // Collect jointed parts. Nested joints get keys such as "armL.fore".
    const rig = {};
    node.querySelectorAll('[data-rig]').forEach((el) => {
      const parent = el.parentElement.closest('[data-rig]');
      const key = parent ? `${parent.dataset.rig}.${el.dataset.rig}` : el.dataset.rig;
      rig[key] = el;
    });

    const footFrac = (0 - vb.y) / vb.height;
    const m = {
      id, wrap, facing, bob, svg: node, rig,
      aspect: vb.width / vb.height,
      footFrac,
      art: CHARACTER_ART[id],
      pose: { ...(Object.values(POSES[id])[0] || {}) },
      flap: { t: 0 },
      visible: false,
      spec: null,
      idle: [],
      vessel: node.querySelector('.g-vessel'),
      crown: node.querySelector('.g-crown'),
      kusha: node.querySelector('.a-kusha'),
    };
    this.members[id] = m;
    gsap.set(wrap, { autoAlpha: 0, xPercent: -50, yPercent: -footFrac * 100, transformOrigin: `50% ${footFrac * 100}%` });
    this.applyRig(m);
    return m;
  }

  layout(W, H) {
    this.W = W; this.H = H;
    for (const m of Object.values(this.members)) {
      const h = m.art.height * H;
      m.wrap.style.height = `${h}px`;
      m.wrap.style.width = `${h * m.aspect}px`;
    }
  }

  /* Screen position for a JSON spec. Narrow screens pull characters toward the centre. */
  target(spec) {
    const ratio = this.W / this.H;
    const k = Math.min(1, Math.max(0.6, ratio / 1.6));
    const sk = Math.min(1, Math.max(0.68, ratio / 1.35));
    return {
      x: ((50 + (spec.x - 50) * k) / 100) * this.W,
      y: (spec.y / 100) * this.H,
      scale: (spec.scale ?? 1) * sk,
      facing: spec.facing === 'left' ? -1 : 1,
    };
  }

  applyRig(m) {
    const p = m.pose;
    const beat = (p.flap || 0) * m.flap.t * 24;
    for (const [key, el] of Object.entries(m.rig)) {
      let a = p[key];
      if (key === 'wingL' || key === 'wingR') a = (a || 0) + beat;
      if (key === 'halo') a = m.haloAngle || 0;
      if (key.startsWith('naga') || key.startsWith('deva')) a = m.sway?.[key] || 0;
      if (a !== undefined) el.setAttribute('transform', `rotate(${a.toFixed(2)})`);
    }
    if (m.vessel) m.vessel.setAttribute('opacity', (p.vessel ?? 0).toFixed(3));
    if (m.crown) m.crown.setAttribute('opacity', (p.crown ?? 1).toFixed(3));
    if (m.kusha) m.kusha.setAttribute('opacity', (p.kusha ?? 0).toFixed(3));
  }

  /* Returns a tween that blends a character's joints into a named pose. */
  poseTween(m, poseName, duration = 0.8) {
    const target = POSES[m.id]?.[poseName];
    if (!target) return gsap.to({}, { duration: 0.01 });
    return gsap.to(m.pose, { ...target, duration, ease: 'power2.inOut', onUpdate: () => this.applyRig(m) });
  }

  setPoseNow(m, poseName) {
    const target = POSES[m.id]?.[poseName];
    if (target) Object.assign(m.pose, target);
    this.applyRig(m);
  }

  /*
   * Adds the cast changes for a scene change to a transition timeline.
   * mode "move": characters in both scenes travel continuously to their new marks.
   * mode "cut": everything changes at `at`, while the frame is covered by clouds, branches and so on.
   */
  addToTimeline(tl, specs, { mode = 'move', at = 0, duration = 1.6, cutAt = 0.5 } = {}) {
    const next = new Map(specs.map((s) => [s.id, s]));
    for (const m of Object.values(this.members)) {
      const spec = next.get(m.id);
      if (!spec) {
        if (m.visible) {
          tl.to(m.wrap, { autoAlpha: 0, duration: 0.5, ease: 'power1.in' }, mode === 'cut' ? Math.max(0, cutAt - 0.5) : at);
          m.visible = false;
        }
        continue;
      }
      const t = this.target(spec);
      const wasVisible = m.visible;
      m.visible = true;
      m.spec = spec;
      if (mode === 'cut' || !wasVisible) {
        const when = mode === 'cut' ? cutAt : at + duration * 0.45;
        if (wasVisible && mode === 'cut') tl.to(m.wrap, { autoAlpha: 0, duration: 0.4 }, Math.max(0, cutAt - 0.45));
        tl.set(m.wrap, { x: t.x, y: t.y + this.H * 0.03, scale: t.scale }, when);
        tl.set(m.facing, { scaleX: t.facing }, when);
        tl.call(() => this.setPoseNow(m, spec.pose), null, when);
        tl.to(m.wrap, { autoAlpha: 1, y: t.y, duration: 0.9, ease: 'power2.out' }, when + 0.05);
      } else {
        tl.to(m.wrap, { x: t.x, y: t.y, scale: t.scale, duration, ease: 'power2.inOut' }, at);
        const curFacing = gsap.getProperty(m.facing, 'scaleX');
        if (Math.sign(curFacing) !== t.facing) tl.to(m.facing, { scaleX: t.facing, duration: 0.5, ease: 'power2.inOut' }, at + 0.1);
        tl.add(this.poseTween(m, spec.pose, Math.min(1, duration * 0.6)), at + 0.1);
      }
    }
  }

  /* Places the cast for a scene immediately (resize, reduced motion, first render). */
  setNow(specs) {
    const next = new Map(specs.map((s) => [s.id, s]));
    for (const m of Object.values(this.members)) {
      const spec = next.get(m.id);
      if (!spec) { gsap.set(m.wrap, { autoAlpha: 0 }); m.visible = false; continue; }
      const t = this.target(spec);
      gsap.set(m.wrap, { x: t.x, y: t.y, scale: t.scale, autoAlpha: 1 });
      gsap.set(m.facing, { scaleX: t.facing });
      this.setPoseNow(m, spec.pose);
      m.visible = true;
      m.spec = spec;
    }
  }

  /* Re-measures current marks after a resize without replaying anything. */
  refresh() {
    for (const m of Object.values(this.members)) {
      if (!m.visible || !m.spec) continue;
      const t = this.target(m.spec);
      gsap.set(m.wrap, { x: t.x, y: t.y, scale: t.scale });
    }
  }

  /* A few long-running idle loops (breathing, wing beats, swaying hoods). */
  startIdle() {
    this.stopIdle();
    if (this.reducedMotion) {
      for (const m of Object.values(this.members)) { m.flap.t = 0; this.applyRig(m); }
      return;
    }
    for (const m of Object.values(this.members)) {
      const loops = [];
      loops.push(gsap.to(m.bob, { y: m.id === 'garuda' ? -8 : -3, duration: m.id === 'garuda' ? 1.1 : 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
      if (m.id === 'garuda') {
        m.flap.t = -1;
        loops.push(gsap.to(m.flap, { t: 1, duration: 0.55, ease: 'sine.inOut', yoyo: true, repeat: -1, onUpdate: () => { if (m.visible && m.pose.flap) this.applyRig(m); } }));
      }
      if (m.id === 'serpents' || m.id === 'guardians') {
        m.sway = {};
        Object.keys(m.rig).forEach((k, i) => {
          m.sway[k] = 0;
          const amp = m.id === 'serpents' ? 4 : 1.2;
          loops.push(gsap.fromTo(m.sway, { [k]: -amp }, { [k]: amp, duration: 1.8 + i * 0.37, ease: 'sine.inOut', yoyo: true, repeat: -1, onUpdate: () => m.visible && this.applyRig(m) }));
        });
      }
      if (m.id === 'vishnu') {
        m.haloAngle = 0;
        loops.push(gsap.to(m, { haloAngle: 360, duration: 90, ease: 'none', repeat: -1, onUpdate: () => m.visible && this.applyRig(m) }));
      }
      if (m.id === 'amrita') {
        const glow = m.svg.querySelector('.a-glow');
        const spark = m.svg.querySelector('.a-spark');
        if (glow) loops.push(gsap.to(glow, { opacity: 0.65, duration: 1.6, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
        if (spark) loops.push(gsap.to(spark, { y: -10, opacity: 0.5, duration: 2.2, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
      }
      m.idle = loops;
    }
  }

  stopIdle() {
    for (const m of Object.values(this.members)) {
      m.idle.forEach((t) => t.kill());
      m.idle = [];
      gsap.set(m.bob, { y: 0 });
    }
  }
}
