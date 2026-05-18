import { Application, Container } from 'pixi.js';
import { CatParticleSystem } from '../particles/CatParticleSystem';
import type { BlobLayoutTuning } from '../particles/types';

export type SceneOptions = {
  glyph: string;
  fontFamily: string;
  fontData?: any | null;
  density: number;
  speed: number;
  softness: number;
  catScale?: number;
  blobLayout?: BlobLayoutTuning;
  showGuides?: boolean;
};

export type SceneController = {
  update: (options: SceneOptions) => void;
  getCanvas: () => HTMLCanvasElement;
  destroy: () => void;
};

export function createScene(host: HTMLDivElement, initialOptions: SceneOptions): SceneController {
  const app = new Application({
    antialias: true,
    autoDensity: true,
    backgroundAlpha: 0,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    resizeTo: host
  });

  host.appendChild(app.view as HTMLCanvasElement);

  const root = new Container();
  app.stage.addChild(root);

  const system = new CatParticleSystem(root, {
    ...initialOptions,
    width: host.clientWidth,
    height: host.clientHeight
  });

  const onResize = () => {
    system.resize(host.clientWidth, host.clientHeight);
  };

  const onPointerMove = (event: PointerEvent) => {
    const rect = host.getBoundingClientRect();
    system.setPointer({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  };

  const onPointerLeave = () => {
    system.setPointer(null);
  };

  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(host);
  host.addEventListener('pointermove', onPointerMove);
  host.addEventListener('pointerleave', onPointerLeave);

  app.ticker.add(() => {
    system.update(app.ticker.deltaMS / 1000);
  });

  return {
    update(nextOptions) {
      system.setOptions(nextOptions);
    },
    getCanvas() {
      return app.view as HTMLCanvasElement;
    },
    destroy() {
      resizeObserver.disconnect();
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);
      app.destroy(true, {
        children: true,
        texture: true,
        baseTexture: true
      });
    }
  };
}
