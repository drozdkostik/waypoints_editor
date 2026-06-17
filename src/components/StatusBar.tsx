import type { ToolType, Waypoint } from '../types/waypoint';
import './StatusBar.css';

interface Props {
  activeTool: ToolType;
  selectedWaypoint: Waypoint | null;
  selectedCount: number;
  count: number;
}

const HINTS: Record<ToolType, string> = {
  select: 'Click to select · Shift+click multi-select · Left drag: orbit · Right drag: pan',
  add:    'Click on canvas to place waypoint · Left drag: orbit',
  move:   'Drag a waypoint to move it · Left drag on empty: orbit',
  delete: 'Click a waypoint to delete it',
};

export function StatusBar({ activeTool, selectedWaypoint, selectedCount, count }: Props) {
  return (
    <footer className="statusbar">
      <span className="statusbar__tool">{activeTool}</span>
      <span className="statusbar__hint">{HINTS[activeTool]}</span>
      {selectedWaypoint && (
        <span className="statusbar__coords">
          {selectedWaypoint.name} — {selectedWaypoint.lat.toFixed(5)}°, {selectedWaypoint.lon.toFixed(5)}°, {selectedWaypoint.alt.toFixed(0)} m
        </span>
      )}
      {selectedCount > 1 && <span className="statusbar__multi">{selectedCount} selected</span>}
      <span className="statusbar__count">{count} waypoints</span>
    </footer>
  );
}
