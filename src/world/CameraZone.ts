import type { CameraZoneDef, LevelData } from './LevelDefinition';

/** Finds the cinematic camera zone, if any, that the player is standing in. */
export class CameraZones {
  private byRoom = new Map<string, CameraZoneDef[]>();

  constructor(level: LevelData) {
    for (const zone of level.cameraZones) {
      const list = this.byRoom.get(zone.room);
      if (list) list.push(zone);
      else this.byRoom.set(zone.room, [zone]);
    }
  }

  find(roomId: string, x: number, z: number): CameraZoneDef | null {
    const zones = this.byRoom.get(roomId);
    if (!zones) return null;
    for (const zone of zones) {
      const [x0, z0, x1, z1] = zone.rect;
      if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return zone;
    }
    return null;
  }
}
