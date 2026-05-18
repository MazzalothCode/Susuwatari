import {
  Alignment,
  Fit,
  Layout,
  useRive,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceBoolean,
  useViewModelInstanceNumber
} from '@rive-app/react-canvas';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import littleSpiritUiUrl from '../assets/rive/little_spirit_ui.riv';

type LittleSpiritUiOverlayProps = {
  glyph: string;
  drawMode: boolean;
  hasCustomPath: boolean;
  brushDrawingActive: boolean;
  density: number;
  speed: number;
  catScale: number;
  showAnchorDebug: boolean;
  onGlyphSelect: (glyph: string) => void;
  onDrawModeChange: (enabled: boolean) => void;
  onDensityChange: (value: number) => void;
  onSpeedChange: (value: number) => void;
  onSizeChange: (value: number) => void;
  onSetAnchorDebug: (enabled: boolean) => void;
  onDelete: () => void;
  onExportVideo: () => void | Promise<void>;
  onExportGif: () => void | Promise<void>;
};

const DENSITY_RANGE = { min: 30, max: 90 };
const SPEED_RANGE = { min: 0.4, max: 1.6 };
const SIZE_RANGE = { min: 0.15, max: 0.45 };
const EPSILON = 0.0001;
const POINTER_HOTSPOTS = [
  { left: 0.09, right: 0.42, top: 0.8, bottom: 0.93 },
  { left: 0.52, right: 0.74, top: 0.8, bottom: 0.92 },
  { left: 0.74, right: 0.93, top: 0.74, bottom: 0.95 },
  { left: 0.94, right: 0.995, top: 0.045, bottom: 0.13 }
] as const;

function LittleSpiritUiOverlayInner({
  glyph,
  drawMode,
  hasCustomPath,
  brushDrawingActive,
  density,
  speed,
  catScale,
  showAnchorDebug,
  onGlyphSelect,
  onDrawModeChange,
  onDensityChange,
  onSpeedChange,
  onSizeChange,
  onSetAnchorDebug,
  onDelete,
  onExportVideo,
  onExportGif
}: LittleSpiritUiOverlayProps) {
  const { rive, RiveComponent } = useRive({
    src: littleSpiritUiUrl,
    artboard: 'Page',
    stateMachines: 'Page State Machine',
    autoplay: true,
    automaticallyHandleEvents: true,
    layout: new Layout({
      fit: Fit.Layout,
      alignment: Alignment.Center
    })
  });

  const pageViewModel = useViewModel(rive, { name: 'Page' });
  const pageViewModelInstance = useViewModelInstance(pageViewModel, {
    useDefault: true,
    rive
  });

  const selectedKeyBinding = useViewModelInstanceNumber('selectedKey', pageViewModelInstance);
  const penModeBinding = useViewModelInstanceBoolean('penMode', pageViewModelInstance);
  const showAnchorBinding = useViewModelInstanceBoolean('showAnchorDebug', pageViewModelInstance);
  const deleteRequestTrigger = useMemo(
    () => pageViewModelInstance?.trigger('deleteRequest') ?? null,
    [pageViewModelInstance]
  );
  const exportVideoTrigger = useMemo(
    () => pageViewModelInstance?.trigger('exportVideoRequest') ?? null,
    [pageViewModelInstance]
  );
  const exportGifTrigger = useMemo(
    () => pageViewModelInstance?.trigger('exportGifRequest') ?? null,
    [pageViewModelInstance]
  );
  const densityBinding = useViewModelInstanceNumber(
    'SliderDensity/SliderValue',
    pageViewModelInstance
  );
  const speedBinding = useViewModelInstanceNumber('SliderSpeed/SliderValue', pageViewModelInstance);
  const sizeBinding = useViewModelInstanceNumber('SliderSize/SliderValue', pageViewModelInstance);
  const brushXBinding = useViewModelInstanceNumber('brushX', pageViewModelInstance);
  const brushYBinding = useViewModelInstanceNumber('brushY', pageViewModelInstance);
  const brushOpacityBinding = useViewModelInstanceNumber('brushOpacity', pageViewModelInstance);
  const brushDrawingBinding = useViewModelInstanceBoolean('Brush/Drawing', pageViewModelInstance);

  const desiredSelectedKey = useMemo(
    () => encodeSelectedKey(glyph, hasCustomPath, drawMode),
    [drawMode, glyph, hasCustomPath]
  );
  const desiredDensity = useMemo(
    () => normalizeRangeValue(density, DENSITY_RANGE.min, DENSITY_RANGE.max),
    [density]
  );
  const desiredSpeed = useMemo(
    () => normalizeRangeValue(speed, SPEED_RANGE.min, SPEED_RANGE.max),
    [speed]
  );
  const desiredSize = useMemo(
    () => normalizeRangeValue(catScale, SIZE_RANGE.min, SIZE_RANGE.max),
    [catScale]
  );
  const didHydrateRef = useRef(false);
  const lastShowAnchorRequestRef = useRef(false);
  const lastDesiredSelectedKeyRef = useRef<number | null>(null);
  const lastDesiredPenModeRef = useRef<boolean | null>(null);
  const lastDesiredDensityRef = useRef<number | null>(null);
  const lastDesiredSpeedRef = useRef<number | null>(null);
  const lastDesiredSizeRef = useRef<number | null>(null);
  const selectedKeyEchoRef = useRef<number | null>(null);
  const prevSelectedKeyValueRef = useRef<number | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const brushXValueRef = useRef<number | null>(null);
  const brushYValueRef = useRef<number | null>(null);
  const brushDrawingValueRef = useRef<boolean | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    brushXValueRef.current = brushXBinding.value;
  }, [brushXBinding.value]);

  useEffect(() => {
    brushYValueRef.current = brushYBinding.value;
  }, [brushYBinding.value]);

  useEffect(() => {
    brushDrawingValueRef.current = brushDrawingBinding.value;
  }, [brushDrawingBinding.value]);

  useEffect(() => {
    if (!pageViewModelInstance) {
      didHydrateRef.current = false;
      setIsHydrated(false);
      return;
    }

    const canHydrate =
      selectedKeyBinding.value !== null &&
      penModeBinding.value !== null &&
      showAnchorBinding.value !== null &&
      densityBinding.value !== null &&
      speedBinding.value !== null &&
      sizeBinding.value !== null &&
      brushOpacityBinding.value !== null &&
      brushDrawingBinding.value !== null;

    if (!canHydrate) {
      return;
    }

    if (!didHydrateRef.current) {
      syncNumberBinding(selectedKeyBinding.value, desiredSelectedKey, selectedKeyBinding.setValue);
      selectedKeyEchoRef.current = desiredSelectedKey;
      prevSelectedKeyValueRef.current = desiredSelectedKey;
      syncBooleanBinding(penModeBinding.value, drawMode, penModeBinding.setValue);
      syncNumberBinding(densityBinding.value, desiredDensity, densityBinding.setValue);
      syncNumberBinding(speedBinding.value, desiredSpeed, speedBinding.setValue);
      syncNumberBinding(sizeBinding.value, desiredSize, sizeBinding.setValue);
      syncNumberBinding(brushOpacityBinding.value, drawMode ? 100 : 0, brushOpacityBinding.setValue);
      syncBooleanBinding(
        brushDrawingBinding.value,
        drawMode ? brushDrawingActive : false,
        brushDrawingBinding.setValue
      );
      brushDrawingValueRef.current = drawMode ? brushDrawingActive : false;
      lastDesiredSelectedKeyRef.current = desiredSelectedKey;
      lastDesiredPenModeRef.current = drawMode;
      lastDesiredDensityRef.current = desiredDensity;
      lastDesiredSpeedRef.current = desiredSpeed;
      lastDesiredSizeRef.current = desiredSize;
      didHydrateRef.current = true;
      setIsHydrated(true);
      return;
    }

    if (lastDesiredSelectedKeyRef.current !== desiredSelectedKey) {
      syncNumberBinding(selectedKeyBinding.value, desiredSelectedKey, selectedKeyBinding.setValue);
      selectedKeyEchoRef.current = desiredSelectedKey;
      lastDesiredSelectedKeyRef.current = desiredSelectedKey;
    }

    if (lastDesiredPenModeRef.current !== drawMode) {
      syncBooleanBinding(penModeBinding.value, drawMode, penModeBinding.setValue);
      lastDesiredPenModeRef.current = drawMode;
    }

    if (lastDesiredDensityRef.current === null || Math.abs(lastDesiredDensityRef.current - desiredDensity) > EPSILON) {
      syncNumberBinding(densityBinding.value, desiredDensity, densityBinding.setValue);
      lastDesiredDensityRef.current = desiredDensity;
    }

    if (lastDesiredSpeedRef.current === null || Math.abs(lastDesiredSpeedRef.current - desiredSpeed) > EPSILON) {
      syncNumberBinding(speedBinding.value, desiredSpeed, speedBinding.setValue);
      lastDesiredSpeedRef.current = desiredSpeed;
    }

    if (lastDesiredSizeRef.current === null || Math.abs(lastDesiredSizeRef.current - desiredSize) > EPSILON) {
      syncNumberBinding(sizeBinding.value, desiredSize, sizeBinding.setValue);
      lastDesiredSizeRef.current = desiredSize;
    }

    syncNumberBinding(
      brushOpacityBinding.value,
      drawMode ? 100 : 0,
      brushOpacityBinding.setValue
    );
  }, [
    brushDrawingActive,
    brushDrawingBinding.setValue,
    brushDrawingBinding.value,
    brushOpacityBinding,
    brushOpacityBinding.value,
    densityBinding.value,
    desiredDensity,
    desiredSelectedKey,
    desiredSize,
    desiredSpeed,
    drawMode,
    pageViewModelInstance,
    penModeBinding.setValue,
    penModeBinding.value,
    selectedKeyBinding.setValue,
    selectedKeyBinding.value,
    sizeBinding.value,
    speedBinding.value
  ]);

  useEffect(() => {
    if (
      !didHydrateRef.current ||
      selectedKeyBinding.value === null
    ) {
      return;
    }

    if (
      selectedKeyEchoRef.current !== null &&
      selectedKeyBinding.value === selectedKeyEchoRef.current
    ) {
      selectedKeyEchoRef.current = null;
      prevSelectedKeyValueRef.current = selectedKeyBinding.value;
      return;
    }

    if (prevSelectedKeyValueRef.current === selectedKeyBinding.value) {
      return;
    }

    prevSelectedKeyValueRef.current = selectedKeyBinding.value;

    if (drawMode) {
      if (selectedKeyBinding.value !== -1) {
        selectedKeyBinding.setValue(-1);
      }
      return;
    }

    const nextGlyph = decodeSelectedKey(selectedKeyBinding.value);
    if (nextGlyph && nextGlyph !== glyph) {
      if (penModeBinding.value) {
        penModeBinding.setValue(false);
      }
      onGlyphSelect(nextGlyph);
      return;
    }

    if (selectedKeyBinding.value === -1 && (glyph !== '' || drawMode || hasCustomPath)) {
      penModeBinding.setValue(false);
      onDelete();
    }
  }, [
    drawMode,
    glyph,
    hasCustomPath,
    onDelete,
    onGlyphSelect,
    penModeBinding,
    penModeBinding.value,
    selectedKeyBinding.value
  ]);

  useEffect(() => {
    if (!didHydrateRef.current || penModeBinding.value === null) {
      return;
    }
    if (hasCustomPath) {
      if (penModeBinding.value) {
        penModeBinding.setValue(false);
      }
      return;
    }
    if (penModeBinding.value !== drawMode) {
      onDrawModeChange(penModeBinding.value);
    }
  }, [drawMode, hasCustomPath, onDrawModeChange, penModeBinding, penModeBinding.value]);

  useEffect(() => {
    if (!didHydrateRef.current || showAnchorBinding.value === null) {
      return;
    }
    if (drawMode) {
      if (showAnchorBinding.value) {
        showAnchorBinding.setValue(false);
      }
      return;
    }
    const wasRequested = lastShowAnchorRequestRef.current;
    lastShowAnchorRequestRef.current = showAnchorBinding.value;
    if (showAnchorBinding.value && !wasRequested) {
      onSetAnchorDebug(!showAnchorDebug);
      showAnchorBinding.setValue(false);
    }
  }, [onSetAnchorDebug, showAnchorBinding, showAnchorDebug]);

  useEffect(() => {
    if (!didHydrateRef.current || densityBinding.value === null) {
      return;
    }
    if (drawMode) {
      syncNumberBinding(densityBinding.value, desiredDensity, densityBinding.setValue);
      return;
    }
    const nextDensity = denormalizeRangeValue(
      densityBinding.value,
      DENSITY_RANGE.min,
      DENSITY_RANGE.max
    );
    if (Math.abs(nextDensity - density) > EPSILON) {
      onDensityChange(nextDensity);
    }
  }, [density, densityBinding.value, onDensityChange]);

  useEffect(() => {
    if (!didHydrateRef.current || speedBinding.value === null) {
      return;
    }
    if (drawMode) {
      syncNumberBinding(speedBinding.value, desiredSpeed, speedBinding.setValue);
      return;
    }
    const nextSpeed = denormalizeRangeValue(speedBinding.value, SPEED_RANGE.min, SPEED_RANGE.max);
    if (Math.abs(nextSpeed - speed) > EPSILON) {
      onSpeedChange(nextSpeed);
    }
  }, [onSpeedChange, speed, speedBinding.value]);

  useEffect(() => {
    if (!didHydrateRef.current || sizeBinding.value === null) {
      return;
    }
    if (drawMode) {
      syncNumberBinding(sizeBinding.value, desiredSize, sizeBinding.setValue);
      return;
    }
    const nextSize = denormalizeRangeValue(sizeBinding.value, SIZE_RANGE.min, SIZE_RANGE.max);
    if (Math.abs(nextSize - catScale) > EPSILON) {
      onSizeChange(nextSize);
    }
  }, [catScale, onSizeChange, sizeBinding.value]);

  useEffect(() => {
    if (!isHydrated || !deleteRequestTrigger) {
      return;
    }
    const handleDeleteRequest = () => {
      if (drawMode) {
        return;
      }
      selectedKeyBinding.setValue(-1);
      penModeBinding.setValue(false);
      onDelete();
    };
    deleteRequestTrigger.on(handleDeleteRequest);
    return () => deleteRequestTrigger.off(handleDeleteRequest);
  }, [deleteRequestTrigger, drawMode, isHydrated, onDelete, penModeBinding, selectedKeyBinding]);

  useEffect(() => {
    if (!isHydrated || !exportVideoTrigger) {
      return;
    }
    const handleExportVideo = () => {
      void onExportVideo();
    };
    exportVideoTrigger.on(handleExportVideo);
    return () => exportVideoTrigger.off(handleExportVideo);
  }, [exportVideoTrigger, isHydrated, onExportVideo]);

  useEffect(() => {
    if (!isHydrated || !exportGifTrigger) {
      return;
    }
    const handleExportGif = () => {
      void onExportGif();
    };
    exportGifTrigger.on(handleExportGif);
    return () => exportGifTrigger.off(handleExportGif);
  }, [exportGifTrigger, isHydrated, onExportGif]);

  useEffect(() => {
    if (
      !drawMode ||
      !didHydrateRef.current ||
      brushXBinding.value === null ||
      brushYBinding.value === null
    ) {
      if (typeof document !== 'undefined' && !drawMode) {
        document.body.style.cursor = '';
      }
      return;
    }

    document.body.style.cursor = 'none';

    const updateBrushPosition = (clientX: number, clientY: number) => {
      const bounds = overlayRef.current?.getBoundingClientRect();
      if (!bounds) {
        return;
      }

      const nextX = clamp(clientX - bounds.left, 0, bounds.width);
      const nextY = clamp(clientY - bounds.top, 0, bounds.height);

      if (brushXValueRef.current === null || Math.abs(brushXValueRef.current - nextX) > EPSILON) {
        brushXValueRef.current = nextX;
        brushXBinding.setValue(nextX);
      }

      if (brushYValueRef.current === null || Math.abs(brushYValueRef.current - nextY) > EPSILON) {
        brushYValueRef.current = nextY;
        brushYBinding.setValue(nextY);
      }
    };

    const handleMove = (event: PointerEvent) => {
      updateBrushPosition(event.clientX, event.clientY);
    };
    window.addEventListener('pointermove', handleMove);

    return () => {
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', handleMove);
    };
  }, [brushXBinding, brushYBinding, drawMode]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || drawMode) {
      if (overlay) {
        overlay.style.cursor = '';
      }
      return;
    }

    const updateCursor = (clientX: number, clientY: number) => {
      const bounds = overlay.getBoundingClientRect();
      if (bounds.width < 1 || bounds.height < 1) {
        overlay.style.cursor = '';
        return;
      }

      const x = clamp((clientX - bounds.left) / bounds.width, 0, 1);
      const y = clamp((clientY - bounds.top) / bounds.height, 0, 1);
      overlay.style.cursor = isPointInPointerHotspot(x, y) ? 'pointer' : '';
    };

    const handlePointerMove = (event: PointerEvent) => {
      updateCursor(event.clientX, event.clientY);
    };

    const handlePointerLeave = () => {
      overlay.style.cursor = '';
    };

    overlay.addEventListener('pointermove', handlePointerMove);
    overlay.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      overlay.style.cursor = '';
      overlay.removeEventListener('pointermove', handlePointerMove);
      overlay.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [drawMode]);

  useLayoutEffect(() => {
    if (!didHydrateRef.current) {
      return;
    }

    const nextValue = drawMode ? brushDrawingActive : false;
    if (brushDrawingValueRef.current !== nextValue) {
      brushDrawingValueRef.current = nextValue;
      brushDrawingBinding.setValue(nextValue);
    }
  }, [brushDrawingActive, brushDrawingBinding, drawMode]);

  return (
    <div
      ref={overlayRef}
      className={`ui-overlay-shell ${drawMode ? 'is-disabled' : ''}`}
      aria-label="Little spirit interface"
    >
      <RiveComponent className="ui-overlay-rive" />
    </div>
  );
}

export const LittleSpiritUiOverlay = memo(LittleSpiritUiOverlayInner);

function syncNumberBinding(
  currentValue: number | null,
  desiredValue: number,
  setValue: (value: number) => void
) {
  if (currentValue === null || Math.abs(currentValue - desiredValue) > EPSILON) {
    setValue(desiredValue);
  }
}

function syncBooleanBinding(
  currentValue: boolean | null,
  desiredValue: boolean,
  setValue: (value: boolean) => void
) {
  if (currentValue === null || currentValue !== desiredValue) {
    setValue(desiredValue);
  }
}

function normalizeRangeValue(value: number, min: number, max: number) {
  return clamp((value - min) / (max - min), 0, 1);
}

function denormalizeRangeValue(value: number, min: number, max: number) {
  return min + clamp(value, 0, 1) * (max - min);
}

function encodeSelectedKey(glyph: string, hasCustomPath: boolean, drawMode: boolean) {
  if (hasCustomPath || drawMode || glyph === '') {
    return -1;
  }

  if (/^[A-Z]$/.test(glyph)) {
    return glyph.charCodeAt(0) - 65;
  }

  if (/^[1-9]$/.test(glyph)) {
    return 25 + Number(glyph);
  }

  if (glyph === '0') {
    return 35;
  }

  return -1;
}

function decodeSelectedKey(value: number) {
  if (value >= 0 && value <= 25) {
    return String.fromCharCode(65 + value);
  }

  if (value >= 26 && value <= 34) {
    return String(value - 25);
  }

  if (value === 35) {
    return '0';
  }

  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isPointInPointerHotspot(x: number, y: number) {
  return POINTER_HOTSPOTS.some(
    (hotspot) =>
      x >= hotspot.left &&
      x <= hotspot.right &&
      y >= hotspot.top &&
      y <= hotspot.bottom
  );
}
