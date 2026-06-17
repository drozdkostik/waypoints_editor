import { useEffect, useState } from 'react';
import type { Waypoint, WaypointType } from '../types/waypoint';
import './PropertiesPanel.css';

interface Props {
  waypoint: Waypoint | null;
  onUpdate: (wp: Waypoint) => void;
  totalCount: number;
  fileName: string;
}

const TYPES: WaypointType[] = ['default', 'checkpoint', 'danger', 'info'];

export function PropertiesPanel({ waypoint, onUpdate, totalCount, fileName }: Props) {
  const [local, setLocal] = useState<Waypoint | null>(null);

  useEffect(() => {
    setLocal(waypoint ? { ...waypoint } : null);
  }, [waypoint]);

  if (!local) {
    return (
      <aside className="props-panel">
        <div className="props-panel__title">Properties</div>
        <div className="props-panel__empty">
          <p>No selection</p>
          <p className="props-panel__hint">Use the Select tool to pick a waypoint</p>
        </div>
        <div className="props-panel__footer">
          <span>{fileName}</span>
          <span>{totalCount} waypoints</span>
        </div>
      </aside>
    );
  }

  const update = (patch: Partial<Waypoint>) => {
    const updated = { ...local, ...patch };
    setLocal(updated);
    onUpdate(updated);
  };

  return (
    <aside className="props-panel">
      <div className="props-panel__title">Properties</div>
      <div className="props-panel__form">
        <label>
          <span>Name</span>
          <input
            value={local.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </label>
        <label>
          <span>Type</span>
          <select
            value={local.type}
            onChange={(e) => update({ type: e.target.value as WaypointType })}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <div className="props-panel__row">
          <label>
            <span>X</span>
            <input
              type="number"
              step="0.1"
              value={local.x}
              onChange={(e) => update({ x: parseFloat(e.target.value) || 0 })}
            />
          </label>
          <label>
            <span>Y</span>
            <input
              type="number"
              step="0.1"
              value={local.y}
              onChange={(e) => update({ y: parseFloat(e.target.value) || 0 })}
            />
          </label>
        </div>
        <label>
          <span>Z (altitude)</span>
          <input
            type="number"
            step="0.1"
            value={local.z}
            onChange={(e) => update({ z: parseFloat(e.target.value) || 0 })}
          />
        </label>
        <label>
          <span>Description</span>
          <textarea
            rows={4}
            value={local.description}
            onChange={(e) => update({ description: e.target.value })}
          />
        </label>
        <div className="props-panel__id">ID: {local.id.slice(0, 8)}…</div>
      </div>
      <div className="props-panel__footer">
        <span>{fileName}</span>
        <span>{totalCount} waypoints</span>
      </div>
    </aside>
  );
}
