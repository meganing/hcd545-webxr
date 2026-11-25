# 3. Demo question sets

Each question has a short model answer and where to open the code. Cover the answer, say yours, then check. Questions marked **(trace)** want you to open the file and walk through it. Questions marked **(own data)** need your own numbers: the answer here is only the shape of a good answer.

## A. Platform detection

1. **How does your page decide to show ENTER VR?** It calls `navigator.xr.isSessionSupported('immersive-vr')` and shows the button only if the promise says true. `main.js`, near the end.
2. **Why not check `navigator.userAgent`?** User agents lie and change. Capability checks ask the thing that matters: can this browser start the session.
3. **What if `navigator.xr` is undefined?** The `if (navigator.xr)` guard skips it. No button. Mono and stereo still work.
4. **Where is the iPhone motion permission requested?** `look.js requestPermission()`, called from the Start click in `main.js` (`onStart`). It must be synchronous in the click: after an `await` iOS no longer counts it as a user action.
5. **What happens if the user refuses motion?** `permission` becomes `'denied'`, `hasData` stays false, drag look-around still works.
6. **How do you know a phone is "dense" for your adaptations?** `platformProfile()` in `adapt.js`: `pointer: coarse`, short screen side at most 500 CSS px, `devicePixelRatio` above 2. No browser name.
7. **Why is your platform profile computed before the renderer?** Antialiasing can only be chosen when the `WebGLRenderer` is created.

## B. Stereo and IPD

8. **What is stereo rendering?** Two images of the scene from two cameras a small distance apart, one per eye.
9. **What is IPD and what is your default?** Interpupillary distance, the gap between the pupils. Default 0.064 m (64 mm). Range in the slider 40 to 90 mm.
10. **What happens when IPD is too big or too small?** The world looks smaller or bigger than it is (scale cue changes) and eyes can strain.
11. **How does your stereo toggle work and how fast is it?** `setStereo(true)` calls `stereo.enable()`: set a flag, request fullscreen. The loop then renders through `StereoEffect`. No reload. **(own data)** measured time: under 2 s.
12. **Where is IPD applied in code?** `stereo.js setIpd` and `effect.setEyeSeparation`; the `ipd` setting change calls it from `main.js onChange`.
13. **Why is the phone's screen split in two?** Cardboard viewers: each lens sees one half. Viewer fit draws each eye as a square under its lens.
14. **What does the headset do differently?** The browser draws both eyes itself; `main.js` turns StereoEffect off on `sessionstart`.
15. **Which depth cues does your game use?** Pictorial (relative size, overlap, shadows, texture of the floor grid), binocular disparity in stereo (strongest at 0.5 to 3 m).
16. **Why must a resize difference be 35 percent or more?** Under that, a person cannot tell a smaller object from one that is simply farther, because size and distance are confounded in one image.
17. **Why is a turned chair not a difference?** Turning, moving or lighting an object leaves the object the same; only a changed colour, size, picture or missing thing counts.
18. **Vergence-accommodation conflict: where does it touch your design?** Text and targets are 1 to 3 m away, not close to the face, so the focus distance of the screen and the vergence distance disagree less.

## C. Comfort

19. **What causes simulator sickness?** Sensory conflict: the eyes say you move, the inner ear says you do not (vection). Also latency, low frame rate, field-of-view changes, unexpected acceleration.
20. **Why teleport and not walking?** Teleport has no continuous visual motion, so no vection. A blink with a vignette makes the jump predictable.
21. **Open `comfort.js` and show the blink.** `teleportTo` sets `tp`; in `update` the phases are tunnel closes 0.15 s, fade 0.1 s, `_moveHeadTo`, then fade in 0.15 s and tunnel opens 0.25 s. **(trace)**
22. **Why move the rig and not the camera?** WebXR and `look.js` overwrite the camera pose every frame; the rig is a parent that holds the player's place in the world.
23. **Snap or smooth turning, and which is default?** Snap 30 degrees by default (starter), smooth is 90 degrees per second. **(own data)** your reason from Lab 2.
24. **What does the vignette do?** Narrows the periphery during motion so less optic flow reaches the eyes. `always`, `motion`, `off`.
25. **Why does reduced motion force snap turning?** Smooth rotation is motion; `effectiveTurnMode()` in `settings.js`.
26. **What are the frame budgets?** 60 Hz: 16.7 ms. 72 Hz: 13.9 ms. 90 Hz: 11.1 ms. The FPS box shows the frame time. Headset minimum in the brief: 72 fps.
27. **Why do you cap `dt` at 0.1?** After a stall a huge `dt` would make timers and animations jump.
28. **Rotate about the head, not the rig origin: why?** `_rotate` fixes the sideways swing of a standing user whose head is not at the rig centre.

## D. Dwell, gaze and the input chain

29. **Explain dwell. What is Midas touch?** Activation by looking for a set time. Midas touch: everything you look at activates; dwell time is the guard.
30. **Trace what happens when I look at the mug for 1.2 s.** **(trace)** `gaze.update` > `pickFromCamera` > `pick` (visible targets, `intersectObjects`, `_root`) > hover and timer > `t >= dwell` > `t = -REARM` > `activate` > `onActivated` (chime, caption) > `target.onActivate` > `flag(entry)`.
31. **What is re-arm and why 0.6 s?** After a fire the timer is set to minus 0.6 s so one long look does not fire twice. `REARM` in `gaze.js`. 0.6 s is long enough to look away and short enough not to feel stuck. **(own data)**
32. **How is the dwell time adjustable?** `settings.dwell`; slider 0.5 to 3 s in the panel, buttons in the 3D menu in 0.1 s steps; `gaze.js` reads `Math.max(0.2, settings.dwell)` each frame. Brief needs 0.8 to 2.5 s.
33. **What is a gaze target in your code?** Any Object3D with `userData.target = { label, onActivate, setHover, safe? }`.
34. **Why invisible proxies for the objects?** Small objects (a mug is 10 cm) are under 3 degrees. A proxy of at least 0.32 m makes the target big enough without changing what you see.
35. **Why are only this room's objects targets?** A far object is smaller than 3 degrees. `refresh()` in `my-interaction.js` removes the other room's proxies from `gaze.targets`.
36. **State the input chain order and show it.** Controller, hand, gaze, pointer. `input.js`; `kind` getter; the badge shows it.
37. **What if a controller connects during play?** `controllerActive` becomes true; `update()` sets `gaze.suppressed`, so gaze stops activating; controller `select` calls `gaze.activate` at once. Takeover within one frame. **(own data)** if you measured it.
38. **How do the controller, hand and gaze reach the same game code?** All call `gaze.activate(root, hit, via)`. The game only sees `onActivate`.
39. **Why do Pause, Restart and Exit still work when gaze is off?** They have `safe: true`; `gaze.update` lets safe targets dwell anyway.
40. **How can someone with no controller, touch or keys complete the game?** Everything after Start is a gaze target: Begin, pads, objects, Play again, Restart, Exit.
41. **Why is the dock 45 degrees below the horizon?** A head-locked target can never reach the view centre (the ray goes through the centre). A body-locked dock you look down to is reachable.

## E. Accessibility (XAUR)

42. **Name six features and the XAUR need each serves.** Dwell time adjustable and gaze-only play (alternative input; users who cannot use controllers). Target size scale (users with limited precision or low vision). Captions for every sound (users who are deaf or hard of hearing). High contrast (low vision). Reduced motion and snap turning (vestibular sensitivity). Seated mode and Reset height (wheelchair users, people who cannot stand). Use the exact XAUR wording from the spec in the report.
43. **Who is excluded without each of those?** Say one group per feature.
44. **Which need did you not meet and how would you test it?** Pick the one you wrote in the report (for example screen reader support or voice control). A test: a named user task with a named assistive tool, pass if completed without help. **(own data)**
45. **Justify your default dwell time.** **(own data)** compare the mean times from your Start 10-target trial at two dwells; show the trade-off: shorter = faster but more accidental flags, longer = fewer errors but slower and tiring.
46. **Justify your target size default.** **(own data)** same trial at two sizes. Bigger = faster to hit, but needs more room.
47. **Are settings saved after reload?** Yes: `set()` writes JSON to `localStorage` under `hcd545-webxr-settings-a1`; `settings.js` reads it at start.
48. **Can the settings be reached by gaze?** The 3D menu in the lobby has them. The DOM panel does not show in stereo or a headset, which is why the 3D menu exists.
49. **What does Reset height do?** `seated.js`: recalibrates the eye height so a seated user is at 1.6 m.
50. **Why a flash rule?** No more than 3 flashes per second (seizure safety). My pulse is slow (sine about 0.6 Hz) and turns off with reduced motion.

## F. Audio

51. **What is PositionalAudio?** A three.js object (Web Audio `PannerNode`) that places a sound at an object's position; the listener is on the camera.
52. **What is HRTF?** Head-related transfer function: filters that imitate how the head and ears change a sound by direction. Works best on headphones.
53. **Why is sound off at first?** Browsers block autoplay until a gesture, and many users do not want sound. `audio.start()` resumes the context inside the Start click.
54. **Where is the caption for each sound?** Chime: `main.js gaze.onActivated`. Hum: `audio.update` > `describe()`. Hint: `hintAt()` returns the text. **(trace)**
55. **How does `describe()` get "ahead and to the left, 3 m"?** `camera.worldToLocal(position)`, then `atan2(x, -z)` for the angle and the length for distance, mapped through `BEARINGS`.
56. **How can the game be completed with sound off?** Captions carry every message; the hint also has a caption; success is shown by a green ring.

## G. Performance and platform adaptations

57. **List your platform adaptations and the rule for each.** Pixel ratio 1.5 on dense phones; antialias off on dense phones; shadow map 1024 on phone-size touch screens; half-size canvas textures on phone-size touch screens. All from `matchMedia`, `screen` and `devicePixelRatio`.
58. **How did you measure before and after?** Same phone, URL switches (`?pr=2`, `?aa=1`, `?sm=2048`, `?tex=1`), FPS box, standing at the start for 20 s. **(own data)** the numbers.
59. **Why is the pixel ratio the biggest lever?** Fragment shading cost scales with pixel count. Ratio 2 to 1.5 is 4 to 2.25 pixels per CSS pixel, 44 percent fewer.
60. **What do `?fb=` and `?fov=` do?** Headset framebuffer scale and foveation, applied when an XR session starts. Not verified on a device.
61. **What is your measured FPS in mono and stereo?** **(own data)** compare to 16.7 ms.
62. **What is the download size?** About 5 MB for `dist` (the two glTF models of 3 MB load only when the starter's Cues view asks for them). Limit 15 MB.

## H. Test results and honesty

63. **Which device classes did you test and what did you reach?** **(own data)** a class is one device type with one engine.
64. **What did you not test?** Be specific: headset, hand tracking, and so on. "Not tested" is valid.
65. **What failed during testing and what did you change?** **(own data)**
66. **How long does a first-time user take?** **(own data)** target under 3 minutes; the clock is 120 s, so a player who runs out still ends before 3 minutes. The hint appears after 25 s without a find.

## I. Game design and code reading

67. **How are the differences defined?** `DIFFS` in `rooms.js`. Room B is room A plus these changes (`buildRoom('B')`).
68. **What is a decoy and why have them?** A change that does not make the object different (turned, moved, lit differently). They teach the rule that an object is the same if it is the same thing, and stop people flagging everything.
69. **Why is a "missing" difference flagged in room A?** The object only exists there. The ring then circles the empty spot in room B.
70. **How does the lamp difference work?** `props.js lamp` reads `o.shade`; room A uses cream, `DIFFS` entry `lamp` (type recolor) sets pink for room B. It is subtle on purpose: a tint, not a letter. The cream-to-pink step is also a brightness change.
71. **How does Target size reach your objects?** `applyScale()` in `my-interaction.js` runs on start and on `onChange('targetScale')`. It scales the proxies and the 3D buttons.
72. **How does the game know you are in room A?** `roomAt(x, z)` on the camera world position each frame.
73. **Why not let people walk freely?** Smooth walking is the main sickness trigger and hard by gaze. Teleport pads are safer and also make the game easier to finish. In a headset physical walking still works because the room comes from the head position.
74. **What did the AI assistant do and what did you do?** State it plainly: it helped write the code and docs under your direction; you reviewed every file, ran and measured the experience, wrote the report analysis, and can trace the code. (Matches the AI-use section.)
75. **Open any file and explain a block I pick.** Practise with `gaze.js update`, `comfort.js update`, `my-interaction.js flag/refresh/update`, `rooms.js buildRoom`, `adapt.js platformProfile`.

## J. Quick-fire (one line each)

- Units in three.js? Metres.
- Eye height default? 1.6 m (`EYE`).
- Reticle distance? 1.6 m.
- Minimum target angle? 3 degrees.
- Re-arm? 0.6 s.
- Default dwell? 1.2 s.
- Default snap angle? 30 degrees.
- Smooth turn speed? 90 degrees per second.
- Hint delay? 25 s.
- Number of differences? 5 real, 5 decoys (turned, moved or lit), and 4 plain objects that are the same, 14 things to look at in all.
- Which three.js version? 0.186.1.
- Why `base: './'` in `vite.config.js`? The build works from a GitHub Pages sub-path.
- What is `__COMMIT__`? The short commit hash injected by Vite, shown in the footer, to prove which commit is deployed.
- Why HTTPS? Phone motion sensors and WebXR need a secure context.

## K. Game design (added after playtesting)

90. **Why can you only see one room at a time?** With both rooms open from the lobby the task is trivial: look left, look right. Hiding the room you are not in makes you compare from memory (change blindness) and gives the teleport pads a real purpose. `refresh()` in `my-interaction.js` toggles each room's `contents` group.
91. **What does a wrong flag cost, and why?** 8 s (`WRONG_COST`) and the combo. Without a cost, looking at everything is the best strategy.
92. **How is the score worked out?** 100 per find times a combo of 1 to 3, plus 2 per second left when all five are found. Best score is in `localStorage`.
93. **What happens when time runs out?** `finish(false)`: the missed differences get orange rings, the board shows the score and a rank, and Play again restarts at once.
94. **Did you test this on players?** **(own data)** Say what you did and saw. The design came from reading about change blindness and casual-game loops, which is a rationale, not a test.
95. **Why do the rooms look empty from the lobby while playing?** On purpose: you only see the room you stand in. Each closed room shows a sign ("Room A: closed. Look at the gold pad to step in"), because an empty-looking screen with no explanation reads as a bug. It is the empty-state rule: say why it is empty and what to do next (`closedTexture` in `world.js`).
96. **What sounds does the game make?** A soft bell on every button or pad, a rising chime for a correct flag (higher with the combo), two low notes for a wrong one, a rising run when all are found and a falling run when time is up. All are generated in code (`makeSeq` in `audio.js`) and each has a bracketed caption.
