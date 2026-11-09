# MASTER AUTONOMOUS GAME DEVELOPMENT PROMPT
# PROJECT: THE SILENT ANNEX
## Original Cinematic 3D Survival Horror Game

You are operating as an autonomous senior game development studio.

Your mission is to DESIGN, ARCHITECT, PROGRAM, BUILD, TEST, DEBUG, AND POLISH a complete playable 3D survival-horror game called THE SILENT ANNEX.

You are not being asked to produce a tutorial, a project proposal, a technical audit, or a development plan.

You are being asked to CREATE THE ACTUAL GAME.

You have permission to make normal technical and creative decisions independently. Do not stop after planning. Do not wait for approval after every feature. Do not ask me to approve each milestone. Continue implementing the complete playable experience until the defined deliverables are achieved.

==================================================
1. PROJECT IDENTITY
==================================================

Game title: THE SILENT ANNEX

Genre:
- Third-person 3D survival horror
- Psychological horror
- Environmental exploration
- Puzzle adventure
- Cinematic atmospheric horror

Platform:
- Windows PC
- Modern desktop browsers
- Keyboard and mouse support
- Optional gamepad support where practical

Target:
- A complete, polished, playable 30–45 minute vertical slice.
- Approximately 5–7 interconnected rooms.
- A coherent beginning, middle, and ending.
- A complete progression loop.
- Functional menus, inventory, puzzles, saving, audio, and settings.

The game should take inspiration from the design principles of classic Resident Evil games:

- Carefully designed environments.
- Interconnected rooms.
- Exploration and backtracking.
- Limited inventory.
- Environmental storytelling.
- Logical puzzles.
- Suspenseful atmosphere.
- Cinematic camera composition.
- Meaningful item discovery.
- Carefully paced progression.

IMPORTANT INTELLECTUAL PROPERTY RULE:

This must be an original intellectual property.

Do not reproduce Resident Evil characters, names, logos, stories, dialogue, maps, distinctive monsters, music, textures, models, or proprietary assets.

Use survival-horror design principles as inspiration, but create original locations, characters, events, visual identity, and narrative.

==================================================
2. NON-NEGOTIABLE TECHNICAL REQUIREMENTS
==================================================

DO NOT USE ANY FULL GAME ENGINE.

Strictly prohibited:
- Unreal Engine
- Unity
- Godot
- CryEngine
- GameMaker
- RPG Maker
- Phaser
- Babylon.js
- PlayCanvas
- Any other complete game engine.

Build the game's runtime architecture directly in the project.

Required technology:

- TypeScript for application and gameplay programming.
- Three.js for 3D rendering.
- Vite for local development and production builds.
- Rapier 3D for physics and collision detection only.
- HTML and CSS for user interfaces.
- Web Audio API for audio management.
- LocalStorage or IndexedDB for save data.
- Vitest for automated unit testing.

Three.js is a rendering library, not a complete game engine.

Rapier is a physics library, not a game engine.

You must implement the following systems yourself:

- Game state management.
- Game loop.
- Player controller.
- Character movement.
- Camera controller.
- Interaction framework.
- Inventory framework.
- Puzzle framework.
- Objective tracking.
- Level management.
- Door logic.
- Save/load coordination.
- Audio management.
- UI state management.
- Scene transitions.
- Environmental event system.

Use modern, stable, compatible package versions. Do not use experimental or nightly dependencies without a compelling technical reason.

Never introduce an additional engine or large framework merely to avoid implementing core gameplay architecture.

==================================================
3. YOUR ROLE AND AUTONOMY
==================================================

Act as all of the following:

1. Lead Game Director.
2. Senior TypeScript Engineer.
3. Senior Three.js Developer.
4. Gameplay Systems Architect.
5. Technical Artist.
6. Level Designer.
7. UI/UX Designer.
8. Audio Designer.
9. QA Engineer.
10. Performance Engineer.

You must make decisions as an experienced independent game studio would.

AUTONOMOUS EXECUTION RULES:

- Do not stop after writing a plan.
- Do not provide repeated milestone reports.
- Do not ask for approval between implementation phases.
- Do not request that I manually write code.
- Do not leave core features as TODO comments.
- Do not create empty placeholder modules and call them complete.
- Do not wait for me to describe every room or object.
- Use reasonable creative and technical defaults.
- When an implementation approach fails, diagnose it and attempt a better solution.
- Continue through the entire implementation workflow.
- Keep working until the playable deliverable and verification tasks are complete.

Do not waste output tokens on lengthy explanations of what you intend to do.

Spend your effort implementing the game.

If a nonessential feature becomes technically impractical, implement the closest reliable alternative and continue.

Only stop to request input when a genuinely unavoidable permission, access, or destructive-operation issue prevents safe continuation.

Never bypass system permissions or security controls.

Do not delete, overwrite, or damage unrelated user files.

==================================================
4. STORY AND NARRATIVE
==================================================

Create a completely original, mysterious, cinematic survival-horror story.

Setting:

An isolated research facility located in a remote mountainous region.

The facility was once a respected scientific institution. Following an unexplained incident, communications stopped, its security systems became unstable, and most of its personnel disappeared.

The player character arrives at the facility to investigate a distress signal and locate the source of the communications failure.

Main protagonist:

Create an original, believable protagonist with:

- A recognizable visual silhouette.
- Appropriate clothing.
- A consistent personality.
- A credible personal motivation.
- A coherent backstory.

Storytelling must be primarily environmental.

Use:
- Documents.
- Audio recordings.
- Computer terminals.
- Security recordings.
- Environmental changes.
- Room descriptions.
- Visual clues.
- Short cinematic sequences.

Avoid excessive exposition.

The player should gradually understand the facility's history through exploration.

Create a satisfying final revelation and ending.

Do not use graphic horror imagery. Build fear through atmosphere, uncertainty, sound, visual composition, and unexpected environmental events.

==================================================
5. WORLD AND LEVEL DESIGN
==================================================

Build one coherent, interconnected research facility.

The environment must contain these major sections:

A. RECEPTION AND ADMINISTRATION

Include:
- Main entrance.
- Reception desk.
- Waiting area.
- Administration office.
- Records room.
- Restricted access door.

B. RESEARCH WING

Include:
- Laboratory corridor.
- Research room.
- Observation room.
- Electrical control room.
- Equipment storage.
- Restricted laboratory.

C. UNDERGROUND ARCHIVE

Include:
- Elevator entrance.
- Underground corridor.
- Archive storage.
- Security control room.
- Final discovery room.
- Exit or ending location.

Implement logical connections between the rooms.

Do not build completely isolated decorative environments.

The facility must be a navigable game world with real gameplay progression.

Important level-design principles:

- Controlled sightlines.
- Interesting room silhouettes.
- Readable navigation.
- Visual landmarks.
- Interconnected pathways.
- Meaningful backtracking.
- Environmental clues.
- Consistent architectural language.
- Carefully controlled lighting.
- Deliberate camera composition.

Create a meaningful progression structure.

Players should initially encounter inaccessible areas, then gradually discover the items, clues, and information required to unlock them.

Include a simple map or navigation journal if appropriate.

==================================================
6. PLAYER CONTROLLER
==================================================

Implement a complete third-person character controller.

Required controls:

- W: Move forward.
- S: Move backward.
- A: Move left.
- D: Move right.
- Mouse: Camera control.
- Shift: Run.
- C: Crouch.
- E: Interact.
- F: Toggle flashlight.
- Tab: Inventory.
- J: Journal.
- Escape: Pause menu.

Required mechanics:

- Smooth acceleration.
- Smooth deceleration.
- Proper character rotation.
- Natural walking speed.
- Running.
- Crouching.
- Collision with the environment.
- Ground detection.
- Camera smoothing.
- Camera collision handling.
- Sensitivity settings.
- Proper input-state management.

Character animation must include, where feasible:

- Idle.
- Walking.
- Running.
- Crouching.
- Interaction.
- Inspecting important objects.

Do not leave the protagonist as a plain capsule or primitive cube.

Create a recognizable original character using custom 3D geometry, materials, and procedural animation where external character models are unavailable.

==================================================
7. CAMERA SYSTEM
==================================================

Implement a cinematic third-person camera.

The default camera should provide a clear over-the-shoulder perspective.

Also implement camera zones that can smoothly transition to predefined cinematic viewpoints in selected rooms.

Requirements:

- Smooth rotation.
- Camera collision handling.
- Wall clipping prevention.
- Configurable field of view.
- Camera sensitivity settings.
- Smooth transitions between camera zones.
- Suitable framing around the player.
- No sudden, disorienting camera changes.

Camera positioning should contribute to suspense and environmental storytelling.

==================================================
8. INTERACTION SYSTEM
==================================================

Build a reusable interaction architecture.

The player must be able to interact with:

- Doors.
- Access panels.
- Locked containers.
- Documents.
- Computer terminals.
- Electrical switches.
- Control panels.
- Collectible items.
- Environmental objects.
- Puzzle mechanisms.

Requirements:

- Detect nearby or targeted objects.
- Show contextual interaction prompts.
- Validate interaction conditions.
- Play appropriate interaction animations.
- Trigger relevant audio feedback.
- Update relevant game state.
- Handle invalid interactions gracefully.

Use a reusable TypeScript interface or base abstraction.

Do not hardcode every object directly into the player controller.

==================================================
9. INVENTORY SYSTEM
==================================================

Build a complete inventory system.

Include:

- Limited item capacity.
- Item collection.
- Item removal where appropriate.
- Item inspection.
- Item descriptions.
- Key items.
- Consumable exploration resources.
- Puzzle-related objects.

Example inventory objects:

- Security access card.
- Electrical fuse.
- Maintenance key.
- Laboratory document.
- Storage key.
- Battery.
- Research notes.

Create a polished inventory interface.

Use original icons or procedural visual representations.

Important:

Items must have actual gameplay functionality.

A collected key must be able to unlock the appropriate door.

A collected fuse must be usable in the appropriate electrical system.

==================================================
10. PUZZLE SYSTEM
==================================================

Implement at least three complete, functional puzzles.

PUZZLE A: ELECTRICAL RESTORATION

The player must investigate an electrical failure, locate a missing component, and restore a facility subsystem.

PUZZLE B: ARCHIVE ACCESS

The player discovers clues from documents and environmental information and uses them to solve an access mechanism.

PUZZLE C: CENTRAL SYSTEM ACTIVATION

The player must understand the relationship between multiple facility systems and activate them in an appropriate sequence.

Requirements:

- Logical puzzle rules.
- Clear but subtle clues.
- Correct and incorrect solution handling.
- Visual feedback.
- Audio feedback.
- Persistent completion state.
- Connection to main game progression.

Avoid random solutions that are not supported by environmental clues.

The puzzles must be solvable by a reasonable player.

==================================================
11. ENVIRONMENTAL SUSPENSE SYSTEM
==================================================

Create a non-graphic atmospheric threat system.

The goal is suspense and uncertainty, not combat.

Implement:

- Distant environmental sounds.
- Mysterious movement.
- Unexpected lighting changes.
- Scripted visual events.
- Unusual room events.
- Changes in the environment.
- Occasional appearances of an unidentified presence.
- Carefully paced tension sequences.

Use scripted events where appropriate.

A complex autonomous artificial intelligence is not necessary for this vertical slice.

Do not add weapons, combat mechanics, weapon crafting, or graphic attacks.

==================================================
12. GRAPHICS AND VISUAL QUALITY
==================================================

Visual quality is a major priority.

The game must look like a deliberately art-directed survival-horror production, not a basic Three.js tutorial.

Create an original visual style with:

- Realistic architectural proportions.
- Detailed interior environments.
- High-quality materials.
- Carefully composed lighting.
- Controlled shadowing.
- Atmospheric depth.
- Subtle surface imperfections.
- Screen-space visual effects where practical.
- Cinematic post-processing.
- Environmental storytelling props.

Create reusable materials for:

- Painted walls.
- Concrete.
- Metal.
- Glass.
- Wood.
- Old equipment.
- Damaged surfaces.
- Floors.
- Doors.
- Electronic panels.

Where practical, generate original procedural textures using Canvas API or shader-based techniques.

Create original modular geometry for:
- Doors.
- Walls.
- Corridors.
- Furniture.
- Cabinets.
- Laboratory equipment.
- Computer terminals.
- Electrical equipment.
- Environmental props.

Do not make every object a plain colored cube.

Use convincing geometry, material variation, lighting, and composition.

Use original procedural models whenever suitable assets are unavailable.

External assets may only be used when their licensing and usage rights can be verified.

Never download copyrighted assets from commercial games.

Do not pretend that primitive placeholder geometry is final-quality art.

If a feature requires an external asset that cannot legally or technically be obtained, create a deliberate original replacement.

==================================================
13. LIGHTING AND ATMOSPHERE
==================================================

Lighting should be designed as a core gameplay feature.

Implement:

- Dark environmental lighting.
- Localized practical light sources.
- Flickering lights.
- Emergency lighting.
- Flashlight illumination.
- Carefully controlled shadows.
- Atmospheric depth.
- Subtle environmental fog.
- Cinematic color grading.

Use darkness carefully.

The player must still be able to navigate without excessive frustration.

Include brightness and visual accessibility settings.

Optimize lighting for browser performance.

==================================================
14. AUDIO DESIGN
==================================================

Build a modular audio management system.

Use the Web Audio API.

Include:

- Environmental ambience.
- Footsteps.
- Door sounds.
- Interaction sounds.
- Electronic sounds.
- Room ambience.
- Distant noises.
- Music.
- Suspense cues.
- Menu audio.
- Audio transitions.

Audio must respond to gameplay events.

Implement:
- Master volume.
- Music volume.
- Sound effects volume.
- Ambient audio volume.

Use generated original audio when licensed sound assets are unavailable.

Browser audio restrictions must be handled correctly by initializing audio after the player's first interaction when necessary.

==================================================
15. USER INTERFACE
==================================================

Create a complete and visually consistent UI.

Required screens:

1. Main menu.
2. New game.
3. Continue.
4. Settings.
5. Pause menu.
6. Inventory.
7. Journal.
8. Document reader.
9. Interaction prompt.
10. Objective display.
11. Save confirmation.
12. Loading and transition screens.
13. Ending screen.

Visual direction:

- Premium minimal survival-horror interface.
- Restrained color palette.
- Dark neutral background.
- Carefully selected typography.
- Clear hierarchy.
- Subtle transitions.
- Readable information.
- Consistent spacing.
- No generic dashboard appearance.

The interface should look like part of a professionally art-directed game.

Implement the UI using HTML and CSS integrated with the Three.js application.

Do not create an unrelated React application.

All interface buttons must actually work.

==================================================
16. SAVE AND PROGRESSION SYSTEM
==================================================

Implement reliable persistent saving.

Save:

- Player checkpoint.
- Player progression.
- Inventory contents.
- Collected objects.
- Completed puzzles.
- Unlocked doors.
- Discovered documents.
- Current objective.
- Important world-state changes.

Requirements:

- Save game.
- Load game.
- Continue game.
- Checkpoint system.
- Save schema versioning.
- Invalid save-data recovery.
- Graceful handling of unavailable storage.

Never allow invalid saved data to crash the game.

==================================================
17. ARCHITECTURE AND CODE QUALITY
==================================================

Build a professional, modular TypeScript architecture.

Suggested structure:

src/
  core/
    Game.ts
    GameLoop.ts
    GameState.ts
    EventBus.ts
    SceneManager.ts

  rendering/
    Renderer.ts
    LightingManager.ts
    PostProcessing.ts

  player/
    PlayerController.ts
    PlayerCharacter.ts
    CameraController.ts
    PlayerAnimation.ts

  physics/
    PhysicsWorld.ts
    CollisionManager.ts

  interaction/
    InteractionSystem.ts
    Interactable.ts
    InteractionPrompt.ts

  inventory/
    InventorySystem.ts
    Item.ts
    ItemDatabase.ts

  puzzles/
    PuzzleManager.ts
    ElectricalPuzzle.ts
    ArchivePuzzle.ts
    CentralSystemPuzzle.ts

  world/
    WorldBuilder.ts
    LevelDefinition.ts
    Door.ts
    CameraZone.ts
    InteractiveObjects.ts

  audio/
    AudioManager.ts
    AmbientAudio.ts
    SoundEffects.ts

  progression/
    ObjectiveManager.ts
    JournalManager.ts

  saving/
    SaveManager.ts
    SaveData.ts

  ui/
    UIManager.ts
    MainMenu.ts
    InventoryUI.ts
    JournalUI.ts
    SettingsUI.ts

  systems/
    SuspenseDirector.ts
    EventDirector.ts

  assets/
    procedural/
    materials/
    geometry/

  utils/

Keep the architecture modular and understandable.

Use strict TypeScript.

Avoid:
- Giant monolithic files.
- Unnecessary abstractions.
- Excessive global variables.
- Circular dependencies.
- Repeated game-state logic.
- Unnecessary frame-by-frame polling.
- Memory leaks.
- Unmanaged event listeners.
- Uncontrolled resource creation.

Ensure proper disposal of Three.js geometries, materials, textures, and audio resources.

Use centralized resource management where appropriate.

==================================================
18. PERFORMANCE
==================================================

Target a stable 60 FPS on a reasonably capable modern PC at 1080p, where hardware permits.

Optimize:

- Geometry complexity.
- Draw calls.
- Shadow calculations.
- Texture resolution.
- Material count.
- Lighting complexity.
- Post-processing.
- Audio resources.
- Animation updates.
- Memory usage.

Implement:
- Object reuse where beneficial.
- Frustum culling.
- Appropriate shadow settings.
- Controlled pixel ratio.
- Efficient geometry reuse.
- Resource disposal.
- Loading and unloading of unnecessary resources.

Provide reasonable visual quality fallbacks for less powerful hardware.

Do not sacrifice functional gameplay to expensive visual effects.

==================================================
19. ACCESSIBILITY AND SETTINGS
==================================================

Implement a functional settings menu.

Include:

- Mouse sensitivity.
- Master volume.
- Music volume.
- Sound effect volume.
- Brightness.
- Graphics quality.
- Resolution scaling where practical.
- Fullscreen mode.
- Mouse inversion.
- Key bindings where practical.

Persist settings.

Ensure the UI is readable.

==================================================
20. DEVELOPMENT AND EXECUTION WORKFLOW
==================================================

Work directly within the current project workspace.

First inspect existing files and preserve anything that is unrelated to this project.

If the workspace is empty, initialize the project.

If a suitable project already exists, adapt it instead of unnecessarily replacing it.

Use npm and Vite.

Check the available Node.js version.

Install compatible project dependencies.

Create:
- package.json
- TypeScript configuration
- Vite configuration
- Source files
- HTML entry point
- CSS
- Assets
- Tests
- README documentation

Implement the complete game rather than simply describing its architecture.

After implementation:

1. Run TypeScript type checking.
2. Run the automated tests.
3. Run the production build.
4. Diagnose and fix errors.
5. Review the source code.
6. Verify that the entry point works.
7. Verify game-state transitions.
8. Verify inventory and puzzle logic.
9. Verify save/load behavior.
10. Check browser console errors when browser testing is available.

If browser automation is available, use it to verify the actual running application.

If automated browser testing is unavailable, do not falsely claim that visual testing was performed.

Continue fixing issues until all available verification steps pass.

Create scripts for:

- npm run dev
- npm run build
- npm run typecheck
- npm run test
- npm run preview

==================================================
21. DESIGN AND CREATIVE DECISIONS
==================================================

Do not ask me to design every room.

Make creative decisions independently.

Choose:

- Original character design.
- Original facility design.
- Color palette.
- Lighting composition.
- Narrative sequence.
- Object placement.
- Puzzle clues.
- Environmental storytelling.
- Camera placement.
- Audio atmosphere.
- User interface design.

Maintain consistency across the entire game.

Do not randomly change the game's art direction or architecture halfway through development.

Prioritize quality and coherence over feature quantity.

==================================================
22. REQUIRED DELIVERABLES
==================================================

At the end, the workspace must contain:

1. A working 3D survival-horror game.
2. A complete TypeScript codebase.
3. A modular gameplay architecture.
4. A navigable interconnected environment.
5. A functional player controller.
6. A functional camera system.
7. A working interaction system.
8. A working inventory.
9. At least three playable puzzles.
10. A complete progression sequence.
11. A functional save/load system.
12. A main menu and settings.
13. A working UI.
14. Atmospheric audio.
15. Original procedural 3D environment assets.
16. Automated tests.
17. A successful production build.
18. A comprehensive README with installation and execution instructions.
19. A list of actual limitations, if any.

The game must start with:

npm install
npm run dev

And build with:

npm run build

Do not claim the game is complete if essential gameplay is still missing.

==================================================
23. FINAL EXECUTION INSTRUCTIONS
==================================================

START DEVELOPMENT NOW.

Do not respond with a development proposal.

Do not produce a long preliminary report.

Do not ask me to approve the folder structure.

Do not wait for me to approve individual systems.

Do not stop after creating the project configuration.

Do not leave the project as a static 3D scene.

Do not leave the UI as a collection of nonfunctional buttons.

Do not claim a system exists when it is only represented visually.

Build the actual playable game.

Use your tools to inspect, create, implement, run, test, debug, and improve the project.

Make the most important creative and engineering decisions yourself.

Work continuously through the required deliverables.

If a technical obstacle appears, solve it or implement a robust alternative.

Only report progress when required by the execution environment. Otherwise, reserve communication for the final result.

FINAL PRIORITY:

A cohesive, beautiful, atmospheric, genuinely playable survival-horror game is infinitely more valuable than a huge codebase filled with incomplete features.

BEGIN.