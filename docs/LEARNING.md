# Learning from The Silent Annex

This project is meant to be read, not just played. This guide builds up your mental model of how it works: what exists, where it lives, who calls it, and what happens when it fails.

You don't need to read it all at once. Part 1 is the map, and the rest is there for when you need it.

## Part 1: The big picture

The most important idea in this codebase is one split:

```
          LOGIC (no graphics)                 PRESENTATION
   +-----------------------------+     +-------------------------+
   | GameSession                 |     | Three.js scene          |
   |   flags, inventory, puzzles | --> | Web Audio               |
   |   objectives, doors         |     | HTML and CSS screens    |
   +-----------------------------+     +-------------------------+
            ^                                      |
            |         player presses E             |
            +--------------------------------------+
```

The left side knows what's true: "the door is unlocked", "the player has the fuse". The right side only shows it.

**Why split it?** Three real benefits:

1. **It can be tested.** `tests/playthrough.test.ts` plays the entire game in about a second, with no graphics card involved.
2. **Saving is simple.** A save file is a copy of the left side. Loading rebuilds the right side from it.
3. **Bugs are easier to place.** If a door won't open, either the rule is wrong (logic) or the animation is wrong (presentation). You only have to look in one half.

### What happens when you press E on a locked door

Follow this path through the code. If you understand this, you understand the architecture.

```
Keyboard: E
  -> InputManager records a press                 core/InputManager.ts
  -> Game.handlePlayInput notices it              core/Game.ts
  -> InteractionSystem says what you're facing    interaction/InteractionSystem.ts
  -> DoorInteractable.interact()                  world/InteractiveObjects.ts
  -> useDoor() applies the rules                  interaction/InteractionLogic.ts
       Has the key? Remove it, unlock the door.
  -> GameSession.openDoor()                       core/GameSession.ts
       Changes state, and announces 'door:opened' on the EventBus
  -> StoryPresenter hears the announcement        systems/StoryPresenter.ts
       Plays the sound, and tells the door to swing
  -> DoorRuntime animates, and clears collision   world/Door.ts
```

Notice that `GameSession` never touches audio or Three.js. It announces what happened and carries on.

### Files to read first

| Order | File | Why |
|---|---|---|
| 1 | `src/core/GameSession.ts` | All game state, in one place |
| 2 | `src/world/levels/reception.ts` | What a level looks like as plain data |
| 3 | `src/interaction/InteractionLogic.ts` | The rules for using anything |
| 4 | `src/puzzles/ElectricalPuzzle.ts` | A complete puzzle in under 80 lines |
| 5 | `src/core/Game.ts` | How everything connects (it's the longest, so read it last) |

## Part 2: Vocabulary

Each term has a pronunciation, a plain meaning, and where to see it here.

| Term | Say it | Meaning | In this project |
|---|---|---|---|
| **TypeScript** | TYPE-script | JavaScript plus labels saying what kind of data each thing holds, checked before the code runs | Every `.ts` file |
| **Interface** | IN-ter-face | A promise about what an object can do, without saying how | `Interactable` in `interaction/Interactable.ts` |
| **Event bus** | | A noticeboard: systems post messages, and whoever cares reads them | `core/EventBus.ts`, `core/GameEvents.ts` |
| **State machine** | | Something that's in exactly one mode at a time, with rules for changing mode | `systems/HushSequence.ts` |
| **Game loop** | | The code that runs over and over: read input, update, draw | `core/GameLoop.ts` |
| **Fixed timestep** | | Running physics in equal slices of time, however fast the screen refreshes | `FIXED_STEP` in `GameLoop.ts` |
| **Scene graph** | | A tree of objects, where moving a parent moves its children | The character's bones in `player/PlayerCharacter.ts` |
| **Mesh** | MESH | A 3D shape made of triangles | Everything visible |
| **Material** | | How a surface reacts to light | `assets/materials/MaterialLibrary.ts` |
| **Shader** | SHAY-der | A tiny program that runs on the graphics card, once per corner or per pixel | `rendering/PostProcessing.ts` |
| **Draw call** | | One request to the graphics card to draw something. Fewer is faster | Why `WorldBuilder` merges geometry |
| **Normal map** | | A texture that fakes small bumps by changing how light bounces | `toTextureSet` in `TextureFactory.ts` |
| **Inverse kinematics (IK)** | KIN-eh-MAT-iks | Working out joint angles from where a hand or foot should end up | `solveLeg` in `player/PlayerAnimation.ts` |
| **Collider** | kuh-LIE-der | An invisible shape used for bumping into things | `physics/CollisionManager.ts` |
| **Render target** | | An image the graphics card draws into, instead of the screen | `rendering/SecurityFeeds.ts` |
| **Post-processing** | | Effects applied to the finished picture | `rendering/PostProcessing.ts` |
| **Procedural** | pruh-SEE-jer-ul | Generated by code rather than made by hand | Every texture, model and sound |
| **Serialization** | | Turning live data into text that can be stored | `GameSession.toSave()` |
| **Schema version** | SKEE-muh | A number saying which shape a save file has, so old ones can be upgraded | `SAVE_VERSION` in `saving/SaveData.ts` |
| **Softlock** | | When the player can't progress and the game doesn't know it | What `tests/level.test.ts` proves can't happen |

## Part 3: Common file types

| File | Say it | What it is | Here |
|---|---|---|---|
| `.ts` | "T S" | TypeScript source code | All game code |
| `.css` | "C S S" | Styling for HTML | `src/ui/ui.css` |
| `.html` | "H T M L" | Page structure | `index.html`, which is almost empty because `main.ts` builds everything |
| `package.json` | JAY-son | The project's list of dependencies and commands | `npm run dev` is defined here |
| `tsconfig.json` | | TypeScript's settings | Strict mode is on, so the compiler catches a lot |
| `vite.config.ts` | VEET | Settings for the development server and build tool | |
| `.npmrc` | | npm's settings for this project | Keeps npm's cache inside this folder, because drive C: was full |
| `.md` | "markdown" | Formatted text | This file |

## Part 4: Decisions, and why they were made

These are judgement calls, not universal rules. Each could reasonably have gone another way.

**Level data is plain objects, not code that creates meshes.** A room is a list of what's in it. `WorldBuilder` turns that into meshes and colliders. *Why:* the tests can read the same data to solve the level. *The cost:* a new kind of behaviour needs a new data field, not just a line of code.

**One material per surface type, shared.** *Why:* the graphics card can batch things using the same material. *The cost:* you can't tweak one wall's colour alone without making a new material.

**A small fixed pool of real lights.** The level has dozens of authored lights, but only a few real ones exist. `LightingManager` hands them to whichever matter most. *Why:* changing the number of lights forces every shader to recompile, which causes a visible stutter. *The cost:* a far-away light can pop on or off, so rooms are arranged to hide that.

**Doors lose their collision the moment they start opening.** *The simple way:* no chance of a door trapping or shoving the player. *The realistic way* would be a swinging physical door, which brings a whole set of edge cases this game doesn't need. This is a good example of choosing the simpler solution.

**Pure CSS and HTML for UI, no framework.** *Why:* the brief forbids an unrelated React app, and these screens are simple enough. See how little `ui/dom.ts` needs to do. A much bigger UI might justify a framework.

**Sound is generated, not recorded.** *Why:* no licensing questions and nothing to download. *The cost:* synthesized sound takes careful work to be convincing, and this is the part of the game least verified by a human.

## Part 5: How to change things

**Add a readable document:**
1. Add an entry in `src/progression/content/documents.ts`.
2. Add `doc('rd_my_doc', 'my_doc', [x, y, z], 'Read it')` to a room's `interactables`.
3. Run `npm run test`. It will tell you if you got an id wrong.

**Add an item:** add it to `ItemDatabase.ts`, then place a `pickup(...)` in a room. The test `gives every item a real use` will fail until the item has a purpose. That's deliberate.

**Add a prop:** add its name to `PropType` in `LevelDefinition.ts`. TypeScript will now refuse to compile until you implement it in `PropCatalog.ts`. Let that error lead you to the right place.

**Change a room's size:** edit its `rect`. If a door no longer lines up with a wall, `tests/level.test.ts` will say exactly which one.

**Try it yourself.** A few small exercises, in increasing order of difficulty:
1. Change the reception clock to a different stopped time. (Then notice what else you'd have to change: Puzzle B depends on it.)
2. Make the torch battery drain twice as fast. Where is that number? Does any test notice?
3. Add a fourth breaker to Board 2. Which tests fail, and what does that tell you?

## Part 6: Debugging

When something's wrong, first decide which half of the split it's in.

| Symptom | First place to look |
|---|---|
| A door or puzzle doesn't behave | `InteractionLogic.ts`, or the puzzle's class. Try writing a failing test first |
| Something works, but looks or sounds wrong | `StoryPresenter.ts`, then the system it calls |
| A scripted scare doesn't fire | The `triggers` list in `world/levels/index.ts`. Check `id`, `when`, and `requires` |
| The player gets stuck on something invisible | A prop's `b.solid(...)` in `assets/geometry/`. Colliders are invisible by nature |
| A room looks dark or wrong | That room's `lights` and `ambient` in its level file |
| The game won't start | Browser console (F12). A failed `boot` shows a message on the loading screen |
| A save won't load | `validateSave` in `saving/SaveData.ts`. It explains why it refused |

**Debug tools.** While running `npm run dev`, the browser console has `__annex`, which gives you everything:

```js
__annex.session().flags          // every story flag currently set
__annex.session().currentRoom
__annex.teleport(0, 0, 17)       // jump to a position (x, y, z)
__annex.session().hush.start('h1')  // start a Hush right now
__annex.measureGpu()             // real GPU time per frame, in milliseconds
```

**Lessons this project taught along the way** (all real bugs from building it):

- *A key press can mean two things.* Pressing Tab to close the inventory also registered as "open inventory", so it instantly reopened. The fix: if a menu used the key, gameplay never sees it. (`InputManager.handleKeyDown`)
- *3D surfaces have a front and a back.* The parka looked strange because its faces pointed inward, so you were seeing through the near side to the legs. The clue was seeing something that should have been hidden.
- *Measure with the right tool.* Counting frames said 1 FPS, because a hidden browser tab runs at one frame a second. Forcing the GPU to finish said a suspiciously constant 33 ms. Only the driver's own timer gave a real number.
- *Don't fight the physics engine for no reason.* Ilse's walk stuttered about every half second. The controller was being told to push her into the floor every step, and it occasionally answered "can't move" for one step, which my wall handling took seriously. Since she only needs gravity when she's actually in the air, the fix was to check for ground with a ray first, and to require a wall to block her for two steps in a row. Stalls went from around 6 per 3 seconds to zero.
- *Check a test's assumptions when it fails.* Several "failures" in the browser walkthrough were the script standing in the wrong place, and one exposed a monitor facing the wrong way. Read each failure before deciding which it is.

## Part 7: Test yourself

If you can answer these from the code, you've got the mental model.

1. Why can `tests/playthrough.test.ts` run without a graphics card? What would break that?
2. What's the path from pressing F to the torch going dark? Which parts are logic, and which are presentation?
3. Why does physics run in `fixedUpdate` at exactly 60 Hz, while drawing happens at whatever rate the screen allows?
4. A save file says the player has an item that no longer exists in the game. What happens, and where in the code?
5. Why does the crouch button matter? Trace how it reaches the Hush. (Start at `NOISE_CROUCH`.)
