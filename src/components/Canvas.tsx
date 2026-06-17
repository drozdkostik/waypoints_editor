import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Waypoint, WaypointFile, ToolType } from '../types/waypoint';
import './Canvas.css';

interface Props {
  waypointFile: WaypointFile;
  activeTool: ToolType;
  selectedId: string | null;
  fitSignal: number;
  onSelect: (id: string | null) => void;
  onChange: (wf: WaypointFile) => void;
}

const TYPE_COLORS: Record<string, string> = {
  default:    '#4a9eff',
  checkpoint: '#4caf50',
  danger:     '#f44336',
  info:       '#ffeb3b',
};

const RADIUS = 14;

interface ViewState { x: number; y: number; scale: number }

export function Canvas({ waypointFile, activeTool, selectedId, fitSignal, onSelect, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<ViewState>({ x: 400, y: 300, scale: 100 });
  const viewRef = useRef(view);
  viewRef.current = view;

  const dragging = useRef<{ id: string; sx0: number; sy0: number; lat0: number; lon0: number } | null>(null);
  const panning  = useRef<{ cx0: number; cy0: number; vx0: number; vy0: number } | null>(null);

  // Equirectangular correction: compress lon so 1° lon = 1° lat visually
  const cosLat = useMemo(() => {
    const valid = waypointFile.waypoints.filter(w => w.lat !== 0 || w.lon !== 0);
    const avgLat = valid.length ? valid.reduce((s, w) => s + w.lat, 0) / valid.length : 51;
    return Math.cos(avgLat * Math.PI / 180);
  }, [waypointFile]);
  const cosLatRef = useRef(cosLat);
  cosLatRef.current = cosLat;

  // scene_x = lon / cosLat,  scene_y = -lat
  const latLonToScene = (lat: number, lon: number): [number, number] =>
    [lon / cosLatRef.current, -lat];

  const sceneToLatLon = (sx: number, sy: number): [number, number] =>
    [-sy, sx * cosLatRef.current];

  const toScene = (cx: number, cy: number): [number, number] => {
    const v = viewRef.current;
    return [(cx - v.x) / v.scale, (cy - v.y) / v.scale];
  };

  // Fit view to bounding box of valid waypoints
  const fitView = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const valid = waypointFile.waypoints.filter(w => w.lat !== 0 || w.lon !== 0);
    if (valid.length === 0) return;

    const cos = cosLatRef.current;
    const sxs = valid.map(w => w.lon / cos);
    const sys = valid.map(w => -w.lat);
    const minSx = Math.min(...sxs), maxSx = Math.max(...sxs);
    const minSy = Math.min(...sys), maxSy = Math.max(...sys);
    const rangeX = maxSx - minSx || 0.01;
    const rangeY = maxSy - minSy || 0.01;

    const { offsetWidth: W, offsetHeight: H } = canvas;
    const newScale = Math.min((W * 0.85) / rangeX, (H * 0.85) / rangeY);
    const cx = (minSx + maxSx) / 2;
    const cy = (minSy + maxSy) / 2;
    setView({ scale: newScale, x: W / 2 - cx * newScale, y: H / 2 - cy * newScale });
  }, [waypointFile]);

  // Auto-fit when new file is loaded or fitSignal changes
  const prevCreated = useRef('');
  useEffect(() => {
    const key = waypointFile.metadata.created;
    if (key !== prevCreated.current || fitSignal > 0) {
      prevCreated.current = key;
      setTimeout(fitView, 60);
    }
  }, [waypointFile.metadata.created, fitSignal, fitView]);

  // Hit test in scene coordinates
  const hitTest = useCallback((sx: number, sy: number): Waypoint | null => {
    const cos = cosLatRef.current;
    const hitR = RADIUS / viewRef.current.scale;
    for (let i = waypointFile.waypoints.length - 1; i >= 0; i--) {
      const w = waypointFile.waypoints[i];
      if (Math.hypot(w.lon / cos - sx, -w.lat - sy) <= hitR) return w;
    }
    return null;
  }, [waypointFile]);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new ResizeObserver(() => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    obs.observe(canvas);
    return () => obs.disconnect();
  }, []);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const { width: W, height: H } = canvas;
    const { x: vx, y: vy, scale } = view;
    const cos = cosLat;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#1e2228';
    ctx.fillRect(0, 0, W, H);

    // Adaptive grid
    const logS = Math.log10(scale);
    const gridDeg = Math.pow(10, -Math.floor(logS));
    const gridPx  = gridDeg * scale;
    ctx.strokeStyle = '#2a2f38';
    ctx.lineWidth = 1;
    // vertical lines (longitude)
    const startVx = ((vx % gridPx) + gridPx) % gridPx;
    for (let gx = startVx; gx < W; gx += gridPx) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    // horizontal lines (latitude)
    const startVy = ((vy % (gridPx / cos)) + gridPx / cos) % (gridPx / cos);
    for (let gy = startVy; gy < H; gy += gridPx / cos) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }

    // Route lines
    const wps = waypointFile.waypoints;
    if (wps.length > 1) {
      ctx.strokeStyle = 'rgba(74, 158, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      wps.forEach((wp, i) => {
        const [sx, sy] = latLonToScene(wp.lat, wp.lon);
        const screenX = sx * scale + vx;
        const screenY = sy * scale + vy;
        if (i === 0) ctx.moveTo(screenX, screenY);
        else ctx.lineTo(screenX, screenY);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Waypoints
    for (const wp of wps) {
      const [sx, sy] = latLonToScene(wp.lat, wp.lon);
      const px = sx * scale + vx;
      const py = sy * scale + vy;
      if (px < -30 || px > W + 30 || py < -30 || py > H + 30) continue;

      const color = TYPE_COLORS[wp.type] ?? '#4a9eff';
      const sel   = wp.id === selectedId;

      // Glow
      ctx.shadowColor = color;
      ctx.shadowBlur  = sel ? 18 : 6;
      ctx.beginPath();
      ctx.arc(px, py, RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = sel ? color : color + 'bb';
      ctx.fill();
      ctx.shadowBlur = 0;

      // Selection ring
      if (sel) {
        ctx.beginPath();
        ctx.arc(px, py, RADIUS + 5, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Inner pip
      ctx.beginPath();
      ctx.arc(px, py, RADIUS * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();

      // Label
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillStyle = sel ? '#fff' : '#bbb';
      ctx.textAlign = 'center';
      ctx.fillText(wp.name, px, py + RADIUS + 13);
    }

    // Zoom indicator
    const zoomLabel = scale >= 1000
      ? `×${Math.round(scale)}`
      : `×${scale.toFixed(1)}`;
    ctx.font = '11px monospace';
    ctx.fillStyle = '#3a4050';
    ctx.textAlign = 'left';
    ctx.fillText(`zoom ${zoomLabel}`, 10, H - 10);
  }, [waypointFile, selectedId, view, cosLat]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setView(v => {
      const s = Math.max(1, Math.min(500000, v.scale * factor));
      return { scale: s, x: mx - (mx - v.x) * (s / v.scale), y: my - (my - v.y) * (s / v.scale) };
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const [sx, sy] = toScene(cx, cy);

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      panning.current = { cx0: cx, cy0: cy, vx0: viewRef.current.x, vy0: viewRef.current.y };
      return;
    }
    if (e.button !== 0) return;

    if (activeTool === 'add') {
      const [lat, lon] = sceneToLatLon(sx, sy);
      const newWp: Waypoint = {
        id: uuidv4(),
        name: `WP ${waypointFile.waypoints.length}`,
        lat: parseFloat(lat.toFixed(6)),
        lon: parseFloat(lon.toFixed(6)),
        alt: 0,
        type: 'default',
        description: '',
        metadata: {},
      };
      onChange({ ...waypointFile, waypoints: [...waypointFile.waypoints, newWp] });
      onSelect(newWp.id);
    } else if (activeTool === 'select' || activeTool === 'move') {
      const hit = hitTest(sx, sy);
      onSelect(hit?.id ?? null);
      if (hit && activeTool === 'move') {
        dragging.current = { id: hit.id, sx0: cx, sy0: cy, lat0: hit.lat, lon0: hit.lon };
      }
    } else if (activeTool === 'delete') {
      const hit = hitTest(sx, sy);
      if (hit) {
        onChange({ ...waypointFile, waypoints: waypointFile.waypoints.filter(w => w.id !== hit.id) });
        if (selectedId === hit.id) onSelect(null);
      }
    }
  }, [activeTool, waypointFile, onChange, onSelect, selectedId, hitTest]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    if (panning.current) {
      const { cx0, cy0, vx0, vy0 } = panning.current;
      setView(v => ({ ...v, x: vx0 + cx - cx0, y: vy0 + cy - cy0 }));
      return;
    }

    if (dragging.current) {
      const { id, sx0, sy0, lat0, lon0 } = dragging.current;
      const dsx = (cx - sx0) / viewRef.current.scale;
      const dsy = (cy - sy0) / viewRef.current.scale;
      const cos = cosLatRef.current;
      onChange({
        ...waypointFile,
        waypoints: waypointFile.waypoints.map(w => w.id !== id ? w : {
          ...w,
          lat: parseFloat((lat0 - dsy).toFixed(6)),
          lon: parseFloat((lon0 + dsx * cos).toFixed(6)),
        }),
      });
    }
  }, [waypointFile, onChange]);

  const handleMouseUp = useCallback(() => {
    dragging.current = null;
    panning.current  = null;
  }, []);

  const cursors: Record<ToolType, string> = {
    select: 'default', add: 'crosshair', move: 'grab', delete: 'not-allowed',
  };

  return (
    <canvas
      ref={canvasRef}
      className="canvas"
      style={{ cursor: dragging.current ? 'grabbing' : cursors[activeTool] }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
}
