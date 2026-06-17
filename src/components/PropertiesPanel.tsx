import { useEffect, useState } from 'react';
import type { Waypoint, WaypointGroup, WaypointType } from '../types/waypoint';
import './PropertiesPanel.css';

interface Props {
  waypoint: Waypoint | null;
  group: WaypointGroup | null;
  selectedCount: number;
  totalCount: number;
  fileName: string;
  onUpdateWaypoint: (wp: Waypoint) => void;
  onUpdateGroup: (g: WaypointGroup) => void;
  onApplyTransform: (groupId: string, scale: number, rotDeg: number) => void;
}

const TYPES: WaypointType[] = ['default', 'checkpoint', 'danger', 'info'];

export function PropertiesPanel({
  waypoint, group, selectedCount, totalCount, fileName,
  onUpdateWaypoint, onUpdateGroup, onApplyTransform,
}: Props) {
  const [localWp, setLocalWp] = useState<Waypoint | null>(null);
  const [localGrp, setLocalGrp] = useState<WaypointGroup | null>(null);
  const [scale, setScale] = useState(1);
  const [rotDeg, setRotDeg] = useState(0);

  useEffect(() => { setLocalWp(waypoint ? { ...waypoint } : null); }, [waypoint]);
  useEffect(() => { setLocalGrp(group ? { ...group } : null); setScale(1); setRotDeg(0); }, [group]);

  const updateWp = (patch: Partial<Waypoint>) => {
    if (!localWp) return;
    const updated = { ...localWp, ...patch };
    setLocalWp(updated);
    onUpdateWaypoint(updated);
  };

  const updateGrp = (patch: Partial<WaypointGroup>) => {
    if (!localGrp) return;
    const updated = { ...localGrp, ...patch };
    setLocalGrp(updated);
    onUpdateGroup(updated);
  };

  const footer = (
    <div className="props-panel__footer">
      <span>{fileName}</span>
      <span>{totalCount} waypoints</span>
    </div>
  );

  // Group selected
  if (localGrp) {
    return (
      <aside className="props-panel">
        <div className="props-panel__title">Group</div>
        <div className="props-panel__form">
          <label>
            <span>Group name</span>
            <input value={localGrp.name} onChange={e => updateGrp({ name: e.target.value })} />
          </label>
          <label>
            <span>Color</span>
            <div className="props-panel__color-row">
              <input type="color" value={localGrp.color} onChange={e => updateGrp({ color: e.target.value })} />
              <span>{localGrp.color}</span>
            </div>
          </label>
          <div className="props-panel__section">Transform</div>
          <label>
            <span>Scale ×</span>
            <input type="number" step="0.1" min="0.01" value={scale} onChange={e => setScale(parseFloat(e.target.value) || 1)} />
          </label>
          <label>
            <span>Rotation (°)</span>
            <input type="number" step="1" value={rotDeg} onChange={e => setRotDeg(parseFloat(e.target.value) || 0)} />
          </label>
          <button
            className="props-panel__apply"
            onClick={() => { onApplyTransform(localGrp.id, scale, rotDeg); setScale(1); setRotDeg(0); }}
          >
            Apply Transform
          </button>
          <div className="props-panel__members">
            <span>Members: {localGrp.waypointIds.length}</span>
          </div>
        </div>
        {footer}
      </aside>
    );
  }

  // Waypoint selected
  if (localWp) {
    return (
      <aside className="props-panel">
        <div className="props-panel__title">Properties</div>
        <div className="props-panel__form">
          <label>
            <span>Name</span>
            <input value={localWp.name} onChange={e => updateWp({ name: e.target.value })} />
          </label>
          <label>
            <span>Type</span>
            <select value={localWp.type} onChange={e => updateWp({ type: e.target.value as WaypointType })}>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>
            <span>Latitude (°)</span>
            <input type="number" step="0.000001" value={localWp.lat} onChange={e => updateWp({ lat: parseFloat(e.target.value) || 0 })} />
          </label>
          <label>
            <span>Longitude (°)</span>
            <input type="number" step="0.000001" value={localWp.lon} onChange={e => updateWp({ lon: parseFloat(e.target.value) || 0 })} />
          </label>
          <label>
            <span>Altitude (m)</span>
            <input type="number" step="1" value={localWp.alt} onChange={e => updateWp({ alt: parseFloat(e.target.value) || 0 })} />
          </label>
          <label>
            <span>Description</span>
            <textarea rows={3} value={localWp.description} onChange={e => updateWp({ description: e.target.value })} />
          </label>
          <div className="props-panel__id">ID: {localWp.id.slice(0, 8)}…</div>
        </div>
        {footer}
      </aside>
    );
  }

  // Nothing selected
  return (
    <aside className="props-panel">
      <div className="props-panel__title">Properties</div>
      <div className="props-panel__empty">
        {selectedCount > 1
          ? <p>{selectedCount} waypoints selected</p>
          : <p>No selection</p>
        }
        <p className="props-panel__hint">
          {selectedCount > 1
            ? 'Press G to group the selection'
            : 'Click a waypoint to select it'
          }
        </p>
      </div>
      {footer}
    </aside>
  );
}
