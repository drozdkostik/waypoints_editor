import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ToolType, Waypoint, WaypointGroup, WaypointFile } from './types/waypoint';
import { parseWaypointFile, serializeToJSON, createEmptyFile, applyGroupTransform, downloadText } from './utils/fileHandler';
import { ThreeCanvas } from './components/ThreeCanvas';
import { ToolsPanel } from './components/ToolsPanel';
import { PropertiesPanel } from './components/PropertiesPanel';
import { MenuBar } from './components/MenuBar';
import { StatusBar } from './components/StatusBar';
import './App.css';

export default function App() {
  const [waypointFile, setWaypointFile] = useState<WaypointFile>(createEmptyFile('Untitled'));
  const [activeTool, setActiveTool]     = useState<ToolType>('select');
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [filePath, setFilePath]         = useState('');
  const [fitSignal, setFitSignal]       = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const firstSelectedId = [...selectedIds][0] ?? null;
  const selectedWaypoint = waypointFile.waypoints.find(w => w.id === firstSelectedId) ?? null;
  const selectedGroup    = waypointFile.groups.find(g => g.id === selectedGroupId) ?? null;

  // File I/O
  const handleOpen = useCallback(() => fileInputRef.current?.click(), []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = parseWaypointFile(ev.target?.result as string);
        setWaypointFile(parsed);
        setSelectedIds(new Set());
        setSelectedGroupId(null);
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
    downloadText(serializeToJSON(waypointFile), filePath || `${name}.waypoints`);
  }, [waypointFile, filePath]);

  const handleNew = useCallback(() => {
    if (waypointFile.waypoints.length > 0 && !confirm('Discard current file?')) return;
    setWaypointFile(createEmptyFile('Untitled'));
    setSelectedIds(new Set()); setSelectedGroupId(null); setFilePath('');
  }, [waypointFile]);

  // Selection
  const handleSelect = useCallback((id: string | null, multi: boolean) => {
    setSelectedGroupId(null);
    if (id === null) { setSelectedIds(new Set()); return; }
    if (multi) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else {
      setSelectedIds(new Set([id]));
    }
  }, []);

  // Waypoint update
  const handleUpdateWaypoint = useCallback((updated: Waypoint) => {
    setWaypointFile(wf => ({
      ...wf, waypoints: wf.waypoints.map(w => w.id === updated.id ? updated : w),
    }));
  }, []);

  // Group operations
  const handleGroup = useCallback(() => {
    if (selectedIds.size < 2) return;
    const group: WaypointGroup = {
      id: uuidv4(),
      name: `Group ${waypointFile.groups.length + 1}`,
      waypointIds: [...selectedIds],
      color: '#4a9eff',
    };
    setWaypointFile(wf => ({ ...wf, groups: [...wf.groups, group] }));
    setSelectedGroupId(group.id);
    setSelectedIds(new Set());
  }, [selectedIds, waypointFile.groups.length]);

  const handleUngroup = useCallback(() => {
    if (!selectedGroupId) return;
    setWaypointFile(wf => ({ ...wf, groups: wf.groups.filter(g => g.id !== selectedGroupId) }));
    setSelectedGroupId(null);
  }, [selectedGroupId]);

  const handleUpdateGroup = useCallback((updated: WaypointGroup) => {
    setWaypointFile(wf => ({ ...wf, groups: wf.groups.map(g => g.id === updated.id ? updated : g) }));
  }, []);

  const handleApplyTransform = useCallback((groupId: string, scale: number, rotDeg: number) => {
    setWaypointFile(wf => applyGroupTransform(wf, groupId, scale, rotDeg));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const map: Record<string, ToolType> = { v: 'select', a: 'add', m: 'move', d: 'delete' };
      const tool = map[e.key.toLowerCase()];
      if (tool) { setActiveTool(tool); return; }
      if (e.key === 'Escape') { setSelectedIds(new Set()); setSelectedGroupId(null); return; }
      if (e.ctrlKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedIds(new Set(waypointFile.waypoints.map(w => w.id)));
        setSelectedGroupId(null);
        return;
      }
      if (e.key.toLowerCase() === 'f') { setFitSignal(s => s + 1); return; }
      if (e.key.toLowerCase() === 'g' && !e.ctrlKey) { handleGroup(); return; }
      if (e.key.toLowerCase() === 'u') { handleUngroup(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0) {
        const ids = selectedIds;
        setWaypointFile(wf => ({
          ...wf,
          waypoints: wf.waypoints.filter(w => !ids.has(w.id)),
          groups: wf.groups
            .map(g => ({ ...g, waypointIds: g.waypointIds.filter(id => !ids.has(id)) }))
            .filter(g => g.waypointIds.length > 0),
        }));
        setSelectedIds(new Set());
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIds, handleGroup, handleUngroup]);

  return (
    <div className="app">
      <MenuBar
        waypointFile={waypointFile}
        filePath={filePath}
        onNew={handleNew}
        onOpen={handleOpen}
        onSave={handleSave}
        onFitView={() => setFitSignal(s => s + 1)}
      />
      <div className="app__workspace">
        <ToolsPanel
          activeTool={activeTool}
          selectedCount={selectedIds.size}
          totalCount={waypointFile.waypoints.length}
          selectedGroupId={selectedGroupId}
          onToolChange={setActiveTool}
          onSelectAll={() => { setSelectedIds(new Set(waypointFile.waypoints.map(w => w.id))); setSelectedGroupId(null); }}
          onGroup={handleGroup}
          onUngroup={handleUngroup}
        />
        <main className="app__canvas-area">
          <ThreeCanvas
            waypointFile={waypointFile}
            activeTool={activeTool}
            selectedIds={selectedIds}
            selectedGroupId={selectedGroupId}
            fitSignal={fitSignal}
            onSelect={handleSelect}
            onChange={setWaypointFile}
          />
        </main>
        <PropertiesPanel
          waypoint={selectedIds.size === 1 ? selectedWaypoint : null}
          group={selectedGroup}
          selectedCount={selectedIds.size}
          totalCount={waypointFile.waypoints.length}
          fileName={filePath || 'Untitled.waypoints'}
          onUpdateWaypoint={handleUpdateWaypoint}
          onUpdateGroup={handleUpdateGroup}
          onApplyTransform={handleApplyTransform}
        />
      </div>
      <StatusBar
        activeTool={activeTool}
        selectedWaypoint={selectedIds.size === 1 ? selectedWaypoint : null}
        selectedCount={selectedIds.size}
        count={waypointFile.waypoints.length}
      />
      <input
        ref={fileInputRef} type="file" accept=".waypoints"
        style={{ display: 'none' }} onChange={handleFileChange}
      />
    </div>
  );
}
