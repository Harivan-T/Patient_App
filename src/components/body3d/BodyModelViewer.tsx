'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { REGION_KEYS } from './regions';
import type { RegionKey } from './regions';
export type { RegionKey } from './regions';

// ── Material colors ──────────────────────────────────────────────────────────
const BASE_COLOR  = new THREE.Color('#B2D4DF'); // light teal body
const SEL_COLOR   = new THREE.Color('#548194'); // brand teal (selected)
const HOVER_COLOR = new THREE.Color('#7AB8CA'); // soft mid-teal hover
const SEL_EMISSIVE = new THREE.Color('#0d2f3a'); // warm teal glow on selected

// ── Body mesh — lives inside Suspense, suspended while GLB loads ─────────────

function BodyMesh({
  url,
  selected,
  hovered,
  onToggle,
  onHover,
  onSegmentCheck,
}: {
  url: string;
  selected: Set<string>;
  hovered: string | null;
  onToggle: (k: RegionKey) => void;
  onHover: (k: string | null) => void;
  onSegmentCheck: (ok: boolean, found: string[]) => void;
}) {
  const { scene } = useGLTF(url);

  // One-time per scene object: normalize scale, centre, check segments, clone materials
  useEffect(() => {
    if (scene.userData.__body3dInit) return;
    scene.userData.__body3dInit = true;

    // Auto-scale to 2 units max-dimension then centre at origin
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const s = maxDim > 0 ? 2 / maxDim : 1;
    scene.scale.setScalar(s);
    scene.position.set(-centre.x * s, -centre.y * s, -centre.z * s);

    // Segmentation check
    const found: string[] = [];
    scene.traverse((o) => { if (o instanceof THREE.Mesh) found.push(o.name); });
    onSegmentCheck(REGION_KEYS.every((k) => found.includes(k)), found);

    // Clone and paint all meshes with the base body colour
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const mat = (o.material as THREE.MeshStandardMaterial).clone();
      mat.color.set(BASE_COLOR);
      mat.roughness = 0.68;
      mat.metalness = 0;
      o.material = mat;
    });
  // segmentCheck is stable (useCallback in parent) — safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  // Reactive colour update on selection / hover changes
  useEffect(() => {
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const mat = o.material as THREE.MeshStandardMaterial;
      if (!mat.isMeshStandardMaterial) return;
      const k = o.name;
      if (selected.has(k)) {
        mat.color.set(SEL_COLOR);
        mat.emissive.set(SEL_EMISSIVE);
        mat.emissiveIntensity = 0.25;
      } else if (hovered === k) {
        mat.color.set(HOVER_COLOR);
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
      } else {
        mat.color.set(BASE_COLOR);
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
      }
    });
  }, [scene, selected, hovered]);

  return (
    <primitive
      object={scene}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        const k = e.object.name as RegionKey;
        if ((REGION_KEYS as readonly string[]).includes(k)) onToggle(k);
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        const k = e.object.name;
        if ((REGION_KEYS as readonly string[]).includes(k)) {
          onHover(k);
          document.body.style.cursor = 'pointer';
        }
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = 'default';
      }}
    />
  );
}

// ── Scene: lights + Suspense-wrapped mesh ────────────────────────────────────

function Scene({
  url,
  selected,
  hovered,
  onToggle,
  onHover,
  onSegmentCheck,
}: {
  url: string;
  selected: Set<string>;
  hovered: string | null;
  onToggle: (k: RegionKey) => void;
  onHover: (k: string | null) => void;
  onSegmentCheck: (ok: boolean, found: string[]) => void;
}) {
  return (
    <>
      <ambientLight intensity={0.95} />
      <directionalLight position={[3, 6, 4]} intensity={1.2} />
      <directionalLight position={[-3, 4, -4]} intensity={0.45} />
      <Suspense
        fallback={
          <Html center>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 30, height: 30,
                border: '3px solid #548194',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'body3d-spin 0.8s linear infinite',
              }} />
              <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>Loading model…</span>
            </div>
          </Html>
        }
      >
        <BodyMesh
          url={url}
          selected={selected}
          hovered={hovered}
          onToggle={onToggle}
          onHover={onHover}
          onSegmentCheck={onSegmentCheck}
        />
      </Suspense>
    </>
  );
}

// ── Public component: Canvas + controls + overlay buttons ────────────────────

export interface BodyModelViewerProps {
  gender: 'male' | 'female';
  selected: Set<string>;
  onToggle: (k: RegionKey) => void;
  onSegmentCheck: (ok: boolean, found: string[]) => void;
}

export function BodyModelViewer({ gender, selected, onToggle, onSegmentCheck }: BodyModelViewerProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const url = `/models/body-${gender}.glb`;

  // Restore cursor and clear GLB cache when the viewer fully unmounts
  useEffect(() => {
    return () => {
      document.body.style.cursor = 'default';
      useGLTF.clear('/models/body-male.glb');
      useGLTF.clear('/models/body-female.glb');
    };
  }, []);

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden"
      style={{ height: 440, background: '#EEF6FA' }}
    >
      {/* Spin keyframe injected once per render */}
      <style>{`@keyframes body3d-spin { to { transform: rotate(360deg); } }`}</style>

      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 42 }}
        gl={{ antialias: true }}
        dpr={[1, 2]}
      >
        <Scene
          url={url}
          selected={selected}
          hovered={hovered}
          onToggle={onToggle}
          onHover={setHovered}
          onSegmentCheck={onSegmentCheck}
        />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan={false}
          minDistance={1.5}
          maxDistance={7}
        />
      </Canvas>

      {/* Reset view */}
      <button
        type="button"
        onClick={() => controlsRef.current?.reset()}
        className="absolute top-3 right-3 px-2.5 py-1.5 text-xs font-medium rounded-xl border border-border text-slate-600 hover:bg-white transition-colors"
        style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(4px)' }}
      >
        ↺ Reset view
      </button>

      {/* CC BY 4.0 attribution — required for the male base model */}
      {gender === 'male' && (
        <p
          className="absolute bottom-2 left-3 text-[10px] text-slate-400 pointer-events-none select-none"
        >
          3D model by ilmarco6910 (CC BY 4.0)
        </p>
      )}
    </div>
  );
}

// Preload both models the moment this dynamic chunk resolves
useGLTF.preload('/models/body-male.glb');
useGLTF.preload('/models/body-female.glb');
