import React, { useState, useEffect, useRef } from 'react';

// Default PDB structure (e.g., Egg White Lysozyme: 1AKI or Adenylate Kinase: 4AKE)
const DEFAULT_PDB_ID = '1AKI';

// Optimal physiological defaults
const OPTIMAL_TEMP = 37; // °C
const OPTIMAL_PH = 7.0;  // Neutral pH

export function App() {
  const container1Ref = useRef<HTMLDivElement>(null);
  const container2Ref = useRef<HTMLDivElement>(null);

  const viewer1Ref = useRef<any>(null);
  const viewer2Ref = useRef<any>(null);

  const [viewer1Instance, setViewer1Instance] = useState<any>(null);
  const [viewer2Instance, setViewer2Instance] = useState<any>(null);

  // Environmental Controls
  const [temperature, setTemperature] = useState<number>(37);
  const [ph, setPh] = useState<number>(7.0);

  // PDB Management
  const [pdbInput, setPdbInput] = useState<string>(DEFAULT_PDB_ID);
  const [currentPdb, setCurrentPdb] = useState<string>(DEFAULT_PDB_ID);
  const [pdbData, setPdbData] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // ------------------------------------------
  // Denaturation Logic & Activity Calculation
  // ------------------------------------------
  const tempDev = Math.abs(temperature - OPTIMAL_TEMP);
  const phDev = Math.abs(ph - OPTIMAL_PH);

  // Temperature > 55°C or extreme pH (<4 or >10) triggers denaturation
  const isDenatured = temperature > 55 || ph < 4.0 || ph > 10.0;

  // Calculate approximate relative enzyme activity (%)
  const calcActivity = () => {
    if (isDenatured) return 0;
    const tempFactor = Math.max(0, 100 - tempDev * 3.5);
    const phFactor = Math.max(0, 100 - phDev * 25);
    return Math.round((tempFactor * phFactor) / 100);
  };

  const activity = calcActivity();

  // ------------------------------------------
  // Synchronized Camera Controls (60 FPS Loop)
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
        // Safe check for unmounted canvas
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
  // Fetch PDB File
  // ------------------------------------------
  const fetchPdb = async (pdbId: string) => {
    const cleanId = pdbId.trim().toUpperCase();
    if (cleanId.length !== 4) {
      setError('Please enter a valid 4-character PDB ID.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`https://files.rcsb.org/download/${cleanId}.pdb`);
      if (!res.ok) throw new Error(`PDB '${cleanId}' not found on RCSB.`);

      const text = await res.text();
      setPdbData(text);
      setCurrentPdb(cleanId);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch PDB data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPdb(DEFAULT_PDB_ID);
  }, []);

  // ------------------------------------------
  // Initialize 3Dmol Viewers
  // ------------------------------------------
  useEffect(() => {
    if (!container1Ref.current || !container2Ref.current) return;

    const initViewers = () => {
      const $3Dmol = (window as any).$3Dmol;
      const $ = (window as any).$;

      if (!$3Dmol || !$) return;

      const darkBg = '#11111b';

      if (!viewer1Ref.current) {
        const v1 = $3Dmol.createViewer($(container1Ref.current), {
          backgroundColor: darkBg,
        });
        viewer1Ref.current = v1;
        setViewer1Instance(v1);
      }

      if (!viewer2Ref.current) {
        const v2 = $3Dmol.createViewer($(container2Ref.current), {
          backgroundColor: darkBg,
        });
        viewer2Ref.current = v2;
        setViewer2Instance(v2);
      }
    };

    const timer = setTimeout(initViewers, 200);
    return () => clearTimeout(timer);
  }, []);

  // ------------------------------------------
  // Render Structures & Apply Temperature/pH Effects
  // ------------------------------------------
  useEffect(() => {
    if (!pdbData || !viewer1Ref.current || !viewer2Ref.current) return;

    const v1 = viewer1Ref.current;
    const v2 = viewer2Ref.current;

    // --- VIEWPORT 1: NATIVE STATE (Ideal Conditions: 37°C, pH 7.0) ---
    v1.clear();
    v1.addModel(pdbData, 'pdb');
    v1.setStyle({ hetflag: false }, { cartoon: { colorscheme: 'spectrum' } });
    v1.zoomTo();
    v1.render();

    // --- VIEWPORT 2: SIMULATED RESPONSE (Dynamic Temperature & pH) ---
    v2.clear();
    v2.addModel(pdbData, 'pdb');

    if (isDenatured) {
      // Unfolded / Denatured state representation: worm backbone with high-stress color
      v2.setStyle(
        { hetflag: false },
        {
          worm: { color: '#f38ba8', radius: 0.3 },
        }
      );
    } else {
      // Functional state with color spectrum shifting according to activity level
      const ribbonColor = activity > 70 ? 'spectrum' : activity > 30 ? 'yellow' : 'orange';
      v2.setStyle({ hetflag: false }, { cartoon: { colorscheme: ribbonColor } });
    }

    v2.zoomTo();
    v2.render();
  }, [pdbData, temperature, ph, isDenatured, activity]);

  const handlePdbSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPdb(pdbInput);
  };

  return (
    <div style={styles.container}>
      {/* HEADER & CONTROL PANEL */}
      <header style={styles.header}>
        <div style={styles.headerTop}>
          <h1 style={styles.title}>Enzyme Activity & Denaturation Simulator</h1>

          <form onSubmit={handlePdbSubmit} style={styles.form}>
            <label style={styles.label}>PDB ID:</label>
            <input
              type="text"
              value={pdbInput}
              onChange={(e) => setPdbInput(e.target.value)}
              maxLength={4}
              style={styles.input}
            />
            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? 'Fetching...' : 'Load Protein'}
            </button>
          </form>
        </div>

        {/* SLIDERS PANEL */}
        <div style={styles.slidersRow}>
          {/* Temperature Slider */}
          <div style={styles.sliderGroup}>
            <div style={styles.sliderHeader}>
              <span style={styles.label}>Temperature:</span>
              <span style={styles.valueHighlight}>{temperature} °C</span>
            </div>
            <input
              type="range"
              min={0}
              max={90}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              style={styles.slider}
            />
            <div style={styles.ticks}>
              <span>0°C</span>
              <span>37°C (Optimal)</span>
              <span>90°C</span>
            </div>
          </div>

          {/* pH Slider */}
          <div style={styles.sliderGroup}>
            <div style={styles.sliderHeader}>
              <span style={styles.label}>pH Level:</span>
              <span style={styles.valueHighlight}>{ph.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={1.0}
              max={14.0}
              step={0.1}
              value={ph}
              onChange={(e) => setPh(Number(e.target.value))}
              style={styles.slider}
            />
            <div style={styles.ticks}>
              <span>pH 1 (Acidic)</span>
              <span>pH 7 (Optimal)</span>
              <span>pH 14 (Basic)</span>
            </div>
          </div>

          {/* Activity / Status Indicator */}
          <div style={styles.statusBox}>
            <span style={styles.label}>Enzyme Status:</span>
            <div
              style={{
                ...styles.statusBadge,
                backgroundColor: isDenatured ? '#f38ba8' : activity > 60 ? '#a6e3a1' : '#f9e2af',
                color: '#11111b',
              }}
            >
              {isDenatured ? 'DENATURED' : `${activity}% Active`}
            </div>
          </div>
        </div>

        {error && <div style={styles.errorMessage}>{error}</div>}
      </header>

      {/* SYNCHRONIZED SPLIT VIEWER */}
      <main style={styles.viewerContainer}>
        {/* Left Window: Native Baseline */}
        <div style={styles.viewerBox}>
          <div style={styles.badgeNative}>Native State (37°C, pH 7.0) — {currentPdb}</div>
          <div ref={container1Ref} style={styles.canvas} />
        </div>

        {/* Right Window: Simulated Response */}
        <div style={styles.viewerBox}>
          <div
            style={{
              ...styles.badgeSimulated,
              borderColor: isDenatured ? '#f38ba8' : '#89b4fa',
              color: isDenatured ? '#f38ba8' : '#89b4fa',
            }}
          >
            Simulated Environment ({temperature}°C, pH {ph.toFixed(1)})
          </div>
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
    gap: '16px',
  },
  headerTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    color: '#89b4fa',
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
  slidersRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '32px',
    flexWrap: 'wrap',
  },
  sliderGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
    minWidth: '220px',
  },
  sliderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valueHighlight: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#89b4fa',
  },
  slider: {
    width: '100%',
    cursor: 'pointer',
    accentColor: '#89b4fa',
  },
  ticks: {
    display: 'flex',
    justify: 'space-between',
    fontSize: '11px',
    color: '#6c7086',
  },
  statusBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '4px',
  },
  statusBadge: {
    padding: '6px 14px',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13px',
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
  badgeNative: {
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
  badgeSimulated: {
    position: 'absolute',
    top: '12px',
    left: '12px',
    zIndex: 10,
    backgroundColor: 'rgba(137, 180, 250, 0.15)',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 'bold',
    border: '1px solid',
    pointerEvents: 'none',
  },
};
