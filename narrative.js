/*
 * narrative.js: the book-like passage panel, progress indicator and nav state.
 * Text always goes in with textContent and never with innerHTML.
 */

export class Narrative {
  constructor(root) {
    this.root = root;
    this.panel = root.querySelector('#passage');
    this.chapter = this.panel.querySelector('.chapter');
    this.title = this.panel.querySelector('.passage-title');
    this.text = this.panel.querySelector('.passage-text');
    this.desc = this.panel.querySelector('.scene-desc');
    this.finalLine = this.panel.querySelector('.final-line');
    this.restart = root.querySelector('[data-command="restart"]');
    this.prev = root.querySelector('[data-command="prev"]');
    this.next = root.querySelector('[data-command="next"]');
    this.counter = root.querySelector('.counter');
    this.progressList = root.querySelector('.progress-list');
    this.dots = [];
  }

  buildProgress(scenes, onJump) {
    this.total = scenes.length;
    this.progressList.textContent = '';
    scenes.forEach((s, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'progress-dot';
      b.dataset.index = String(i);
      b.setAttribute('aria-label', `Passage ${i + 1} of ${scenes.length}: ${s.title}`);
      b.title = `${i + 1}. ${s.title}`;
      b.addEventListener('click', () => onJump(i));
      li.appendChild(b);
      this.progressList.appendChild(li);
      this.dots.push(b);
    });
  }

  /* Updates progress immediately when navigation starts so feedback is instant. */
  updateProgress(index) {
    this.dots.forEach((d, i) => {
      d.classList.toggle('is-past', i < index);
      if (i === index) d.setAttribute('aria-current', 'step');
      else d.removeAttribute('aria-current');
    });
    const n = String(index + 1).padStart(2, '0');
    this.counter.textContent = `${n} / ${String(this.total).padStart(2, '0')}`;
    this.prev.disabled = index === 0;
    const last = index === this.total - 1;
    this.next.disabled = last;
    this.next.hidden = last;
    this.restart.hidden = !last;
  }

  fill(scene, isLast, finalLine) {
    this.panel.dataset.side = scene.panel === 'right' ? 'right' : 'left';
    this.chapter.textContent = scene.chapter || '';
    this.title.textContent = scene.title;
    this.text.textContent = scene.text;
    this.desc.textContent = scene.description ? `Illustration: ${scene.description}` : '';
    this.finalLine.hidden = !isLast;
    this.finalLine.textContent = isLast ? finalLine || '' : '';
  }

  hide(duration = 0.35) {
    return gsap.to(this.panel, { autoAlpha: 0, y: 12, duration, ease: 'power1.in' });
  }

  show(scene, isLast, finalLine, duration = 0.7) {
    const tl = gsap.timeline();
    tl.call(() => this.fill(scene, isLast, finalLine));
    tl.fromTo(this.panel, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration, ease: 'power2.out' });
    if (isLast) tl.fromTo(this.finalLine, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2 }, '+=0.4');
    return tl;
  }
}
