/*
 * atmosphere.js: the colour and light of each scene, including the sky gradient,
 * atmospheric haze, colour grade, light glow, the Madhubani frame tint,
 * sun and moon, and story props (fire ring, wheel of blades).
 * Every value comes from scene.palette, scene.sky, scene.frame and scene.props.
 */

export class Atmosphere {
  constructor(stage, world) {
    this.stage = stage;
    this.world = world;
    this.frame = stage.querySelector('.frame');
    this.corners = stage.querySelectorAll('.frame-corner');
  }

  vars(scene) {
    const p = scene.palette;
    return {
      '--sky-top': p.skyTop,
      '--sky-bottom': p.skyBottom,
      '--haze': p.haze,
      '--haze-o': p.hazeOpacity ?? 0.3,
      '--grade': p.grade,
      '--grade-o': p.gradeOpacity ?? 0.08,
      '--glow': p.glow,
      '--glow-o': p.glowOpacity ?? 0.4,
      '--glow-x': `${p.glowX ?? 50}%`,
      '--glow-y': `${p.glowY ?? 40}%`,
      '--frame-a': p.frameA,
      '--frame-b': p.frameB,
    };
  }

  /* A tween (or timeline) that blends the whole atmosphere into a scene's values. */
  tweenTo(scene, duration = 2, ease = 'sine.inOut') {
    const tl = gsap.timeline();
    tl.to(this.stage, { ...this.vars(scene), duration, ease }, 0);
    tl.to(this.world.skyBodies, { sun: scene.sky?.sun ?? 0, moon: scene.sky?.moon ?? 0, duration, ease }, 0);
    const strength = scene.frame?.strength ?? 1;
    tl.to(this.frame, { opacity: 0.35 + strength * 0.65, duration, ease }, 0);
    tl.to(this.corners, { opacity: strength, duration, ease }, 0);
    const props = {};
    for (const key of Object.keys(this.world.props)) props[key] = scene.props?.[key] ?? 0;
    if (Object.keys(props).length) tl.to(this.world.props, { ...props, duration: duration * 0.8, ease }, 0);
    return tl;
  }

  setNow(scene) {
    this.tweenTo(scene, 0).progress(1).kill();
  }
}
