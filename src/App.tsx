import React, { useState, useEffect, useRef } from 'react';

interface EnzymeInfo {
  name: string;
  pdbOpen: string;
  pdbClosed: string;
  description: string;
  optTempMin: number;
  optTempMax: number;
  optPhMin: number;
  optPhMax: number;
}

const DEFAULT_ENZYMES: Record<string, EnzymeInfo> = {
  Hexokinase: {
    name: 'Hexokinase',
    pdbOpen: '1HKG',
    pdbClosed: '2YHX',
    description: 'Watch the two distinct lobes clamp together in an induced fit around the glucose molecule.',
    optTempMin: 15,
    optTempMax: 50,
    optPhMin: 5.5,
    optPhMax: 8.5
  },
  'Maltose Binding Protein': {
    name: 'Maltose Binding Protein',
    pdbOpen: '1OMP',
    pdbClosed: '1ANF',
    description: 'A classic "Venus flytrap" hinge motion that wraps around sugar molecules.',
    optTempMin: 15,
    optTempMax: 52,
    optPhMin: 5.0,
    optPhMax: 9.0
  },
  'Adenylate Kinase': {
    name: 'Adenylate Kinase',
    pdbOpen: '4AKE',
    pdbClosed: '1AKE',
    description: 'Demonstrates a massive domain lid movement closing over the ATP/AMP substrate.',
    optTempMin: 10,
    optTempMax: 55,
    optPhMin: 5.5,
    optPhMax: 8.5
  },
  'DNA Polymerase': {
    name: 'DNA Polymerase',
    pdbOpen: '1T7P',
    pdbClosed: '1L3U',
    description: 'The finger domain closes over the incoming nucleotide to verify correct base pairing.',
    optTempMin: 20,
    optTempMax: 48,
    optPhMin: 6.0,
    optPhMax: 8.5
  }
};

export default function App() {
  const [enzymes, setEnzymes] = useState<Record<string, EnzymeInfo>>(DEFAULT_ENZYMES);
  const [selectedKey, setSelectedKey] = useState<string>('Hexokinase');
  const [viewMode, setViewMode] = useState<'split' | 'open' | 'closed'>('split');
  const [renderStyle, setRenderStyle] = useState<'vdw' | 'spheres' | 'cartoon'>('vdw');
  
  // Custom PDB Input State
  const [customPdbInput, setCustomPdbInput] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);

  // Environmental Variables
  const [temp, setTemp] = useState<number>(37);
  const [ph, setPh] = useState<number>(7.0);

  const [statusText, setStatusText] = useState<string>('Initializing 3D Engine...');

  // Dual Viewport Refs
  const openViewerRef = useRef<HTMLDivElement>(null);
  const closedViewerRef = useRef<HTMLDivElement>(null);
  
  const openViewerInstance = useRef<any>(null);
  const closedViewerInstance = useRef<any>(null);

  // Interaction Lock State to prevent recursive feedback loops during synchronization
  const isSyncingRef = useRef<boolean>(false);

  const activeEnzyme = enzymes[selectedKey];

  // Check if current environmental conditions cause denaturation
  const isDenatured = 
    temp < activeEnzyme.optTempMin || 
    temp > activeEnzyme.optTempMax || 
    ph < activeEnzyme.optPhMin || 
    ph > activeEnzyme.optPhMax;

  // 1. Script Loader Pipeline
  useEffect(() => {
    let isMounted = true;

    const loadScripts = async () => {
      try {
        if (!window || !(window as any).$) {
          const jq = document.createElement('script');
          jq.src = 'https://code.jquery.com/jquery-3.6.0.min.js';
          document.head.appendChild(jq);
          await new Promise((res) => (jq.onload = res));
        }

        if (!(window as any).$3Dmol) {
          const mol = document.createElement('script');
          mol.src = 'https://3dmol.org/build/3Dmol-min.js';
          document.head.appendChild(mol);
          await new Promise((res) => (mol.onload = res));
        }

        if (isMounted) setStatusText('');
      } catch (err: any) {
        if (isMounted) setStatusText(`Engine Load Error: ${err.message}`);
      }
    };

    loadScripts();
    return () => { isMounted = false; };
  }, []);

  // Helper function to apply styling to a specific viewer instance
  const renderStructure = (viewer: any, pdbId: string) => {
    if (!viewer) return;
    const $3Dmol = (window as any).$3Dmol;

    viewer.clear();
    viewer.removeAllSurfaces();

    $3Dmol.download(`pdb:${pdbId}`, viewer, {}, () => {
      if (isDenatured) {
        // Denatured State (Uncoiled Red Wireframe)
        viewer.setStyle({ hetflag: false }, { line: { color: '#ef4444', linewidth: 2 } });
        viewer.setStyle({ hetflag: true }, { stick: { color: '#94a3b8', opacity: 0.3, radius: 0.15 } });
      } else {
        // Native Functional States
        if (renderStyle === 'vdw') {
          viewer.setStyle({ hetflag: false }, { cartoon: { color: 'spectrum' } });
          viewer.addSurface($3Dmol.SurfaceType.VDW, { opacity: 0.65, colorscheme: 'spectrum' }, { hetflag: false });
        } else if (renderStyle === 'spheres') {
          viewer.setStyle({ hetflag: false }, { sphere: { colorscheme: 'spectrum', scale: 0.9 } });
        } else {
          viewer.setStyle({ hetflag: false }, { cartoon: { color: 'spectrum' } });
        }

        // Substrate
        viewer.setStyle({ hetflag: true }, { stick: { colorscheme: 'yellowCarbon', radius: 0.4 } });
      }

      viewer.zoomTo();
      viewer.render();
    });
  };

  // Handle Loading Custom PDB ID(s)
  const handleLoadCustomPdb = () => {
    const trimmed = customPdbInput.trim().toUpperCase();
    if (!trimmed) return;

    // Support single PDB (e.g. "1CAG") or comma-separated pair (e.g. "1HKG, 2YHX")
    const parts = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
    const pdbOpen = parts[0];
    const pdbClosed = parts[1] || parts[0];
    const customKey = `Custom (${pdbOpen}${parts[1] ? ` / ${pdbClosed}` : ''})`;

    const newEnzyme: EnzymeInfo = {
      name: customKey,
      pdbOpen,
      pdbClosed,
      description: `Custom PDB Structure: ${pdbOpen}${parts[1] ? ` (Open) and ${pdbClosed} (Closed)` : ''}`,
      optTempMin: 15,
      optTempMax: 50,
      optPhMin: 5.0,
      optPhMax: 9.0
    };

    setEnzymes((prev) => ({ ...prev, [customKey]: newEnzyme }));
    setSelectedKey(customKey);
    setCustomPdbInput('');
    setShowCustomInput(false);
  };

  // 2. Initialize and Render Open Viewer
  useEffect(() => {
    if (!(window as any).$3Dmol || !(window as any).$) return;
    const $3Dmol = (window as any).$3Dmol;
    const $ = (window as any).$;

    if (openViewerRef.current && (viewMode === 'split' || viewMode === 'open')) {
      if (!openViewerInstance.current) {
        openViewerInstance.current = $3Dmol.createViewer($(openViewerRef.current), { backgroundColor: '#ffffff' });
      }
      renderStructure(openViewerInstance.current, activeEnzyme.pdbOpen);
    }
  }, [selectedKey, renderStyle, isDenatured, viewMode, enzymes]);

  // 3. Initialize and Render Closed Viewer
  useEffect(() => {
    if (!(window as any).$3Dmol || !(window as any).$) return;
    const $3Dmol = (window as any).$3Dmol;
    const $ = (window as any).$;

    if (closedViewerRef.current && (viewMode === 'split' || viewMode === 'closed')) {
      if (!closedViewerInstance.current) {
        closedViewerInstance.current = $3Dmol.createViewer($(closedViewerRef.current), { backgroundColor: '#ffffff' });
      }
      renderStructure(closedViewerInstance.current, activeEnzyme.pdbClosed);
    }
  }, [selectedKey, renderStyle, isDenatured, viewMode, enzymes]);

  // 4. Synchronization Loop for Dual Viewports
  useEffect(() => {
    if (viewMode !== 'split') return;

    let animFrameId: number;

    const syncViewers = () => {
      const v1 = openViewerInstance.current;
      const v2 = closedViewerInstance.current;

      if (v1 && v2 && !isSyncingRef.current) {
        // Synchronize from Open (v1) to Closed (v2) if user interacts with Open
        v1.setTransformCallback(() => {
          if (isSyncingRef.current) return;
          isSyncingRef.current = true;
          const view = v1.getView();
          v2.setView(view);
          v2.render();
          isSyncingRef.current = false;
        });

        // Synchronize from Closed (v2) to Open (v1) if user interacts with Closed
        v2.setTransformCallback(() => {
          if (isSyncingRef.current) return;
          isSyncingRef.current = true;
          const view = v2.getView();
          v1.setView(view);
          v1.render();
          isSyncingRef.current = false;
        });
      }

      animFrameId = requestAnimationFrame(syncViewers);
    };

    syncViewers();

    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (openViewerInstance.current) openViewerInstance.current.setTransformCallback(null);
      if (closedViewerInstance.current) closedViewerInstance.current.setTransformCallback(null);
    };
  }, [viewMode, selectedKey]);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#0f172a' }}>
      
      {/* LEFT SIDEBAR */}
      <div style={{ width: '320px', padding: '20px 12px 20px 12px', color: '#ffffff', display: 'flex', flexDirection: 'column', gap: '18px', boxSizing: 'border-box', overflowY: 'auto' }}>
        <div>
          {/* ENZYME VIEWER Header */}
          <div style={{ 
            backgroundColor: '#000000', 
            padding: '8px 12px', 
            borderRadius: '6px', 
            border: '1px solid #334155',
            display: 'inline-block',
            marginBottom: '8px'
          }}>
            <h2 style={{ margin: 0, fontSize: '20px', color: '#ffffff', letterSpacing: '0.02em', fontWeight: 'bold' }}>
              Enzyme Viewer
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Observe active site closure and environmental tolerance:</p>
        </div>

        {/* ENZYME SELECTOR */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', letterSpacing: '0.05em' }}>SELECT ENZYME</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
            {Object.keys(enzymes).map((key) => (
              <button
                key={key}
                onClick={() => setSelectedKey(key)}
                style={{
                  padding: '10px',
                  borderRadius: '6px',
                  border: selectedKey === key ? '2px solid #3b82f6' : '1px solid #334155',
                  backgroundColor: '#1e293b',
                  color: '#ffffff',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '12px'
                }}
              >
                {key}
              </button>
            ))}
          </div>

          {/* CUSTOM PDB LOADER CONTROLS */}
          <div style={{ marginTop: '10px' }}>
            {!showCustomInput ? (
              <button
                onClick={() => setShowCustomInput(true)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px dashed #3b82f6',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  color: '#38bdf8',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                + Load Custom PDB ID
              </button>
            ) : (
              <div style={{ backgroundColor: '#1e293b', padding: '10px', borderRadius: '6px', border: '1px solid #3b82f6' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  PDB CODE(S) (e.g. 1CAG or 1HKG, 2YHX)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1CAG or 1HKG, 2YHX"
                  value={customPdbInput}
                  onChange={(e) => setCustomPdbInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleLoadCustomPdb(); }}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    border: '1px solid #334155',
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    fontSize: '12px',
                    boxSizing: 'border-box',
                    marginBottom: '8px'
                  }}
                />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={handleLoadCustomPdb}
                    style={{
                      flex: 1,
                      padding: '6px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: '#3b82f6',
                      color: '#ffffff',
                      fontWeight: 'bold',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    Load PDBs
                  </button>
                  <button
                    onClick={() => setShowCustomInput(false)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: '#334155',
                      color: '#94a3b8',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* VIEW MODE TOGGLE (SPLIT VS SINGLE) */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', letterSpacing: '0.05em' }}>VIEWPORT MODE</label>
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
            <button
              onClick={() => setViewMode('split')}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: viewMode === 'split' ? '#3b82f6' : '#334155',
                color: '#ffffff',
                fontWeight: 'bold',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              Split View
            </button>
            <button
              onClick={() => setViewMode('open')}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: viewMode === 'open' ? '#3b82f6' : '#334155',
                color: '#ffffff',
                fontWeight: 'bold',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              Open Only
            </button>
            <button
              onClick={() => setViewMode('closed')}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: viewMode === 'closed' ? '#3b82f6' : '#334155',
                color: '#ffffff',
                fontWeight: 'bold',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              Closed Only
            </button>
          </div>
        </div>

        {/* ENVIRONMENT VARIABLES (pH & TEMPERATURE SLIDERS) */}
        <div style={{ backgroundColor: '#1e293b', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#38bdf8', letterSpacing: '0.05em' }}>ENVIRONMENT VARIABLES</label>
          
          {/* Temperature Slider */}
          <div style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
              <span>Temperature</span>
              <strong style={{ color: temp > activeEnzyme.optTempMax || temp < activeEnzyme.optTempMin ? '#ef4444' : '#22c55e' }}>
                {temp}°C
              </strong>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              value={temp}
              onChange={(e) => setTemp(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: temp > activeEnzyme.optTempMax ? '#ef4444' : '#3b82f6' }}
            />
            <div style={{ fontSize: '10px', color: '#64748b' }}>Optimal: {activeEnzyme.optTempMin}°C – {activeEnzyme.optTempMax}°C</div>
          </div>

          {/* pH Slider */}
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
              <span>pH Level</span>
              <strong style={{ color: ph > activeEnzyme.optPhMax || ph < activeEnzyme.optPhMin ? '#ef4444' : '#22c55e' }}>
                {ph.toFixed(1)}
              </strong>
            </div>
            <input
              type="range"
              min="1"
              max="14"
              step="0.5"
              value={ph}
              onChange={(e) => setPh(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: ph > activeEnzyme.optPhMax || ph < activeEnzyme.optPhMin ? '#ef4444' : '#3b82f6' }}
            />
            <div style={{ fontSize: '10px', color: '#64748b' }}>Optimal: pH {activeEnzyme.optPhMin} – {activeEnzyme.optPhMax}</div>
          </div>

          <button
            onClick={() => { setTemp(37); setPh(7.0); }}
            style={{
              marginTop: '10px',
              width: '100%',
              padding: '6px',
              fontSize: '11px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: '#334155',
              color: '#ffffff',
              cursor: 'pointer'
            }}
          >
            Reset to Standard (37°C, pH 7.0)
          </button>
        </div>

        {/* DISPLAY MODE */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8' }}>3D MODEL STYLE</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
            <button
              onClick={() => setRenderStyle('vdw')}
              disabled={isDenatured}
              style={{
                padding: '8px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: renderStyle === 'vdw' && !isDenatured ? '#3b82f6' : '#334155',
                color: isDenatured ? '#64748b' : '#ffffff',
                fontWeight: 'bold',
                cursor: isDenatured ? 'not-allowed' : 'pointer'
              }}
            >
              VDW Surface Envelope
            </button>
            <button
              onClick={() => setRenderStyle('spheres')}
              disabled={isDenatured}
              style={{
                padding: '8px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: renderStyle === 'spheres' && !isDenatured ? '#3b82f6' : '#334155',
                color: isDenatured ? '#64748b' : '#ffffff',
                fontWeight: 'bold',
                cursor: isDenatured ? 'not-allowed' : 'pointer'
              }}
            >
              VDW Space-Filling Spheres
            </button>
            <button
              onClick={() => setRenderStyle('cartoon')}
              disabled={isDenatured}
              style={{
                padding: '8px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: renderStyle === 'cartoon' && !isDenatured ? '#3b82f6' : '#334155',
                color: isDenatured ? '#64748b' : '#ffffff',
                fontWeight: 'bold',
                cursor: isDenatured ? 'not-allowed' : 'pointer'
              }}
            >
              Cartoon Ribbon
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT CANVAS VIEWPORT AREA */}
      <div style={{ flex: 1, margin: '15px 15px 15px 5px', display: 'flex', gap: '15px', position: 'relative' }}>
        
        {/* DENATURATION WARNING BANNER */}
        {isDenatured && (
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 24px',
            backgroundColor: '#ef4444',
            color: '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)',
            fontWeight: 'bold',
            fontSize: '14px',
            zIndex: 20,
            textAlign: 'center'
          }}>
            ⚠️ ENZYME DENATURED — Tertiary structure disrupted. Substrate binding lost!
          </div>
        )}

        {statusText && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '15px 25px',
            backgroundColor: '#1e293b',
            color: '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            fontWeight: 'bold',
            zIndex: 20
          }}>
            {statusText}
          </div>
        )}

        {/* LEFT VIEWPORT: OPEN STATE */}
        {(viewMode === 'split' || viewMode === 'open') && (
          <div style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
            <div style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              backgroundColor: '#22c55e',
              color: '#ffffff',
              padding: '6px 12px',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '12px',
              zIndex: 10
            }}>
              UNBOUND / PDB 1: {activeEnzyme.pdbOpen} {viewMode === 'split' ? '🔗 Synchronized' : ''}
            </div>
            <div ref={openViewerRef} style={{ width: '100%', height: '100%' }} />
          </div>
        )}

        {/* RIGHT VIEWPORT: CLOSED STATE */}
        {(viewMode === 'split' || viewMode === 'closed') && (
          <div style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
            <div style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              padding: '6px 12px',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '12px',
              zIndex: 10
            }}>
              BOUND / PDB 2: {activeEnzyme.pdbClosed} {viewMode === 'split' ? '🔗 Synchronized' : ''}
            </div>
            <div ref={closedViewerRef} style={{ width: '100%', height: '100%' }} />
          </div>
        )}

        {/* DESCRIPTION CAPTION */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: isDenatured ? 'rgba(254, 242, 242, 0.95)' : 'rgba(248, 250, 252, 0.95)',
          borderTop: '1px solid #e2e8f0',
          padding: '12px',
          fontSize: '13px',
          color: isDenatured ? '#991b1b' : '#334155',
          textAlign: 'center',
          borderRadius: '0 0 12px 12px',
          zIndex: 15
        }}>
          {isDenatured ? (
            <strong>DENATURED STATE: Extreme {temp > activeEnzyme.optTempMax ? 'high temperature' : temp < activeEnzyme.optTempMin ? 'low temperature' : 'pH levels'} disrupted structural bonding.</strong>
          ) : (
            <span><strong>{activeEnzyme.name}</strong>: {activeEnzyme.description}</span>
          )}
        </div>

      </div>

    </div>
  );
}
