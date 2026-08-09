# Source-traced parity inventory

This document is the acceptance contract for porting the original Ruby/Gosu
`NickTitle/starfield` master at commit
`e25e7b86337ce0428c5008eab28e0a07cef6f674`. The PICO-8 adaptation is useful
comparison material, but it is not authoritative for behavior.

Status values: **foundation** means milestone 1 provides the browser-native
primitive; **pending** means the original behavior is inventoried but not yet
ported; **verify** means final parity requires automated and browser evidence.

## Runtime and states

| Area | Original contract | Port status |
|---|---|---|
| Logical display | 640×480, scaled into a 1200×900 window | **foundation**: responsive 640×480 Canvas |
| Main loop | Gosu update/draw loop | **foundation**: deterministic fixed 60 Hz update with independent render scheduling |
| State 0 | Black fades away one alpha unit per update; title ship flies at 52°; Space starts only after fade reaches zero | **foundation** |
| State 1 | Normal flight, artifacts, HUD, story, radio | **foundation** through the complete 61-entry story, orbit, and shutdown gates; sonar/particles pending |
| State 2 | Story completion fades to black by 0.5 alpha/update | **pending** |
| State 3 | Black pause; finale audio begins; 25-second delay | **pending** |
| State 4 | Two-ship finale fades in by 0.3 alpha/update | **pending** |
| State 5 | At 73 seconds from finale start, return to black | **pending** |
| Deployment | Ruby 2.0 + Gosu from `app/`; no build artifact | **foundation**: static HTML/CSS/JS, no build/framework/server-side application runtime |

## Story gates and input

- Preserve all 61 `STORY` entries (indices 0–60), exact wording, and each
  pause/free-flight boolean from `app/constants.rb`.
- Preserve radio gates at story states `8, 15, 20, 23, 27, 31, 34, 38, 43,
  49, 55` and shutdown gates at `12, 18, 22, 25, 29, 33, 37, 41, 46, 52,
  57`.
- While paused, Space advances ordinary prompts only after the one-second
  debounce. State 3 requires Period to power/tune the radio. Artifact prompt
  states require a nearby tower and Space.
- In free-flight, Left/Right rotate, Up thrusts, Comma/Period tune continuously,
  and Space shuts down the nearby active artifact. At story state 60, tuning
  fully down to zero triggers the ending.
- Escape exits in Gosu. In the browser, normal browser exit/navigation remains
  available rather than trapping Escape.

Current status: **foundation** complete 61-entry story inventory, pause/free-flight
gates, radio and artifact cues, final radio-off handoff, and deterministic
one-second gate timing.

## Ship physics and controls

| Behavior | Original value | Port status |
|---|---:|---|
| Spawn | world center plus independent random 0–99 x/y offset | **foundation** |
| Rotation | 2° per update | **foundation** |
| Thrust acceleration | `vx += 0.03 sin(angle)`, `vy -= 0.03 cos(angle)` | **foundation** |
| Component speed cap | −4…4 | **foundation** |
| Active damping | velocity × 0.993/update | **foundation** |
| Passive damping | velocity × 0.995/update while component magnitude > 0.05 | **foundation** |
| Passive drift rotation | ±0.1°/update based on y velocity sign | **foundation** |
| Engine volume | +0.025/update under thrust; ×0.95 until cutoff at 0.05 | **foundation** |
| Tower capture/orbit | pull toward a close tuned tower, cap high velocity, face orbit direction | **foundation** |
| World bounds | no wrap or clamp; commented-out wrap stays disabled | **foundation** |

## Radio, tuning, and 11 artifacts

- Dial range is 0–275 in 0.5-unit input steps; zero is off. Power transitions
  play `button.mp3`.
- Each artifact receives a random frequency in 0–274 and random position in a
  20,000×20,000 world. Eleven artifacts are created. Audio cycles through
  songs 2…10, 1, 2 because the original class counter uses `count % 10 + 1`.
- A frequency is in range when its strict distance from the dial is less than
  8. The original takes the first two in-range artifacts in iteration order,
  then sorts those two by ascending signal strength. The weaker selected signal
  controls reception color, static, sonar, minimap visibility, and nearby
  interaction; the stronger selected signal plays at 20% of its computed
  volume. This counterintuitive precedence is preserved as source behavior.
- Signal volume combines frequency closeness (up to 0.6) and world distance
  (up to 0.45), capped at 1. Static is `(1 - signal volume) × 0.75` unless the
  tower is close, and untuned static is 0.75.
- A tuned tower within both half-height and half-width becomes the active orbit
  and shutdown target. Shutdown flickers for 150–209 updates, plays the found
  sound at start, becomes grey/off, silences its broadcast, advances story,
  and cannot broadcast again.
- The original retains a previously close shutdown target when tuning moves to
  a frequency with no in-range signal; powering the radio off or selecting a
  different signal clears it. This stale-target behavior is preserved.

Current status: **foundation** dial bounds, input, power transition, deterministic
11-artifact generation, original first-two/weaker-signal selection, static and
broadcast mixing, proximity targeting, and lazy per-artifact audio loops;
**foundation** nearby artifact update/draw gates, full tower geometry, orbit,
shutdown lifecycle/audio, and story integration.

## Sonar and minimap

- Ten sonar bars reset as a burst. Each starts at the ship origin with width 2,
  alpha 255, speed 5, and the bearing toward the weaker of the first two
  in-range artifacts selected by the original radio logic. Per update
  width grows 0.5, alpha falls 5, speed damps by 0.97, and travel advances by
  current speed. Draw angle adds a fresh random ±30° spread. The burst cadence
  is intended to vary from 20 to 200 updates based on signal volume.
- The 100×100 minimap sits at (10,10) with a two-pixel frame. It maps absolute
  world coordinates linearly, blinks the 3×3 player marker every 60 updates,
  and shows only that weaker selected tuned artifact.

Current status: **foundation** exact minimap frame, world mapping, asymmetric
marker offsets, weaker-signal visibility, and 61-update player blink;
**pending** sonar implementation and deterministic replacement for draw-time
randomness. Final verification must cover bearing, spread, cadence, and draw
order.

## Particles, parallax, and rendering

- Exactly 150 stars begin at random screen positions. Depth is one of
  1.0…3.4; size is 0.6…15.5; rotation is 0…89°; spin magnitude is
  0…0.198°/update in a random direction. Near/small stars can receive a random
  translucent color. Stars move opposite velocity multiplied by depth, wrap
  on the crossed axis, randomize the other axis, and regenerate visual traits.
- Stars at depth ≤1.75 draw behind the world; deeper stars draw above the ship
  and artifacts but below the HUD.
- The ship has 200 primary engine particles and 100 secondary particles. Color
  advances white → yellow → orange → red over lifetime. Strength follows
  engine volume in gameplay and stays full for title/finale scenes.
- Ship one is the orange patched craft drawn at screen center. The finale draws
  it translated +25,+25 and a peach second ship translated −25,−25. The
  original shares particle origins; visual parity review must decide whether
  to preserve that exact behavior or the independently reviewed dual-trail
  correction from the later PICO-8 work.
- Artifact geometry is a rotating colored octagonal world with twin towers,
  braces, house, window, door, and top octagon. Only artifacts within 1.5 screen
  widths/heights update; draw uses radial distance less than 1.5×640.

Current status: **foundation** deterministic star count/generation, depth-scaled
motion/wrap, background, representative ship, original star/artifact/HUD layer
order, and artifact geometry; **pending** particles, sonar, and finale ship.

## Finale

The final story entry is reached only after all 11 shutdown gates and tuning
the radio to zero. State 2 fades out; at full black, story pauses, state 3
starts `game_end.mp3`, schedules fade-in after 25 seconds and black after 73
seconds. State 4 shows the two offset ships with continuous full-strength
particles and fixed 52° heading while fading in. State 5 is black.

Current status: **foundation** story state 60 hands off to the fade-out state;
finale fade/audio timing remains pending. Final acceptance requires both
deterministic timing coverage and a fresh title → 11 searches/shutdowns →
finale browser run.

## Audio and assets

| Assets | Count/use | Port status |
|---|---|---|
| Pixel font | `04B03.TTF` | **foundation**, copied unchanged |
| Songs | `1.mp3`…`10.mp3` | **foundation**, copied unchanged; mixing pending |
| Finale | `game_end.mp3` | **foundation**, copied unchanged; state timing pending |
| Effects | button, engine loop/on/off/slow, found, static, three typing variants | **foundation**, copied unchanged; full cues/mix pending |

Browser audio must remain locked until a user gesture, then preserve looping,
volume, and one-shot semantics. Missing or rejected playback must not break the
simulation.

## Verification gates

1. Deterministic unit tests for every transition, physics rule, seeded world,
   signal calculation, sonar/minimap mapping, particle lifecycle, and finale
   timer.
2. Full package test run at the exact commit reported for each milestone.
3. Desktop browser verification for layout, keyboard control, animation, audio,
   and a complete title → all 11 shutdowns → finale run.
4. Fresh static-host run from documented instructions with no build artifacts,
   Ruby, Gosu, framework, or server-side application code.
5. Asset/license attribution review and secret scan before every publication.
