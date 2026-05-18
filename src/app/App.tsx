import { useCallback, useMemo, useRef, useState } from 'react';
import { LittleSpiritUiOverlay } from '../components/LittleSpiritUiOverlay';
import { SpiritFormationStage } from '../components/SpiritFormationStage';
import { FONT_OPTIONS } from '../typography/fontCatalog';
import { useFontLibrary } from '../typography/useFontLibrary';
const FORMATION_FONT_ID = 'nunito';

export type DrawStroke = {
  points: Array<{ x: number; y: number }>;
  strokeWidth: number;
  pathD: string;
  length: number;
};

export function App() {
  const [glyph, setGlyph] = useState('');
  const [drawMode, setDrawMode] = useState(false);
  const [drawStroke, setDrawStroke] = useState<DrawStroke | null>(null);
  const [density, setDensity] = useState(60);
  const [speed, setSpeed] = useState(1.0);
  const [catScale, setCatScale] = useState(0.3);
  const [showAnchorDebug, setShowAnchorDebug] = useState(false);
  const [brushDrawingActive, setBrushDrawingActive] = useState(false);
  const exportVideoHandlerRef = useRef<(() => Promise<void>) | null>(null);
  const exportGifHandlerRef = useRef<(() => Promise<void>) | null>(null);
  const fontWeight = 900;

  const selectedFont = useMemo(
    () => FONT_OPTIONS.find((option) => option.id === FORMATION_FONT_ID) ?? FONT_OPTIONS[0],
    []
  );
  const { loadedFonts } = useFontLibrary([selectedFont]);
  const loadedSelectedFont = loadedFonts[FORMATION_FONT_ID];

  const deleteGlyph = () => {
    setGlyph('');
    setDrawStroke(null);
    setDrawMode(false);
    setBrushDrawingActive(false);
  };

  const selectGlyph = (nextGlyph: string) => {
    setGlyph(nextGlyph);
    setDrawStroke(null);
    setDrawMode(false);
    setBrushDrawingActive(false);
  };

  const setPenMode = (enabled: boolean) => {
    if (enabled) {
      setGlyph('');
      setDrawStroke(null);
      setDrawMode(true);
      setBrushDrawingActive(false);
      return;
    }

    setDrawMode(false);
    setBrushDrawingActive(false);
  };

  const handleStrokeCommit = (stroke: DrawStroke) => {
    setGlyph('');
    setDrawStroke(stroke);
    setDrawMode(false);
    setBrushDrawingActive(false);
  };

  const handleExportVideo = useCallback(async () => {
    if (!exportVideoHandlerRef.current) {
      window.alert('Video export is not ready yet.');
      return;
    }

    try {
      await exportVideoHandlerRef.current();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Video export failed.';
      window.alert(message);
    }
  }, []);

  const handleExportGif = useCallback(async () => {
    if (!exportGifHandlerRef.current) {
      window.alert('GIF export is not ready yet.');
      return;
    }

    try {
      await exportGifHandlerRef.current();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'GIF export failed.';
      window.alert(message);
    }
  }, []);

  return (
    <main className="ui-page-shell">
      <section className="ui-stage-shell">
        <SpiritFormationStage
          glyph={glyph}
          drawMode={drawMode}
          drawStroke={drawStroke}
          onStrokeCommit={handleStrokeCommit}
          fontFamily={loadedSelectedFont?.family ?? selectedFont.family}
          fontData={loadedSelectedFont?.fontData}
          fontWeight={fontWeight}
          density={density}
          speed={speed}
          catScale={catScale}
          showGhostGlyph={false}
          showRegionOutline={false}
          showAnchorDebug={showAnchorDebug}
          onDrawPointerStateChange={setBrushDrawingActive}
          onExportVideoReady={(exporter) => {
            exportVideoHandlerRef.current = exporter;
          }}
          onExportGifReady={(exporter) => {
            exportGifHandlerRef.current = exporter;
          }}
        />
      </section>
      <LittleSpiritUiOverlay
        glyph={glyph}
        drawMode={drawMode}
        brushDrawingActive={brushDrawingActive}
        hasCustomPath={Boolean(drawStroke)}
        density={density}
        speed={speed}
        catScale={catScale}
        showAnchorDebug={showAnchorDebug}
        onGlyphSelect={selectGlyph}
        onDrawModeChange={setPenMode}
        onDensityChange={setDensity}
        onSpeedChange={setSpeed}
        onSizeChange={setCatScale}
        onSetAnchorDebug={setShowAnchorDebug}
        onDelete={deleteGlyph}
        onExportVideo={handleExportVideo}
        onExportGif={handleExportGif}
      />
    </main>
  );
}
