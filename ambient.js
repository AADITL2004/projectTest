/*
 * ambient.js: environmental life such as petals, leaves, dust, golden motes,
 * birds, light rays and wind. All particles share one canvas and one ticker
 * callback instead of hundreds of DOM nodes or separate loops.
 */

const SHAPES = {
  petals: { size: [5, 9], speed: [18, 38], drift: 30, spin: 1.2, fall: 1 },
  leaves: { size: [6, 11], speed: [40, 80], drift: 60, spin: 2, fall: 0.6 },
  dust: { size: [1.2, 3], speed: [30, 70], drift: 10, spin: 0, fall: -0.05 },
  motes: { size: [1.5, 3.5], speed: [6, 16], drift: 14, spin: 0, fall: -0.4 },
  embers: { size: [1.5, 3.2], speed: [20, 40], drift: 18, spin: 0, fall: -1 },
};
const PARTICLE_TYPES = Object.keys(SHAPES);

const rand = (a, b) => a + Math.random() * (b - a);

export class Ambient {
  constructor(stage) {
    this.stage = stage;
    this.canvas = stage.querySelector('.particles');
    this.ctx = this.canvas.getContext('2d');
    this.rays = stage.querySelector('.rays');
    this.wind = stage.querySelector('.wind');
    this.birds = [...stage.querySelectorAll('.bird')];
    this.particles = [];
    this.types = [];
    this.colors = ['#FFF3D8'];
    this.reduced = false;
    this.running = false;
    this.windBoost = 0;
    this.loops = [];
    this.tick = this.tick.bind(this);
  }

  resize(W, H, mobile) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = W; this.H = H; this.mobile = mobile;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  spawn(type, anywhere) {
    const s = SHAPES[type];
    const p = {
      type,
      x: rand(-20, this.W + 20),
      y: anywhere ? rand(0, this.H) : (s.fall >= 0 ? rand(-40, -10) : rand(this.H + 10, this.H + 40)),
      size: rand(...s.size),
      vx: rand(s.speed[0], s.speed[1]) * (type === 'leaves' || type === 'dust' ? 1 : rand(-0.4, 0.6)),
      vy: rand(s.speed[0], s.speed[1]) * s.fall,
      rot: rand(0, Math.PI * 2),
      vr: rand(-s.spin, s.spin),
      phase: rand(0, Math.PI * 2),
      color: this.colors[Math.floor(Math.random() * this.colors.length)],
      alpha: type === 'motes' ? rand(0.35, 0.9) : rand(0.6, 0.95),
    };
    if (type === 'dust' || type === 'leaves') p.x = anywhere ? p.x : rand(-60, -10), p.y = anywhere ? p.y : rand(0, this.H);
    return p;
  }

  /* Called whenever a scene settles. Effects come from scene.ambientEffects in story.json. */
  setScene(scene) {
    const fx = new Set(scene.ambientEffects || []);
    this.colors = scene.palette?.particles?.length ? scene.palette.particles : ['#FFF3D8'];
    this.types = PARTICLE_TYPES.filter((t) => fx.has(t));
    const budget = this.reduced ? 0 : (this.mobile ? 22 : 54);
    this.target = this.types.length ? Math.round(budget / this.types.length) : 0;
    // recolour particles that stay, so the palette changes smoothly
    this.particles.forEach((p) => { if (Math.random() < 0.5) p.color = this.colors[Math.floor(Math.random() * this.colors.length)]; });
    gsap.to(this.rays, { opacity: fx.has('rays') && !this.reduced ? 1 : 0, duration: 1.6 });
    this.setWind(fx.has('wind') && !this.reduced);
    this.setBirds(fx.has('birds') && !this.reduced);
    this.start();
  }

  burst(type, n = 24) {
    if (this.reduced || !SHAPES[type]) return;
    for (let i = 0; i < n; i++) {
      const p = this.spawn(type, true);
      p.burst = true;
      this.particles.push(p);
    }
    this.start();
  }

  setWind(on) {
    gsap.to(this.wind, { opacity: on ? 0.85 : 0, duration: 0.8 });
    this.windBoost = on ? 1 : 0;
  }

  setBirds(on) {
    this.loops.forEach((t) => t.kill());
    this.loops = [];
    this.birds.forEach((b, i) => {
      if (!on) { gsap.to(b, { opacity: 0, duration: 0.6 }); return; }
      const y = 0.12 + i * 0.07;
      const tl = gsap.timeline({ repeat: -1, delay: i * 2.6 });
      tl.fromTo(b, { x: -80, y: this.H * y, opacity: 1 }, { x: this.W + 80, y: this.H * (y - 0.05), duration: 16 + i * 3, ease: 'none' });
      this.loops.push(tl);
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    gsap.ticker.add(this.tick);
  }

  stop() {
    this.running = false;
    gsap.ticker.remove(this.tick);
  }

  setReduced(r) {
    this.reduced = r;
    if (r) {
      this.particles = [];
      this.ctx.clearRect(0, 0, this.W, this.H);
      this.setWind(false);
      this.setBirds(false);
      gsap.to(this.rays, { opacity: 0, duration: 0.3 });
    }
  }

  tick() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const { ctx, W, H } = this;
    // top up the particle count gradually
    const live = this.particles.filter((p) => !p.burst).length;
    if (live < this.target * this.types.length && Math.random() < 0.3) {
      const type = this.types[Math.floor(Math.random() * this.types.length)];
      this.particles.push(this.spawn(type, live === 0));
    }
    ctx.clearRect(0, 0, W, H);
    const wind = 1 + this.windBoost * 2.5;
    this.particles = this.particles.filter((p) => {
      p.phase += dt * 1.6;
      p.x += (p.vx * wind + Math.sin(p.phase) * SHAPES[p.type].drift * 0.6) * dt;
      p.y += p.vy * dt + Math.cos(p.phase * 0.7) * 6 * dt;
      p.rot += p.vr * dt;
      if (p.burst) p.alpha -= dt * 0.35;
      const out = p.x < -80 || p.x > W + 80 || p.y < -60 || p.y > H + 60 || p.alpha <= 0;
      const typeGone = !p.burst && !this.types.includes(p.type);
      if (typeGone) p.alpha -= dt * 0.8;
      if (out || p.alpha <= 0) return false;
      this.draw(p);
      return true;
    });
    if (!this.particles.length && !this.types.length) { ctx.clearRect(0, 0, W, H); this.stop(); }
  }

  draw(p) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.type === 'petals' || p.type === 'leaves') {
      const s = p.size;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(s * 0.8, 0, 0, s);
      ctx.quadraticCurveTo(-s * 0.8, 0, 0, -s);
      ctx.fill();
      ctx.strokeStyle = 'rgba(53,44,54,0.55)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
      if (p.type === 'motes' || p.type === 'embers') {
        ctx.globalAlpha *= 0.25;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
