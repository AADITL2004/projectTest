/*
 * world.js: the persistent illustrated world and its camera.
 *
 * The story world is one large landscape, not 20 separate backdrops. The forest
 * and wilderness run left to right along the ground, and the heavens sit "above"
 * the earth. Every piece of scenery has a fixed world position. Each scene in
 * story.json only says where the camera should be, so moving between scenes
 * really does travel through the landscape.
 *
 * Units: world x is measured in WX stage-heights, world y (altitude) in stage-heights.
 * Each layer has a depth factor. A layer moves by camera * depth, so far mountains
 * drift slowly while foreground branches rush past. That is the parallax.
 */

export const WX = 1.6; // one world-x unit, in stage heights

export const LAYERS = {
  sky: { depth: 0.02, group: 'sky' },
  far: { depth: 0.2, group: 'background' },
  back: { depth: 0.45, group: 'background' },
  main: { depth: 1, group: 'midground' },
  fore: { depth: 1.5, group: 'foreground' },
};

const A = 'assets/';
// Shorthand to repeat a piece at several world x positions.
const at = (base, xs, extra = {}) => xs.map((x, i) => ({ ...base, ...extra, id: `${extra.id || base.id}-${i}`, x }));

const meadow = { id: 'meadow', src: A + 'backgrounds/meadow.svg', layer: 'main', h: 0.3, aspect: 2600 / 320, bleed: 0.03, vis: { x: [-2, 4.9], y: [-1, 1.1] } };
const rocky = { id: 'rocky', src: A + 'backgrounds/rocky-ground.svg', layer: 'main', h: 0.3, aspect: 2600 / 320, bleed: 0.03, vis: { x: [4.5, 9.7], y: [-1, 1.1] } };
const grass = { id: 'grass', src: A + 'foreground/fore-grass.svg', layer: 'fore', h: 0.26, aspect: 1500 / 340, bleed: 0.04, vis: { x: [-2, 4.8], y: [-1, 0.6] } };
const rocks = { id: 'rocks', src: A + 'foreground/fore-rocks.svg', layer: 'fore', h: 0.24, aspect: 1500 / 340, bleed: 0.04, vis: { x: [4.7, 8.2], y: [-1, 0.6] } };
const branch = { id: 'branch', src: A + 'foreground/fore-branch.svg', layer: 'fore', h: 0.5, aspect: 1300 / 760, anchor: 'top', bleed: 0.03, vis: { x: [-2, 4.9], y: [-1, 0.6] } };
const tallTree = { id: 'tall-tree', src: A + 'backgrounds/tall-tree.svg', layer: 'main', h: 1.0, aspect: 620 / 1150, bleed: -0.16, vis: { x: [3.3, 5.0], y: [-1, 1] } };
const flowerTree = { id: 'flower-tree', src: A + 'backgrounds/flower-tree.svg', layer: 'main', h: 0.92, aspect: 0.9, bleed: -0.17, vis: { x: [-2, 4.9], y: [-1, 1] } };
const skyCloud = { id: 'sky-cloud', src: A + 'backgrounds/small-cloud.svg', layer: 'back', h: 0.17, aspect: 2, anchor: 'top', drift: true, vis: { x: [-2, 12], y: [-1, 1.1] } };
const cloudFloor = { id: 'cloud-floor', src: A + 'backgrounds/cloud-floor.svg', layer: 'main', h: 0.32, aspect: 7, bleed: 0.06, vis: { x: [8.5, 13], y: [1.75, 3] }, fade: 0.3 };
const cloudSea = { id: 'cloud-sea', src: A + 'backgrounds/cloud-floor.svg', layer: 'main', h: 0.4, aspect: 7, bleed: 0.06, vis: { x: [7.5, 12], y: [1.0, 1.9] }, fade: 0.3 };
const foreCloud = { id: 'fore-cloud', src: A + 'foreground/fore-clouds.svg', layer: 'fore', h: 0.42, aspect: 2000 / 560, bleed: 0.05 };

export const PIECES = [
  // ---- sky bodies (screen-fixed, faded per scene)
  { id: 'sun', src: A + 'decorative/sun.svg', layer: 'sky', screen: [0.8, 0.2], h: 0.27, aspect: 1, skyBody: 'sun', spin: 240 },
  { id: 'moon', src: A + 'decorative/moon.svg', layer: 'sky', screen: [0.2, 0.17], h: 0.2, aspect: 320 / 340, skyBody: 'moon' },

  // ---- far layer
  { id: 'far-hills', src: A + 'backgrounds/far-hills.svg', layer: 'far', x: 2.2, h: 0.6, aspect: 2800 / 420, bleed: -0.06, vis: { x: [-2, 4.4], y: [-1, 0.9] }, fade: 0.35 },
  { id: 'far-mountains', src: A + 'backgrounds/far-mountains.svg', layer: 'far', x: 7, h: 0.66, aspect: 5, bleed: -0.04, vis: { x: [4.2, 10.4], y: [-1, 0.9] }, fade: 0.35 },
  { id: 'far-palaces', src: A + 'backgrounds/far-palaces.svg', layer: 'far', x: 10.3, y: 2.2, h: 0.62, aspect: 3.75, bleed: -0.25, vis: { x: [8.5, 13], y: [1.75, 3] }, fade: 0.3 },

  // ---- back layer
  ...at({ id: 'treeline', src: A + 'backgrounds/treeline.svg', layer: 'back', h: 0.36, aspect: 2600 / 460, bleed: -0.02, vis: { x: [-2, 5.1], y: [-1, 1.0] } }, [0, 3.6]),
  ...at({ id: 'mesas', src: A + 'backgrounds/mesas.svg', layer: 'back', h: 0.5, aspect: 5, bleed: -0.03, vis: { x: [4.6, 9.6], y: [-1, 1.1] } }, [5.6, 7.8]),
  ...at(skyCloud, [-0.5], { dy: 0.1 }), ...at(skyCloud, [0.9], { dy: 0.04, id: 'sky-cloud-b' }), ...at(skyCloud, [2.6], { dy: 0.12, id: 'sky-cloud-c' }),
  ...at(skyCloud, [4.3], { dy: 0.06, id: 'sky-cloud-d' }), ...at(skyCloud, [6.2], { dy: 0.1, id: 'sky-cloud-e' }), ...at(skyCloud, [8.2], { dy: 0.05, id: 'sky-cloud-f' }),
  { id: 'back-clouds', src: A + 'backgrounds/back-clouds.svg', layer: 'back', x: 9.3, y: 1.15, h: 0.6, aspect: 2400 / 520, bleed: -0.18, vis: { x: [7.6, 12], y: [0.95, 1.9] }, fade: 0.3 },
  { id: 'back-clouds-heaven', src: A + 'backgrounds/back-clouds.svg', layer: 'back', x: 10.6, y: 2.15, h: 0.7, aspect: 2400 / 520, bleed: -0.16, vis: { x: [8.6, 13], y: [1.75, 3] }, fade: 0.3 },
  { id: 'heaven-pavilions', src: A + 'backgrounds/heaven-pavilions.svg', layer: 'back', x: 10.2, y: 2.2, h: 0.56, aspect: 2400 / 760, bleed: -0.17, vis: { x: [8.8, 12.2], y: [1.75, 3] }, fade: 0.3 },

  // ---- main layer: the ground the characters stand on
  ...at(meadow, [-0.8, 0.6, 2.0, 3.4, 4.8]),
  ...at(rocky, [5.8, 7.2, 8.6]),
  ...at(flowerTree, [-0.62], { h: 0.98 }), ...at(flowerTree, [0.98], { id: 'flower-tree-b' }), ...at(flowerTree, [4.75], { id: 'flower-tree-c', h: 0.8 }),
  { id: 'pavilion', src: A + 'backgrounds/pavilion.svg', layer: 'main', x: 1.82, h: 0.66, aspect: 1500 / 900, bleed: -0.16, vis: { x: [1.0, 2.7], y: [-1, 1] } },
  { id: 'knoll', src: A + 'backgrounds/knoll.svg', layer: 'main', x: 2.45, h: 0.56, aspect: 2.5, bleed: -0.08, vis: { x: [2.32, 2.6], y: [-1, 1] }, fade: 0.14 },
  { id: 'serpent-mound', src: A + 'backgrounds/serpent-mound.svg', layer: 'main', x: 3.3, h: 0.55, aspect: 1300 / 680, bleed: -0.16, vis: { x: [2.65, 3.85], y: [-1, 1] } },
  ...at(tallTree, [3.82, 4.62]),
  { id: 'banyan-lake', src: A + 'backgrounds/banyan-lake.svg', layer: 'main', x: 7.3, h: 0.78, aspect: 2000 / 900, bleed: -0.12, vis: { x: [6.8, 8.0], y: [-1, 1] }, fade: 0.3 },
  { id: 'threshold-peak', src: A + 'backgrounds/threshold-peak.svg', layer: 'main', x: 8.55, h: 1.25, aspect: 1400 / 1300, bleed: -0.06, vis: { x: [7.9, 9.0], y: [-1, 1.0] } },
  { id: 'pass-rocks', src: A + 'backgrounds/pass-rocks.svg', layer: 'main', x: 9.05, y: 0.45, h: 1.2, aspect: 2000 / 1100, bleed: 0.06, vis: { x: [8.85, 9.6], y: [0.2, 1.1] }, fade: 0.2 },
  ...at(cloudSea, [8.6, 9.6, 10.6], { y: 1.2 }),
  ...at(cloudFloor, [9.4, 10.6, 11.8], { y: 2.2 }),
  { id: 'heaven-court', src: A + 'backgrounds/heaven-court.svg', layer: 'main', x: 9.65, y: 2.2, h: 0.8, aspect: 1800 / 1100, bleed: -0.03, vis: { x: [9.0, 10.0], y: [1.75, 3] }, fade: 0.3 },
  { id: 'chamber', src: A + 'backgrounds/chamber.svg', layer: 'main', x: 10.25, y: 2.2, h: 1.12, aspect: 1800 / 1100, bleed: 0.06, vis: { x: [10.0, 10.5], y: [1.8, 3] }, fade: 0.25 },
  { id: 'fire-ring', src: A + 'backgrounds/fire-ring.svg', layer: 'main', x: 10.25, y: 2.2, h: 0.44, aspect: 1, anchor: 'center', cy: 0.6, prop: 'fire-ring', flicker: true, vis: { x: [10.0, 10.5], y: [1.8, 3] }, fade: 0.25 },
  { id: 'wheel', src: A + 'backgrounds/wheel.svg', layer: 'main', x: 10.25, y: 2.2, h: 0.54, aspect: 1, anchor: 'center', cy: 0.6, prop: 'wheel', spin: 6, vis: { x: [10.0, 10.5], y: [1.8, 3] }, fade: 0.25 },

  // ---- foreground layer
  ...at(grass, [-1.0, -0.5, 0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5], { mobileEvery: 2 }),
  ...at(rocks, [5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0], { mobileEvery: 2 }),
  ...at(branch, [-0.32], {}), ...at(branch, [1.18], { id: 'branch-b', flip: true }),
  ...at(branch, [3.86], { id: 'branch-c' }), ...at(branch, [4.5], { id: 'branch-d', flip: true }),
  ...at(foreCloud, [8.95, 9.65], { y: 1.25, vis: { x: [8, 10.5], y: [0.95, 1.75] }, fade: 0.3 }),
  ...at(foreCloud, [9.6, 11.1], { y: 2.2, id: 'fore-cloud-h', vis: { x: [8.8, 12.5], y: [1.75, 3] } }),
  { id: 'fore-lotus', src: A + 'foreground/fore-lotus.svg', layer: 'fore', x: 10.25, y: 2.2, h: 0.2, aspect: 1500 / 340, bleed: 0.04, vis: { x: [10.0, 10.5], y: [1.8, 3] }, fade: 0.25 },
];

const clamp01 = (v) => Math.max(0, Math.min(1, v));
function band(v, [a, b], fade) {
  if (v < a) return clamp01(1 - (a - v) / fade);
  if (v > b) return clamp01(1 - (v - b) / fade);
  return 1;
}

export class World {
  constructor(stage) {
    this.stage = stage;
    this.layers = {};
    stage.querySelectorAll('[data-layer]').forEach((el) => { this.layers[el.dataset.layer] = el; });
    this.pieces = [];
    this.props = {};          // prop id -> opacity multiplier (tweened by transitions)
    this.skyBodies = { sun: 1, moon: 0 };
    this.W = 1; this.H = 1;
    this.mobile = false;
  }

  build() {
    const frag = {};
    for (const def of PIECES) {
      const img = document.createElement('img');
      img.src = def.src;
      img.alt = '';
      img.decoding = 'async';
      img.draggable = false;
      img.className = 'piece' + (def.flip ? ' is-flipped' : '');
      img.dataset.piece = def.id;
      (frag[def.layer] ||= document.createDocumentFragment()).appendChild(img);
      const p = { def, el: img, shown: true, op: -1 };
      this.pieces.push(p);
      if (def.prop && !(def.prop in this.props)) this.props[def.prop] = 0;
    }
    for (const [layer, f] of Object.entries(frag)) this.layers[layer].appendChild(f);
  }

  /* Pixel layout. Runs on load and on resize only, never per frame. */
  layout() {
    const W = this.stage.clientWidth, H = this.stage.clientHeight;
    this.W = W; this.H = H;
    this.mobile = W < 720;
    for (const p of this.pieces) {
      const d = p.def;
      const depth = LAYERS[d.layer].depth;
      const h = d.h * H, w = h * d.aspect;
      let left, top;
      if (d.screen) {
        left = d.screen[0] * W - w / 2;
        top = d.screen[1] * H - h / 2;
      } else {
        const cx = W / 2 + (d.x || 0) * depth * WX * H;
        left = cx - w / 2;
        const lift = (d.y || 0) * depth * H;
        const anchor = d.anchor || 'bottom';
        if (anchor === 'bottom') top = H * (1 + (d.bleed || 0)) - lift - h;
        else if (anchor === 'top') top = -H * (d.bleed || 0) - lift + (d.dy || 0) * H;
        else top = H * d.cy - lift - h / 2;
      }
      // Fewer foreground elements on small screens keep phone compositions readable.
      p.mobileHidden = this.mobile && d.mobileEvery && (Number(d.id.split('-').pop()) % d.mobileEvery === 1);
      p.box = { left, top, w, h, depth };
      Object.assign(p.el.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px` });
    }
  }

  /*
   * Compose camera + pointer offsets into one transform per layer, and fade
   * pieces in or out depending on where the camera is. Called from one shared
   * ticker, so there is a single animation loop for the whole world.
   */
  apply(cam, pointer, amp) {
    const { W, H } = this;
    for (const [name, cfg] of Object.entries(LAYERS)) {
      const el = this.layers[name];
      if (!el) continue;
      const d = cfg.depth;
      const pa = amp[cfg.group] ?? 0.3;
      const px = -pointer.x * pa * W * 0.022 * (name === 'back' ? 1.4 : 1);
      const py = -pointer.y * pa * H * 0.014;
      const tx = -cam.x * d * WX * H + px + cam.shakeX * d;
      const ty = cam.y * d * H + py + cam.shakeY * d;
      const s = 1 + (cam.zoom - 1) * Math.min(d, 1.3);
      // scale first (about the stage centre), then translate: the camera's focus stays centred at any zoom
      el.style.transform = `scale(${s.toFixed(4)}) translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0)`;
      if (name === 'main') this.mainOffset = { px, py };
    }
    for (const p of this.pieces) {
      const d = p.def;
      let op = 1;
      if (d.skyBody) op = this.skyBodies[d.skyBody];
      else {
        const f = d.fade ?? 0.45;
        if (d.vis) op = Math.min(band(cam.x, d.vis.x, f), band(cam.y, d.vis.y, f));
        if (d.prop) op *= this.props[d.prop] ?? 0;
        if (p.mobileHidden) op = 0;
        if (op > 0 && p.box) {
          // cull pieces that are far outside the frame
          const cx = p.box.left + p.box.w / 2 - cam.x * p.box.depth * WX * H;
          if (Math.abs(cx - W / 2) - p.box.w / 2 > W * 0.9 + H * 0.4) op = 0;
        }
      }
      const shown = op > 0.003;
      if (shown !== p.shown) { p.el.style.visibility = shown ? 'visible' : 'hidden'; p.shown = shown; }
      if (shown && Math.abs(op - p.op) > 0.004) { p.el.style.opacity = op.toFixed(3); p.op = op; }
    }
  }

  piecesWith(key) { return this.pieces.filter((p) => p.def[key]); }
}
