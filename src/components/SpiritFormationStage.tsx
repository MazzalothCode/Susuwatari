import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { useRive, useRiveFile, type RiveFile } from '@rive-app/react-webgl2';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react';
import { useVideoExport } from '../app/useVideoExport';
import littieSpiritUrl from '../assets/rive/littie_spirit.riv';
import { GlyphField } from '../typography/glyphField';
import { buildGlyphLayout, pathCommandsToSvgD } from '../typography/glyphLayout';

type SpiritFormationStageProps = {
  glyph: string;
  drawMode?: boolean;
  drawStroke?: StrokeShape | null;
  onStrokeCommit?: (stroke: StrokeShape) => void;
  onDrawPointerStateChange?: (active: boolean) => void;
  onExportVideoReady?: (exporter: (() => Promise<void>) | null) => void;
  onExportGifReady?: (exporter: (() => Promise<void>) | null) => void;
  fontFamily: string;
  fontData?: any | null;
  fontWeight?: number;
  density: number;
  speed: number;
  catScale: number;
  showGhostGlyph?: boolean;
  showRegionOutline?: boolean;
  showAnchorDebug?: boolean;
};

type SpiritSeed = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  anchorX: number;
  anchorY: number;
  anchorTargetX: number;
  anchorTargetY: number;
  wander: number;
  roamPhase: number;
  roamSpeed: number;
  roamRadiusT: number;
  roamRadiusN: number;
  targetRoamRadiusT: number;
  targetRoamRadiusN: number;
  driftDir: 1 | -1;
  scaleJitter: number;
  state: 'entering' | 'active' | 'exiting';
  presence: number;
  retarget: number;
};

type DebugSnapshot = {
  id: string;
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
};

type PointerState = {
  active: boolean;
  x: number;
  y: number;
};

type DraftStroke = {
  points: Array<{ x: number; y: number }>;
  strokeWidth: number;
  pathD: string;
  length: number;
};

type StrokeShape = DraftStroke;

const GLYPH_FILL_RATIO = 0.72;
const FORMATION_VISUAL_SCALE = 0.56;
const GLYPH_VISUAL_BIAS = 1.77;
const SPIRIT_VISUAL_BIAS = 0.9;
const SPIRIT_FOOTPRINT_FACTOR = 0.48;
const SPIRIT_RENDER_HEIGHT_RATIO = 1.68;
const SPIRIT_COLLISION_RADIUS_FACTOR = 0.17;
const SPIRIT_MIN_ANCHOR_SPACING = 18;
const DRAW_POINT_STEP = 6;
const DRAW_MIN_PATH_LENGTH = 48;
const VIDEO_EXPORT_SIZE = 512;
const VIDEO_EXPORT_DURATION_MS = 5000;
const VIDEO_EXPORT_FPS = 30;
const GIF_EXPORT_SIZE = 256;
const GIF_EXPORT_DURATION_MS = 3000;
const GIF_EXPORT_FPS = 10;
const GIF_EXPORT_DELAY_CS = Math.round(100 / GIF_EXPORT_FPS);

type FormationMetrics = {
  stageBase: number;
  glyphFillRatio: number;
  spiritBaseSize: number;
  footprintRadiusBase: number;
  collisionRadiusBase: number;
  minAnchorSpacing: number;
  areaPerSpirit: number;
};

export function SpiritFormationStage({
  glyph,
  drawMode = false,
  drawStroke = null,
  onStrokeCommit,
  onDrawPointerStateChange,
  onExportVideoReady,
  onExportGifReady,
  fontFamily,
  fontData,
  fontWeight = 700,
  density,
  speed,
  catScale,
  showGhostGlyph = false,
  showRegionOutline = false,
  showAnchorDebug = false
}: SpiritFormationStageProps) {
  const hasDrawStroke = Boolean(drawStroke && drawStroke.points.length > 1);
  const hasGlyph = !hasDrawStroke && glyph.trim().length > 0;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const spiritRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const animationFrameRef = useRef<number | null>(null);
  const seedsRef = useRef<SpiritSeed[]>([]);
  const nextSpiritIdRef = useRef(0);
  const lastFrameRef = useRef<number>(0);
  const drawPointerIdRef = useRef<number | null>(null);
  const activeDraftRef = useRef<DraftStroke | null>(null);
  const exportCanvas = useMemo(
    () => (typeof document === 'undefined' ? null : document.createElement('canvas')),
    []
  );
  const pointerRef = useRef<PointerState>({
    active: false,
    x: 0,
    y: 0
  });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [renderIds, setRenderIds] = useState<string[]>([]);
  const [debugSnapshot, setDebugSnapshot] = useState<DebugSnapshot[]>([]);
  const [draftStroke, setDraftStroke] = useState<DraftStroke | null>(null);
  const { riveFile: spiritRiveFile, status: spiritRiveFileStatus } = useRiveFile({
    src: littieSpiritUrl
  });
  const { exportVideo } = useVideoExport(exportCanvas, {
    durationMs: VIDEO_EXPORT_DURATION_MS,
    fps: VIDEO_EXPORT_FPS,
    filename: buildVideoExportFilename(glyph, hasDrawStroke)
  });

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

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(hostRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    if (drawMode) {
      pointerRef.current.active = false;
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointerRef.current = {
        active: true,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    };

    const handlePointerLeave = () => {
      pointerRef.current.active = false;
    };

    host.addEventListener('pointermove', handlePointerMove);
    host.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      host.removeEventListener('pointermove', handlePointerMove);
      host.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [drawMode]);

  useEffect(() => {
    if (!drawMode) {
      activeDraftRef.current = null;
      drawPointerIdRef.current = null;
      setDraftStroke(null);
      onDrawPointerStateChange?.(false);
    }
  }, [drawMode, onDrawPointerStateChange]);

  const formationMetrics = useMemo(
    () => deriveFormationMetrics(size, catScale),
    [catScale, size]
  );

  const draftStrokeWidth = useMemo(
    () =>
      deriveReferenceStrokeWidth(
        { width: size.width, height: size.height },
        fontFamily,
        fontWeight,
        formationMetrics.glyphFillRatio
      ),
    [fontFamily, fontWeight, formationMetrics.glyphFillRatio, size.height, size.width]
  );
  const maxDrawLength = useMemo(
    () => clamp(Math.min(size.width, size.height) * 4.8, 960, 2400),
    [size.height, size.width]
  );

  const exportCurrentVideo = useCallback(async () => {
    if (drawMode) {
      throw new Error('Finish drawing first before exporting the sprite animation.');
    }

    if (!hasGlyph && !hasDrawStroke) {
      throw new Error('Nothing is ready to export yet.');
    }

    if (!hostRef.current || !exportCanvas) {
      throw new Error('The export surface is not ready yet.');
    }

    const context = exportCanvas.getContext('2d');

    if (!context) {
      throw new Error('The browser could not create a 2D export canvas.');
    }

    exportCanvas.width = VIDEO_EXPORT_SIZE;
    exportCanvas.height = VIDEO_EXPORT_SIZE;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    let frameHandle: number | null = null;
    let recording = true;

    const renderFrame = () => {
      if (!recording || !hostRef.current) {
        return;
      }

      drawSpiritStageFrame(hostRef.current, context, exportCanvas.width, exportCanvas.height);
      frameHandle = window.requestAnimationFrame(renderFrame);
    };

    drawSpiritStageFrame(hostRef.current, context, exportCanvas.width, exportCanvas.height);
    frameHandle = window.requestAnimationFrame(renderFrame);

    try {
      await exportVideo();
    } finally {
      recording = false;
      if (frameHandle !== null) {
        window.cancelAnimationFrame(frameHandle);
      }
    }
  }, [drawMode, exportCanvas, exportVideo, hasDrawStroke, hasGlyph]);

  useEffect(() => {
    onExportVideoReady?.(exportCurrentVideo);
    return () => onExportVideoReady?.(null);
  }, [exportCurrentVideo, onExportVideoReady]);

  const exportCurrentGif = useCallback(async () => {
    if (drawMode) {
      throw new Error('Finish drawing first before exporting the sprite animation.');
    }

    if (!hasGlyph && !hasDrawStroke) {
      throw new Error('Nothing is ready to export yet.');
    }

    if (!hostRef.current) {
      throw new Error('The export surface is not ready yet.');
    }

    const gifCanvas = document.createElement('canvas');
    gifCanvas.width = GIF_EXPORT_SIZE;
    gifCanvas.height = GIF_EXPORT_SIZE;

    const context = gifCanvas.getContext('2d', { willReadFrequently: true });

    if (!context) {
      throw new Error('The browser could not create a 2D export canvas.');
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    const frameCount = Math.round((GIF_EXPORT_DURATION_MS / 1000) * GIF_EXPORT_FPS);
    const frameIntervalMs = 1000 / GIF_EXPORT_FPS;
    const frames = await captureGifFrames(
      hostRef.current,
      context,
      gifCanvas.width,
      gifCanvas.height,
      frameCount,
      frameIntervalMs
    );

    const blob = encodeGif({
      width: gifCanvas.width,
      height: gifCanvas.height,
      frames,
      delayCs: GIF_EXPORT_DELAY_CS
    });

    if (blob.size < 1) {
      throw new Error('The GIF encoder returned an empty file.');
    }

    downloadBlob(blob, buildGifExportFilename(glyph, hasDrawStroke));
  }, [drawMode, glyph, hasDrawStroke, hasGlyph]);

  useEffect(() => {
    onExportGifReady?.(exportCurrentGif);
    return () => onExportGifReady?.(null);
  }, [exportCurrentGif, onExportGifReady]);

  const finalizeDraftStroke = () => {
    const draft = activeDraftRef.current;
    drawPointerIdRef.current = null;
    activeDraftRef.current = null;
    setDraftStroke(null);
    onDrawPointerStateChange?.(false);
    if (!draft || draft.points.length < 2 || draft.length < DRAW_MIN_PATH_LENGTH) {
      return;
    }
    onStrokeCommit?.(draft);
  };

  const stagePointFromEvent = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = hostRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }
    return {
      x: clamp(event.clientX - rect.left, 0, rect.width),
      y: clamp(event.clientY - rect.top, 0, rect.height)
    };
  };

  const handleDrawPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawMode || event.button !== 0) {
      return;
    }
    const point = stagePointFromEvent(event);
    if (!isPointInDrawActivationRegion(point, size)) {
      return;
    }
    const nextDraft: DraftStroke = {
      points: [point],
      strokeWidth: draftStrokeWidth,
      pathD: buildStrokePathD([point]),
      length: 0
    };
    drawPointerIdRef.current = event.pointerId;
    activeDraftRef.current = nextDraft;
    setDraftStroke(nextDraft);
    onDrawPointerStateChange?.(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handleDrawPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawMode || drawPointerIdRef.current !== event.pointerId || !activeDraftRef.current) {
      return;
    }

    const point = stagePointFromEvent(event);
    const draft = activeDraftRef.current;
    const lastPoint = draft.points[draft.points.length - 1];
    const segment = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
    if (segment < DRAW_POINT_STEP) {
      return;
    }

    const nextLength = draft.length + segment;
    const nextPoint =
      nextLength <= maxDrawLength
        ? point
        : interpolatePoint(lastPoint, point, (maxDrawLength - draft.length) / segment);
    const nextPoints = [...draft.points, nextPoint];
    const nextDraft: DraftStroke = {
      points: nextPoints,
      strokeWidth: draftStrokeWidth,
      pathD: buildStrokePathD(nextPoints),
      length: Math.min(maxDrawLength, nextLength)
    };

    activeDraftRef.current = nextDraft;
    setDraftStroke(nextDraft);

    if (nextLength >= maxDrawLength) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      finalizeDraftStroke();
    }
  };

  const handleDrawPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawMode || drawPointerIdRef.current !== event.pointerId) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    finalizeDraftStroke();
  };

  const handleDrawPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawMode || drawPointerIdRef.current !== event.pointerId) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drawPointerIdRef.current = null;
    activeDraftRef.current = null;
    setDraftStroke(null);
    onDrawPointerStateChange?.(false);
  };

  const glyphLayout = useMemo(() => {
    if (!hasGlyph || size.width < 1 || size.height < 1) {
      return null;
    }

    return buildGlyphLayout({
      glyph,
      fontFamily,
      fontData,
      fontWeight,
      width: size.width,
      height: size.height,
      fillRatio: formationMetrics.glyphFillRatio
    });
  }, [
    fontData,
    fontFamily,
    fontWeight,
    formationMetrics.glyphFillRatio,
    glyph,
    hasGlyph,
    size.height,
    size.width
  ]);

  const glyphPathD = useMemo(() => {
    if (drawMode && draftStroke) {
      return draftStroke.pathD;
    }

    if (!glyphLayout?.pathCommands) {
      return null;
    }

    return pathCommandsToSvgD(glyphLayout.pathCommands);
  }, [draftStroke, drawMode, glyphLayout]);

  const field = useMemo(() => {
    if (size.width < 1 || size.height < 1) {
      return null;
    }

    if (hasDrawStroke && drawStroke) {
      return new GlyphField({
        glyph: 'C',
        fontFamily,
        fontData,
        fontWeight,
        width: size.width,
        height: size.height,
        fillRatio: formationMetrics.glyphFillRatio,
        drawStroke: {
          points: drawStroke.points,
          strokeWidth: drawStroke.strokeWidth
        }
      });
    }

    if (!hasGlyph) {
      return null;
    }

    return new GlyphField({
      glyph,
      fontFamily,
      fontData,
      fontWeight,
      width: size.width,
      height: size.height,
      fillRatio: formationMetrics.glyphFillRatio
    });
  }, [
    drawStroke,
    fontData,
    fontFamily,
    fontWeight,
    formationMetrics.glyphFillRatio,
    glyph,
    hasDrawStroke,
    hasGlyph,
    size.height,
    size.width
  ]);

  const glyphMetrics = useMemo(() => {
    if (!field) {
      return null;
    }

    const bounds = field.getBounds();
    return {
      width: Math.max(1, bounds.maxX - bounds.minX),
      height: Math.max(1, bounds.maxY - bounds.minY)
    };
  }, [field]);

  const insideAreaEstimate = useMemo(() => {
    if (!field) {
      return 0;
    }

    return field.getInsideAreaEstimate();
  }, [field]);

  const spiritCount = useMemo(() => {
    if (!hasGlyph && !hasDrawStroke) {
      return 1;
    }
    if (!insideAreaEstimate) {
      return density;
    }

    const densityFactor = density / 40;
    const targetCount = (insideAreaEstimate / formationMetrics.areaPerSpirit) * densityFactor;
    return Math.max(4, Math.round(targetCount));
  }, [density, formationMetrics.areaPerSpirit, hasGlyph, hasDrawStroke, insideAreaEstimate]);

  useEffect(() => {
    if (size.width < 1 || size.height < 1) {
      return;
    }

    if (!field || !glyphMetrics) {
      const nextSeeds = reconcileIdleSpiritPool(
        seedsRef.current,
        { width: size.width, height: size.height },
        formationMetrics,
        nextSpiritIdRef
      );
      seedsRef.current = nextSeeds;
      setRenderIds(nextSeeds.map((seed) => seed.id));
      return;
    }

    const anchors = createDistributedAnchors(
      field,
      spiritCount,
      glyphMetrics,
      insideAreaEstimate,
      formationMetrics
    );
    const nextSeeds = reconcileSpiritPool({
      currentSeeds: seedsRef.current,
      anchors,
      field,
      glyphMetrics,
      insideAreaEstimate,
      spiritCount,
      formationMetrics,
      nextIdRef: nextSpiritIdRef
    });
    seedsRef.current = nextSeeds;
    setRenderIds(nextSeeds.map((seed) => seed.id));
  }, [field, formationMetrics, glyphMetrics, insideAreaEstimate, size, spiritCount]);

  useEffect(() => {
    if (size.width < 1 || size.height < 1) {
      return undefined;
    }

    const tick = (now: number) => {
      const dt = Math.min((now - lastFrameRef.current) / 1000 || 0, 1 / 20);
      lastFrameRef.current = now;
      const spiritBaseSize = formationMetrics.spiritBaseSize;
      const wanderForce = 10 + speed * 8;
      const returnForce = 88;
      const targetForce = 92 + speed * 26;
      const maxSpeed = 46 + speed * 54;
      const pointer = pointerRef.current;
      const pointerRadius = spiritBaseSize * 4.2;
      const pointerForce = spiritBaseSize * 16;

      for (const seed of seedsRef.current) {
        seed.retarget = Math.max(0, seed.retarget - dt * 1.35);
        seed.anchorX = lerp(seed.anchorX, seed.anchorTargetX, Math.min(1, dt * 4.4));
        seed.anchorY = lerp(seed.anchorY, seed.anchorTargetY, Math.min(1, dt * 4.4));
        seed.roamRadiusT = lerp(seed.roamRadiusT, seed.targetRoamRadiusT, Math.min(1, dt * 3.2));
        seed.roamRadiusN = lerp(seed.roamRadiusN, seed.targetRoamRadiusN, Math.min(1, dt * 3.2));

        if (seed.state === 'entering') {
          seed.presence = Math.min(1, seed.presence + dt * 5.4);
          if (seed.presence >= 0.995) {
            seed.presence = 1;
            seed.state = 'active';
          }
        } else if (seed.state === 'exiting') {
          seed.presence = Math.max(0, seed.presence - dt * 4.8);
        }

        if (field && glyphMetrics) {
          const sample = field.sample(seed.x, seed.y);
          const anchorSample = field.sample(seed.anchorX, seed.anchorY);
          const tangentX = anchorSample.tangentX;
          const tangentY = anchorSample.tangentY;
          const anchorNormalX = anchorSample.normalX;
          const anchorNormalY = anchorSample.normalY;
          const inwardX = sample.inside ? sample.normalX : -sample.normalX;
          const inwardY = sample.inside ? sample.normalY : -sample.normalY;
          const spiritRadius = spiritBaseSize * seed.scaleJitter * SPIRIT_FOOTPRINT_FACTOR;
          const safeInset = spiritRadius;

          seed.wander += (Math.random() - 0.5) * 2.2 * dt;
          seed.roamPhase += dt * seed.roamSpeed * (0.72 + speed * 0.52) * seed.driftDir;
          const wanderX = Math.cos(seed.wander);
          const wanderY = Math.sin(seed.wander);

          const roamBlend = 1 - seed.retarget * 0.72;
          const roamOffsetT = Math.cos(seed.roamPhase) * seed.roamRadiusT * roamBlend;
          const roamOffsetN = Math.sin(seed.roamPhase) * seed.roamRadiusN * roamBlend;
          const targetX =
            seed.anchorX + tangentX * roamOffsetT + anchorNormalX * roamOffsetN;
          const targetY =
            seed.anchorY + tangentY * roamOffsetT + anchorNormalY * roamOffsetN;
          const toTargetX = targetX - seed.x;
          const toTargetY = targetY - seed.y;
          const targetDistance = Math.hypot(toTargetX, toTargetY) || 1;

          let ax = 0;
          let ay = 0;

          if (seed.state !== 'exiting') {
            const migrationForce = 1 + seed.retarget * 1.45;
            const localWanderForce = wanderForce * (1 - seed.retarget * 0.72);
            ax = (toTargetX / targetDistance) * targetForce * migrationForce + wanderX * localWanderForce;
            ay = (toTargetY / targetDistance) * targetForce * migrationForce + wanderY * localWanderForce;

            ax += tangentX * 10 * speed * (1 - seed.retarget * 0.38);
            ay += tangentY * 10 * speed * (1 - seed.retarget * 0.38);

            if (sample.distance > -safeInset) {
              const strength = 1 + (sample.distance + safeInset) / Math.max(8, safeInset);
              ax += inwardX * returnForce * (1.18 + strength * 1.2);
              ay += inwardY * returnForce * (1.18 + strength * 1.2);
            }
          }

          if (pointer.active) {
            const dx = seed.x - pointer.x;
            const dy = seed.y - pointer.y;
            const distance = Math.hypot(dx, dy) || 1;

            if (distance < pointerRadius) {
              const strength = (1 - distance / pointerRadius) ** 1.35;
              ax += (dx / distance) * pointerForce * strength;
              ay += (dy / distance) * pointerForce * strength;
            }
          }

          seed.vx += ax * dt;
          seed.vy += ay * dt;

          let velocityLength = Math.hypot(seed.vx, seed.vy) || 1;
          if (velocityLength < 8) {
            seed.vx += (toTargetX / targetDistance) * 12 * dt;
            seed.vy += (toTargetY / targetDistance) * 12 * dt;
            velocityLength = Math.hypot(seed.vx, seed.vy) || 1;
          }
          if (velocityLength > maxSpeed) {
            const boostedMaxSpeed = maxSpeed * (1 + seed.retarget * 0.6);
            seed.vx = (seed.vx / velocityLength) * boostedMaxSpeed;
            seed.vy = (seed.vy / velocityLength) * boostedMaxSpeed;
          }

          seed.vx *= 0.975;
          seed.vy *= 0.975;
          seed.x += seed.vx * dt;
          seed.y += seed.vy * dt;
        } else {
          seed.vx *= 0.94;
          seed.vy *= 0.94;
          seed.x = lerp(seed.x, seed.anchorTargetX, Math.min(1, dt * 4.6));
          seed.y = lerp(seed.y, seed.anchorTargetY, Math.min(1, dt * 4.6));
        }
      }

      if (field && glyphMetrics) {
        resolveCollisions(seedsRef.current, formationMetrics);
      }
      let removedAny = false;

      for (const seed of seedsRef.current) {
        const element = spiritRefs.current.get(seed.id);

      if (!element) {
          continue;
        }

        const spiritSize = spiritBaseSize * seed.scaleJitter;
        const presenceScale = Math.max(0.035, seed.presence);
        const spiritWidth = spiritSize;
        const spiritHeight = spiritWidth * SPIRIT_RENDER_HEIGHT_RATIO;
        const bodyCenterOffsetY = spiritHeight - spiritWidth / 2;
        element.style.width = `${spiritWidth * presenceScale}px`;
        element.style.height = `${spiritHeight * presenceScale}px`;
        element.style.opacity = `1`;
        element.style.transform = `translate(${seed.x - (spiritWidth * presenceScale) / 2}px, ${seed.y - bodyCenterOffsetY * presenceScale}px)`;
      }

      const filteredSeeds = seedsRef.current.filter((seed) => {
        const keep = !(seed.state === 'exiting' && seed.presence <= 0.001);
        if (!keep) {
          removedAny = true;
          spiritRefs.current.delete(seed.id);
        }
        return keep;
      });

      if (removedAny || filteredSeeds.length !== seedsRef.current.length) {
        seedsRef.current = filteredSeeds;
        setRenderIds(filteredSeeds.map((seed) => seed.id));
      }

      if (showAnchorDebug) {
        setDebugSnapshot(
          seedsRef.current.map((seed) => ({
            id: seed.id,
            x: seed.x,
            y: seed.y,
            anchorX: seed.anchorX,
            anchorY: seed.anchorY
          }))
        );
      } else if (debugSnapshot.length > 0) {
        setDebugSnapshot([]);
      }

      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    lastFrameRef.current = performance.now();
    animationFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    debugSnapshot.length,
    field,
    formationMetrics,
    glyphMetrics,
    insideAreaEstimate,
    showAnchorDebug,
    size,
    speed,
    spiritCount
  ]);

  return (
    <div
      className={`stage-canvas spirit-stage ${drawMode ? 'is-drawing' : ''}`}
      ref={hostRef}
      onPointerDown={handleDrawPointerDown}
      onPointerMove={handleDrawPointerMove}
      onPointerUp={handleDrawPointerUp}
      onPointerCancel={handleDrawPointerCancel}
    >
      {showGhostGlyph && glyphLayout ? (
        <div className="ghost-glyph-layer" aria-hidden="true">
          {glyphLayout.pathCommands ? (
            <svg
              className="ghost-glyph-svg"
              viewBox={`0 0 ${size.width} ${size.height}`}
              preserveAspectRatio="none"
            >
              <path className="ghost-glyph-path" d={glyphPathD ?? ''} />
            </svg>
          ) : (
            <div
              className="ghost-glyph"
              style={{
                fontFamily,
                fontSize: glyphLayout.fontSize,
                fontWeight,
                WebkitTextStroke:
                  fontWeight > 700 ? `${Math.max(0, (fontWeight - 700) / 80)}px rgba(17, 17, 17, 0.08)` : undefined
              }}
            >
              {glyph}
            </div>
          )}
        </div>
      ) : null}

      {showRegionOutline && glyphPathD ? (
        <svg
          className="spirit-region-outline"
          viewBox={`0 0 ${size.width} ${size.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            className="spirit-region-path"
            d={glyphPathD}
            fill={drawMode && draftStroke ? 'none' : 'rgba(17, 17, 17, 0.035)'}
            stroke={drawMode && draftStroke ? 'rgba(17, 17, 17, 0.14)' : undefined}
            strokeWidth={drawMode && draftStroke ? draftStroke.strokeWidth : 2}
            strokeLinecap={drawMode && draftStroke ? 'round' : undefined}
            strokeLinejoin={drawMode && draftStroke ? 'round' : undefined}
          />
        </svg>
      ) : showRegionOutline && glyphLayout ? (
        <div className="ghost-glyph-layer spirit-region-text-layer" aria-hidden="true">
          <div
            className="ghost-glyph spirit-region-text"
            style={{
              fontFamily,
              fontSize: glyphLayout.fontSize,
              fontWeight,
              WebkitTextStroke:
                fontWeight > 700 ? `${Math.max(0, (fontWeight - 700) / 80)}px rgba(17, 17, 17, 0.06)` : undefined
            }}
          >
            {glyph}
          </div>
        </div>
      ) : null}

      {showAnchorDebug ? (
        <svg
          className="spirit-debug-overlay"
          viewBox={`0 0 ${size.width} ${size.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {debugSnapshot.map((seed) => (
            <g key={seed.id}>
              <line
                x1={seed.x}
                y1={seed.y}
                x2={seed.anchorX}
                y2={seed.anchorY}
                stroke="rgba(220, 60, 60, 0.28)"
                strokeWidth="1.25"
              />
              <circle
                cx={seed.anchorX}
                cy={seed.anchorY}
                r="4.2"
                fill="rgba(220, 60, 60, 0.82)"
              />
              <circle
                cx={seed.x}
                cy={seed.y}
                r="3.2"
                fill="rgba(24, 24, 24, 0.82)"
              />
            </g>
          ))}
        </svg>
      ) : null}

      {drawMode && draftStroke ? (
        <svg
          className="spirit-draw-overlay"
          viewBox={`0 0 ${size.width} ${size.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d={draftStroke.pathD}
            fill="none"
            stroke="rgba(17, 17, 17, 0.22)"
            strokeWidth={draftStroke.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}

      <div className="spirit-layer">
        {renderIds.map((id) => (
          <div
            key={id}
            className="spirit-instance"
            ref={(node) => {
              if (node) {
                spiritRefs.current.set(id, node);
              } else {
                spiritRefs.current.delete(id);
              }
            }}
          >
            <SpiritRive
              riveFile={spiritRiveFileStatus === 'success' ? spiritRiveFile : null}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function createSpiritSeed(
  id: string,
  field: GlyphField,
  glyphMetrics: { width: number; height: number },
  insideAreaEstimate: number,
  spiritCount: number,
  formationMetrics: FormationMetrics,
  anchor?: { x: number; y: number },
  mode: 'active' | 'entering' = 'active'
): SpiritSeed {
  const numericId = Number(id.split('-')[1] ?? '0');
  const scaleJitter = 0.95 + Math.random() * 0.1;
  const spiritBaseSize = formationMetrics.spiritBaseSize;
  const spawnJitter = spiritBaseSize * 0.36;

  for (let attempts = 0; attempts < 320; attempts += 1) {
    const rawBase = anchor ?? field.sampleWorldPoint();
    const base = projectTowardInterior(
      field,
      rawBase.x,
      rawBase.y,
      spiritBaseSize * scaleJitter * SPIRIT_FOOTPRINT_FACTOR * 1.12
    );
    const anchorSample = field.sample(base.x, base.y);
    const interiorDepth = Math.max(8, -anchorSample.distance);
    const safeInset = spiritBaseSize * scaleJitter * SPIRIT_FOOTPRINT_FACTOR;
    const normalSlack = Math.max(3, interiorDepth - safeInset);
    const fallback = {
      x: base.x + (Math.random() - 0.5) * spawnJitter,
      y: base.y + (Math.random() - 0.5) * spawnJitter
    };
    const settled = projectTowardInterior(field, fallback.x, fallback.y, safeInset * 1.08);
    const sample = field.sample(settled.x, settled.y);

    if (sample.distance <= -safeInset * 1.08) {
      const spawnX = mode === 'entering' ? settled.x : settled.x;
      const spawnY = mode === 'entering' ? settled.y : settled.y;
      return {
        id,
        x: spawnX,
        y: spawnY,
        vx: 0,
        vy: 0,
        anchorX: base.x,
        anchorY: base.y,
        anchorTargetX: base.x,
        anchorTargetY: base.y,
        wander: Math.random() * Math.PI * 2,
        roamPhase: Math.random() * Math.PI * 2,
        roamSpeed: 0.8 + Math.random() * 0.7,
        roamRadiusT: Math.min(spiritBaseSize * (0.18 + Math.random() * 0.04), interiorDepth * 0.28),
        roamRadiusN: Math.min(spiritBaseSize * (0.06 + Math.random() * 0.02), normalSlack * 0.42),
        targetRoamRadiusT: Math.min(spiritBaseSize * (0.18 + Math.random() * 0.04), interiorDepth * 0.28),
        targetRoamRadiusN: Math.min(spiritBaseSize * (0.06 + Math.random() * 0.02), normalSlack * 0.42),
        driftDir: numericId % 2 === 0 ? 1 : -1,
        scaleJitter,
        state: mode,
        presence: mode === 'entering' ? 0 : 1,
        retarget: mode === 'entering' ? 1 : 0
      };
    }
  }

  const rawFallback = anchor ?? field.sampleWorldPoint();
  const fallback = projectTowardInterior(
    field,
    rawFallback.x,
    rawFallback.y,
    spiritBaseSize * scaleJitter * SPIRIT_FOOTPRINT_FACTOR * 1.12
  );
  const fallbackSample = field.sample(fallback.x, fallback.y);
  const fallbackDepth = Math.max(8, -fallbackSample.distance);
  const fallbackSafeInset = spiritBaseSize * scaleJitter * SPIRIT_FOOTPRINT_FACTOR;
  const fallbackSlack = Math.max(3, fallbackDepth - fallbackSafeInset);
  const fallbackRoamRadiusT = Math.min(spiritBaseSize * (0.18 + Math.random() * 0.04), fallbackDepth * 0.28);
  const fallbackRoamRadiusN = Math.min(spiritBaseSize * (0.06 + Math.random() * 0.02), fallbackSlack * 0.42);
  return {
    id,
    x: mode === 'entering' ? fallback.x : fallback.x,
    y: mode === 'entering' ? fallback.y : fallback.y,
    vx: 0,
    vy: 0,
    anchorX: fallback.x,
    anchorY: fallback.y,
    anchorTargetX: fallback.x,
    anchorTargetY: fallback.y,
    wander: Math.random() * Math.PI * 2,
    roamPhase: Math.random() * Math.PI * 2,
    roamSpeed: 0.8 + Math.random() * 0.7,
    roamRadiusT: fallbackRoamRadiusT,
    roamRadiusN: fallbackRoamRadiusN,
    targetRoamRadiusT: fallbackRoamRadiusT,
    targetRoamRadiusN: fallbackRoamRadiusN,
    driftDir: numericId % 2 === 0 ? 1 : -1,
    scaleJitter,
    state: mode,
    presence: mode === 'entering' ? 0 : 1,
    retarget: mode === 'entering' ? 1 : 0
  };
}

function reconcileSpiritPool({
  currentSeeds,
  anchors,
  field,
  glyphMetrics,
  insideAreaEstimate,
  spiritCount,
  formationMetrics,
  nextIdRef
}: {
  currentSeeds: SpiritSeed[];
  anchors: Array<{ x: number; y: number }>;
  field: GlyphField;
  glyphMetrics: { width: number; height: number };
  insideAreaEstimate: number;
  spiritCount: number;
  formationMetrics: FormationMetrics;
  nextIdRef: React.MutableRefObject<number>;
}) {
  const sortedSeeds = [...currentSeeds].sort((a, b) => a.id.localeCompare(b.id));
  const reusableCount = Math.min(sortedSeeds.length, spiritCount);
  const seedsToKeep = sortedSeeds.slice(0, reusableCount);
  const seedsToExit = sortedSeeds.slice(reusableCount);
  const matchedAnchors = assignAnchorsToSeeds(seedsToKeep, anchors);

  for (const seed of seedsToExit) {
    seed.state = 'exiting';
  }

  for (let index = 0; index < seedsToKeep.length; index += 1) {
    const seed = seedsToKeep[index];
    const anchor = matchedAnchors[index];
    applyAnchorTarget(seed, field, glyphMetrics, insideAreaEstimate, spiritCount, formationMetrics, anchor);
    seed.state = seed.presence < 0.999 ? 'entering' : 'active';
  }

  const usedAnchorKeys = new Set(matchedAnchors.map((anchor) => `${anchor.x}:${anchor.y}`));
  const extraAnchors = anchors.filter((anchor) => !usedAnchorKeys.has(`${anchor.x}:${anchor.y}`));
  const nextSeeds = [...seedsToKeep, ...seedsToExit];

  while (nextSeeds.filter((seed) => seed.state !== 'exiting').length < spiritCount && extraAnchors.length > 0) {
    const anchor = extraAnchors.shift()!;
    const id = `spirit-${nextIdRef.current++}`;
    nextSeeds.push(
      createSpiritSeed(
        id,
        field,
        glyphMetrics,
        insideAreaEstimate,
        spiritCount,
        formationMetrics,
        anchor,
        'entering'
      )
    );
  }

  return nextSeeds;
}

function reconcileIdleSpiritPool(
  currentSeeds: SpiritSeed[],
  viewport: { width: number; height: number },
  formationMetrics: FormationMetrics,
  nextIdRef: React.MutableRefObject<number>
) {
  const center = {
    x: viewport.width * 0.5,
    y: viewport.height * 0.62
  };
  const seeds = [...currentSeeds].sort((a, b) => a.id.localeCompare(b.id));
  const primary = seeds.find((seed) => seed.state !== 'exiting') ?? seeds[0];
  const nextSeeds: SpiritSeed[] = [];

  if (primary) {
    primary.anchorTargetX = center.x;
    primary.anchorTargetY = center.y;
    primary.anchorX = lerp(primary.anchorX, center.x, 0.35);
    primary.anchorY = lerp(primary.anchorY, center.y, 0.35);
    primary.targetRoamRadiusT = 0;
    primary.targetRoamRadiusN = 0;
    primary.roamRadiusT = lerp(primary.roamRadiusT, 0, 0.35);
    primary.roamRadiusN = lerp(primary.roamRadiusN, 0, 0.35);
    primary.state = primary.presence < 0.999 ? 'entering' : 'active';
    primary.retarget = Math.max(primary.retarget, 1);
    nextSeeds.push(primary);
  } else {
    const id = `spirit-${nextIdRef.current++}`;
    nextSeeds.push(createIdleSpiritSeed(id, viewport, formationMetrics, 'active'));
  }

  for (const seed of seeds) {
    if (seed === primary) {
      continue;
    }
    seed.state = 'exiting';
    seed.anchorTargetX = center.x;
    seed.anchorTargetY = center.y;
    seed.targetRoamRadiusT = 0;
    seed.targetRoamRadiusN = 0;
    nextSeeds.push(seed);
  }

  return nextSeeds;
}

function createIdleSpiritSeed(
  id: string,
  viewport: { width: number; height: number },
  formationMetrics: FormationMetrics,
  mode: 'active' | 'entering' = 'active'
): SpiritSeed {
  const numericId = Number(id.split('-')[1] ?? '0');
  const centerX = viewport.width * 0.5;
  const centerY = viewport.height * 0.62;

  return {
    id,
    x: centerX,
    y: centerY,
    vx: 0,
    vy: 0,
    anchorX: centerX,
    anchorY: centerY,
    anchorTargetX: centerX,
    anchorTargetY: centerY,
    wander: Math.random() * Math.PI * 2,
    roamPhase: Math.random() * Math.PI * 2,
    roamSpeed: 0.8 + Math.random() * 0.7,
    roamRadiusT: 0,
    roamRadiusN: 0,
    targetRoamRadiusT: 0,
    targetRoamRadiusN: 0,
    driftDir: numericId % 2 === 0 ? 1 : -1,
    scaleJitter: 0.95 + Math.random() * 0.1,
    state: mode,
    presence: mode === 'entering' ? 0 : 1,
    retarget: mode === 'entering' ? 1 : 0
  };
}

function assignAnchorsToSeeds(
  seeds: SpiritSeed[],
  anchors: Array<{ x: number; y: number }>
) {
  const remainingAnchors = [...anchors];
  const matches: Array<{ x: number; y: number }> = [];

  for (const seed of seeds) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < remainingAnchors.length; index += 1) {
      const anchor = remainingAnchors[index];
      const distance = Math.hypot(seed.anchorTargetX - anchor.x, seed.anchorTargetY - anchor.y);
  if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }

    matches.push(remainingAnchors.splice(bestIndex, 1)[0]);
  }

  return matches;
}

function applyAnchorTarget(
  seed: SpiritSeed,
  field: GlyphField,
  glyphMetrics: { width: number; height: number },
  insideAreaEstimate: number,
  spiritCount: number,
  formationMetrics: FormationMetrics,
  anchor: { x: number; y: number }
) {
  const spiritBaseSize = formationMetrics.spiritBaseSize;
  const safeInset = spiritBaseSize * seed.scaleJitter * SPIRIT_FOOTPRINT_FACTOR;
  const projectedAnchor = projectTowardInterior(field, anchor.x, anchor.y, safeInset * 1.12);
  const anchorSample = field.sample(projectedAnchor.x, projectedAnchor.y);
  const interiorDepth = Math.max(8, -anchorSample.distance);
  const normalSlack = Math.max(3, interiorDepth - safeInset);

  seed.anchorTargetX = projectedAnchor.x;
  seed.anchorTargetY = projectedAnchor.y;
  seed.targetRoamRadiusT = Math.min(spiritBaseSize * (0.18 + Math.random() * 0.04), interiorDepth * 0.28);
  seed.targetRoamRadiusN = Math.min(spiritBaseSize * (0.06 + Math.random() * 0.02), normalSlack * 0.42);
  seed.retarget = Math.max(seed.retarget, 1);
}

function resolveCollisions(seeds: SpiritSeed[], formationMetrics: FormationMetrics) {
  for (let i = 0; i < seeds.length; i += 1) {
    for (let j = i + 1; j < seeds.length; j += 1) {
      const a = seeds[i];
      const b = seeds[j];
      const aRadius = formationMetrics.collisionRadiusBase * a.scaleJitter;
      const bRadius = formationMetrics.collisionRadiusBase * b.scaleJitter;
      const minDistance = aRadius + bRadius;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy) || 0.0001;

      if (distance >= minDistance) {
        continue;
      }

      const overlap = Math.min(
        (minDistance - distance) * 0.32,
        formationMetrics.spiritBaseSize * 0.08
      );
      const nx = dx / distance;
      const ny = dy / distance;

      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;
    }
  }
}

function createDistributedAnchors(
  field: GlyphField,
  count: number,
  glyphMetrics: { width: number; height: number },
  insideAreaEstimate: number,
  formationMetrics: FormationMetrics
) {
  const anchors: Array<{ x: number; y: number }> = [];
  const baseSafeInset = formationMetrics.footprintRadiusBase;
  const preferredDepth = Math.max(baseSafeInset * 1.35, 16);
  const minAnchorSpacing = formationMetrics.minAnchorSpacing;
  const hardRejectSpacing = minAnchorSpacing * 0.92;
  const endpointHints = field.getEndpointHints();

  for (const hint of endpointHints) {
    if (anchors.length >= count) {
      break;
    }

    const candidate = projectTowardInterior(field, hint.x, hint.y, preferredDepth * 0.82);
    let minDistance = Number.POSITIVE_INFINITY;
    for (const anchor of anchors) {
      const distance = Math.hypot(candidate.x - anchor.x, candidate.y - anchor.y);
      minDistance = Math.min(minDistance, distance);
    }

    if (anchors.length > 0 && minDistance < hardRejectSpacing) {
      continue;
    }

    anchors.push(candidate);
  }

  for (let index = anchors.length; index < count; index += 1) {
    let bestPoint: { x: number; y: number } | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let attempt = 0; attempt < 72; attempt += 1) {
      const rawCandidate = field.sampleWorldPoint();
      const candidate = projectTowardInterior(field, rawCandidate.x, rawCandidate.y, preferredDepth);
      const sample = field.sample(candidate.x, candidate.y);

      if (sample.distance > -preferredDepth) {
        continue;
      }

      let minDistance = Number.POSITIVE_INFINITY;
      for (const anchor of anchors) {
        const distance = Math.hypot(candidate.x - anchor.x, candidate.y - anchor.y);
        minDistance = Math.min(minDistance, distance);
      }

      if (anchors.length > 0 && minDistance < hardRejectSpacing) {
        continue;
      }

      const interiorDepth = Math.min(-sample.distance, baseSafeInset);
      const score =
        anchors.length === 0
          ? interiorDepth * 2.4 + Math.random()
          : minDistance * 1.15 + interiorDepth * 2.05 + Math.random() * baseSafeInset * 0.16;

      if (score > bestScore) {
        bestScore = score;
        bestPoint = candidate;
      }
    }

    if (bestPoint) {
      anchors.push(bestPoint);
    } else {
      const fallback = field.sampleWorldPoint();
      anchors.push(projectTowardInterior(field, fallback.x, fallback.y, preferredDepth));
    }
  }

  return anchors;
}

function projectTowardInterior(
  field: GlyphField,
  x: number,
  y: number,
  targetDepth: number
) {
  let px = x;
  let py = y;

  for (let step = 0; step < 6; step += 1) {
    const sample = field.sample(px, py);
    const currentDepth = -sample.distance;
    if (currentDepth >= targetDepth) {
      break;
    }

    const deficit = targetDepth - currentDepth;
    const inwardX = sample.inside ? sample.normalX : -sample.normalX;
    const inwardY = sample.inside ? sample.normalY : -sample.normalY;
    px += inwardX * Math.min(deficit * 0.72, targetDepth * 0.58);
    py += inwardY * Math.min(deficit * 0.72, targetDepth * 0.58);
  }

  return { x: px, y: py };
}

function deriveFormationMetrics(
  viewport: { width: number; height: number },
  catScale: number
) : FormationMetrics {
  const stageBase = Math.min(viewport.width, viewport.height);
  const visualScale = FORMATION_VISUAL_SCALE;
  const spiritBaseSize = clamp(
    stageBase * (0.15 + catScale * 0.21) * visualScale * SPIRIT_VISUAL_BIAS,
    stageBase * 0.14 * visualScale * SPIRIT_VISUAL_BIAS,
    stageBase * 0.28 * visualScale * SPIRIT_VISUAL_BIAS
  );
  const footprintRadiusBase = spiritBaseSize * SPIRIT_FOOTPRINT_FACTOR;
  const minAnchorSpacing = Math.max(footprintRadiusBase * 1.32, SPIRIT_MIN_ANCHOR_SPACING + 4);
  return {
    stageBase,
    glyphFillRatio: GLYPH_FILL_RATIO * visualScale * GLYPH_VISUAL_BIAS,
    spiritBaseSize,
    footprintRadiusBase,
    collisionRadiusBase: spiritBaseSize * SPIRIT_COLLISION_RADIUS_FACTOR,
    minAnchorSpacing,
    areaPerSpirit: Math.max(560, minAnchorSpacing * minAnchorSpacing * 0.82)
  };
}

function isPointInDrawActivationRegion(
  point: { x: number; y: number },
  viewport: { width: number; height: number }
) {
  return (
    viewport.width > 0 &&
    viewport.height > 0 &&
    point.x >= 0 &&
    point.x <= viewport.width &&
    point.y >= 0 &&
    point.y <= viewport.height
  );
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function drawSpiritStageFrame(
  host: HTMLDivElement,
  context: CanvasRenderingContext2D,
  outputWidth: number,
  outputHeight: number,
  options: { backgroundColor?: string } = {}
) {
  const hostRect = host.getBoundingClientRect();

  if (options.backgroundColor) {
    context.fillStyle = options.backgroundColor;
    context.fillRect(0, 0, outputWidth, outputHeight);
  } else {
    context.clearRect(0, 0, outputWidth, outputHeight);
  }

  if (hostRect.width < 1 || hostRect.height < 1) {
    return;
  }

  const scaleX = outputWidth / hostRect.width;
  const scaleY = outputHeight / hostRect.height;
  const spiritNodes = host.querySelectorAll<HTMLDivElement>('.spirit-instance');

  spiritNodes.forEach((node) => {
    const canvas = node.querySelector('canvas');

    if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 1 || canvas.height < 1) {
      return;
    }

    const rect = node.getBoundingClientRect();
    const x = (rect.left - hostRect.left) * scaleX;
    const y = (rect.top - hostRect.top) * scaleY;
    const width = rect.width * scaleX;
    const height = rect.height * scaleY;

    if (width <= 0 || height <= 0) {
      return;
    }

    context.drawImage(canvas, x, y, width, height);
  });
}

function buildVideoExportFilename(glyph: string, hasDrawStroke: boolean) {
  if (hasDrawStroke) {
    return 'cat-a-font-stroke-512.webm';
  }

  const compactGlyph = glyph.trim().replace(/[^a-z0-9_-]+/gi, '') || 'glyph';
  return `cat-a-font-${compactGlyph}-512.webm`;
}

function buildGifExportFilename(glyph: string, hasDrawStroke: boolean) {
  if (hasDrawStroke) {
    return 'cat-a-font-stroke-256.gif';
  }

  const compactGlyph = glyph.trim().replace(/[^a-z0-9_-]+/gi, '') || 'glyph';
  return `cat-a-font-${compactGlyph}-256.gif`;
}

function captureGifFrames(
  host: HTMLDivElement,
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  frameCount: number,
  frameIntervalMs: number
) {
  return new Promise<Uint8ClampedArray[]>((resolve) => {
    const frames: Uint8ClampedArray[] = [];
    const startTime = performance.now();
    let frameHandle = 0;

    const capture = (now: number) => {
      while (
        frames.length < frameCount &&
        now >= startTime + frames.length * frameIntervalMs - 0.5
      ) {
        drawSpiritStageFrame(host, context, width, height, { backgroundColor: '#ffffff' });
        const imageData = context.getImageData(0, 0, width, height);
        frames.push(new Uint8ClampedArray(imageData.data));
      }

      if (frames.length >= frameCount) {
        resolve(frames);
        return;
      }

      frameHandle = window.requestAnimationFrame(capture);
    };

    frameHandle = window.requestAnimationFrame(capture);

    return () => window.cancelAnimationFrame(frameHandle);
  });
}

function encodeGif({
  width,
  height,
  frames,
  delayCs
}: {
  width: number;
  height: number;
  frames: Uint8ClampedArray[];
  delayCs: number;
}) {
  const encoder = GIFEncoder();

  for (const frame of frames) {
    const palette = quantize(frame, 256, { format: 'rgb565' });
    const indexed = applyPalette(frame, palette, 'rgb565');

    encoder.writeFrame(indexed, width, height, {
      palette,
      delay: delayCs * 10,
      repeat: 0
    });
  }

  encoder.finish();
  return new Blob([Uint8Array.from(encoder.bytesView())], { type: 'image/gif' });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const SpiritRive = memo(function SpiritRive({
  riveFile
}: {
  riveFile: RiveFile | null;
}) {
  const { RiveComponent } = useRive(
    riveFile
      ? {
          riveFile,
          stateMachines: 'CONTROL',
          autoplay: true
        }
      : null
  );

  if (!riveFile) {
    return <div className="spirit-canvas spirit-canvas--pending" />;
  }

  return <RiveComponent className="spirit-canvas" />;
});

const drawMeasureCanvas = document.createElement('canvas');
const drawMeasureContext = drawMeasureCanvas.getContext('2d');

function deriveReferenceStrokeWidth(
  viewport: { width: number; height: number },
  fontFamily: string,
  fontWeight: number,
  glyphFillRatio: number
) {
  const stageBase = Math.min(viewport.width, viewport.height);
  const fontSize = stageBase * glyphFillRatio;
  const fallback = Math.max(18, fontSize * 0.12);

  if (!drawMeasureContext) {
    return fallback * (13 / 28) * 0.64;
  }

  drawMeasureContext.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const measured = drawMeasureContext.measureText('I').width;
  const syntheticBold = Math.max(0, (fontWeight - 700) / 80);
  return Math.max(fallback, measured + syntheticBold * 2.4) * (13 / 28) * 0.64;
}

function buildStrokePathD(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return '';
  }

  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
}

function interpolatePoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
  t: number
) {
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t)
  };
}
