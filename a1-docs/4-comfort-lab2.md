# 4. Lab 2 comfort test (10 minutes)

Goal: replace the "My test:" lines in `a1/src/my-comfort.js` with what you really felt, and keep or change each value.
The values in the file are a reasoned starting point, not your results. The brief wants defaults chosen from your own tests.

## Setup (1 minute)

- Open the page on your phone (the device you will demo on). Press Start.
- Open Settings. Turn Show FPS on.
- Tap Comfort preset once to apply `sensitive`. The button shows the name.

## Test, for each preset (about 3 minutes each)

- Press Comfort preset until the button shows the preset name.
- Do the same 4 actions every time:
  - Turn right 4 times (use Turn right), then left 4 times.
  - Teleport onto a pad in Room A, then Home, then Room B.
  - Look around the room for 30 seconds.
  - Flag one object.
- Right after, write one score from 0 to 3: 0 = fine, 1 = slightly uneasy, 2 = uneasy, 3 = would stop.
- Rest one minute between presets.

## Result table (fill in)

| Preset | Score 0 to 3 | What you felt | Keep or change |
|---|---|---|---|
| sensitive (always, snap 45) | | | |
| comfortable (motion, snap 30) | | | |
| intense (off, smooth) | | | |

## Then

- Copy each "what you felt" into the "My test:" line of the same preset in `my-comfort.js`.
- If `comfortable` scored 2 or more, change its values and its reason together, and set the same values as defaults in `settings.js`.
- Put the table in the report, section 4 (the Comfort defaults table).
- Be honest if you tested one device only: write "one device, one person".
