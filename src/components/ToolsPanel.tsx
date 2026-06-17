import type { ToolType } from '../types/waypoint';
import './ToolsPanel.css';

interface Props {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
}

const TOOLS: { id: ToolType; label: string; icon: string; shortcut: string; title: string }[] = [
  { id: 'select', label: 'V', icon: '↖', shortcut: 'V', title: 'Select (V)' },
  { id: 'add',    label: 'A', icon: '✚', shortcut: 'A', title: 'Add Waypoint (A)' },
  { id: 'move',   label: 'M', icon: '✥', shortcut: 'M', title: 'Move (M)' },
  { id: 'delete', label: 'D', icon: '✕', shortcut: 'D', title: 'Delete (D)' },
];

export function ToolsPanel({ activeTool, onToolChange }: Props) {
  return (
    <aside className="tools-panel">
      <div className="tools-panel__title">Tools</div>
      <div className="tools-panel__buttons">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            className={`tool-btn${activeTool === tool.id ? ' tool-btn--active' : ''}`}
            title={tool.title}
            onClick={() => onToolChange(tool.id)}
          >
            <span className="tool-btn__icon">{tool.icon}</span>
            <span className="tool-btn__label">{tool.label}</span>
          </button>
        ))}
      </div>
      <div className="tools-panel__legend">
        {TOOLS.map((t) => (
          <div key={t.id} className="tools-panel__legend-item">
            <kbd>{t.shortcut}</kbd> {t.title.split(' (')[0]}
          </div>
        ))}
      </div>
    </aside>
  );
}
