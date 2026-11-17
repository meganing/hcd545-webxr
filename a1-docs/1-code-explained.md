# 1. Code explained: the VR principles in my A1 project

Read this once, then use it to answer "where is that in your code?". File names are in `a1/src/`. The code claims were read against the code; nothing here was run in a real browser or headset.

## How to use this document

- Read section 0 (the map) first. It takes 3 minutes.
- For each principle: read "What it is", open the file, find the named function, read the "How it works" bullets against the real code.
- Say the "Demo sentence" out loud once. It is the 15-second answer.
- Items marked **Starter** were given to us (Lab 1 to 3). Items marked **Mine** I added for A1. The examiner asks about both.

## 0. The map

```
index.html            one <script type="module"> that loads src/main.js
src/main.js           wires everything: renderer, scene, camera inside a rig, every module, the loop
src/settings.js       one settings object + onChange listeners, saved in localStorage (key ...-a1)
src/look.js           mono look-around: phone motion (DeviceOrientation) + drag          Starter
src/stereo.js         stereo view: StereoEffect (side by side), IPD, viewer fit           Starter
src/comfort.js        vignette, snap/smooth turn, blink teleport                          Starter
src/gaze.js           the dwell ray: reticle, progress ring, re-arm                       Starter
src/input.js          input chain: controller > hand > gaze > pointer                     Starter
src/audio.js          PositionalAudio, generated sounds, caption text                     Starter + Mine (hintAt)
src/captions.js       head-locked caption strip                                           Starter
src/menu.js           3D buttons, 3D menu, teleport pads, speaker                         Starter + Mine (pad options)
src/safe.js           Pause / Restart / Exit dock                                         Starter
src/measure.js        angularSizes(): the 3 degree check                                  Starter
src/adapt.js          URL switches ?pr ?fb ?fov                                           Starter + Mine (platformProfile)
src/my-comfort.js     the three comfort presets                                           Starter (my Lab 2 values go here)
src/my-interaction.js THE GAME: state machine, flags, hint, rings, Begin / Play again     Mine
src/game/rooms.js     data: rooms, objects, DIFFS (the answer key), pads, links           Mine
src/game/props.js     every object built from boxes, cylinders, canvases                  Mine
src/game/world.js     builds the two rooms + the invisible gaze proxies                   Mine
src/game/hud.js       score line (head-locked) and the lobby board                        Mine
```

One sentence for the whole project: **"Two rooms look the same but five things differ. You teleport by gaze, look at a thing until the ring fills to flag it, and every input path (controller, hand, gaze, pointer) uses the same `userData.target` objects."**

## 1. Platform detection (capability, not browser name)

- **What it is**: ask the browser what it can do. Never decide behaviour from `navigator.userAgent`. (`capabilities.js` reads it only for a display label.)
- **Where**: `main.js`, near the end: `navigator.xr.isSessionSupported('immersive-vr').then(ok => ...)` creates the ENTER VR button only if `ok`. Also `look.js requestPermission()` tests `DeviceOrientationEvent.requestPermission` (exists on iPhone only). `adapt.js platformProfile()` uses `matchMedia('(pointer: coarse)')`, `screen.width` and `devicePixelRatio`.
- **How it works**:
  - No `navigator.xr` (laptop Safari, many phones): no button, the page still works in mono and stereo.
  - iPhone: `requestPermission` is a function, so the permission prompt is shown. It must be called inside the Start click, with no `await` before it (the comment in `look.js` says why).
  - Permission refused: `hasData` stays false and drag still works.
- **Demo sentence**: "The Enter VR button exists only when `isSessionSupported` says yes; I never look at the user agent."

## 2. Mono: look-around

- **Where**: `look.js`, class `LookControls`, `update()`.
- **How it works**:
  - Phone: `deviceorientation` gives alpha, beta, gamma. `update()` builds a quaternion from them (`Euler 'YXZ'`), multiplies by `Q_UPRIGHT` (phone upright = horizon) and by the screen rotation.
  - Drag adds `dragYaw` on top, so you can still turn if the phone is on a desk.
  - Laptop: no sensor data, so `hasData` is false and drag moves `pitch` and `dragYaw`.
  - `recenter()` stores the current alpha as the new "forward".
- **Key idea**: the camera orientation is overwritten every frame, so turning and teleport move the **rig** (a Group holding the camera), never the camera.

## 3. Stereo and IPD

- **Where**: `stereo.js` (`StereoMode`), toggle in `main.js setStereo()`, IPD slider in `settings-panel.js`, IPD buttons in `menu.js`.
- **How it works**:
  - Stereo = render the scene twice per frame from two cameras, one per eye, side by side. `StereoEffect` (three.js addon) does that. IPD = the distance between the two eye cameras: `effect.setEyeSeparation(metres)`. Default 0.064 m. The slider goes 40 to 90 mm (brief: at least 55 to 70).
  - Switching is one function call (`stereo.enable()`), no reload, so it is well under 2 s.
  - `enable()` also asks for fullscreen, landscape lock and wake lock. Each is optional (`try`/`?.`) because iPhone Safari lacks some.
  - Viewer fit (`eyeRects`): draws each eye in a square one lens spacing wide, so the images sit under the lenses of a cardboard viewer.
  - In an immersive-vr session the headset does its own stereo, so `main.js` turns stereo off on `sessionstart`.
- **Why IPD matters**: wrong IPD scales the world. Too small makes things look bigger. Too large makes them look smaller and can cause eye strain.
- **Depth cues in my game**: the rooms are 4 m wide. Pictorial cues (size, overlap, shadows) work in mono. Disparity only helps at about 0.5 to 3 m. That is why a resize (plant 1.45x) is checked from two pads at the same distance, and a "moved nearer" thing is a decoy, not a difference.

## 4. The render loop and WebXR

- **Where**: `main.js`: `renderer.setAnimationLoop((now) => { ... })`.
- **How it works**:
  - `setAnimationLoop`, not `requestAnimationFrame`: the XR session owns the frame timing.
  - `dt` = seconds since last frame, capped at 0.1 s so a stall cannot cause a jump.
  - Order matters: look and comfort first, then objects, then `gaze.update(dt)` last (after everything that moves the camera or targets).
  - `renderer.xr.enabled = true` lets the same renderer present to a headset. `sessionstart` and `sessionend` events set the headset eye height, FPS target (72), and turn stereo off.

## 5. Gaze dwell, the progress ring and re-arm (the core)

- **Where**: `gaze.js`, class `GazeSystem`.
- **Trace of one activation** (learn this; it is the most likely "trace your own code"):
  1. `gaze.update(dt)` calls `pickFromCamera()`.
  2. `pickFromCamera()` takes the camera world position and direction and calls `pick()`.
  3. `pick()` keeps only `targets` with `.visible`, runs `ray.intersectObjects(live, true)`, then `_root(hit.object)` walks up the parents to the first object with `userData.target`.
  4. If the hit root is different from `hovered`, `setHover(false)` goes to the old one, `setHover(true)` to the new one, and the timer `t` resets to 0.
  5. While hovered and active: `t += dt`; the ring shows `t / dwell`, where `dwell = Math.max(0.2, settings.dwell)`.
  6. When `t >= dwell`: `t = -REARM` (0.6 s, the re-arm), `activate()` runs.
  7. `activate()` calls `onActivated` (main.js: the chime and the caption `[chime] label`), then `target.onActivate()`. In my game that is `flag(entry)` in `my-interaction.js`.
- **Re-arm**: `t` goes negative after a fire, so the target needs 0.6 s plus the dwell before it can fire again. One long look is not a double click.
- **Midas touch**: if everything you look at activates, you cannot look at anything. Dwell time is the defence. Too short = accidental flags. Too long = slow and tiring.
- **Why not a closer reticle**: the reticle is 1.6 m away. Closer than about 1 m it gives double vision in stereo.
- **Safe targets**: `userData.target.safe` lets Pause, Restart and Exit still dwell when gaze is off, paused, or a controller is active.
- **Demo sentence**: "A target is any Object3D with `userData.target`. Every input path ends in `gaze.activate()`, so the game does not know which input was used."

## 6. The input chain

- **Where**: `input.js`, class `InputChain`; the badge is `badge.js`.
- **How it works**:
  - Order: controller > hand > gaze > pointer.
  - Controller `select` event: `_controllerSelect` casts a ray from the controller and calls `gaze.activate(..., 'controller')` at once.
  - Hand: same `select` path, but `kind` returns 'hand' when the `XRInputSource` has `.hand` (needs the optional feature `'hand-tracking'`, requested in `main.js`).
  - While a controller is active, `update()` sets `gaze.suppressed = true`, so one look cannot activate twice.
  - Pointer: a click or tap (movement under 8 px) activates what is under the pointer; in stereo a tap activates what you look at, and the far edges turn.
  - `kind` drives the badge text.
- **Tested status**: write what you really tested (laptop mono yes; Immersive Web Emulator yes/no; headset not tested unless you have one).

## 7. Comfort: vignette, snap turn, blink teleport

- **Where**: `comfort.js` (class `Comfort`, class `Vignette`), presets in `my-comfort.js`, FPS box in `fps.js`.
- **How it works**:
  - Vignette: a 10 m plane 1 m in front of the eyes (child of the camera, so it shows in mono, in each eye, and in a headset). A shader darkens beyond a radius. 'always' = constant, 'motion' = only while turning or teleporting, 'off'.
  - Snap turn: `_rotate(angle)` jumps by `snapAngle` (30 degrees). Smooth turn rotates at `smoothSpeed` (90 degrees per second). Reduced motion forces snap (`effectiveTurnMode()`).
  - `_rotate` turns about the head, not the rig origin, so a standing user does not swing sideways.
  - Teleport: `teleportTo(point)` starts a state machine: tunnel closes (0.15 s), fade to black (0.1 s), `_moveHeadTo` moves the **rig** so the head is above the point, then everything reverses. No continuous movement, so no vection.
  - Why: vection (the feeling of moving without the body moving) is the main trigger of sickness. Teleport has none.
- **My own values**: `my-comfort.js` holds three profiles (sensitive, comfortable, intense), each with a reason. The reasons are drafts. Run `4-comfort-lab2.md`, then replace each "My test:" line with what you felt. **This is yours to fill.**

## 8. Audio and captions

- **Where**: `audio.js` (`SpatialAudio`), `captions.js`.
- **How it works**:
  - `AudioListener` on the camera + `PositionalAudio` on a mesh = a Web Audio `PannerNode`. `panningModel = 'HRTF'` gives direction cues on headphones. `refDistance 1.5`, `rolloff 1.2`, inverse distance model.
  - Sounds are generated in code (`makeHum`, `makePing`), so there are no audio files.
  - Browsers keep the `AudioContext` suspended until a user gesture, so `audio.start()` is called inside the Start click.
  - Sound is off by default. `settings.audio` toggles `play()` and `pause()`.
  - Mine, `hintAt(obj)`: adds one `PositionalAudio` (a 520 Hz ping) to the target object, plays it, and returns a caption `[hint ping, ahead and to the left, 3 m]` from `describe()`. The bearing text uses `worldToLocal` and `atan2`.
  - Every sound has a caption: the chime (`[chime] ...` is the start of the caption, so a deaf player is told a sound happened), the hum (`describe()`), the hint (caption). The game is finishable with sound off.

## 9. Accessibility settings (saved)

- **Where**: `settings.js` (store), `settings-panel.js` (DOM panel), `menu.js` (3D buttons), `seated.js`.
- **How it works**: `set(key, value)` writes the object, saves JSON to `localStorage`, and calls every `onChange` listener. Modules react: for example `onChange('targetScale')` in `my-interaction.js` rescales the proxies. Reload reads the JSON back. The key is `hcd545-webxr-settings-a1`, so older labs on the same site do not leak in.
- **Reachable by gaze**: the 3D menu (lobby, behind and to the right of the start) has dwell, turn, sound, captions, size, reduced motion, IPD, contrast, seated, reset height.
- **Target size in my code**: `applyScale()` in `my-interaction.js` scales each invisible proxy and the Begin / Play again buttons. The rooms do not scale.

## 10. The 3 degree target size rule

- **Where**: `measure.js` (`angularSizes`), design check in `a1-docs/check-design.mjs`.
- **Rule**: a target must cover at least 3 degrees. For width w at distance d: angle = 2 atan(w / 2d). Minimum w at 4.5 m for 3 degrees: 2 x 4.5 x tan(1.5 degrees) = 0.24 m.
- **What I did**:
  - Every flaggable object has an invisible box (the proxy) of at least 0.32 m (`MIN_PROXY` in `rooms.js`). At Target size 0.8 that is 0.256 m, so it still passes at 4.5 m.
  - Only the objects of the room you are in are in `gaze.targets` (`refresh()` in `my-interaction.js`). Objects in the other room would be too small.
  - The lobby is view-only while playing. The starter menu and speaker are hidden outside the lobby (`syncFixtures` in `main.js`), for the same reason.
  - The check script measures the real proxies from every pad: smallest object 7.5 degrees; smallest pad link about 3 degrees (the back pads no longer link to the lobby; the Target size setting never goes below 1 for pads); Begin button 23 x 9 degrees.
- **In the browser**: open the console, stand at a pad, run `hcd.angularSizes()`. Every row must say `ok: true`.

## 11. Performance and platform adaptations

- **Where**: `adapt.js` `platformProfile()`, used in `main.js` and `scene.js`; `game/props.js setTextureScale`.
- **Frame budget**: 60 Hz = 16.7 ms, 72 Hz = 13.9 ms, 90 Hz = 11.1 ms. The FPS box shows frame time. Measure standing at the start for 20 s.
- **My four adaptations** (all decided from capabilities, each switchable by URL so I can measure before and after on the same phone):

| # | Change | Rule | Switch back to "before" |
|---|---|---|---|
| 1 | Pixel ratio 1.5 | phone-size touch screen with devicePixelRatio above 2 | `?pr=2` |
| 2 | Antialiasing off | same dense phones | `?aa=1` |
| 3 | Shadow map 1024 | phone-size touch screens | `?sm=2048` |
| 4 | Canvas textures at half size | phone-size touch screens | `?tex=1` |

  All four off at once: `?adapt=off`.
- **Pixel maths**: ratio 2 draws 4 pixels per CSS pixel, ratio 1.5 draws 2.25. That is 44 percent fewer.
- **Not claimed**: I did not measure on a phone in this build. The numbers in the report come from my own phone runs.

## 12. The game: state machine, flags, hint, data

- **Where**: `my-interaction.js` (logic), `game/rooms.js` (data).
- **State machine** (the starter's template idea): `start -> play -> end -> reset -> start`.
  - start: board with the rules and a Begin target in the lobby.
  - play: timer, flags, hint. Only the current room's objects are targets.
  - end: when the 5th difference is found, wait 2.5 s, teleport Home, show time and wrong flags, show Play again.
  - `reset()` is called by Restart and Exit through `safe.js` hooks in `main.js`.
- **Data-driven rooms**: `OBJECTS` is room A. `DIFFS` is the answer key. `buildRoom('B')` copies room A and applies `set`, `remove` or `add`. To change the game, edit `DIFFS`.
- **Rules** (shown on the start board):
  - Real (counts): added, missing, replaced, recoloured (also a brightness change), resized by at least 35 percent, a different detail on a hidden side.
  - Decoy (does not count): turned, moved, lit differently, looks bigger only because of distance.
  - A wrong flag costs only a "Wrong" count and a caption that says why. There is no hover feedback that gives answers away: every object shows the same white ring when looked at.
- **Rings**: a flat ring that copies the camera quaternion every frame (a billboard), `depthTest: false` so it shows through objects. White on hover, green once found, in both rooms. For a missing object the ring circles the empty spot in room B.
- **Hint**: after 25 s without a find, `hint()` picks the nearest unfound difference (preferring your room) and calls `audio.hintAt()`. If it is in the other room the caption names the room.
- **Targets per room**: `refresh()` adds or removes each proxy from `gaze.targets`. `update()` detects the room from the head position with `roomAt(x, z)`, so a person who really walks in a headset gets the right targets too.
- **Pads**: `createPads` in `menu.js` got options (`spots`, `radius`, `names`, `canShow`, `onArrive`). The defaults keep the starter's behaviour. The game passes its own spots and a link table (`PAD_LINKS`) so only nearby pads are visible and big enough.

## 13. What I changed in starter files (be able to list this)

| File | Change | Why |
|---|---|---|
| `main.js` | platform profile, two pad sets, 4 view modes (game + starter), lobby fixtures, `mine3d.update`, start card text | game view without breaking starter features |
| `menu.js` | `createPads` options, `setEnabled`, `onArrive` | game pads, per-pad visibility |
| `scene.js` | `shadowMap` option, `'game'` cue mode | phone adaptation; hide starter props in the game |
| `audio.js` | `hintAt`, `describe(mesh, name)`, ping frequency argument | the hint |
| `adapt.js` | `platformProfile()` | phone adaptations |
| `settings.js` | storage key `...-a1`, `cues: 'game'` | own saved settings, game first |
| `my-interaction.js` | replaced the template with the game | the task |

Starter features still work: the Cues button cycles game > all > solids > models (the last three show the starter's scale-cue scene and its own pads), and Sky, Shadows, Stereo, Turn, Recenter, Settings, the 3D menu and the Start 10-target trial are unchanged.

## 14. Honest limits (say them before you are asked)

- Headset and Immersive Web Emulator: fill in what you really did. Mark the rest "not tested".
- Hands: `hand-tracking` is requested but untested.
- The lens distortion extension is not done.
- Audio is HRTF on headphones; on phone speakers the direction cue is weak, which is why the caption exists.
