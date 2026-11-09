// Plays the whole game inside the running page, using real physics, collision and
// interaction detection. Where the Vitest playthrough proves the story logic works, this
// proves a player can physically walk everywhere and press E on everything.
//
// With `npm run dev` running, paste this into the browser console:
//   const m = await import('/tests/browser/walkthrough.ts'); await m.runWalkthrough('silence');

import type { Game } from '../../src/core/Game';

type Debug = Game['debug'];

interface StepResult {
  step: string;
  ok: boolean;
  detail?: string;
}

const STEP_SECONDS = 0.1;

export class Walker {
  results: StepResult[] = [];
  private failed = false;

  constructor(private g: Debug) {}

  private record(step: string, ok: boolean, detail?: string): void {
    this.results.push({ step, ok, detail });
    if (!ok) this.failed = true;
  }

  get ok(): boolean {
    return !this.failed;
  }

  /** Walks in a straight line to a point, turning the camera as a player would. */
  walk(x: number, z: number, label = '', maxSeconds = 40): boolean {
    const player = this.g.player();
    let stuckTimer = 0;
    let lastX = player.position.x;
    let lastZ = player.position.z;
    for (let t = 0; t < maxSeconds; t += STEP_SECONDS) {
      const dx = x - player.position.x;
      const dz = z - player.position.z;
      if (Math.hypot(dx, dz) < 0.22) {
        this.g.move(0, 0);
        this.g.advance(0.15, false);
        return true;
      }
      if (this.g.lockState().blocking) this.g.ui().closeAll();
      this.g.look(Math.atan2(-dx, -dz), -0.1);
      this.g.move(0, 1);
      this.g.advance(STEP_SECONDS, false);
      if (Math.hypot(player.position.x - lastX, player.position.z - lastZ) < 0.008) stuckTimer += STEP_SECONDS;
      else stuckTimer = 0;
      lastX = player.position.x;
      lastZ = player.position.z;
      if (stuckTimer > 1.2) break;
    }
    this.g.move(0, 0);
    const where = `[${player.position.x.toFixed(2)}, ${player.position.z.toFixed(2)}] in ${this.g.session().currentRoom}`;
    this.record(`walk ${label || `to ${x},${z}`}`, false, `stuck at ${where}, wanted ${x},${z}`);
    return false;
  }

  /** Walks through several points in order. */
  route(points: [number, number][], label = ''): boolean {
    for (const [x, z] of points) {
      if (!this.walk(x, z, label)) return false;
    }
    return true;
  }

  private aimAt(x: number, y: number, z: number): void {
    const player = this.g.player();
    const eyeY = player.position.y + (player.crouching ? 0.95 : 1.5);
    const dx = x - player.position.x;
    const dz = z - player.position.z;
    this.g.look(Math.atan2(-dx, -dz), Math.atan2(y - eyeY, Math.hypot(dx, dz)));
  }

  /**
   * Stands in a spot, looks at an interactable, and presses E on it, but only if the game
   * itself has picked it out as the focus. That checks range and line of sight for real.
   */
  use(id: string, standX: number, standZ: number, approach: [number, number][] = []): boolean {
    if (!this.route([...approach, [standX, standZ]], id)) return false;
    const target = this.g.interaction().find(id);
    if (!target) {
      this.record(id, false, 'no such interactable');
      return false;
    }
    this.aimAt(target.position.x, target.position.y, target.position.z);
    this.g.advance(0.25, false);
    const focused = this.g.interaction().focused?.id ?? null;
    if (focused !== id) {
      this.record(id, false, `focus was ${focused ?? 'nothing'} instead`);
      return false;
    }
    this.g.useFocused();
    this.g.advance(0.1, false);
    this.record(id, true);
    return true;
  }

  /** Closes whatever screen just opened, after confirming that one did. */
  closeScreen(label: string): void {
    const opened = this.g.lockState().blocking;
    this.record(`${label} opens a screen`, opened);
    this.g.ui().closeAll();
    this.g.advance(0.05, false);
  }

  read(id: string, standX: number, standZ: number, approach: [number, number][] = []): void {
    if (this.use(id, standX, standZ, approach)) this.closeScreen(id);
  }

  /** Stands still until a Hush has passed. */
  waitOutHush(label: string): void {
    const { hush } = this.g.session();
    this.record(`${label} starts`, hush.active);
    for (let t = 0; t < 60 && hush.active; t += 0.5) this.g.advance(0.5, false);
    this.record(`${label} passes`, !hush.active && this.g.session().hushAttempts[label] === undefined);
    this.g.advance(1.5, false);
  }

  expect(label: string, value: boolean): void {
    this.record(label, value);
  }
}

const sleep = (seconds: number) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

/** Everything up to the final choice in the Annex. */
async function playToChoice(w: Walker, g: Debug): Promise<void> {
  const s = g.session();

  // Arrival
  w.use('d_entrance', 0, 29.7);
  g.advance(1.3, false);
  w.route([[0, 24.5], [0, 20]], 'into reception');
  w.expect('entrance sealed behind the player', s.check({ flag: 'entrance_sealed' }));
  g.advance(3, false);

  w.read('rd_visitor_log', -1.1, 14.5);
  g.advance(7, false);
  w.use('sw_phone', -0.2, 14.5);
  w.use('ex_plaque', -3.3, 9.6, [[-7, 15], [-7.3, 9.6]]);
  w.read('rd_night_log_1', 1.5, 10.2);

  // Waiting area
  w.route([[-3, 9.6], [-7.3, 9.6], [-7.3, 15]], 'around the desk');
  w.read('tm_reception', 1.3, 14.5);
  w.route([[-7.3, 15], [-12, 15]], 'to waiting');
  w.use('pk_admin_key', -19.2, 18.5, [[-19.2, 15]]);
  w.use('pk_battery_waiting', -16.2, 14.7);
  w.read('rd_protocol_h', -17.1, 11.8, [[-13.2, 14.7], [-13.2, 12]]);
  w.read('rd_bulletin', -15.3, 11.8);

  // Administration and records
  w.route([[-13, 14.5], [-9, 15], [8.6, 17.5]], 'to admin door');
  w.use('d_admin', 8.7, 17.5);
  g.advance(1, false);
  w.read('rd_memo_code', 16.8, 18.2, [[13, 17.5], [13, 19.2], [16.8, 19.2]]);
  w.read('rd_director_letter', 18.5, 15.6, [[18.6, 19.2], [18.7, 16.5]]);
  w.read('tm_admin', 15.4, 14.9, [[18.5, 14.7]]);
  w.use('d_records', 13, 15.1);
  w.closeScreen('records keypad');
  s.puzzles.enterCode('records_keypad', '1961');
  g.advance(1, false);
  w.use('pk_security_card', 13.6, 9.8, [[13, 12.4]]);
  w.use('sw_floorplan', 12.4, 5.9, [[13.2, 6]]);
  w.expect('card objective', s.objectives.currentId === 'card');
  w.expect('hatch is bolted from this side', g.session().door('d_hatch') !== undefined);

  // The restricted door, with a first glimpse of the figure
  w.route([[13, 12.4], [13, 15.1], [13, 17.5], [8.6, 17.5]], 'back to reception');
  g.advance(1, false);
  w.expect('first glimpse fired', s.check({ flag: 'glimpse_gallery' }));
  w.use('d_restricted', 0.6, 9.3, [[7.3, 15], [7.3, 9.4]]);
  g.advance(1.6, false);
  w.route([[0.6, 6.2]], 'into the corridor');

  // Research wing
  w.use('d_electrical', -16.8, 6.2);
  g.advance(1, false);
  w.read('rd_aune', -25.6, 5.6, [[-20, 6.2]]);
  w.walk(-25.3, 4, 'to board');
  w.use('pz_board2', -25.4, 4);
  w.closeScreen('board 2');
  w.route([[-20, 6.2], [-16.8, 6.2], [-12, 6.1]], 'out of electrical');
  w.use('d_research', -12, 5.7);
  g.advance(1, false);
  w.read('rd_research_notes', -10.1, 2.45, [[-12, 3.4]]);
  w.use('pk_storage_key', -7.8, -4.4, [[-7.7, 2.5]]);
  w.read('tp_olander', -14.2, -1.2, [[-7.7, -1.2], [-14.2, -1.2]]);
  w.use('ex_whiteboard', -12, -4.4, [[-16.8, -1.2], [-16.8, -4.4]]);
  w.route([[-16.8, -4.4], [-16.8, 2.5], [-12, 3.4], [-12, 6.1]], 'out of research');
  w.route([[6, 6.2], [6, 2.5]], 'to junction');
  w.use('st_research_post', 7.9, -0.6);
  w.closeScreen('pneumatic post');
  w.use('d_storage', 7.9, 1.4);
  g.advance(1, false);
  w.read('rd_night_log_2', 11.2, 2.9, [[10, 1.4], [10.3, 2.8]]);
  w.route([[10.2, 2.4], [10.2, -0.5], [14.3, -1.55]], 'through storage');
  w.use('pk_fuse', 19.2, -3.4, [[18.6, -1.55]]);
  w.use('pk_battery_storage', 17.4, -1.1, [[18.6, -1.55]]);
  w.use('d_hatch', 18.5, 3.6, [[18.6, -0.5]]);
  g.advance(1, false);

  // Crouching through the hatch and back, to check the low opening really works.
  w.expect('hatch opened', s.openDoors.has('d_hatch'));
  g.crouch();
  g.advance(0.3, false);
  w.route([[18, 5.4], [18, 6.2]], 'crouch through hatch');
  w.expect('reached records through the hatch', s.currentRoom === 'records');
  w.route([[18, 4]], 'crouch back');
  g.advance(0.2, false);
  g.crouch();
  g.advance(0.3, false);
  w.expect('stood up after hatch', !g.player().crouching);

  w.route([[18.6, -0.5], [14.3, -1.55], [10.2, -0.5], [10.2, 1.4], [8, 1.4], [6, 2.5], [6, 6]], 'back to corridor');
  g.advance(0.2, false);
  w.waitOutHush('h1');

  w.route([[-16.8, 6.2], [-20, 6.2], [-25.3, 4.2]], 'back to board');
  w.use('pz_board2', -25.4, 4);
  s.puzzles.seatFuse();
  for (const id of ['west', 'reserve', 'main', 'east'] as const) s.puzzles.toggleBreaker(id);
  s.puzzles.energise();
  w.closeScreen('board 2 solved');
  w.expect('power restored', s.check({ flag: 'main_power' }));

  w.route([[-20, 6.2], [-16.8, 6.2], [-2, 5.9]], 'to observation');
  w.use('d_observation', -1.5, 5.9);
  g.advance(1, false);
  w.read('rd_test44', -3.9, 0.75, [[-1.5, 3.5]]);
  w.use('sw_lab_release', -1.1, 0.75);
  w.route([[-1.5, 3.5], [-1.5, 5.9], [6, 6.2], [6, 2.5]], 'back to junction');
  w.use('d_lab', 6, -0.4);
  g.advance(1.5, false);
  w.route([[6, -3.2], [1.5, -5.6]], 'into chamber');
  w.read('rd_hana_lab', 1.5, -5.8);
  w.use('pk_lift_key', 1.5, -7.5);
  w.use('pk_research_notes', -0.2, -5.7);
  w.use('d_labLift', 7.9, -9, [[1, -5.7], [3.6, -5.7], [7.9, -6.5]]);
  g.advance(1, false);
  w.use('tr_lift_down', 14.4, -9.25, [[11, -9]]);
  await sleep(0.9);
  g.advance(0.1, false);
  await sleep(4);
  g.advance(0.2, false);
  w.expect('rode the lift', s.currentRoom === 'liftLanding');

  // Level C
  w.route([[10.5, -9.5], [4, -9.5]], 'into level C');
  g.advance(8, false);
  w.read('rd_archive_guide', -1.4, -10.1);
  w.use('pz_archive', -3.8, -10.1);
  w.closeScreen('archive panel');
  for (const [i, value] of [2, 4, 4, 0, 3, 1, 7].entries()) {
    for (let step = 0; step < value; step++) s.puzzles.rotateDial(i, 1);
  }
  s.puzzles.pullArchiveLever();
  w.expect('archive unlocked', s.openDoors.has('d_archive'));
  g.advance(1.5, false);
  w.route([[-6, -10.4], [-6, -13], [-8, -14], [-8, -27.3]], 'into the archive');
  w.use('pk_reel', -8, -27.6);
  w.read('rd_procedure_b', -7, -27.7);
  w.use('pk_battery_archive', -18.8, -27.6, [[-12, -27.5]]);
  w.use('pk_security_key', 2.4, -27.6);
  g.advance(0.2, false);
  w.waitOutHush('h2');
  w.route([[2, -27], [-3.5, -27.3], [-8, -27.3], [-8, -14], [-6, -13], [-6, -10.4], [-17, -9.5]], 'out of the archive');
  w.use('d_security', -17, -8.2);
  g.advance(1, false);
  w.route([[-17, -6], [-15, -3]], 'into security');
  w.use('tp_cctv', -15, -0.4);
  w.expect('footage is locking input', g.lockState().inputLocks > 0);
  await sleep(10.5);
  w.expect('footage ended on the transcript', g.lockState().blocking);
  g.ui().closeAll();
  g.advance(0.2, false);
  w.read('rd_director_final', -21.3, -3.4, [[-19, -3]]);
  w.read('rd_procedure_c', -21.3, -2.5);
  w.use('pz_central', -11.6, -3, [[-15, -3]]);
  w.closeScreen('annex panel');
  w.expect('needs the ignition key', s.objectives.currentId === 'ignition');

  // Back upstairs by the new service stair
  w.route([[-15, -3], [-17, -6], [-17, -9.5]], 'out of security');
  w.read('rd_procedure_a', -23.6, -10.1);
  w.use('sw_coolant', -21.5, -10.1);
  w.route([[0, -9.5]], 'to the stair');
  w.use('sw_unbolt_stairs', 2, -8.9);
  g.advance(0.3, false);
  w.use('tr_stairs_up', 2, -8.9);
  await sleep(0.9);
  g.advance(0.1, false);
  await sleep(2.8);
  g.advance(0.2, false);
  w.expect('climbed the stair', s.currentRoom === 'waiting');
  w.route([[-19, 13.2], [-13.2, 14.7], [-10.5, 15]], 'through waiting');
  w.route([[-9.5, 15], [-7, 15], [8.6, 17.5]], 'through reception');
  w.route([[13, 17.5], [13, 19.2], [18.6, 19.2], [18.7, 16.5]], 'to the safe');
  w.use('pz_safe', 18.5, 15.5);
  s.puzzles.enterCode('director_safe', '1410');
  g.advance(1, false);
  w.closeScreen('director safe');
  w.use('pk_ignition_key', 18.5, 15.5);
  w.expect('has the ignition key', s.inventory.has('ignition_key') || s.inventory.storage.includes('ignition_key'));

  w.route([[18.7, 16.5], [18.6, 19.2], [13, 19.2], [13, 17.5], [9.2, 17.5], [8, 17.5]], 'back to reception');
  g.advance(0.3, false);
  w.waitOutHush('h3');
  w.expect('the waiting area has been rearranged', s.check({ flag: 'chairs_moved' }));
  w.route([[-7, 15], [-11, 15], [-13, 17.8], [-19.8, 17.8], [-19.8, 13.2]], 'back through waiting');
  w.use('tr_stairs_up_side', -19.8, 13.2);
  await sleep(0.9);
  g.advance(0.1, false);
  await sleep(2.8);
  g.advance(0.2, false);
  w.expect('went back down', s.currentRoom === 'underCorridor');

  w.route([[2, -9.5], [-17, -9.5], [-17, -6], [-15, -3]], 'back to security');
  w.use('pz_central', -11.6, -3);
  s.puzzles.insertIgnitionKey();
  for (const control of ['generator', 'ventilation', 'dampers', 'release'] as const) s.puzzles.operateCentral(control);
  w.closeScreen('annex panel solved');
  w.expect('annex released', s.check({ flag: 'annex_release' }));

  w.route([[-15, -3], [-17, -6], [-17, -9.5], [-24, -9.5]], 'to the annex door');
  w.use('d_annex', -24.4, -9.5);
  g.advance(6, false);
  w.route([[-27, -9.5], [-36.2, -9.5], [-36.4, -7.2], [-39.4, -7.1]], 'into the annex');
  g.advance(4, false);
  w.expect('listener seen by the chairs', s.events.fired.has('t_annex_figure'));
  w.expect('reached the source objective', s.objectives.currentId === 'source');
  w.read('tp_hana_final', -39.4, -7.1);
}

export async function runWalkthrough(ending: 'silence' | 'answer' = 'silence'): Promise<{ ok: boolean; failures: StepResult[]; steps: number; ending: string | null; playtime: number }> {
  const g = (window as unknown as { __annex: Debug }).__annex;
  g.settings().update({ cinematicCameras: false });
  await g.startNewGame();
  await sleep(0.5);
  g.advance(22, false);
  await sleep(1.5);

  const w = new Walker(g);
  await playToChoice(w, g);
  const s = g.session();

  if (ending === 'silence') {
    w.use('sw_cut', -41.4, -9.1, [[-41.6, -7.2]]);
    w.expect('signal cut', s.check({ flag: 'signal_cut' }));
    w.use('d_exit', -50.6, -9.5);
    g.advance(1, false);
    w.route([[-53.5, -9.5], [-75.5, -9.5]], 'out through the tunnel');
    // The last few steps are taken by hand, as the ending takes control partway through them.
    g.move(0, 1);
    g.advance(1, false);
    g.move(0, 0);
  } else {
    w.use('sw_speak', -38.1, -7.2);
  }
  g.advance(0.3, false);
  w.expect(`${ending} ending reached`, s.ending === ending);

  return {
    ok: w.ok,
    failures: w.results.filter((result) => !result.ok),
    steps: w.results.length,
    ending: s.ending,
    playtime: Math.round(s.playtime),
  };
}
