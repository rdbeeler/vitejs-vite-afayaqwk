import React, { useEffect, useRef, useState } from 'react';

// --- Types ---
type ViewMode = 'split' | 'open' | 'closed';
type RenderStyle = 'cartoon' | 'vdw' | 'spheres';

interface EnzymePreset {
  name: string;
  openPdb: string;
  closedPdb: string;
  description: string;
}

const PRESETS: Record<string, EnzymePreset> = {
  hexokinase: {
    name: 'Hexokinase',
    openPdb: '1HKG',
    closedPdb: '2YHX',
    description: 'Conformational change upon glucose binding in yeast hexokinase.',
  },
  adenylateKinase: {
    name: 'Adenylate Kinase',
    openPdb: '4AKE',
    closedPdb: '1AKE',
    description: 'Domain closure mechanism regulating ATP/AMP phosphate transfer.',
  },
};

export default function App() {
  // State
  const [selectedKey, setSelectedKey] = useState<string>('hexokinase');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [renderStyle, setRenderStyle] = useState<RenderStyle>('cartoon');
  const [isDenatured, setIsDenatured] = useState<boolean>(false);
  const [autoAlign, setAutoAlign] = useState<boolean>(true);

  // Refs for container elements and 3Dmol viewer instances
  const openContainerRef = useRef<HTMLDivElement | null>(null);
  const closedContainerRef = useRef<HTMLDivElement | null>(null);

  const openViewerInstance = useRef<any>(null);
  const closedViewerInstance = useRef<any>(null);

  // Tracks which pane the user is interacting with
  const activeViewerSource = useRef<'open' | 'closed' | null>(null);

  // Stores base centroids so rotation doesn't cause model translation drift
  const modelCenters = useRef<{ open?: [number, number, number]; closed?: [number, number, number] }>({});

  const currentPreset = PRESETS[selectedKey];

  // Helper to safely load $3Dmol CDN script if not present
  useEffect(() => {
    if ((window as any).$3Dmol) return;
    const script = document.createElement('script');
    script.src = 'https://3dmol.org/build/3Dmol-min.js';
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // 1. Initialize Viewers
  useEffect(() => {
    const $3Dmol = (window as any).$3Dmol;
    if (!$3Dmol) return;

    if (openContainerRef.current && !openViewerInstance.current) {
      openViewerInstance.current = $3Dmol.createViewer(openContainerRef.current, {
        backgroundColor: '#0f172a',
      });
    }

    if (closedContainerRef.current && !closedViewerInstance.current) {
      closedViewerInstance.current = $3Dmol.createViewer(closedContainerRef.current, {
        backgroundColor: '#0f172a',
      });
    }

    // Attach listeners to detect active viewer
    const openEl = openContainerRef.current;
    const closedEl = closedContainerRef.current;

    const handleOpenFocus = () => { activeViewerSource.current = 'open'; };
    const handleClosedFocus = () => { activeViewerSource.current = 'closed'; };

    openEl?.addEventListener('mouseenter', handleOpenFocus);
    openEl?.addEventListener('touchstart', handleOpenFocus);
    closedEl?.addEventListener('mouseenter', handleClosedFocus);
    closedEl?.addEventListener('touchstart', handleClosedFocus);

    return () => {
      openEl?.removeEventListener('mouseenter', handleOpenFocus);
      openEl?.removeEventListener('touchstart', handleOpenFocus);
      closedEl?.removeEventListener('mouseenter', handleClosedFocus);
      closedEl?.removeEventListener('touchstart', handleClosedFocus);
    };
  }, []);

  // Structural Alignment (Superposition) Utility
  const alignStructures = (sourceViewer: any, targetViewer: any) => {
    if (!sourceViewer || !targetViewer) return;

    // Get C-alpha atoms for superposition comparison
    const srcAtoms = sourceViewer.selectedAtoms({ atom: 'CA' });
    const tgtAtoms = targetViewer.selectedAtoms({ atom: 'CA' });

    if (srcAtoms.length > 0 && tgtAtoms.length > 0 && sourceViewer.align) {
      // 3Dmol built-in structural alignment helper
      sourceViewer.align(targetViewer, { atom: 'CA' });
    }
  };

  // Render PDB structures into a target viewer
  const renderStructure = (viewer: any, pdbId: string, type: 'open' | 'closed') => {
    if (!viewer) return;
    const $3Dmol = (window as any).$3Dmol;
    if (!$3Dmol) return;

    viewer.clear();
    viewer.removeAllSurfaces();

    $3Dmol.download(`pdb:${pdbId}`, viewer, {}, () => {
      if (isDenatured) {
        viewer.setStyle({ hetflag: false }, { line: { color: '#ef4444', linewidth: 2 } });
        viewer.setStyle({ hetflag: true }, { stick: { color: '#94a3b8', opacity: 0.3, radius: 0.15 } });
      } else {
        if (renderStyle === 'vdw') {
          viewer.setStyle({ hetflag: false }, { cartoon: { color: 'spectrum' } });
          viewer.addSurface($3Dmol.SurfaceType.VDW, { opacity: 0.65, colorscheme: { prop: 'resi', gradient: 'roygb' } }, { hetflag: false });
        } else if (renderStyle === 'spheres') {
          viewer.setStyle({ hetflag: false }, { sphere: { colorscheme: { prop: 'resi', gradient: 'roygb' }, scale: 0.9 } });
        } else {
          viewer.setStyle({ hetflag: false }, { cartoon: { color: 'spectrum' } });
        }

        viewer.setStyle({ hetflag: true }, { stick: { colorscheme: 'yellowCarbon', radius: 0.4 } });
      }

      viewer.zoomTo();

      // Store initial center offset to decoupling origin translation from rotation
      const initialView = viewer.getView();
      if (initialView) {
        modelCenters.current[type] = [initialView.x, initialView.y, initialView.z];
      }

      // If both viewers ready and structural superposition requested
      if (autoAlign && openViewerInstance.current && closedViewerInstance.current) {
        alignStructures(openViewerInstance.current, closedViewerInstance.current);
      }

      viewer.render();
    });
  };

  // 2. Load and Update Structures on State Changes
  useEffect(() => {
    if (viewMode === 'split' || viewMode === 'open') {
      renderStructure(openViewerInstance.current, currentPreset.openPdb, 'open');
    }
    if (viewMode === 'split' || viewMode === 'closed') {
      renderStructure(closedViewerInstance.current, currentPreset.closedPdb, 'closed');
    }
  }, [selectedKey, renderStyle, isDenatured, autoAlign]);

  // Handle Resize
  useEffect(() => {
    openViewerInstance.current?.resize();
    closedViewerInstance.current?.resize();
  }, [viewMode]);

  // 3. Synchronized Camera & Quaternion Control Loop
  useEffect(() => {
    if (viewMode !== 'split') return;

    let animId: number;

    const syncLoop = () => {
      const v1 = openViewerInstance.current;
      const v2 = closedViewerInstance.current;

      if (v1 && v2) {
        if (activeViewerSource.current === 'open') {
          const srcView = v1.getView();
          const targetCenter = modelCenters.current.closed;

          if (srcView && targetCenter) {
            v2.setView({
              x: targetCenter[0],
              y: targetCenter[1],
              z: targetCenter[2],
              zoom: srcView.zoom,
              qx: srcView.qx,
              qy: srcView.qy,
              qz: srcView.qz,
              qw: srcView.qw,
            });
            v2.render();
          }
        } else if (activeViewerSource.current === 'closed') {
          const srcView = v2.getView();
          const targetCenter = modelCenters.current.open;

          if (srcView && targetCenter) {
            v1.setView({
              x: targetCenter[0],
              y: targetCenter[1],
              z: targetCenter[2],
              zoom: srcView.zoom,
              qx: srcView.qx,
              qy: srcView.qy,
              qz: srcView.qz,
              qw: srcView.qw,
            });
            v1.render();
          }
        }
      }

      animId = requestAnimationFrame(syncLoop);
    };

    animId = requestAnimationFrame(syncLoop);
    return () => cancelAnimationFrame(animId);
  }, [viewMode, selectedKey]);

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-100 font-sans">
      {/* Top Header Controls */}
      <header className="flex flex-wrap items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-wide">3D Enzyme Viewer</h1>
          <p className="text-xs text-slate-400 mt-0.5">{currentPreset.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          {/* Preset Selector */}
          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            className="bg-slate-800 text-slate-200 border border-slate-700 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {Object.entries(PRESETS).map(([key, preset]) => (
              <option key={key} value={key}>
                {preset.name}
              </option>
            ))}
          </select>

          {/* View Mode */}
          <div className="flex bg-slate-800 p-1 rounded-md border border-slate-700">
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'split' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Split View
            </button>
            <button
              onClick={() => setViewMode('open')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'open' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Open State
            </button>
            <button
              onClick={() => setViewMode('closed')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'closed' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Closed State
            </button>
          </div>

          {/* Style Selector */}
          <select
            value={renderStyle}
            onChange={(e) => setRenderStyle(e.target.value as RenderStyle)}
            className="bg-slate-800 text-slate-200 border border-slate-700 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="cartoon">Cartoon</option>
            <option value="vdw">VDW Surface</option>
            <option value="spheres">Space-Filling (Spheres)</option>
          </select>

          {/* Denature Toggle */}
          <button
            onClick={() => setIsDenatured(!isDenatured)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
              isDenatured
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {isDenatured ? 'Denatured' : 'Native State'}
          </button>

          {/* Superposition Toggle */}
          <button
            onClick={() => setAutoAlign(!autoAlign)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
              autoAlign
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {autoAlign ? 'Superimposed' : 'Unaligned'}
          </button>
        </div>
      </header>

      {/* Main Viewport Container */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-800 relative overflow-hidden">
        {/* Open State Container */}
        <div
          className={`relative h-full w-full bg-slate-950 ${
            viewMode === 'closed' ? 'hidden' : viewMode === 'open' ? 'col-span-2' : ''
          }`}
        >
          <div className="absolute top-3 left-3 z-10 bg-slate-900/80 backdrop-blur border border-slate-800 px-2.5 py-1 rounded text-xs font-semibold text-indigo-400">
            Open State ({currentPreset.openPdb})
          </div>
          <div ref={openContainerRef} className="h-full w-full" />
        </div>

        {/* Closed State Container */}
        <div
          className={`relative h-full w-full bg-slate-950 ${
            viewMode === 'open' ? 'hidden' : viewMode === 'closed' ? 'col-span-2' : ''
          }`}
        >
          <div className="absolute top-3 left-3 z-10 bg-slate-900/80 backdrop-blur border border-slate-800 px-2.5 py-1 rounded text-xs font-semibold text-emerald-400">
            Closed State ({currentPreset.closedPdb})
          </div>
          <div ref={closedContainerRef} className="h-full w-full" />
        </div>
      </main>
    </div>
  );
}
