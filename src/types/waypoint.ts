export type WaypointType = 'default' | 'checkpoint' | 'danger' | 'info';
export type FileFormat = 'json' | 'qgc_wpl';

export interface Waypoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  alt: number;
  type: WaypointType;
  description: string;
  metadata: Record<string, unknown>;
}

export interface WaypointGroup {
  id: string;
  name: string;
  waypointIds: string[];
  color: string;
}

export interface WaypointFile {
  version: string;
  format: FileFormat;
  metadata: { name: string; created: string };
  waypoints: Waypoint[];
  groups: WaypointGroup[];
}

export type ToolType = 'select' | 'add' | 'move' | 'delete';
