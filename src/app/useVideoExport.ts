import { useCallback, useMemo, useState } from 'react';

type ExportState =
  | { status: 'idle' }
  | { status: 'recording' }
  | { status: 'error'; message: string };

type UseVideoExportResult = {
  exportState: ExportState;
  canExport: boolean;
  exportVideo: () => Promise<void>;
};

type VideoExportOptions = {
  durationMs?: number;
  fps?: number;
  filename?: string;
};

const DEFAULT_RECORDING_DURATION_MS = 4000;
const DEFAULT_RECORDING_FPS = 30;
const DEFAULT_FILENAME = 'cat-a-font-export.webm';

export function useVideoExport(
  canvas: HTMLCanvasElement | null,
  options: VideoExportOptions = {}
): UseVideoExportResult {
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' });
  const durationMs = options.durationMs ?? DEFAULT_RECORDING_DURATION_MS;
  const fps = options.fps ?? DEFAULT_RECORDING_FPS;
  const filename = options.filename ?? DEFAULT_FILENAME;

  const canExport = useMemo(() => {
    return Boolean(
      canvas &&
        typeof canvas.captureStream === 'function' &&
        typeof MediaRecorder !== 'undefined'
    );
  }, [canvas]);

  const exportVideo = useCallback(async () => {
    if (!canvas) {
      const message = 'Canvas is not ready yet.';
      setExportState({ status: 'error', message });
      throw new Error(message);
    }

    if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
      const message = 'This browser does not support video export.';
      setExportState({
        status: 'error',
        message
      });
      throw new Error(message);
    }

    const stream = canvas.captureStream(fps);
    const mimeType = pickMimeType();

    if (!mimeType) {
      const message = 'No supported WebM encoder was found in this browser.';
      setExportState({
        status: 'error',
        message
      });
      throw new Error(message);
    }

    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 10_000_000
    });

    setExportState({ status: 'recording' });

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finalize = (callback: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        stream.getTracks().forEach((track) => track.stop());
        callback();
      };

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        const message = 'Recording failed before the video could be generated.';
        setExportState({
          status: 'error',
          message
        });
        finalize(() => reject(new Error(message)));
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });

        if (blob.size > 0) {
          downloadBlob(blob, filename);
          setExportState({ status: 'idle' });
          finalize(resolve);
        } else {
          const message = 'The video encoder returned an empty file.';
          setExportState({
            status: 'error',
            message
          });
          finalize(() => reject(new Error(message)));
        }
      };

      recorder.start();
      window.setTimeout(() => recorder.stop(), durationMs);
    });
  }, [canvas, durationMs, filename, fps]);

  return {
    exportState,
    canExport,
    exportVideo
  };
}

function pickMimeType() {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? null;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
