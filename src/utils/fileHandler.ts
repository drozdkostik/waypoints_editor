import type { Waypoint, WaypointFile } from '../types/waypoint';
import { v4 as uuidv4 } from 'uuid';

function parseQGCWPL(content: string): WaypointFile {
  const lines = content.trim().split('\n');
  if (!lines[0].trim().startsWith('QGC WPL')) throw new Error('Not a valid QGC WPL file');

  const waypoints: Waypoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split('\t');
    if (cols.length < 12) continue;
    waypoints.push({
      id: uuidv4(),
      name: `WP ${cols[0]}`,
      lat: parseFloat(cols[8]),
      lon: parseFloat(cols[9]),
      alt: parseFloat(cols[10]),
      type: 'default',
      description: '',
      metadata: {
        qgc_index: parseInt(cols[0]),
        qgc_current: parseInt(cols[1]),
        qgc_frame: parseInt(cols[2]),
        qgc_command: parseInt(cols[3]),
        qgc_params: [parseFloat(cols[4]), parseFloat(cols[5]), parseFloat(cols[6]), parseFloat(cols[7])],
        qgc_autocontinue: parseInt(cols[11]),
      },
    });
  }
  return {
    version: '1.0', format: 'qgc_wpl',
    metadata: { name: 'Flight Plan', created: new Date().toISOString() },
    waypoints, groups: [],
  };
}

export function parseWaypointFile(content: string): WaypointFile {
  if (content.trimStart().startsWith('QGC WPL')) return parseQGCWPL(content);
  const data = JSON.parse(content);
  if (!data.waypoints || !Array.isArray(data.waypoints))
    throw new Error('Invalid .waypoints file: missing waypoints array');
  return {
    version: data.version ?? '1.0', format: 'json',
    metadata: { name: data.metadata?.name ?? 'Untitled', created: data.metadata?.created ?? new Date().toISOString() },
    waypoints: data.waypoints.map((w: Partial<Waypoint>) => ({
      id: w.id ?? uuidv4(), name: w.name ?? 'Waypoint',
      lat: Number(w.lat ?? 0), lon: Number(w.lon ?? 0), alt: Number(w.alt ?? 0),
      type: w.type ?? 'default', description: w.description ?? '', metadata: w.metadata ?? {},
    })),
    groups: Array.isArray(data.groups) ? data.groups : [],
  };
}

export function serializeToJSON(wf: WaypointFile): string {
  return JSON.stringify({ version: wf.version, metadata: wf.metadata, waypoints: wf.waypoints, groups: wf.groups }, null, 2);
}

export function serializeToQGCWPL(wf: WaypointFile): string {
  const lines = ['QGC WPL 110'];
  wf.waypoints.forEach((wp, i) => {
    const m = wp.metadata;
    const params = (m.qgc_params as number[]) ?? [0, 0, 0, 0];
    lines.push([
      i, i === 0 ? 1 : 0,
      (m.qgc_frame as number) ?? 0,
      (m.qgc_command as number) ?? 16,
      ...params, wp.lat, wp.lon, wp.alt,
      (m.qgc_autocontinue as number) ?? 1,
    ].join('\t'));
  });
  return lines.join('\n') + '\n';
}

export function createEmptyFile(name = 'Untitled'): WaypointFile {
  return {
    version: '1.0', format: 'json',
    metadata: { name, created: new Date().toISOString() },
    waypoints: [], groups: [],
  };
}

export function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function applyGroupTransform(
  wf: WaypointFile, groupId: string, scale: number, rotDeg: number
): WaypointFile {
  const group = wf.groups.find(g => g.id === groupId);
  if (!group) return wf;
  const members = wf.waypoints.filter(w => group.waypointIds.includes(w.id));
  if (members.length === 0) return wf;

  const cLat = members.reduce((s, w) => s + w.lat, 0) / members.length;
  const cLon = members.reduce((s, w) => s + w.lon, 0) / members.length;
  const cAlt = members.reduce((s, w) => s + w.alt, 0) / members.length;
  const cos = Math.cos(cLat * Math.PI / 180);
  const rot = rotDeg * Math.PI / 180;

  return {
    ...wf,
    waypoints: wf.waypoints.map(w => {
      if (!group.waypointIds.includes(w.id)) return w;
      const dx = (w.lon - cLon) * 111320 * cos * scale;
      const dz = -(w.lat - cLat) * 111320 * scale;
      const rdx = dx * Math.cos(rot) - dz * Math.sin(rot);
      const rdz = dx * Math.sin(rot) + dz * Math.cos(rot);
      return {
        ...w,
        lat: parseFloat((cLat - rdz / 111320).toFixed(6)),
        lon: parseFloat((cLon + rdx / (111320 * cos)).toFixed(6)),
        alt: parseFloat((cAlt + (w.alt - cAlt) * scale).toFixed(1)),
      };
    }),
  };
}
