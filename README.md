# The Silent Annex

An original third-person survival-horror game that runs in a desktop browser. It's a 30 to 45 minute vertical slice with a complete story, three main puzzles (plus two code locks), two endings, saving, and a fully synthesized soundtrack.

December 1987. Ilse Marek, a radio technician, walks up to an isolated research institute on Hollin Ridge to find the source of a distress signal only she can hear. Her sister worked there. Forty-one people did. None of them answer the telephone.

There is no combat. The threat is **the Hush**: when the world's sound drains away, stop moving, get low, and don't touch anything until it comes back.

Everything in the game is original, and nothing is downloaded at runtime. Every texture, model, sound and piece of music is generated in code as the game loads. The only external assets are four open-licensed typefaces, bundled with the game.

## Running it

You need [Node.js](https://nodejs.org) 22.12 or newer.

```bash
npm install
```

```bash
npm run dev
```

Then open the address it prints, normally <http://localhost:5173>. Best played in the dark, with headphones.

### Other commands

| Command | What it does |
|---|---|
| `npm run build` | Makes the production build in `dist/` |
| `npm run preview` | Serves that build locally |
| `npm run typecheck` | Checks all TypeScript types |
| `npm run test` | Runs the automated tests |

## Controls

| Key | Action |
|---|---|
| W A S D | Move |
| Mouse | Look (click the game to capture the mouse, or drag to look) |
| Left Shift | Run |
| C | Crouch |
| E | Interact |
| F | Torch on or off |
| Tab | Inventory |
| J | Journal, documents and map |
| Esc | Pause |

Keys can be rebound in Settings. Gamepads work too: left stick moves, right stick looks, A uses, X toggles the torch, B crouches, Y opens the bag, right trigger runs.

## How it's built

There is no game engine. **Three.js** draws triangles, **Rapier** answers collision questions, and every gameplay system is written directly in this project.

```
src/
  core/        Game (wires everything together), loop, input, settings, GameSession
  rendering/   Renderer, light pool, post-processing, atmosphere, security feeds
  player/      Controller, procedural character and animation, camera
  physics/     A thin wrapper around Rapier
  interaction/ The Interactable interface and the rules for using things
  inventory/   Items and the bag
  puzzles/     The puzzle rules, as plain classes
  world/       Level data (world/levels), WorldBuilder, doors, camera zones
  progression/ Objectives, journal, and all written story content
  saving/      Versioned save data, validation and recovery
  systems/     Triggers, the Hush state machine, the suspense director, the Listener
  audio/       Sound synthesis, ambience, and the mixer
  ui/          Every screen, in plain HTML and CSS
  assets/      Procedural textures, materials, and props
tests/         Vitest suites, plus a walkthrough that plays the game in a real browser
docs/          LEARNING.md: a guided tour of how all of this works
```

The important design decision is that **all game rules are separate from the renderer**. `GameSession` and everything it owns can run with no graphics at all, which is why the whole game can be played through by an automated test.

If you'd like to understand or change the code, start with [docs/LEARNING.md](docs/LEARNING.md).

## Testing

`npm run test` runs 71 tests, including:

- Two complete playthroughs, to both endings, including a save and reload partway.
- A **no-softlock solver**, which works through the level data and proves that every key is reachable before the lock it opens, and that every room, item, puzzle and ending can be reached.
- Save recovery: corrupted data, old versions, missing fields and unavailable storage.
- Each puzzle's right and wrong paths, including a check that Board 2 has exactly one solution.

`tests/browser/walkthrough.ts` plays the entire game in the real page, with real physics, collision and interaction detection. It needs the dev server, and is run from the browser console:

```js
const m = await import('/tests/browser/walkthrough.ts');
await m.runWalkthrough('silence'); // or 'answer'
```

## Graphics quality

The game picks a starting quality from your graphics chip, then adjusts its resolution automatically if frames take too long. You can change both in Settings.

| Quality | Textures | Effects |
|---|---|---|
| Low | Up to 256 px | No bloom, no antialiasing, torch shadows only |
| Medium | Up to 512 px | Bloom, light antialiasing, static room shadows |
| High | Up to 1024 px | Adds contact shadows (ambient occlusion) and stronger antialiasing |

GPU time measured with the driver's own timer, on an Intel Iris Plus integrated GPU, at 1024x768 with the pixel ratio shown:

| Quality | Resolution drawn | GPU time per frame |
|---|---|---|
| Low | 1024x768 | 11 to 30 ms |
| Medium | 1024x768 | 12 to 20 ms |
| High | 1536x1152 | 51 to 73 ms |

High is meant for a dedicated graphics card and isn't suggested for integrated GPUs. These measurements were taken with the browser window throttled in the background, so treat them as a guide. Frame rate on other hardware hasn't been measured.

## Known limitations

- **Sound hasn't been heard by a person.** It was built and checked by program: every sound is confirmed to synthesize without errors and at sensible levels, but nobody has yet judged how it sounds, or the mix.
- **Real play hasn't been tested by a human.** The whole game has been played by automated scripts using real physics and collision, but not by someone holding a mouse. The 30 to 45 minute length is an estimate: a script takes about 11 minutes with no reading or thinking.
- **Mouse capture wasn't tested.** The test browser refused it, so the drag-to-look fallback was tested instead. Capturing the mouse, and fullscreen, are built but unverified in a normal browser window.
- **Character animation is procedural.** She walks, runs, crouches and reaches convincingly from behind, where she's usually seen. There's no facial animation, and strafing plays the walk cycle turned toward the direction of travel.
- **Art has limits.** Everything is generated from code, so surfaces are convincing at normal play distance, but fine detail is modest up close, and the character is made of simple rounded forms.
- **Changing graphics quality reloads the page**, because every texture has to be repainted. Anything since your last checkpoint is lost, and the game warns you first.
- **Saves live in this browser's local storage.** Clearing site data deletes them, and they don't move between browsers or machines.
- **Desktop only.** It needs a keyboard and mouse, or a gamepad, plus WebGL 2.
