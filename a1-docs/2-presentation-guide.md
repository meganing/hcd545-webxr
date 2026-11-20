# 2. Demo presentation guide (10 minutes)

The demo is in person. You bring a laptop and a phone. **No AI assistant during the demo.** The examiner may ask you to use their phone.

## What is graded in the demo

- You show the experience in mono and in stereo or WebXR.
- You complete the task by gaze only.
- You answer questions and open your own code.
- You make one small change in 2 minutes, with docs and notes only.

## The night before

- Push the final commit. Open the live URL on your phone and on your laptop. The footer shows `build <hash>`. It must equal the hash you tagged `a1-final` and wrote in the report.
- Charge the phone. Turn off Low Power Mode (it caps the frame rate).
- Put the phone on the same Wi-Fi as nothing else heavy. Close other tabs.
- Have a cardboard viewer or a headset with you if you own one.
- Open on the laptop, in separate tabs: the live URL, `src/gaze.js`, `src/my-interaction.js`, `src/game/rooms.js`, `src/main.js`, and the docs `1-code-explained.md`.
- Run `npm ci` and `npm run dev` once, so the local copy works if the Wi-Fi fails.
- Clear the saved settings once (Settings panel > Reset) so the demo starts from the defaults.
- Print or open this guide and the Q&A sheet. Notes are allowed in the 2-minute change.

## Minute by minute

| Time | What you do | What you say (one sentence) |
|---|---|---|
| 0:00 | Open the live page on the laptop. Press Start. | "This is a 3D spot-the-difference game: two rooms, five differences, played by gaze." |
| 0:30 | Drag to look around the lobby. Show the board. Point to the Footer hash. | "Laptop mono: drag to look. The footer proves which commit this is." |
| 1:00 | Press Stereo. Then Exit stereo. Say the time. | "Stereo is one function call, no reload, well under 2 seconds." |
| 1:30 | Open Settings. Move IPD to 55, 64, 70 mm. | "IPD is the distance between the two eye cameras. It scales the world." |
| 2:00 | Look at Begin (by dragging the view to it). Let the ring fill. | "Everything from here is dwell: the ring is the progress, 0.6 s re-arm after each fire." |
| 2:30 | Look at the green pad of room A, then at objects. Flag a decoy (the chair). | "Turned is not a difference, so I get a caption that says why, and a Wrong count." |
| 3:30 | Flag real differences. Turn sound off and show the hint caption. | "The hint is a positional ping plus a caption, so it works with sound off." |
| 5:00 | Finish the game. Show the end board. Press Restart in the dock (look down). | "Restart calls `reset()` through safe.js." |
| 5:30 | Phone: open the URL. Allow motion on iPhone. Look around by moving the phone. Stereo. | "On iPhone the permission step must be inside the Start click." |
| 7:00 | Show FPS box in mono then in stereo. Say the frame budget. | "I measured X fps in mono and Y in stereo. 60 Hz is 16.7 ms." |
| 8:00 | Open the console: `hcd.angularSizes()` at one pad. | "Every target is at least 3 degrees. That is why only this room's objects are targets." |
| 9:00 | Questions start (or the change drill). | |

The examiner decides the order. If they interrupt, follow them. The table is only a safe default.

## Gaze-only run (how to do it on a laptop)

- You may drag to aim. Do not click or press keys to activate anything. The ring must fill.
- Plan a route: Begin > pad Room A > flag clock (missing in B) > pad Room B > mug, plant, picture, lamp. About 2 minutes.
- Practise the route 5 times with a stopwatch. Your best time and a first-time tester's time go into the report (brief: under 3 minutes for a first-time user).
- The answers: mug (recoloured), plant (bigger), picture (replaced), clock (missing in B), lamp (shade is pink in B). Decoys: chair, vase, lantern.

## Failure plans

| What breaks | What you do |
|---|---|
| No Wi-Fi | Run the local copy: `npm run dev`, open the https Network URL on the laptop. Phone parts: say "not tested today" and show the report record. |
| iPhone does not ask for motion | Reload and press Start again. Say: "the prompt is only allowed inside the click." Drag still works. |
| Sound blocked | Press Sound on. If still silent, say: "the AudioContext needs a gesture, and the game is finishable with sound off." |
| Examiner's phone is slow | Use `?pr=1` and say what it does. |
| No headset | Say: "WebXR session not tested on a headset. I tested X in the Immersive Web Emulator" (only if true). |

## The 2-minute change (practise each one three times)

Open `src/game/rooms.js` or the named file, edit, save, check in the browser. Dev server hot reload shows it in seconds.

| Request | Where | Edit |
|---|---|---|
| New default dwell time | `src/settings.js` | `dwell: 1.2` to the new number |
| A sixth difference | `src/game/rooms.js` `DIFFS` | add a real change, for example on `vase`: `{type:'resize', counts:true, set:{scale:1.5}, say:'The vase is bigger'}`. `TOTAL` updates itself, but `check-design.mjs` and `smoke-test.mjs` hard-code 5: change those too. The chair ignores colour, so do not use it for a recolor |
| Make a decoy real | `rooms.js` | `counts: true` on that entry |
| Add an object | `rooms.js` `OBJECTS` | copy a line, new `id`, `kind`, `x`, `z`; give it `proxy` and `cy` |
| Change the hint time | `src/my-interaction.js` | `const HINT_AFTER = 25` |
| Bigger minimum target | `rooms.js` | `MIN_PROXY = 0.32` to `0.4` |
| Different comfort default | `src/my-comfort.js` or `settings.js` | `vignette`, `turnMode`, `snapAngle` |
| Change the re-arm | `src/gaze.js` | `const REARM = 0.6` |
| Change the hint sound | `src/audio.js` `hintAt` | `makePing(this.ctx, 520)` to another frequency |
| Change the pixel ratio rule | `src/adapt.js` `platformProfile` | `dense ? 1.5` to another number |
| Change the room count text | `my-interaction.js` `refresh()` | the strings in `board.show` |
| Add a pad link | `rooms.js` `PAD_LINKS` | add an index to a row (check with `node a1-docs/check-design.mjs`) |

After any change to the room data, run `node a1-docs/check-design.mjs` in a terminal. It tells you if a target falls under 3 degrees or an object overlaps a pad.

## How to talk (rules for yourself)

- Answer in two sentences, then open the file. Show, do not describe.
- If you do not know: "I would check in `file.js`, function X" and open it. Examiners reward tracing.
- Say "starter" for code you did not write and "mine" for code you did. The report has an AI-use section, and the instructor knows. Be calm and specific: what the assistant did, which files, and that you studied every line.
- Do not claim a test you did not do. "Not tested" scores better than a wrong pass.
- Never say "it just works". Say what function does it.

## Your own numbers to fill in before the demo

- Dwell trial: 10-target trial results at two dwell times and two target sizes (mean seconds).
- FPS: mono and stereo on your phone, 20 s each, plus frame time.
- Adaptation before/after on the same phone (the four URL switches).
- First-time tester time.
- Device test record: at least 3 device/browser classes with date, mode, result, screenshot.
- Comfort defaults and the reason from your Lab 2 tests.


## If you change a default
- `settings.js` defaults only apply to a browser with no saved settings.
- After editing a default, press Reset settings in the panel, or clear this site's localStorage, then reload.

## Ship it (yours to do, I did not push anything)
- Commit on branch `a1`, push it, and merge to `main`: the workflow runs only on pushes to `main`.
- Check the live URL ends in `/a1/`, and note that the repo is `hcd545-lab1`, not `hcd545-webxr`.
- Tag the final commit `a1-final` if the course asks for it.
- Run `python3 a1-docs/make_submission.py firstname_lastname` after the PDF is final.
