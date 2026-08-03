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

const ENZYMES: Record<string, EnzymeInfo> = {
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
  const [selectedKey, setSelectedKey] = useState<string>('Hexokinase');
  const [stateMode, setStateMode] = useState<'open' | 'closed'>('open');
  const [renderStyle, setRenderStyle] = useState<'vdw' | 'spheres' | 'cartoon'>('vdw');
  
  // Environmental Variables
  const [temp, setTemp] = useState<number>(37);
  const [ph, setPh] = useState<number>(7.0);

  const [statusText, setStatusText] = useState<string>('Initializing 3D Engine...');

  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerInstance = useRef<any>(null);

  const activeEnzyme = ENZYMES[selectedKey];

  // Check if current environmental conditions exceed enzyme tolerances
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

        if (viewerRef.current && !viewerInstance.current && isMounted) {
          const $3Dmol = (window as any).$3Dmol;
          const $ = (window as any).$;
          viewerInstance.current = $3Dmol.createViewer($(viewerRef.current), {
            backgroundColor: '#ffffff'
          });
          setStatusText('');
        }
      } catch (err: any) {
        if (isMounted) setStatusText(`Engine Load Error: ${err.message}`);
      }
    };

    loadScripts();
    return () => { isMounted = false; };
  }, []);

  // 2. Fetch Structure and Apply Native or Denatured Visualization
  useEffect(() => {
    if (!viewerInstance.current) return;

    const $3Dmol = (window as any).$3Dmol;
    const targetPdb = stateMode === 'open' ? activeEnzyme.pdbOpen : activeEnzyme.pdbClosed;
    const v = viewerInstance.current;

    setStatusText(`Downloading PDB ${targetPdb}...`);
    v.clear();
    v.removeAllSurfaces();

    $3Dmol.download(`pdb:${targetPdb}`, v, {}, () => {
      
      if (isDenatured) {
        // --- DENATURED STATE VISUALIZATION ---
        // Strip tertiary structure, render as uncoiled, discolored wireframe/thin sticks
        v.setStyle({ hetflag: false }, { line: { color: '#ef4444', linewidth: 2 } });
        
        // Substrate loses active site fit (faded out)
        v.setStyle({ hetflag: true }, { stick: { color: '#94a3b8', opacity: 0.3, radius: 0.15 } });
      } else {
        // --- NATIVE FUNCTIONAL STATE VISUALIZATION ---
        if (renderStyle === 'vdw') {
          v.setStyle({ hetflag: false }, { cartoon: { color: 'spectrum' } });
          v.addSurface($3Dmol.SurfaceType.VDW, { opacity: 0.65, colorscheme: 'spectrum' }, { hetflag: false });
        } else if (renderStyle === 'spheres') {
          v.setStyle({ hetflag: false }, { sphere: { colorscheme: 'spectrum', scale: 0.9 } });
        } else {
          v.setStyle({ hetflag: false }, { cartoon: { color: 'spectrum' } });
        }

        // Active substrate
        v.setStyle({ hetflag: true }, { stick: { colorscheme: 'yellowCarbon', radius: 0.4 } });
      }

      v.zoomTo();
      v.render();
      setStatusText('');
    });
  }, [selectedKey, stateMode, renderStyle, isDenatured]);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#0f172a' }}>
      
      {/* LEFT SIDEBAR */}
      <div style={{ width: '320px', padding: '20px', color: '#ffffff', display: 'flex', flexDirection: 'column', gap: '18px', boxSizing: 'border-box', overflowY: 'auto' }}>
        <div>
          <h2 style={{ margin: '0 0 5px 0', fontSize: '20px' }}>Enzyme Viewer</h2>
          <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Observe active site closure and environmental tolerance:</p>
        </div>

        {/* ENZYME SELECTOR */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', letterSpacing: '0.05em' }}>SELECT ENZYME</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
            {Object.keys(ENZYMES).map((key) => (
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
                  textAlign: 'left'
                }}
              >
                {key}
              </button>
            ))}
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

          {/* Reset Environment Button */}
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
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8' }}>DISPLAY MODE</label>
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

        {/* CONFORMATION TOGGLE */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8' }}>CONFORMATION</label>
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              onClick={() => setStateMode('open')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: stateMode === 'open' ? '#22c55e' : '#334155',
                color: '#ffffff',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Open State
            </button>
            <button
              onClick={() => setStateMode('closed')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: stateMode === 'closed' ? '#22c55e' : '#334155',
                color: '#ffffff',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Closed State
            </button>
          </div>
        </div>
      </div>

      {/* CANVAS VIEWPORT */}
      <div style={{ flex: 1, margin: '15px', borderRadius: '12px', backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden' }}>
        
        {/* Denaturation Alert Banner */}
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
            zIndex: 10,
            textAlign: 'center'
          }}>
            ⚠️ ENZYME DENATURED — Tertiary structure uncoiled. Catalytic binding lost!
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
            zIndex: 10
          }}>
            {statusText}
          </div>
        )}

        <div ref={viewerRef} style={{ width: '100%', height: '100%' }} />

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
          textAlign: 'center'
        }}>
          {isDenatured ? (
            <strong>DENATURED STATE: Extreme {temp > activeEnzyme.optTempMax ? 'high temperature' : temp < activeEnzyme.optTempMin ? 'low temperature' : 'pH levels'} disrupted hydrogen bonds & hydrophobic interactions.</strong>
          ) : (
            <span><strong>{activeEnzyme.name} ({stateMode.toUpperCase()} STATE)</strong>: {activeEnzyme.description}</span>
          )}
        </div>
      </div>

    </div>
  );
}
