# Starfield — HTML5 port

A browser-native JavaScript and HTML5 Canvas port of Nick Esposito's 2013
Ruby/Gosu game [Starfield](https://github.com/NickTitle/starfield).

This is an in-progress preservation port. The current milestones establish the
static browser shell, deterministic 60 Hz simulation, original ship controls,
radio dial and signal mixing, 11 seeded artifacts, parallax starfield, lazy
browser audio, source-shaped artifact towers and minimap, the complete story
gate inventory, tower orbit, shutdown lifecycle, sonar bursts, gameplay engine
particles, source-timed two-ship finale, and automated tests.
The source-traced parity plan is in
[`PARITY.md`](./PARITY.md).

## Run

Serve this directory with any static-file host and open `index.html`. There is
no build step, package install, framework, Ruby, Gosu, or server-side
application runtime. For example, if Python is already installed:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

The merged `main` branch is deployed by GitHub Actions to
<https://nicktitle.github.io/strfld-html5/>. Relative asset paths keep the game
working beneath the repository subpath.

## Test

Node.js 20 or newer is used only for the automated test harness, not by the
game at runtime:

```sh
npm test
```

## Controls

- Left / Right: rotate
- Up: thrust
- Comma / Period: tune the radio
- Space: advance story prompts and interact
- Escape: leave or close the browser tab using normal browser controls

Touch-capable devices show the PICO-8 control layout: Left / Right rotate, Up
thrusts, Down advances or interacts, O tunes up, and X tunes down. The overlay
stays hidden for fine-pointer desktop browsers, where the keyboard controls are
unchanged.

## Attribution and license

Game, story, music, sound, visuals, and original Ruby implementation by Nick
Esposito. Port code is released under the original MIT license; see
[`LICENSE`](./LICENSE).
