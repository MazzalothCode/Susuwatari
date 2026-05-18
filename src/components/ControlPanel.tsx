import type { FontOption } from '../typography/fontCatalog';

type ControlPanelProps = {
  glyph: string;
  fontId: string;
  density: number;
  speed: number;
  softness: number;
  catScale: number;
  showGuides: boolean;
  showGhostGlyph: boolean;
  fontOptions: FontOption[];
  onGlyphChange: (glyph: string) => void;
  onFontChange: (fontId: string) => void;
  onDensityChange: (value: number) => void;
  onSpeedChange: (value: number) => void;
  onSoftnessChange: (value: number) => void;
  onCatScaleChange: (value: number) => void;
  onShowGuidesChange: (value: boolean) => void;
  onShowGhostGlyphChange: (value: boolean) => void;
};

function clampGlyph(input: string) {
  if (!input) {
    return 'C';
  }

  return input.slice(0, 1).toUpperCase();
}

export function ControlPanel({
  glyph,
  fontId,
  density,
  speed,
  softness,
  catScale,
  showGuides,
  showGhostGlyph,
  fontOptions,
  onGlyphChange,
  onFontChange,
  onDensityChange,
  onSpeedChange,
  onSoftnessChange,
  onCatScaleChange,
  onShowGuidesChange,
  onShowGhostGlyphChange
}: ControlPanelProps) {
  return (
    <section className="control-panel">
      <div className="panel-header">
        <p className="eyebrow">Scene Controls</p>
        <h2>Build the letterform</h2>
      </div>

      <label className="field">
        <span>Letter</span>
        <input
          className="text-input"
          value={glyph}
          maxLength={1}
          onChange={(event) => onGlyphChange(clampGlyph(event.target.value))}
        />
      </label>

      <label className="field">
        <span>Typeface</span>
        <select
          className="select-input"
          value={fontId}
          onChange={(event) => onFontChange(event.target.value)}
        >
          {fontOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <Slider
        label="Particle Density"
        min={6}
        max={120}
        step={1}
        value={density}
        onChange={onDensityChange}
      />
      <Slider
        label="Drift Speed"
        min={0.2}
        max={1.6}
        step={0.05}
        value={speed}
        onChange={onSpeedChange}
      />
      <Slider
        label="Shape Softness"
        min={0.2}
        max={1}
        step={0.02}
        value={softness}
        onChange={onSoftnessChange}
      />
      <Slider
        label="Cat Size"
        min={0.3}
        max={0.8}
        step={0.05}
        value={catScale}
        onChange={onCatScaleChange}
      />

      <label className="field">
        <span>Show Guides</span>
        <div className="range-row">
          <input
            type="checkbox"
            checked={showGuides}
            onChange={(event) => onShowGuidesChange(event.target.checked)}
          />
        </div>
      </label>

      <label className="field">
        <span>Show Base Glyph</span>
        <div className="range-row">
          <input
            type="checkbox"
            checked={showGhostGlyph}
            onChange={(event) => onShowGhostGlyphChange(event.target.checked)}
          />
        </div>
      </label>

      <div className="preset-row" aria-label="Suggested presets">
        <button type="button" className="preset-chip" onClick={() => {
          onDensityChange(10);
          onSpeedChange(0.84);
          onSoftnessChange(0.6);
          onCatScaleChange(0.55);
        }}>
          Crisp
        </button>
        <button type="button" className="preset-chip" onClick={() => {
          onDensityChange(18);
          onSpeedChange(1.02);
          onSoftnessChange(0.82);
          onCatScaleChange(0.55);
        }}>
          Balanced
        </button>
        <button type="button" className="preset-chip" onClick={() => {
          onDensityChange(28);
          onSpeedChange(1.24);
          onSoftnessChange(0.9);
          onCatScaleChange(0.55);
        }}>
          Bloom
        </button>
      </div>
    </section>
  );
}

type SliderProps = {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
};

function Slider({ label, min, max, step, value, onChange }: SliderProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="range-row">
        <input
          className="range-input"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <output>{typeof step === 'number' && step < 1 ? value.toFixed(2) : value}</output>
      </div>
    </label>
  );
}
