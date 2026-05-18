export type BlobLayoutTuning = {
  bodyRest: number;
  bodyMax: number;
  faceRest: number;
  faceMax: number;
  feetRest: number;
  feetMax: number;
  tailRootRest: number;
  tailRootMax: number;
  tailBaseRest: number;
  tailBaseMax: number;
  tailBaseSideRest: number;
  tailBaseSideMax: number;
  tailMidRest: number;
  tailMidMax: number;
  tailMidSideRest: number;
  tailMidSideMax: number;
  tailTipRest: number;
  tailTipMax: number;
  tailTipSideRest: number;
  tailTipSideMax: number;
};

export const DEFAULT_BLOB_LAYOUT: BlobLayoutTuning = {
  bodyRest: 0.35,
  bodyMax: 0.68,
  faceRest: -0.33,
  faceMax: -0.23,
  feetRest: 0.37,
  feetMax: 0.53,
  tailRootRest: 0.12,
  tailRootMax: 0.06,
  tailBaseRest: 0.27,
  tailBaseMax: 0.4,
  tailBaseSideRest: 0,
  tailBaseSideMax: 0,
  tailMidRest: 0.4,
  tailMidMax: 0.57,
  tailMidSideRest: -0.01,
  tailMidSideMax: -0.01,
  tailTipRest: 0.56,
  tailTipMax: 0.74,
  tailTipSideRest: 0.01,
  tailTipSideMax: 0.01
};

export type ParticleSystemOptions = {
  glyph: string;
  fontFamily: string;
  fontData?: any | null;
  density: number;
  speed: number;
  softness: number;
  catScale?: number;
  blobLayout?: BlobLayoutTuning;
  showGuides?: boolean;
  width: number;
  height: number;
};

export type Particle = {
  guidePoints: Array<{
    x: number;
    y: number;
  }>;
  guideLengths: number[];
  guideTotalLength: number;
  pathCursor: number;
  pathSpeed: number;
  size: number;
  direction: 1 | -1;
  lanePhase: number;
  laneAmplitude: number;
  driftPhase: number;
  depthBase: number;
  depthPhase: number;
  hopPhase: number;
  hopStride: number;
  depthRange: number;
  motionStretch: number;
  depthCurrent: number;
  previousDepthCurrent: number;
  displayX: number;
  displayY: number;
  axisX: number;
  axisY: number;
  tailOrbX: number;
  tailOrbY: number;
  tailX: number;
  tailY: number;
};
