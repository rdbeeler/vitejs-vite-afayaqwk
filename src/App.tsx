import React, { useState, useEffect, useRef } from 'react';

// Default PDB (Lysozyme: 1HEW)
const DEFAULT_PDB_ID = '1HEW';

export function App() {
  const container1Ref = useRef<HTMLDivElement>(null);
  const container2Ref = useRef<HTMLDivElement>(null);

  const viewer1Ref = useRef<any>(null);
  const viewer2Ref = useRef<any>(null);

  const [viewer1Instance, setViewer1Instance] = useState<any>(null);
  const [viewer2Instance, setViewer2Instance] = useState<any>(null);

  // App States
  const [pdbIdInput, setPdbIdInput] = useState(DEFAULT_PDB_ID);
  const [currentPdbId, setCurrentPdbId] = useState(DEFAULT_PDB_ID);
  const [pdbData, setPdbData] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Environmental Parameters
  const [temp, setTemp] = useState<number>(37); // °C
  const [ph, setPh] = useState<number>(7.4);

  // ------------------------------------------
  // Real-Time Synchronized Viewers Loop (60 FPS)
  // ------------------------------------------
  useEffect(() => {
    if (!viewer1Instance || !viewer2Instance) return;

    let animFrameId: number;
    let activeViewer: 'v1' | 'v2' | null = null;

    const v1Canvas = container1Ref.current;
    const v2Canvas = container2Ref.current;

    const handleMouseOver1 = () => { activeViewer = 'v1'; };
    const handleMouseOver2 = () => { activeViewer = 'v2'; };

    if (v1Canvas) v1Canvas.addEventListener('mouseenter', handleMouseOver1);
    if (v2Canvas) v2Canvas.addEventListener('mouseenter', handleMouseOver2);

    const syncLoop = () => {
      try {
        if (activeViewer === 'v1' && viewer1Instance && viewer2Instance) {
          const view1 = viewer1Instance.getView();
          viewer2Instance.setView(view1);
          viewer2Instance.render();
        } else if (activeViewer === 'v2' && viewer1Instance && viewer2Instance) {
          const view2 = viewer2Instance.getView();
          viewer1Instance.setView(view2);
          viewer1Instance.render();
        }
      } catch (err) {
        // Safe guard against unmounted instances
      }

      animFrameId = requestAnimationFrame(syncLoop);
    };

    animFrameId = requestAnimationFrame(syncLoop);

    return () => {
      cancelAnimationFrame(animFrameId);
      if (v1Canvas) v1Canvas.removeEventListener('mouseenter', handleMouseOver1);
      if (v2Canvas) v2Canvas.removeEventListener('mouseenter', handleMouseOver2);
    };
  }, [viewer1Instance, viewer2Instance]);

  // ------------------------------------------
  // Fetch PDB structure from RCSB API
  // ------------------------------------------
  const fetchPdbData = async (targetPdbId: string) => {
    const cleanId = targetPdbId.trim().toUpperCase();
    if (cleanId.length !== 4) {
      setError('Please enter a valid 4-character PDB ID (e.g., 1HEW, 1A2C).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`https://files.rcsb.org/download/${cleanId}.pdb`);
      if (!response.ok) {
        throw new Error(`PDB '${cleanId}' not found on RCSB.`);
      }
      const text = await response.text();
      setPdbData(text);
      setCurrentPdbId(cleanId);
    } catch (err: any) {
      setError(err.message || 'Failed to load PDB data.');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchPdbData(DEFAULT_PDB_ID);
  }, []);

  // ------------------------------------------
  // Initialize 3Dmol Viewers Dynamically
  // ------------------------------------------
  useEffect(() => {
    if (!container1Ref.current || !container2Ref.current) return;

    const initViewers = () => {
      const $3Dmol = (window as any).$3Dmol;
      const $ = (window as any).$;

      if (!$3Dmol || !$) return;

      if (!viewer1Ref.current) {
        const v1 = $3Dmol.createViewer($(container1Ref.current), {
          backgroundColor: '#1e1e2e',
        });
        viewer1Ref.current = v1;
        setViewer1Instance(v1);
      }

      if (!viewer2Ref.current) {
        const v2 = $3Dmol.createViewer($(container2Ref.current), {
          backgroundColor: '#11111b',
        });
        viewer2Ref.current = v2;
        setViewer2Instance(v2);
      }
    };

    const timer = setTimeout(initViewers, 200);
    return () => clearTimeout(timer);
  }, []);

  // ------------------------------------------
  // Update Visualizations on Data/Parameter Change
  // ------------------------------------------
  useEffect(() => {
    if (!pdbData || !viewer1Ref.current || !viewer2Ref.current) return;

    const v1 = viewer1Ref.current;
    const v2 = viewer2Ref.current;

    v1.clear();
    v2.clear();

    v1.addModel(pdbData, 'pdb');
    v2.addModel(pdbData, 'pdb');

    v1.setStyle({}, { cartoon: { color: 'spectrum' } });
    v1.zoomTo();
    v1.render();

    const isDenatured = temp > 60 || ph < 4 || ph > 10;

    if (isDenatured) {
      v2.setStyle({}, { cartoon: { color: '#f38ba8', style: 'trace', thickness: 0.8 } });
    } else {
      v2.setStyle({}, { cartoon: { color: '#a6e3a1' } });
    }

    v2.zoomTo();
    v2.render();
  }, [pdbData, temp, ph]);

  const handlePdbSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPdbData(pdbIdInput);
  };

  return (
    <div style={styles.container}>
      {/* HEADER & CONTROLS */}
      <header style={styles.header}>
        <h1 style={styles.title}>3D Enzyme Visualization Hub</h1>

        <div style={styles.controlsRow}>
          <form onSubmit={handlePdbSubmit} style={styles.form}>
            <label style={styles.label}>PDB Code:</label>
            <input
              type="text"
              value={pdbIdInput}
              onChange={(e) => setPdbIdInput(e.target.value)}
              placeholder="e.g. 1HEW"
              maxLength={4}
              style={styles.input}
            />
            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? 'Fetching...' : 'Load PDB'}
            </button>
          </form>

          <div style={styles.presets}>
            <span style={styles.label}>Quick Examples:</span>
            {['1HEW', '1A2C', '2CPA', '1K4T'].map((code) => (
              <button
                key={code}
                onClick={() => {
                  setPdbIdInput(code);
                  fetchPdbData(code);
                }}
                style={styles.presetButton}
              >
                {code}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.slidersRow}>
          <div style={styles.sliderGroup}>
            <label style={styles.label}>
              Temperature: <strong>{temp}°C</strong>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={temp}
              onChange={(e) => setTemp(Number(e.target.value))}
              style={styles.slider}
            />
          </div>

          <div style={styles.sliderGroup}>
            <label style={styles.label}>
              pH Level: <strong>{ph}</strong>
            </label>
            <input
              type="range"
              min={0}
              max={14}
              step={0.1}
              value={ph}
              onChange={(e) => setPh(Number(e.target.value))}
              style={styles.slider}
            />
          </div>
        </div>

        {error && <div style={styles.errorMessage}>{error}</div>}
      </header>

      {/* SYNCHRONIZED SPLIT VIEWER */}
      <main style={styles.viewerContainer}>
        <div style={styles.viewerBox}>
          <div style={styles.badge}>Native State ({currentPdbId})</div>
          <div ref={container1Ref} style={styles.canvas} />
        </div>

        <div style={styles.viewerBox}>
          <div style={styles.badge}>
            Simulated Response ({temp}°C, pH {ph})
          </div>
          <div ref={container2Ref} style={styles.canvas} />
        </div>
      </main>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    backgroundColor: '#181825',
    color: '#cdd6f4',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    overflow: 'hidden',
  },
  header: {
    padding: '16px 24px',
    backgroundColor: '#1e1e2e',
    borderBottom: '1px solid #313244',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    color: '#89b4fa',
  },
  controlsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    flexWrap: 'wrap',
  },
  form: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    color: '#a6adc8',
  },
  input: {
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid #45475a',
    backgroundColor: '#313244',
    color: '#cdd6f4',
    fontSize: '14px',
    width: '80px',
    textTransform: 'uppercase',
  },
  button: {
    padding: '6px 14px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#89b4fa',
    color: '#11111b',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  presets: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  presetButton: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #45475a',
    backgroundColor: '#313244',
    color: '#cdd6f4',
    fontSize: '12px',
    cursor: 'pointer',
  },
  slidersRow: {
    display: 'flex',
    gap: '32px',
  },
  sliderGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  slider: {
    cursor: 'pointer',
    accentColor: '#89b4fa',
  },
  errorMessage: {
    color: '#f38ba8',
    fontSize: '14px',
  },
  viewerContainer: {
    display: 'flex',
    flex: 1,
    width: '100%',
    height: '100%',
  },
  viewerBox: {
    flex: 1,
    position: 'relative',
    borderRight: '1px solid #313244',
  },
  canvas: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: '12px',
    left: '12px',
    zIndex: 10,
    backgroundColor: 'rgba(17, 17, 27, 0.8)',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    border: '1px solid #45475a',
    pointerEvents: 'none',
  },
};
