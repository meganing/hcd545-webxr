import { set } from './settings.js';

// A1 / Lab 2: the three comfort presets. Each preset is a bundle of comfort settings; the "Comfort preset" button applies them in this
// order, one per press. The values and reasons below come from the comfort factors in the lectures (vection, vignette, snap against
// smooth turning) and from this game's design (teleport only, no walking, a seated or standing visitor in a 4 m room).
// My test lines: my own 10-minute comfort test (a1-docs/4-comfort-lab2.md), 0 = fine to 3 = would stop. My result differs from the
// reason for sensitive: the always-on vignette felt worse than the one during motion, so I kept comfortable as the default.
//   vignette:  'off' | 'motion' | 'always'
//   turnMode:  'snap' | 'smooth'
//   snapAngle: degrees per turn (the Turn angle slider goes from 15 to 90 in steps of 15)
//   latencyMs: 0 in every preset: added latency always makes comfort worse
export const presets = {
  // For people who get sick easily (and anyone in their first minutes).
  //   vignette 'always': the narrow view is on all the time, so the peripheral optic flow that drives vection never reaches the eyes,
  //     and there is no sudden change at the start of a turn or a blink.
  //   snap, 45 degrees: a turn is one jump, so there is no continuous rotation (the strongest sickness trigger); 45 degrees means
  //     fewer jumps to look around the lobby (about 8 for a full circle, 12 at 30 degrees).
  //   My test (Samsung phone in VR mode, one person): score 2 of 3. Only the centre was stable; the blurry edge was still visible and made me dizzy.
  sensitive:   { vignette: 'always', turnMode: 'snap',   snapAngle: 45, latencyMs: 0 },

  // The DEFAULT (the same values as defaults in settings.js).
  //   vignette 'motion': the tunnel appears only while turning or teleporting, so the view is full when you look at a small difference
  //     (the game needs the whole view to compare things) and protected when the eyes would see motion.
  //   snap, 30 degrees: small enough to keep your bearings after a turn (you can follow where you were), large enough to reach the
  //     other room in two or three turns. 30 degrees is the common default in VR apps.
  //   My test (same phone and person): score 0 of 3. Less dizzy and comfortable, so this is my default.
  comfortable: { vignette: 'motion', turnMode: 'snap',   snapAngle: 30, latencyMs: 0 },

  // For people who are not sensitive and want the fastest look-around.
  //   vignette 'off': nothing narrows the view (the blink teleport still fades to black briefly, 0.1 s out and 0.15 s in, so a jump is never abrupt).
  //   smooth, 90 degrees per second: continuous rotation, quick and natural, but it is optic flow without body motion, which is the
  //     reason it is not the default. Reduced motion forces snap anyway (settings.js effectiveTurnMode).
  //   My test (same phone and person): score 1 of 3. The movement did not feel very smooth and looked blurry.
  intense:     { vignette: 'off',    turnMode: 'smooth', snapAngle: 30, latencyMs: 0 },
};
export const presetNames = Object.keys(presets);

export function applyPreset(name) {
  for (const [key, value] of Object.entries(presets[name])) set(key, value);
}
