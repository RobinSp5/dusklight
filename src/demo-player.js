// Plays a scripted demo scene (src/demos.js) on the real simulation in a small canvas.
// Used by the onboarding tutorial and the wardrobe preview.
import { TILE as T } from './levels.js';
import { World, STEP, PHYS } from './world.js';
import { Renderer } from './render.js';
import { demoInput, demoActive } from './demos.js';

export class DemoPlayer {
  constructor(canvas) {
    this.renderer = new Renderer(canvas, { fit: true, viewH: 9 * T, minW: 360 });
    this.cam = { x: 0, y: 0 };
    this.demo = null;
    this.world = null;
  }

  play(demo) {
    this.demo = demo;
    this.restart();
  }

  restart() {
    this.world = new World(this.demo.level, 0);
    this.renderer.setLevel(this.world);
    this.t = 0;
    this.acc = 0;
    this.phaseT = this.world.phase;
    this.camera(1, true);
  }

  resize() {
    this.renderer.resize();
    if (this.world) this.camera(1, true);
  }

  camera(dt, snap = false) {
    const r = this.renderer, w = this.world;
    const lw = w.w * T, lh = w.h * T;
    let tx = w.player.x + PHYS.W / 2 - r.vw / 2 + 40;
    tx = lw <= r.vw ? (lw - r.vw) / 2 : Math.min(Math.max(tx, 0), lw - r.vw);
    const ty = lh - r.vh;
    if (snap) { this.cam.x = tx; this.cam.y = ty; return; }
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 5);
    this.cam.y = ty;
  }

  // Advances and draws one frame; returns the set of actions the script is "pressing".
  update(dt, time) {
    const d = this.demo;
    this.acc += dt;
    while (this.acc >= STEP) {
      const prev = this.t;
      this.t += STEP;
      this.world.update(STEP, demoInput(d, prev, this.t));
      this.acc -= STEP;
    }
    for (const e of this.world.events) this.renderer.fx(e, this.phaseT);
    this.world.events.length = 0;
    if (this.t >= d.duration) this.restart();
    this.phaseT += (this.world.phase - this.phaseT) * Math.min(1, dt * 7);
    this.camera(dt);
    this.renderer.update(dt, this.world, time);
    this.renderer.render(this.world, this.cam, this.phaseT, time, { showSigns: false });
    return demoActive(d, this.t);
  }
}
