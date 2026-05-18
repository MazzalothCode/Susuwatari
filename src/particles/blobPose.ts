import type { BlobLayoutTuning } from './types';

export type BlobPoseOffsets = {
  bodyDistance: number;
  faceLead: number;
  feetLead: number;
  tailRootDistance: number;
  tailBaseDistance: number;
  tailBaseSide: number;
  tailMidDistance: number;
  tailMidSide: number;
  tailTipDistance: number;
  tailTipSide: number;
};

export function sampleBlobPoseOffsets(
  layout: BlobLayoutTuning,
  postureBlend: number,
  headExtent: number,
  bodyExtent: number
): BlobPoseOffsets {
  return {
    bodyDistance: headExtent * lerp(layout.bodyRest, layout.bodyMax, postureBlend),
    faceLead: headExtent * lerp(layout.faceRest, layout.faceMax, postureBlend),
    feetLead: headExtent * lerp(layout.feetRest, layout.feetMax, postureBlend),
    tailRootDistance: bodyExtent * lerp(layout.tailRootRest, layout.tailRootMax, postureBlend),
    tailBaseDistance: headExtent * lerp(layout.tailBaseRest, layout.tailBaseMax, postureBlend),
    tailBaseSide: headExtent * lerp(layout.tailBaseSideRest, layout.tailBaseSideMax, postureBlend),
    tailMidDistance: headExtent * lerp(layout.tailMidRest, layout.tailMidMax, postureBlend),
    tailMidSide: headExtent * lerp(layout.tailMidSideRest, layout.tailMidSideMax, postureBlend),
    tailTipDistance: headExtent * lerp(layout.tailTipRest, layout.tailTipMax, postureBlend),
    tailTipSide: headExtent * lerp(layout.tailTipSideRest, layout.tailTipSideMax, postureBlend)
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
