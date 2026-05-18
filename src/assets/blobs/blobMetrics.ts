export type BlobMetricKey =
  | 'head'
  | 'body'
  | 'face'
  | 'feet'
  | 'tailBase'
  | 'tailMid'
  | 'tailTip';

export type BlobMetric = {
  width: number;
  height: number;
};

export const BLOB_METRICS: Record<BlobMetricKey, BlobMetric> = {
  head: { width: 335, height: 287 },
  body: { width: 192, height: 184 },
  face: { width: 384, height: 372 },
  feet: { width: 176, height: 124 },
  tailBase: { width: 66, height: 101 },
  tailMid: { width: 59, height: 88 },
  tailTip: { width: 74, height: 108 }
};

export const HEAD_REFERENCE_SIZE = 512;

export function blobUnitScale(headScale: number) {
  return (HEAD_REFERENCE_SIZE / BLOB_METRICS.head.height) * headScale;
}

export function blobDisplaySize(metricKey: BlobMetricKey, headScale: number) {
  const metric = BLOB_METRICS[metricKey];
  const unit = blobUnitScale(headScale);

  return {
    width: metric.width * unit,
    height: metric.height * unit
  };
}
