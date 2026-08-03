import React, { useState, useEffect, useRef } from 'react';

// Default Pair: Adenylate Kinase (4AKE = Open, 1AKE = Closed)
const DEFAULT_OPEN_PDB = '4AKE';
const DEFAULT_CLOSED_PDB = '1AKE';

export function App() {
  const container1Ref = useRef<HTMLDivElement>(null);
  const container2Ref = useRef<HTMLDivElement>(null);

  const viewer1Ref = useRef<any>(null);
  const viewer2Ref = useRef<any>(null);

  const [viewer1Instance, setViewer1Instance] = useState<any>(null);
  const [viewer2Instance, setViewer2Instance] = useState<any>(null);

  // PDB Inputs
  const [openInput, setOpenInput] = useState(DEFAULT_OPEN_PDB);
  const [closedInput, setClosedInput] = useState(DEFAULT_CLOSED_PDB);

  // Loaded PDB States
  const [openPdbId, setOpenPdbId] = useState(DEFAULT_OPEN_PDB);
  const [closedPdbId, setClosedPdbId] = useState(DEFAULT_CLOSED_PDB);

  const [openPdbData, setOpenPdbData] = useState<string>('');
  const [closedPdbData, setClosedPdbData] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
        // Safe check
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
  // Fetch Both Open & Closed PDB Structures
  // ------------------------------------------
  const fetchConformations = async (openId: string, closedId: string) => {
    const cleanOpen = openId.trim().toUpperCase();
    const cleanClosed = closedId.trim().toUpperCase();

    if (cleanOpen.length !== 4 || cleanClosed.length !== 4) {
      setError('Please enter valid 4-character PDB IDs.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch both PDB files concurrently
      const [resOpen, resClosed] = await Promise.all([
        fetch(`https://files.rcsb.org/download/${cleanOpen}.pdb`),
        fetch(`https://files.rcsb.org/download/${cleanClosed}.pdb`),
      ]);

      if (!resOpen.ok) throw new Error(`Open state PDB '${cleanOpen}' not found.`);
      if (!resClosed.ok) throw new Error(`Closed state PDB '${cleanClosed}' not found.`);

      const textOpen = await resOpen.text();
      const textClosed = await resClosed.text();

      setOpenPdbData(textOpen);
      setClosedPdbData(textClosed);

      setOpenPdbId(cleanOpen);
      setClosedPdbId(cleanClosed);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch PDB structures.');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchConformations(DEFAULT_OPEN_PDB, DEFAULT_CLOSED_PDB);
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
  // Render Open (Left) & Closed (Right) Structures
  // ------------------------------------------
  useEffect(() => {
    if (!openPdbData || !closedPdbData || !viewer1Ref.current || !viewer2Ref.current) return;

    const v1 = viewer1Ref.current;
    const v2 = viewer2Ref.current;

    // Window 1: Open Conformation
    v1.clear();
    v1.addModel(openPdbData, 'pdb');
    v1.setStyle({}, { cartoon: { color: '#89b4fa' } }); // Blue theme for Open
    v1.zoomTo();
    v1.render();

    // Window 2: Closed Conformation
    v2.clear();
    v2.addModel(closedPdbData, 'pdb');
    v2.setStyle({}, { cartoon: { color: '#a6e3a1' } }); // Green theme for Closed
    v2.zoomTo();
    v2.render();
  }, [openPdbData, closedPdbData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchConformations(openInput, closedInput);
  };

  const handlePreset = (openCode: string, closedCode: string) => {
    setOpenInput(openCode);
    setClosedInput(closedCode);
    fetchConformations(openCode, closedCode);
  };

  return (
    <div style={styles.container}>
      {/* HEADER & CONTROLS */}
      <header style={styles.header}>
        <h1 style={styles.title}>Conformational Change Viewer: Open vs. Closed State</h1>

        <div style={styles.controlsRow}>
          {/* Custom Open / Closed PDB Form */}
          <form onSubmit={handleSubmit} style={styles.form}>
            <label style={styles.label}>Open PDB:</label>
            <input
              type="text"
              value={openInput}
              onChange={(e) => setOpenInput(e.target.value)}
              maxLength={4}
              style={styles.input}
            />

            <label style={styles.label}>Closed PDB:</label>
            <input
              type="text"
              value={closedInput}
              onChange={(e) => setClosedInput(e.target.value)}
              maxLength={4}
              style={styles.input}
            />

            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? 'Fetching...' : 'Compare States'}
            </button>
          </form>

          {/* Quick Presets for Common Open/Closed Pairs */}
          <div style={styles.presets}>
            <span style={styles.label}>Presets:</span>
            <button
              onClick={() => handlePreset('4AKE', '1AKE')}
              style={styles.presetButton}
            >
              Adenylate Kinase (4AKE / 1AKE)
            </button>
            <button
              onClick={() => handlePreset('1OMP', '1ANF')}
              style={styles.presetButton}
            >
              Maltose Binding (1OMP / 1ANF)
            </button>
            <button
              onClick={() => handlePreset('2HEX', '1HKG')}
              style={styles.presetButton}
            >
              Hexokinase (2HEX / 1HKG)
            </button>
          </div>
        </div>

        {error && <div style={styles.errorMessage}>{error}</div>}
      </header>

      {/* SYNCHRONIZED SPLIT VIEWER */}
      <main style={styles.viewerContainer}>
        {/* Left Window: Open State */}
        <div style={styles.viewerBox}>
          <div style={styles.badgeOpen}>Open State ({openPdbId})</div>
          <div ref={container1Ref} style={styles.canvas} />
        </div>

        {/* Right Window: Closed State */}
        <div style={styles.viewerBox}>
          <div style={styles.badgeClosed}>Closed State ({closedPdbId})</div>
          <div ref={container2Ref} style={styles.canvas} />
        </div>
      </main>
    </div>
  );
}

export default App;

// ------------------------------------------
// INLINE STYLES
// ------------------------------------------
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
    width: '70px',
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
    gap: '8px',
  },
  presetButton: {
    padding: '4px 10px',
    borderRadius: '4px',
    border: '1px solid #45475a',
    backgroundColor: '#313244',
    color: '#cdd6f4',
    fontSize: '12px',
    cursor: 'pointer',
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
  badgeOpen: {
    position: 'absolute',
    top: '12px',
    left: '12px',
    zIndex: 10,
    backgroundColor: 'rgba(137, 180, 250, 0.15)',
    color: '#89b4fa',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 'bold',
    border: '1px solid #89b4fa',
    pointerEvents: 'none',
  },
  badgeClosed: {
    position: 'absolute',
    top: '12px',
    left: '12px',
    zIndex: 10,
    backgroundColor: 'rgba(166, 227, 161, 0.15)',
    color: '#a6e3a1',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 'bold',
    border: '1px solid #a6e3a1',
    pointerEvents: 'none',
  },
};
