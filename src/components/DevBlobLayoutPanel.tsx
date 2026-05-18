import { useEffect, useRef, useState } from 'react';
import type { BlobLayoutTuning } from '../particles/types';
import { blobDisplaySize } from '../assets/blobs/blobMetrics';
import { sampleBlobPoseOffsets } from '../particles/blobPose';
import headBlobUrl from '../assets/blobs/head_blob.svg';
import bodyBlobUrl from '../assets/blobs/body_blob.svg';
import tailBaseBlobUrl from '../assets/blobs/tail-base_blob.svg';
import tailMidBlobUrl from '../assets/blobs/tail-mid_blob.svg';
import tailTipBlobUrl from '../assets/blobs/tail-tip_blob.svg';
import faceBlobUrl from '../assets/blobs/face_blob.svg';
import footBlobUrl from '../assets/blobs/foot_blob.svg';

type DevBlobLayoutPanelProps = {
  layout: BlobLayoutTuning;
  onChange: (next: BlobLayoutTuning) => void;
  onReset: () => void;
};

const GROUPS: Array<{
  title: string;
  restKey: keyof BlobLayoutTuning;
  maxKey: keyof BlobLayoutTuning;
  sideRestKey?: keyof BlobLayoutTuning;
  sideMaxKey?: keyof BlobLayoutTuning;
  min?: number;
  max?: number;
}> = [
  { title: 'Body', restKey: 'bodyRest', maxKey: 'bodyMax' },
  { title: 'Face', restKey: 'faceRest', maxKey: 'faceMax', min: -0.75, max: 1.3 },
  { title: 'Feet', restKey: 'feetRest', maxKey: 'feetMax' },
  { title: 'Tail Root', restKey: 'tailRootRest', maxKey: 'tailRootMax' },
  {
    title: 'Tail Base',
    restKey: 'tailBaseRest',
    maxKey: 'tailBaseMax',
    sideRestKey: 'tailBaseSideRest',
    sideMaxKey: 'tailBaseSideMax'
  },
  {
    title: 'Tail Mid',
    restKey: 'tailMidRest',
    maxKey: 'tailMidMax',
    sideRestKey: 'tailMidSideRest',
    sideMaxKey: 'tailMidSideMax'
  },
  {
    title: 'Tail Tip',
    restKey: 'tailTipRest',
    maxKey: 'tailTipMax',
    sideRestKey: 'tailTipSideRest',
    sideMaxKey: 'tailTipSideMax'
  }
];

export function DevBlobLayoutPanel({
  layout,
  onChange,
  onReset
}: DevBlobLayoutPanelProps) {
  const layoutJson = JSON.stringify(layout, null, 2);
  const floatingRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [floatingPosition, setFloatingPosition] = useState({ left: 24, top: 96 });

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!dragRef.current) {
        return;
      }

      const element = floatingRef.current;
      const panelWidth = element?.offsetWidth ?? 360;
      const panelHeight = element?.offsetHeight ?? 720;
      const nextLeft = clampToRange(
        event.clientX - dragRef.current.offsetX,
        12,
        Math.max(12, window.innerWidth - panelWidth - 12)
      );
      const nextTop = clampToRange(
        event.clientY - dragRef.current.offsetY,
        12,
        Math.max(12, window.innerHeight - panelHeight - 12)
      );

      setFloatingPosition({ left: nextLeft, top: nextTop });
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
        return;
      }

      dragRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, []);

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = floatingRef.current?.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - (rect?.left ?? 0),
      offsetY: event.clientY - (rect?.top ?? 0)
    };
  };

  return (
    <>
      <div
        ref={floatingRef}
        className="dev-layout-floating"
        aria-label="Blob preview panel"
        style={{
          left: `${floatingPosition.left}px`,
          top: `${floatingPosition.top}px`
        }}
      >
        <div className="dev-layout-floating-header" onPointerDown={handleDragStart}>
          <span>Blob Preview</span>
          <span className="dev-layout-drag-hint">Drag</span>
        </div>
        <BlobPosePreview title="Rest" layout={layout} pose="rest" />
        <BlobPosePreview title="Max" layout={layout} pose="max" />
      </div>
      <details className="dev-layout-panel" open>
        <summary>Blob Layout (Dev)</summary>
        <p className="dev-layout-copy">
          Tune the rest position and max position for each blob along the body
          axis. Use the floating preview cards to compare static rest and max
          poses while you adjust values.
        </p>
      <div className="dev-layout-grid">
        {GROUPS.map((group) => (
          <BlobLayoutGroup
            key={group.title}
            group={group}
            layout={layout}
            onChange={onChange}
          />
        ))}
      </div>
      <div className="dev-layout-actions">
        <button type="button" className="preset-chip" onClick={onReset}>
          Reset Layout
        </button>
      </div>
      <label className="field">
        <span>Current JSON</span>
        <textarea className="dev-layout-json" value={layoutJson} readOnly />
      </label>
      </details>
    </>
  );
}

type BlobLayoutGroupProps = {
  group: (typeof GROUPS)[number];
  layout: BlobLayoutTuning;
  onChange: (next: BlobLayoutTuning) => void;
};

function BlobLayoutGroup({ group, layout, onChange }: BlobLayoutGroupProps) {
  const sideRestKey = group.sideRestKey;
  const sideMaxKey = group.sideMaxKey;

  return (
    <div className="dev-layout-group">
      <p>{group.title}</p>
      <MiniSlider
        label="Rest"
        value={layout[group.restKey]}
        min={group.min}
        max={group.max}
        onChange={(value) =>
          onChange({
            ...layout,
            [group.restKey]: value
          })
        }
      />
      <MiniSlider
        label="Max"
        value={layout[group.maxKey]}
        min={group.min}
        max={group.max}
        onChange={(value) =>
          onChange({
            ...layout,
            [group.maxKey]: value
          })
        }
      />
      {sideRestKey && sideMaxKey ? (
        <>
          <MiniSlider
            label="Side Rest"
            value={layout[sideRestKey]}
            min={-0.8}
            max={0.8}
            onChange={(value) =>
              onChange({
                ...layout,
                [sideRestKey]: value
              })
            }
          />
          <MiniSlider
            label="Side Max"
            value={layout[sideMaxKey]}
            min={-0.8}
            max={0.8}
            onChange={(value) =>
              onChange({
                ...layout,
                [sideMaxKey]: value
              })
            }
          />
        </>
      ) : null}
    </div>
  );
}

function clampToRange(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type BlobPosePreviewProps = {
  title: string;
  layout: BlobLayoutTuning;
  pose: 'rest' | 'max';
};

function BlobPosePreview({ title, layout, pose }: BlobPosePreviewProps) {
  const centerX = 128;
  const centerY = 212;
  const headScale = 0.24;
  const headSize = blobDisplaySize('head', headScale);
  const bodySize = blobDisplaySize('body', headScale);
  const faceSize = blobDisplaySize('face', headScale);
  const feetSize = blobDisplaySize('feet', headScale);
  const tailBaseSize = blobDisplaySize('tailBase', headScale);
  const tailMidSize = blobDisplaySize('tailMid', headScale);
  const tailTipSize = blobDisplaySize('tailTip', headScale);

  const postureBlend = pose === 'rest' ? 0 : 1;
  const poseOffsets = sampleBlobPoseOffsets(
    layout,
    postureBlend,
    headSize.height,
    bodySize.height
  );
  const bodyY = centerY - poseOffsets.bodyDistance;
  const faceY = centerY + poseOffsets.faceLead;
  const feetY = centerY + poseOffsets.feetLead;
  const tailRootY = bodyY - poseOffsets.tailRootDistance;
  const tailBaseY = tailRootY - poseOffsets.tailBaseDistance;
  const tailMidY = tailRootY - poseOffsets.tailMidDistance;
  const tailTipY = tailRootY - poseOffsets.tailTipDistance;
  const tailBaseX = centerX + poseOffsets.tailBaseSide;
  const tailMidX = centerX + poseOffsets.tailMidSide;
  const tailTipX = centerX + poseOffsets.tailTipSide;

  return (
    <div className="dev-pose-card">
      <p>{title}</p>
      <div className="dev-pose-stage">
        <img className="dev-blob dev-tail-tip" src={tailTipBlobUrl} style={spriteStyle(tailTipX, tailTipY, tailTipSize.width, tailTipSize.height)} />
        <img className="dev-blob dev-tail-mid" src={tailMidBlobUrl} style={spriteStyle(tailMidX, tailMidY, tailMidSize.width, tailMidSize.height)} />
        <img className="dev-blob dev-tail-base" src={tailBaseBlobUrl} style={spriteStyle(tailBaseX, tailBaseY, tailBaseSize.width, tailBaseSize.height)} />
        <img className="dev-blob dev-feet" src={footBlobUrl} style={spriteStyle(centerX, feetY, feetSize.width, feetSize.height)} />
        <img className="dev-blob dev-body" src={bodyBlobUrl} style={spriteStyle(centerX, bodyY, bodySize.width, bodySize.height)} />
        <img className="dev-blob dev-head" src={headBlobUrl} style={spriteStyle(centerX, centerY, headSize.width, headSize.height)} />
        <img className="dev-blob dev-face" src={faceBlobUrl} style={spriteStyle(centerX, faceY, faceSize.width, faceSize.height)} />
      </div>
    </div>
  );
}

function spriteStyle(x: number, y: number, width: number, height: number) {
  return {
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`,
    transform: 'translate(-50%, -50%)'
  } as const;
}

type MiniSliderProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
};

function MiniSlider({ label, value, min = -0.2, max = 1.3, onChange }: MiniSliderProps) {
  return (
    <label className="field dev-layout-slider">
      <span>{label}</span>
      <div className="range-row">
        <input
          className="range-input"
          type="range"
          min={min}
          max={max}
          step={0.01}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <output>{value.toFixed(2)}</output>
      </div>
    </label>
  );
}
