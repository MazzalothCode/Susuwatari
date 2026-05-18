import { useEffect, useMemo, useRef, useState } from 'react';
import { createScene, type SceneController, type SceneOptions } from '../engine/createScene';
import { buildGlyphLayout, pathCommandsToSvgD } from '../typography/glyphLayout';

type StageCanvasProps = SceneOptions & {
  showGhostGlyph?: boolean;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
};

export function StageCanvas({
  onCanvasReady,
  showGhostGlyph = false,
  ...sceneOptions
}: StageCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SceneController | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!hostRef.current) {
      return undefined;
    }

    const updateSize = () => {
      if (!hostRef.current) {
        return;
      }

      setSize({
        width: hostRef.current.clientWidth,
        height: hostRef.current.clientHeight
      });
    };

    const scene = createScene(hostRef.current, sceneOptions);
    sceneRef.current = scene;
    onCanvasReady?.(scene.getCanvas());
    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(hostRef.current);

    return () => {
      resizeObserver.disconnect();
      onCanvasReady?.(null);
      scene.destroy();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.update(sceneOptions);
  }, [sceneOptions]);

  const ghostLayout = useMemo(() => {
    if (!showGhostGlyph || size.width < 1 || size.height < 1) {
      return null;
    }

    return buildGlyphLayout({
      glyph: sceneOptions.glyph,
      fontFamily: sceneOptions.fontFamily,
      fontData: sceneOptions.fontData,
      width: size.width,
      height: size.height
    });
  }, [
    sceneOptions.fontData,
    sceneOptions.fontFamily,
    sceneOptions.glyph,
    showGhostGlyph,
    size.height,
    size.width
  ]);

  return (
    <div className="stage-canvas" ref={hostRef}>
      {showGhostGlyph && ghostLayout ? (
        <div className="ghost-glyph-layer" aria-hidden="true">
          {ghostLayout.pathCommands ? (
            <svg
              className="ghost-glyph-svg"
              viewBox={`0 0 ${size.width} ${size.height}`}
              preserveAspectRatio="none"
            >
              <path
                className="ghost-glyph-path"
                d={pathCommandsToSvgD(ghostLayout.pathCommands)}
              />
            </svg>
          ) : (
            <div
              className="ghost-glyph"
              style={{ fontFamily: sceneOptions.fontFamily, fontSize: ghostLayout.fontSize }}
            >
              {sceneOptions.glyph}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
