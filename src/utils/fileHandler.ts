import type { Waypoint, WaypointFile } from '../types/waypoint';
import { v4 as uuidv4 } from 'uuid';

export function parseWaypointFile(json: string): WaypointFile {
  const data = JSON.parse(json);
  if (!data.waypoints || !Array.isArray(data.waypoints)) {
    throw new Error('Invalid .waypoints file: missing waypoints array');
  }
  return {
    version: data.version ?? '1.0',
    metadata: {
      name: data.metadata?.name ?? 'Untitled',
      created: data.metadata?.created ?? new Date().toISOString(),
    },
    waypoints: data.waypoints.map((w: Partial<Waypoint>) => ({
      id: w.id ?? uuidv4(),
      name: w.name ?? 'Waypoint',
      x: Number(w.x ?? 0),
      y: Number(w.y ?? 0),
      z: Number(w.z ?? 0),
      type: w.type ?? 'default',
      description: w.description ?? '',
      metadata: w.metadata ?? {},
    })),
  };
}

export function serializeWaypointFile(wf: WaypointFile): string {
  return JSON.stringify(wf, null, 2);
}

export function createEmptyFile(name = 'Untitled'): WaypointFile {
  return {
    version: '1.0',
    metadata: { name, created: new Date().toISOString() },
    waypoints: [],
  };
}

export function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
