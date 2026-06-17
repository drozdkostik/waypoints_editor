import type { ToolType } from '../types/waypoint';
import './ToolsPanel.css';

interface Props {
  activeTool: ToolType;
  selectedCount: number;
  totalCount: number;
  selectedGroupId: string | null;
  onToolChange: (tool: ToolType) => void;
  onSelectAll: () => void;
  onGroup: () => void;
  onUngroup: () => void;
}

const TOOLS: { id: ToolType; icon: string; key: string; title: string }[] = [
  { id: 'select', icon: '↖', key: 'V', title: 'Select (V)' },
  { id: 'add',    icon: '✚', key: 'A', title: 'Add (A)' },
  { id: 'move',   icon: '✥', key: 'M', title: 'Move (M)' },
  { id: 'delete', icon: '✕', key: 'D', title: 'Delete (D)' },
];

export function ToolsPanel({ activeTool, selectedCount, totalCount, selectedGroupId, onToolChange, onSelectAll, onGroup, onUngroup }: Props) {
  return (
    <aside className="tools-panel">
      <div className="tools-panel__title">Tools</div>

      <div className="tools-panel__buttons">
        {TOOLS.map(t => (
          <button
            key={t.id}
            className={`tool-btn${activeTool === t.id ? ' tool-btn--active' : ''}`}
            title={t.title}
            onClick={() => onToolChange(t.id)}
          >
            <span className="tool-btn__icon">{t.icon}</span>
            <span className="tool-btn__key">{t.key}</span>
          </button>
        ))}
      </div>

      <div className="tools-panel__divider" />

      <div className="tools-panel__actions">
        <button
          className="action-btn"
          title="Select All (Ctrl+A)"
          disabled={totalCount === 0}
          onClick={onSelectAll}
        >
          <span>⊡</span>
          <span>All</span>
        </button>
        <button
          className="action-btn"
          title="Group selected waypoints (G)"
          disabled={selectedCount < 2}
          onClick={onGroup}
        >
          <span>⊞</span>
          <span>Group</span>
        </button>
        <button
          className="action-btn"
          title="Ungroup (U)"
          disabled={!selectedGroupId}
          onClick={onUngroup}
        >
          <span>⊟</span>
          <span>Ungroup</span>
        </button>
      </div>
    </aside>
  );
}
