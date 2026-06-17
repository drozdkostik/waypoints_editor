import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Waypoint, WaypointFile, ToolType } from '../types/waypoint';
import './Canvas.css';

interface Props {
  waypointFile: WaypointFile;
  activeTool: ToolType;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (wf: WaypointFile) => void;
}

const TYPE_COLORS: Record<string, string> = {
  default:    '#4a9eff',
  checkpoint: '#4caf50',
  danger:     '#f44336',
  info:       '#ffeb3b',
};

const GRID = 40;
const RADIUS = 14;

interface ViewState {
  x: number;
  y: number;
  scale: number;
}

export function Canvas({ waypointFile, activeTool, selectedId, onSelect, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, scale: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;

  const dragging = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const panning = useRef<{ startX: number; startY: number; origVx: number; origVy: number } | null>(null);

  const toScene = useCallback((cx: number, cy: number): [number, number] => {
    const v = viewRef.current;
    return [(cx - v.x) / v.scale, (cy - v.y) / v.scale];
  }, []);

  const hitTest = useCallback((sx: number, sy: number, waypoints: Waypoint[]): Waypoint | null => {
    for (let i = waypoints.length - 1; i >= 0; i--) {
      const w = waypoints[i];
      const dist = Math.hypot(w.x - sx, w.y - sy);
      if (dist <= RADIUS + 4) return w;
    }
    return null;
  }, []);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const { width, height } = canvas;
    const { x: vx, y: vy, scale } = view;

    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#262626';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = '#2e2e2e';
    ctx.lineWidth = 1;
    const gridStep = GRID * scale;
    const startX = ((vx % gridStep) + gridStep) % gridStep;
    const startY = ((vy % gridStep) + gridStep) % gridStep;
    for (let gx = startX; gx < width; gx += gridStep) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, height); ctx.stroke();
    }
    for (let gy = startY; gy < height; gy += gridStep) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(width, gy); ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    if (vy >= 0 && vy <= height) {
      ctx.beginPath(); ctx.moveTo(0, vy); ctx.lineTo(width, vy); ctx.stroke();
    }
    if (vx >= 0 && vx <= width) {
      ctx.beginPath(); ctx.moveTo(vx, 0); ctx.lineTo(vx, height); ctx.stroke();
    }

    // Waypoints
    for (const wp of waypointFile.waypoints) {
      const sx = wp.x * scale + vx;
      const sy = wp.y * scale + vy;
      const r = RADIUS * Math.max(0.5, Math.min(2, scale));
      const color = TYPE_COLORS[wp.type] ?? '#4a9eff';
      const isSelected = wp.id === selectedId;

      // Shadow
      ctx.shadowColor = color;
      ctx.shadowBlur = isSelected ? 12 : 4;

      // Circle
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = color + (isSelected ? 'ff' : 'cc');
      ctx.fill();

      ctx.shadowBlur = 0;

      // Selection ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(sx, sy, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Inner dot
      ctx.beginPath();
      ctx.arc(sx, sy, r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fill();

      // Label
      ctx.font = `${Math.max(10, 11 * scale)}px Inter, sans-serif`;
      ctx.fillStyle = '#ddd';
      ctx.textAlign = 'center';
      ctx.fillText(wp.name, sx, sy + r + 14 * Math.max(0.8, scale));
    }
  }, [waypointFile, selectedId, view]);

  // Resize canvas to container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    obs.observe(canvas);
    return () => obs.disconnect();
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setView((v) => {
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newScale = Math.max(0.1, Math.min(10, v.scale * factor));
      return {
        scale: newScale,
        x: mx - (mx - v.x) * (newScale / v.scale),
        y: my - (my - v.y) * (newScale / v.scale),
      };
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const [sx, sy] = toScene(cx, cy);

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      panning.current = { startX: cx, startY: cy, origVx: viewRef.current.x, origVy: viewRef.current.y };
      return;
    }

    if (activeTool === 'add') {
      const newWp: Waypoint = {
        id: uuidv4(),
        name: `WP ${waypointFile.waypoints.length + 1}`,
        x: Math.round(sx),
        y: Math.round(sy),
        z: 0,
        type: 'default',
        description: '',
        metadata: {},
      };
      onChange({ ...waypointFile, waypoints: [...waypointFile.waypoints, newWp] });
      onSelect(newWp.id);
    } else if (activeTool === 'select' || activeTool === 'move') {
      const hit = hitTest(sx, sy, waypointFile.waypoints);
      onSelect(hit?.id ?? null);
      if (hit && activeTool === 'move') {
        dragging.current = { id: hit.id, startX: cx, startY: cy, origX: hit.x, origY: hit.y };
      }
    } else if (activeTool === 'delete') {
      const hit = hitTest(sx, sy, waypointFile.waypoints);
      if (hit) {
        onChange({ ...waypointFile, waypoints: waypointFile.waypoints.filter((w) => w.id !== hit.id) });
        if (selectedId === hit.id) onSelect(null);
      }
    }
  }, [activeTool, waypointFile, onChange, onSelect, selectedId, toScene, hitTest]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    if (panning.current) {
      const { startX, startY, origVx, origVy } = panning.current;
      setView((v) => ({ ...v, x: origVx + cx - startX, y: origVy + cy - startY }));
      return;
    }

    if (dragging.current) {
      const { id, startX, startY, origX, origY } = dragging.current;
      const dx = (cx - startX) / viewRef.current.scale;
      const dy = (cy - startY) / viewRef.current.scale;
      onChange({
        ...waypointFile,
        waypoints: waypointFile.waypoints.map((w) =>
          w.id === id ? { ...w, x: Math.round(origX + dx), y: Math.round(origY + dy) } : w
        ),
      });
    }
  }, [waypointFile, onChange]);

  const handleMouseUp = useCallback(() => {
    dragging.current = null;
    panning.current = null;
  }, []);

  const cursorMap: Record<ToolType, string> = {
    select: 'default',
    add: 'crosshair',
    move: 'grab',
    delete: 'not-allowed',
  };

  return (
    <canvas
      ref={canvasRef}
      className="canvas"
      style={{ cursor: dragging.current ? 'grabbing' : cursorMap[activeTool] }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
}
