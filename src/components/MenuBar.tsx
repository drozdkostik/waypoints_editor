import type { WaypointFile } from '../types/waypoint';
import { serializeToJSON, serializeToQGCWPL, downloadText } from '../utils/fileHandler';
import './MenuBar.css';

interface Props {
  waypointFile: WaypointFile;
  filePath: string;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onFitView: () => void;
}

export function MenuBar({ waypointFile, filePath, onNew, onOpen, onSave, onFitView }: Props) {
  const base = (filePath || waypointFile.metadata.name || 'waypoints').replace(/\.waypoints$/, '');
  return (
    <header className="menubar">
      <div className="menubar__brand">⬡ Waypoints Editor</div>
      <nav className="menubar__menu">
        <div className="menubar__group">
          <span className="menubar__label">File</span>
          <div className="menubar__dropdown">
            <button onClick={onNew}>New</button>
            <button onClick={onOpen}>Open… (.waypoints)</button>
            <button onClick={onSave}>Save</button>
            <hr />
            <button onClick={() => downloadText(serializeToJSON(waypointFile), `${base}.waypoints`)}>
              Export as JSON (.waypoints)
            </button>
            <button onClick={() => downloadText(serializeToQGCWPL(waypointFile), `${base}.waypoints`)}>
              Export as QGC WPL (.waypoints)
            </button>
          </div>
        </div>
        <div className="menubar__group">
          <span className="menubar__label">View</span>
          <div className="menubar__dropdown">
            <button onClick={onFitView}>Fit View (F)</button>
          </div>
        </div>
      </nav>
      <div className="menubar__badge">{waypointFile.format === 'qgc_wpl' ? 'QGC WPL' : 'JSON'}</div>
      <div className="menubar__path">{filePath || 'Untitled.waypoints'}</div>
    </header>
  );
}
