import type { ToolType, Waypoint } from '../types/waypoint';
import './StatusBar.css';

interface Props {
  activeTool: ToolType;
  selectedWaypoint: Waypoint | null;
  count: number;
}

const HINTS: Record<ToolType, string> = {
  select: 'Click a waypoint to select it',
  add:    'Click on the canvas to add a waypoint',
  move:   'Click and drag a waypoint to move it',
  delete: 'Click a waypoint to delete it',
};

export function StatusBar({ activeTool, selectedWaypoint, count }: Props) {
  return (
    <footer className="statusbar">
      <span className="statusbar__tool">Tool: {activeTool}</span>
      <span className="statusbar__hint">{HINTS[activeTool]}</span>
      {selectedWaypoint && (
        <span className="statusbar__coords">
          {selectedWaypoint.name} @ ({selectedWaypoint.x}, {selectedWaypoint.y}, {selectedWaypoint.z})
        </span>
      )}
      <span className="statusbar__count">{count} waypoints</span>
    </footer>
  );
}
