export type WaypointType = 'default' | 'checkpoint' | 'danger' | 'info';

export interface Waypoint {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  type: WaypointType;
  description: string;
  metadata: Record<string, unknown>;
}

export interface WaypointFile {
  version: string;
  metadata: {
    name: string;
    created: string;
  };
  waypoints: Waypoint[];
}

export type ToolType = 'select' | 'add' | 'move' | 'delete';
