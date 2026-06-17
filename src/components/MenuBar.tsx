import type { WaypointFile } from '../types/waypoint';
import { serializeWaypointFile, downloadFile } from '../utils/fileHandler';
import './MenuBar.css';

interface Props {
  waypointFile: WaypointFile;
  filePath: string;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
}

export function MenuBar({ waypointFile, filePath, onNew, onOpen, onSave }: Props) {
  const handleExport = () => {
    const name = waypointFile.metadata.name || 'export';
    downloadFile(serializeWaypointFile(waypointFile), `${name}.waypoints`);
  };

  return (
    <header className="menubar">
      <div className="menubar__brand">⬡ Waypoints Editor</div>
      <nav className="menubar__menu">
        <div className="menubar__group">
          <span className="menubar__label">File</span>
          <div className="menubar__dropdown">
            <button onClick={onNew}>New</button>
            <button onClick={onOpen}>Open…</button>
            <button onClick={onSave}>Save</button>
            <hr />
            <button onClick={handleExport}>Export .waypoints</button>
          </div>
        </div>
      </nav>
      <div className="menubar__path">{filePath || 'Untitled.waypoints'}</div>
    </header>
  );
}
