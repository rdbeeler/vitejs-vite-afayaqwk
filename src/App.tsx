import React, { useState, useEffect, useRef } from 'react';

interface EnzymeInfo {
  name: string;
  pdbOpen: string;
  pdbClosed: string;
  description: string;
}

const ENZYMES: Record<string, EnzymeInfo> = {
  Hexokinase: {
    name: 'Hexokinase',
    pdbOpen: '1HKG',
    pdbClosed: '2YHX',
    description: 'Watch the two distinct lobes clamp together in an induced fit around the glucose molecule.'
  },
  Lactase: {
    name: 'Lactase',
    pdbOpen: '1JZ8',
    pdbClosed: '1JSY',
    description: 'Enzyme active site closes around milk sugar to break the glycosidic bond.'
  },
  'DNA Polymerase': {
    name: 'DNA Polymerase',
    pdbOpen: '1T7P',
    pdbClosed: '1L3U',
    description: 'The finger domain closes over the incoming nucleotide to verify correct base pairing.'
  },
  Trypsin: {
    name: 'Trypsin',
    pdbOpen: '1UTG',
    pdbClosed: '1A0H',
    description: 'Serine protease binding pocket wraps tightly around basic amino acid residues.'
  }
};

export default function App() {
  const [selectedKey, setSelectedKey] = useState<string>('Hexokinase');
  const [stateMode, setStateMode] = useState<'open' | 'closed'>('open');
  const [renderStyle, setRenderStyle] = useState<'vdw' | 'spheres' | 'cartoon'>('vdw');
  const [statusText, setStatusText] = useState<string>('Initializing 3D Viewer...');
  const [isReady, setIsReady] = useState<boolean>(false);

  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerInstance = useRef<any>(null);

  const activeEnzyme = ENZYMES[selectedKey];

  // 1. Script Loading Pipeline
  useEffect(() => {
    const loadDependencies = async () => {
      try {
        if (!window || !(window as any).$) {
          setStatusText('Loading jQuery...');
          const jq = document.createElement('script');
          jq.src = 'https://code.jquery.com/jquery-3.6.0.min.js';
          document.head.appendChild(jq);
          await new Promise((res) => (jq.onload = res));
        }

        if (!(window as any).$3Dmol) {
          setStatusText('Loading 3D Graphics Engine (3Dmol)...');
          const mol = document.createElement('script');
          mol.src = 'https://3dmol.org/build/3Dmol-min.js';
          document.head.appendChild(mol);
          await new Promise((res) => (mol.onload = res));
        }

        setStatusText('Initializing Canvas...');
        const $3Dmol = (window as any).$3Dmol;
        const $ = (window as any).$;

        if (viewerRef.current && !viewerInstance.current) {
          viewerInstance.current = $3Dmol.createViewer($(viewerRef.current), {
            backgroundColor: '#ffffff'
          });
          setIsReady(true);
        }
      } catch (err: any) {
        setStatusText(`Error loading 3D engine: ${err.message}`);
      }
    };

    loadDependencies();
  }, []);

  // 2. Fetch Structure and Apply Van Der Waals / Cartoon Styling
  useEffect(() => {
    if (!isReady || !viewerInstance.current) return;

    const $3Dmol = (window as any).$3Dmol;
    const targetPdb = stateMode === 'open' ? activeEnzyme.pdbOpen : activeEnzyme.pdbClosed;
    const v = viewerInstance.current;

    setStatusText(`Downloading PDB: ${targetPdb}...`);
    v.clear();
    v.removeAllSurfaces();

    $3Dmol.download(`pdb:${targetPdb}`, v, {}, () => {
      
      // APPLY DISPLAY STYLES
      if (renderStyle === 'vdw') {
        // Option 1: Ribbon structure wrapped inside a semi-transparent Van der Waals Surface
        v.setStyle({ hetflag: false }, { cartoon: { color: 'spectrum' } });
        v.addSurface($3Dmol.SurfaceType.VDW, {
          opacity: 0.65,
          colorscheme: 'spectrum'
        }, { hetflag: false });
      } else if (renderStyle === 'spheres') {
        // Option 2: Full Van der Waals space-filling spheres
        v.setStyle({ hetflag: false }, { sphere: { colorscheme: 'spectrum', scale: 0.9 } });
      } else {
        // Option 3: Clean Cartoon Ribbon
        v.setStyle({ hetflag: false }, { cartoon: { color: 'spectrum' } });
      }

      // Highlight substrate / ligand as bright stick model
      v.setStyle({ hetflag: true }, { stick: { colorscheme: 'yellowCarbon', radius: 0.4 } });

      v.zoomTo();
      v.render();
      setStatusText('');
    });
  }, [isReady, selectedKey, stateMode, renderStyle]);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#0f172a' }}>
      
      {/* CONTROL PANEL */}
      <div style={{ width: '320px', padding: '20px', color: '#ffffff', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h2 style={{ margin: '0 0 5px 0', fontSize: '20px' }}>Enzyme Viewer</h2>
          <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
            Select an enzyme and observe the active site closure:
          </p>
        </div>

        {/* ENZYME SELECTOR */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8' }}>ENZYME</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
            {Object.keys(ENZYMES).map((key) => (
              <button
                key={key}
                onClick={() => setSelectedKey(key)}
                style={{
                  padding: '12px',
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

        {/* DISPLAY STYLE (VDW vs CARTOON) */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8' }}>3D DISPLAY MODE</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
            <button
              onClick={() => setRenderStyle('vdw')}
              style={{
                padding: '8px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: renderStyle === 'vdw' ? '#3b82f6' : '#334155',
                color: '#ffffff',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              VDW Surface (Transparent Envelope)
            </button>
            <button
              onClick={() => setRenderStyle('spheres')}
              style={{
                padding: '8px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: renderStyle === 'spheres' ? '#3b82f6' : '#334155',
                color: '#ffffff',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              VDW Space-Filling Spheres
            </button>
            <button
              onClick={() => setRenderStyle('cartoon')}
              style={{
                padding: '8px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: renderStyle === 'cartoon' ? '#3b82f6' : '#334155',
                color: '#ffffff',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Cartoon Ribbon Only
            </button>
          </div>
        </div>

        {/* STATE TOGGLE */}
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

      {/* VIEWPORT CANVAS */}
      <div style={{ flex: 1, margin: '15px', borderRadius: '12px', backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden' }}>
        
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
          backgroundColor: 'rgba(248, 250, 252, 0.95)',
          borderTop: '1px solid #e2e8f0',
          padding: '12px',
          fontSize: '13px',
          color: '#334155',
          textAlign: 'center'
        }}>
          <strong>{activeEnzyme.name} ({stateMode.toUpperCase()} STATE)</strong>: {activeEnzyme.description}
        </div>
      </div>

    </div>
  );
}
