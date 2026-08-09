# Starfield — HTML5 port

A browser-native JavaScript and HTML5 Canvas port of Nick Esposito's 2013
Ruby/Gosu game [Starfield](https://github.com/NickTitle/starfield).

This is an in-progress preservation port. Milestone 1 establishes the static
browser shell, deterministic 60 Hz simulation, original ship controls, radio
dial bounds, parallax starfield, lazy browser audio, and automated tests. The
source-traced parity plan is in [`PARITY.md`](./PARITY.md).

## Run

Serve this directory with any static-file host and open `index.html`. There is
no build step, package install, framework, Ruby, Gosu, or server-side
application runtime. For example, if Python is already installed:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

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

## Attribution and license

Game, story, music, sound, visuals, and original Ruby implementation by Nick
Esposito. Port code is released under the original MIT license; see
[`LICENSE`](./LICENSE).
