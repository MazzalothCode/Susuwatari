import { useRive } from '@rive-app/react-webgl2';
import littieSpiritUrl from '../assets/rive/littie_spirit.riv';

export function RiveSpiritPreview() {
  const { RiveComponent, rive } = useRive({
    src: littieSpiritUrl,
    stateMachines: 'CONTROL',
    autoplay: true
  });

  return (
    <div className="stage-canvas rive-preview-shell">
      <div className="rive-preview-meta">
        <p className="stage-label">Rive Preview</p>
        <p className="stage-hint">
          {rive ? 'Rive file loaded and playing.' : 'Loading .riv asset...'}
        </p>
      </div>
      <RiveComponent className="rive-preview-canvas" />
    </div>
  );
}
