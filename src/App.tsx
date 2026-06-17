import { useCallback, useEffect, useRef, useState } from 'react';
import type { ToolType, Waypoint, WaypointFile } from './types/waypoint';
import { parseWaypointFile, serializeWaypointFile, createEmptyFile } from './utils/fileHandler';
import { Canvas } from './components/Canvas';
import { ToolsPanel } from './components/ToolsPanel';
import { PropertiesPanel } from './components/PropertiesPanel';
import { MenuBar } from './components/MenuBar';
import { StatusBar } from './components/StatusBar';
import './App.css';

export default function App() {
  const [waypointFile, setWaypointFile] = useState<WaypointFile>(createEmptyFile('Untitled'));
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filePath, setFilePath] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedWaypoint = waypointFile.waypoints.find((w) => w.id === selectedId) ?? null;

  const handleOpen = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseWaypointFile(ev.target?.result as string);
        setWaypointFile(parsed);
        setSelectedId(null);
        setFilePath(file.name);
      } catch (err) {
        alert(`Failed to parse file: ${(err as Error).message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const handleSave = useCallback(() => {
    const name = waypointFile.metadata.name || 'waypoints';
    const content = serializeWaypointFile(waypointFile);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filePath || `${name}.waypoints`;
    a.click();
    URL.revokeObjectURL(url);
  }, [waypointFile, filePath]);

  const handleNew = useCallback(() => {
    if (waypointFile.waypoints.length > 0) {
      if (!confirm('Discard current file and create a new one?')) return;
    }
    setWaypointFile(createEmptyFile('Untitled'));
    setSelectedId(null);
    setFilePath('');
  }, [waypointFile]);

  const handleWaypointUpdate = useCallback((updated: Waypoint) => {
    setWaypointFile((wf) => ({
      ...wf,
      waypoints: wf.waypoints.map((w) => (w.id === updated.id ? updated : w)),
    }));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const map: Record<string, ToolType> = { v: 'select', a: 'add', m: 'move', d: 'delete' };
      const tool = map[e.key.toLowerCase()];
      if (tool) setActiveTool(tool);
      if (e.key === 'Escape') setSelectedId(null);
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        setWaypointFile((wf) => ({
          ...wf,
          waypoints: wf.waypoints.filter((w) => w.id !== selectedId),
        }));
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId]);

  return (
    <div className="app">
      <MenuBar
        waypointFile={waypointFile}
        filePath={filePath}
        onNew={handleNew}
        onOpen={handleOpen}
        onSave={handleSave}
      />
      <div className="app__workspace">
        <ToolsPanel activeTool={activeTool} onToolChange={setActiveTool} />
        <main className="app__canvas-area">
          <Canvas
            waypointFile={waypointFile}
            activeTool={activeTool}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={setWaypointFile}
          />
        </main>
        <PropertiesPanel
          waypoint={selectedWaypoint}
          onUpdate={handleWaypointUpdate}
          totalCount={waypointFile.waypoints.length}
          fileName={filePath || 'Untitled.waypoints'}
        />
      </div>
      <StatusBar
        activeTool={activeTool}
        selectedWaypoint={selectedWaypoint}
        count={waypointFile.waypoints.length}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".waypoints"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}
