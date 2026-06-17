import { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import type { Waypoint, WaypointFile, ToolType } from '../types/waypoint';
import './ThreeCanvas.css';

const ALT_EXAG = 5;

const TYPE_COLORS: Record<string, number> = {
  default:    0x4a9eff,
  checkpoint: 0x4caf50,
  danger:     0xf44336,
  info:       0xffeb3b,
};

interface WorldCenter { lat: number; lon: number; cosLat: number }

function computeCenter(waypoints: Waypoint[]): WorldCenter {
  const v = waypoints.filter(w => w.lat !== 0 || w.lon !== 0);
  if (!v.length) return { lat: 51, lon: 31, cosLat: Math.cos(51 * Math.PI / 180) };
  const lat = v.reduce((s, w) => s + w.lat, 0) / v.length;
  const lon = v.reduce((s, w) => s + w.lon, 0) / v.length;
  return { lat, lon, cosLat: Math.cos(lat * Math.PI / 180) };
}

function toWorld(lat: number, lon: number, alt: number, c: WorldCenter): THREE.Vector3 {
  return new THREE.Vector3(
    (lon - c.lon) * 111.32 * c.cosLat,
    alt / 1000 * ALT_EXAG,
    -(lat - c.lat) * 111.32,
  );
}

function fromWorld(p: THREE.Vector3, c: WorldCenter) {
  return {
    lat: parseFloat((c.lat - p.z / 111.32).toFixed(6)),
    lon: parseFloat((c.lon + p.x / (111.32 * c.cosLat)).toFixed(6)),
    alt: parseFloat((p.y / ALT_EXAG * 1000).toFixed(1)),
  };
}

interface Props {
  waypointFile: WaypointFile;
  activeTool: ToolType;
  selectedIds: Set<string>;
  selectedGroupId: string | null;
  fitSignal: number;
  onSelect: (id: string | null, multi: boolean) => void;
  onChange: (wf: WaypointFile) => void;
}

export function ThreeCanvas({
  waypointFile, activeTool, selectedIds, selectedGroupId, fitSignal,
  onSelect, onChange,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelRef  = useRef<HTMLDivElement>(null);

  // Three.js refs (stable across renders)
  const scene    = useRef<THREE.Scene | null>(null);
  const camera   = useRef<THREE.PerspectiveCamera | null>(null);
  const renderer = useRef<THREE.WebGLRenderer | null>(null);
  const rafId    = useRef(0);

  // Orbit state
  const orb = useRef({ az: 0.6, el: 0.7, dist: 300, target: new THREE.Vector3() });

  // Scene objects
  const meshMap  = useRef<Map<string, THREE.Mesh>>(new Map());
  const labelMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const lineRef  = useRef<THREE.Line | null>(null);
  const boxRefs  = useRef<THREE.Box3Helper[]>([]);
  const center   = useRef<WorldCenter>({ lat: 51, lon: 31, cosLat: 0.629 });

  // Interaction state
  const mouse = useRef({
    type: null as null | 'orbit' | 'pan' | 'drag',
    lx: 0, ly: 0, moved: false, downX: 0, downY: 0,
    dragId: null as string | null,
    dragPlane: null as THREE.Plane | null,
    ray: new THREE.Raycaster(),
  });

  const updateCamera = useCallback(() => {
    const cam = camera.current; if (!cam) return;
    const { az, el, dist, target } = orb.current;
    cam.position.set(
      target.x + dist * Math.sin(el) * Math.sin(az),
      target.y + dist * Math.cos(el),
      target.z + dist * Math.sin(el) * Math.cos(az),
    );
    cam.lookAt(target);
  }, []);

  // Init
  useEffect(() => {
    const mount = mountRef.current; if (!mount) return;
    const W = mount.clientWidth, H = mount.clientHeight;

    const sc = new THREE.Scene();
    sc.background = new THREE.Color(0x1a1e26);
    scene.current = sc;

    const cam = new THREE.PerspectiveCamera(55, W / H, 0.1, 50000);
    camera.current = cam;
    updateCamera();

    const ren = new THREE.WebGLRenderer({ antialias: true });
    ren.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    ren.setSize(W, H);
    mount.appendChild(ren.domElement);
    renderer.current = ren;

    sc.add(new THREE.AmbientLight(0x607090, 3));
    const dir = new THREE.DirectionalLight(0xffffff, 4);
    dir.position.set(200, 500, 100);
    sc.add(dir);

    const grid = new THREE.GridHelper(2000, 40, 0x1e2830, 0x1e2830);
    sc.add(grid);

    const animate = () => {
      rafId.current = requestAnimationFrame(animate);
      ren.render(sc, cam);
      syncLabels(cam);
    };
    animate();

    const obs = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight;
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      ren.setSize(w, h);
    });
    obs.observe(mount);

    return () => {
      cancelAnimationFrame(rafId.current);
      obs.disconnect();
      ren.dispose();
      if (mount.contains(ren.domElement)) mount.removeChild(ren.domElement);
    };
  }, [updateCamera]);

  const syncLabels = (cam: THREE.PerspectiveCamera) => {
    const mount = mountRef.current; if (!mount) return;
    const W = mount.clientWidth, H = mount.clientHeight;
    for (const [id, div] of labelMap.current) {
      const mesh = meshMap.current.get(id);
      if (!mesh) { div.style.display = 'none'; continue; }
      const p = mesh.position.clone().project(cam);
      if (p.z > 1) { div.style.display = 'none'; continue; }
      div.style.display = 'block';
      div.style.left = `${(p.x * 0.5 + 0.5) * W}px`;
      div.style.top  = `${(-p.y * 0.5 + 0.5) * H + 18}px`;
    }
  };

  // Rebuild scene whenever file changes
  useEffect(() => {
    const sc = scene.current; const lc = labelRef.current;
    if (!sc || !lc) return;

    const c = computeCenter(waypointFile.waypoints);
    center.current = c;

    // Clear old meshes
    for (const [, m] of meshMap.current) { sc.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    meshMap.current.clear();
    for (const [, d] of labelMap.current) d.remove();
    labelMap.current.clear();

    // Clear route line
    if (lineRef.current) { sc.remove(lineRef.current); lineRef.current.geometry.dispose(); lineRef.current = null; }

    // Clear group boxes
    for (const b of boxRefs.current) sc.remove(b);
    boxRefs.current = [];

    const valid = waypointFile.waypoints.filter(w => w.lat !== 0 || w.lon !== 0);
    const extent = (() => {
      if (valid.length < 2) return 5;
      const xs = valid.map(w => (w.lon - c.lon) * 111.32 * c.cosLat);
      const zs = valid.map(w => -(w.lat - c.lat) * 111.32);
      return Math.max(
        Math.max(...xs) - Math.min(...xs),
        Math.max(...zs) - Math.min(...zs),
      );
    })();
    const radius = Math.max(0.5, extent * 0.012);

    const sphereGeo = new THREE.SphereGeometry(radius, 16, 12);

    // Route line
    if (valid.length > 1) {
      const pts = valid.map(w => toWorld(w.lat, w.lon, w.alt, c));
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x4a9eff, opacity: 0.35, transparent: true });
      const line = new THREE.Line(lineGeo, lineMat);
      sc.add(line);
      lineRef.current = line;
    }

    // Waypoint spheres + labels
    for (const wp of waypointFile.waypoints) {
      const mat = new THREE.MeshLambertMaterial({ color: TYPE_COLORS[wp.type] ?? 0x4a9eff });
      const mesh = new THREE.Mesh(sphereGeo.clone(), mat);
      mesh.position.copy(
        (wp.lat === 0 && wp.lon === 0)
          ? new THREE.Vector3(0, 0, 0)
          : toWorld(wp.lat, wp.lon, wp.alt, c)
      );
      mesh.userData = { waypointId: wp.id };
      sc.add(mesh);
      meshMap.current.set(wp.id, mesh);

      const div = document.createElement('div');
      div.className = 'wp-label';
      div.textContent = wp.name;
      lc.appendChild(div);
      labelMap.current.set(wp.id, div);
    }

    // Group boxes
    for (const group of waypointFile.groups) {
      const ms = group.waypointIds.map(id => meshMap.current.get(id)).filter(Boolean) as THREE.Mesh[];
      if (!ms.length) continue;
      const bbox = new THREE.Box3();
      ms.forEach(m => bbox.expandByObject(m));
      bbox.expandByScalar(radius * 1.5);
      const helper = new THREE.Box3Helper(bbox, new THREE.Color(group.color || '#4a9eff'));
      sc.add(helper);
      boxRefs.current.push(helper);
    }
  }, [waypointFile]);

  // Update colors on selection change
  useEffect(() => {
    for (const [id, mesh] of meshMap.current) {
      const wp = waypointFile.waypoints.find(w => w.id === id);
      if (!wp) continue;
      const mat = mesh.material as THREE.MeshLambertMaterial;
      if (selectedIds.has(id)) {
        mat.color.setHex(0xffffff);
        mat.emissive.setHex(TYPE_COLORS[wp.type] ?? 0x4a9eff);
        mat.emissiveIntensity = 0.7;
      } else {
        mat.color.setHex(TYPE_COLORS[wp.type] ?? 0x4a9eff);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    }
    for (const [id, div] of labelMap.current) {
      div.className = `wp-label${selectedIds.has(id) ? ' wp-label--sel' : ''}`;
    }
  }, [selectedIds, waypointFile]);

  // Highlight selected group
  useEffect(() => {
    if (!selectedGroupId) return;
    const group = waypointFile.groups.find(g => g.id === selectedGroupId);
    if (!group) return;
    for (const [id, mesh] of meshMap.current) {
      if (!group.waypointIds.includes(id)) continue;
      const mat = mesh.material as THREE.MeshLambertMaterial;
      mat.emissive.setHex(new THREE.Color(group.color).getHex());
      mat.emissiveIntensity = 0.5;
    }
  }, [selectedGroupId, waypointFile]);

  // Fit view
  const fitView = useCallback(() => {
    const c = center.current;
    const valid = waypointFile.waypoints.filter(w => w.lat !== 0 || w.lon !== 0);
    if (!valid.length) return;
    const pts = valid.map(w => toWorld(w.lat, w.lon, w.alt, c));
    const bbox = new THREE.Box3().setFromPoints(pts);
    const size = bbox.getSize(new THREE.Vector3());
    bbox.getCenter(orb.current.target);
    orb.current.dist = Math.max(size.length() * 0.9, 30);
    updateCamera();
  }, [waypointFile, updateCamera]);

  const prevCreated = useRef('');
  useEffect(() => {
    const key = waypointFile.metadata.created;
    if (key !== prevCreated.current || fitSignal > 0) {
      prevCreated.current = key;
      setTimeout(fitView, 80);
    }
  }, [waypointFile.metadata.created, fitSignal, fitView]);

  const getNDC = (e: React.MouseEvent) => {
    const r = mountRef.current!.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
  };

  const raycastWaypoints = (ndc: THREE.Vector2): string | null => {
    const cam = camera.current; if (!cam) return null;
    mouse.current.ray.setFromCamera(ndc, cam);
    const hits = mouse.current.ray.intersectObjects([...meshMap.current.values()]);
    return hits.length ? (hits[0].object.userData.waypointId as string) : null;
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const ms = mouse.current;
    ms.lx = e.clientX; ms.ly = e.clientY;
    ms.downX = e.clientX; ms.downY = e.clientY;
    ms.moved = false;

    if (e.button === 2) { ms.type = 'pan'; return; }
    if (e.button === 1 || (e.button === 0 && e.altKey)) { ms.type = 'pan'; return; }
    if (e.button !== 0) return;

    const ndc = getNDC(e);
    const hitId = raycastWaypoints(ndc);

    if (activeTool === 'move' && hitId) {
      const mesh = meshMap.current.get(hitId)!;
      ms.type = 'drag';
      ms.dragId = hitId;
      ms.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -mesh.position.y);
      onSelect(hitId, false);
    } else {
      ms.type = 'orbit';
    }
  }, [activeTool, onSelect]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const ms = mouse.current;
    const wasMoved = ms.moved;
    const type = ms.type;
    ms.type = null; ms.dragId = null; ms.dragPlane = null;

    if (wasMoved || type === 'pan') return;
    if (e.button !== 0) return;

    // Short click = tool action
    const ndc = getNDC(e);
    const cam = camera.current; if (!cam) return;
    const hitId = raycastWaypoints(ndc);

    if (activeTool === 'select') {
      onSelect(hitId ?? null, e.shiftKey);
    } else if (activeTool === 'add') {
      ms.ray.setFromCamera(ndc, cam);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const pt = new THREE.Vector3();
      ms.ray.ray.intersectPlane(plane, pt);
      const { lat, lon } = fromWorld(pt, center.current);
      const newWp: Waypoint = {
        id: uuidv4(), name: `WP ${waypointFile.waypoints.length}`,
        lat, lon, alt: 0, type: 'default', description: '', metadata: {},
      };
      onChange({ ...waypointFile, waypoints: [...waypointFile.waypoints, newWp] });
      onSelect(newWp.id, false);
    } else if (activeTool === 'delete' && hitId) {
      onChange({
        ...waypointFile,
        waypoints: waypointFile.waypoints.filter(w => w.id !== hitId),
        groups: waypointFile.groups.map(g => ({ ...g, waypointIds: g.waypointIds.filter(id => id !== hitId) })).filter(g => g.waypointIds.length > 0),
      });
      onSelect(null, false);
    }
  }, [activeTool, waypointFile, onChange, onSelect]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const ms = mouse.current;
    if (!ms.type) return;

    const dx = e.clientX - ms.lx;
    const dy = e.clientY - ms.ly;
    ms.lx = e.clientX; ms.ly = e.clientY;

    const totalD = Math.hypot(e.clientX - ms.downX, e.clientY - ms.downY);
    if (totalD > 4) ms.moved = true;

    if (ms.type === 'orbit') {
      orb.current.az -= dx * 0.006;
      orb.current.el = Math.max(0.05, Math.min(Math.PI * 0.49, orb.current.el - dy * 0.006));
      updateCamera();
    } else if (ms.type === 'pan') {
      const cam = camera.current; if (!cam) return;
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0);
      const up    = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1);
      const speed = orb.current.dist * 0.001;
      orb.current.target.addScaledVector(right, -dx * speed);
      orb.current.target.addScaledVector(up,    dy * speed);
      updateCamera();
    } else if (ms.type === 'drag' && ms.dragId && ms.dragPlane) {
      const cam = camera.current; if (!cam) return;
      const ndc = getNDC(e);
      ms.ray.setFromCamera(ndc, cam);
      const pt = new THREE.Vector3();
      ms.ray.ray.intersectPlane(ms.dragPlane, pt);
      const { lat, lon } = fromWorld(pt, center.current);
      onChange({
        ...waypointFile,
        waypoints: waypointFile.waypoints.map(w =>
          w.id !== ms.dragId ? w : { ...w, lat, lon }
        ),
      });
    }
  }, [waypointFile, onChange, updateCamera]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    orb.current.dist *= e.deltaY > 0 ? 1.12 : 0.88;
    orb.current.dist = Math.max(1, Math.min(5000, orb.current.dist));
    updateCamera();
  }, [updateCamera]);

  const cursors: Record<ToolType, string> = {
    select: 'default', add: 'crosshair', move: 'grab', delete: 'not-allowed',
  };

  return (
    <div
      ref={mountRef}
      className="three-canvas"
      style={{ cursor: mouse.current.type === 'drag' ? 'grabbing' : cursors[activeTool] }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={e => e.preventDefault()}
    >
      <div ref={labelRef} className="three-canvas__labels" />
      <div className="three-canvas__hint">
        Left drag: orbit · Right drag: pan · Scroll: zoom · Alt+drag: pan
      </div>
    </div>
  );
}
