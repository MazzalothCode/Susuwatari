import { buildGlyphLayout } from './glyphLayout';

type GlyphFieldOptions = {
  glyph: string;
  fontFamily: string;
  fontData?: any | null;
  fontWeight?: number;
  width: number;
  height: number;
  fillRatio?: number;
  drawStroke?: {
    points: Array<{ x: number; y: number }>;
    strokeWidth: number;
  } | null;
};

type GridPoint = {
  x: number;
  y: number;
};

export type GlyphFieldSample = {
  inside: boolean;
  distance: number;
  normalX: number;
  normalY: number;
  tangentX: number;
  tangentY: number;
};

const scratchCanvas = document.createElement('canvas');
const scratchContext = scratchCanvas.getContext('2d', { willReadFrequently: true });

export class GlyphField {
  readonly width: number;
  readonly height: number;
  readonly glyph: string;
  readonly fontFamily: string;
  readonly fontData?: any | null;
  readonly fontWeight: number;
  readonly fillRatio: number;
  readonly drawStroke?: {
    points: Array<{ x: number; y: number }>;
    strokeWidth: number;
  } | null;

  private readonly columns: number;
  private readonly rows: number;
  private readonly cellSize: number;
  private readonly occupancy: Uint8Array;
  private readonly edgeIndices: Uint16Array;
  private readonly distanceField: Float32Array;
  private readonly normalField: Float32Array;
  private readonly insideCells: GridPoint[];
  private readonly endpointHints: GridPoint[];
  private minOccupiedX = Number.POSITIVE_INFINITY;
  private minOccupiedY = Number.POSITIVE_INFINITY;
  private maxOccupiedX = Number.NEGATIVE_INFINITY;
  private maxOccupiedY = Number.NEGATIVE_INFINITY;
  private occupiedSumX = 0;
  private occupiedSumY = 0;

  constructor({
    glyph,
    fontFamily,
    fontData,
    fontWeight = 700,
    width,
    height,
    fillRatio = 0.37,
    drawStroke = null
  }: GlyphFieldOptions) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.glyph = normalizeGlyphText(glyph);
    this.fontFamily = fontFamily;
    this.fontData = fontData;
    this.fontWeight = fontWeight;
    this.fillRatio = fillRatio;
    this.drawStroke = drawStroke;

    this.cellSize = Math.max(3, Math.round(Math.min(this.width, this.height) / 140));
    this.columns = Math.max(24, Math.floor(this.width / this.cellSize));
    this.rows = Math.max(24, Math.floor(this.height / this.cellSize));

    const total = this.columns * this.rows;
    this.occupancy = new Uint8Array(total);
    this.distanceField = new Float32Array(total);
    this.normalField = new Float32Array(total * 2);
    this.insideCells = [];
    this.endpointHints = [];

    this.rasterizeGlyph();
    this.endpointHints = this.extractEndpointHints();
    const edgeList = this.collectEdgeCells();
    this.edgeIndices = Uint16Array.from(edgeList);
    this.buildDistanceField(edgeList);
  }

  sampleWorldPoint() {
    if (this.insideCells.length === 0) {
      return {
        x: this.width * 0.5,
        y: this.height * 0.5,
        distance: 0
      };
    }

    const cell = this.insideCells[Math.floor(Math.random() * this.insideCells.length)];
    const jitter = this.cellSize * 0.9;
    const x = (cell.x + 0.5) * this.cellSize + (Math.random() - 0.5) * jitter;
    const y = (cell.y + 0.5) * this.cellSize + (Math.random() - 0.5) * jitter;
    const sample = this.sample(x, y);

    return {
      x,
      y,
      distance: sample.distance
    };
  }

  sample(worldX: number, worldY: number): GlyphFieldSample {
    const fx = clamp(worldX / this.cellSize - 0.5, 0, this.columns - 1);
    const fy = clamp(worldY / this.cellSize - 0.5, 0, this.rows - 1);
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(this.columns - 1, x0 + 1);
    const y1 = Math.min(this.rows - 1, y0 + 1);
    const tx = fx - x0;
    const ty = fy - y0;

    const s00 = this.readCell(x0, y0);
    const s10 = this.readCell(x1, y0);
    const s01 = this.readCell(x0, y1);
    const s11 = this.readCell(x1, y1);

    const distance = bilerp(s00.distance, s10.distance, s01.distance, s11.distance, tx, ty);
    const insideWeight = bilerp(
      s00.inside ? 1 : 0,
      s10.inside ? 1 : 0,
      s01.inside ? 1 : 0,
      s11.inside ? 1 : 0,
      tx,
      ty
    );
    const normalX = bilerp(s00.normalX, s10.normalX, s01.normalX, s11.normalX, tx, ty);
    const normalY = bilerp(s00.normalY, s10.normalY, s01.normalY, s11.normalY, tx, ty);
    const magnitude = Math.hypot(normalX, normalY) || 1;

    return {
      inside: insideWeight >= 0.5,
      distance,
      normalX: normalX / magnitude,
      normalY: normalY / magnitude,
      tangentX: -(normalY / magnitude),
      tangentY: normalX / magnitude
    };
  }

  getCenter() {
    if (this.insideCells.length === 0) {
      return {
        x: this.width * 0.5,
        y: this.height * 0.5
      };
    }

    return {
      x: ((this.occupiedSumX / this.insideCells.length) + 0.5) * this.cellSize,
      y: ((this.occupiedSumY / this.insideCells.length) + 0.5) * this.cellSize
    };
  }

  getBounds() {
    if (this.insideCells.length === 0) {
      return {
        minX: this.width * 0.25,
        minY: this.height * 0.25,
        maxX: this.width * 0.75,
        maxY: this.height * 0.75
      };
    }

    return {
      minX: this.minOccupiedX * this.cellSize,
      minY: this.minOccupiedY * this.cellSize,
      maxX: (this.maxOccupiedX + 1) * this.cellSize,
      maxY: (this.maxOccupiedY + 1) * this.cellSize
    };
  }

  getInsideAreaEstimate() {
    return this.insideCells.length * this.cellSize * this.cellSize;
  }

  getEndpointHints() {
    return this.endpointHints.map((cell) => ({
      x: (cell.x + 0.5) * this.cellSize,
      y: (cell.y + 0.5) * this.cellSize
    }));
  }

  private readCell(x: number, y: number) {
    const index = this.toIndex(x, y);
    const normalIndex = index * 2;

    return {
      inside: this.occupancy[index] === 1,
      distance: this.distanceField[index],
      normalX: this.normalField[normalIndex],
      normalY: this.normalField[normalIndex + 1]
    };
  }

  private rasterizeGlyph() {
    if (!scratchContext) {
      return;
    }

    scratchCanvas.width = this.columns;
    scratchCanvas.height = this.rows;
    scratchContext.clearRect(0, 0, this.columns, this.rows);
    scratchContext.fillStyle = '#000';

    if (this.drawStroke && this.drawStroke.points.length > 1) {
      this.rasterizeDrawStroke(
        scratchContext,
        this.drawStroke.points,
        this.drawStroke.strokeWidth
      );
    } else {
      const layout = buildGlyphLayout({
        glyph: this.glyph,
        fontFamily: this.fontFamily,
        fontData: this.fontData,
        fontWeight: this.fontWeight,
        width: this.columns,
        height: this.rows,
        fillRatio: this.fillRatio
      });

      if (layout.pathCommands) {
        this.rasterizePathCommands(scratchContext, layout.pathCommands);
      } else {
        scratchContext.textAlign = 'center';
        scratchContext.textBaseline = 'middle';
        scratchContext.font = `${this.fontWeight} ${layout.fontSize}px ${this.fontFamily}`;
        scratchContext.fillText(layout.glyph, layout.textX, layout.textY);

        const syntheticBold = Math.max(0, (this.fontWeight - 700) / 80);
        if (syntheticBold > 0) {
          scratchContext.lineJoin = 'round';
          scratchContext.lineCap = 'round';
          scratchContext.lineWidth = syntheticBold;
          scratchContext.strokeStyle = '#000';
          scratchContext.strokeText(layout.glyph, layout.textX, layout.textY);
        }
      }
    }

    const image = scratchContext.getImageData(0, 0, this.columns, this.rows);

    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.columns; x += 1) {
        const index = this.toIndex(x, y);
        const alpha = image.data[index * 4 + 3];

        if (alpha > 40) {
          this.occupancy[index] = 1;
          this.insideCells.push({ x, y });
          this.minOccupiedX = Math.min(this.minOccupiedX, x);
          this.minOccupiedY = Math.min(this.minOccupiedY, y);
          this.maxOccupiedX = Math.max(this.maxOccupiedX, x);
          this.maxOccupiedY = Math.max(this.maxOccupiedY, y);
          this.occupiedSumX += x;
          this.occupiedSumY += y;
        }
      }
    }
  }

  private rasterizePathCommands(context: CanvasRenderingContext2D, commands: any[]) {
    context.beginPath();

    for (const command of commands) {
      switch (command.type) {
        case 'M':
          context.moveTo(command.x, command.y);
          break;
        case 'L':
          context.lineTo(command.x, command.y);
          break;
        case 'Q':
          context.quadraticCurveTo(command.x1, command.y1, command.x, command.y);
          break;
        case 'C':
          context.bezierCurveTo(
            command.x1,
            command.y1,
            command.x2,
            command.y2,
            command.x,
            command.y
          );
          break;
        case 'Z':
          context.closePath();
          break;
      }
    }

    context.fill();
  }

  private rasterizeDrawStroke(
    context: CanvasRenderingContext2D,
    points: Array<{ x: number; y: number }>,
    strokeWidth: number
  ) {
    if (points.length < 2) {
      return;
    }

    context.beginPath();
    context.moveTo(points[0].x / this.cellSize, points[0].y / this.cellSize);

    for (let index = 1; index < points.length; index += 1) {
      const point = points[index];
      context.lineTo(point.x / this.cellSize, point.y / this.cellSize);
    }

    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.lineWidth = Math.max(1, strokeWidth / this.cellSize);
    context.strokeStyle = '#000';
    context.stroke();
  }

  private extractEndpointHints() {
    const skeleton = this.occupancy.slice();
    const width = this.columns;
    const height = this.rows;

    const get = (x: number, y: number) => skeleton[this.toIndex(x, y)];
    const set = (x: number, y: number, value: number) => {
      skeleton[this.toIndex(x, y)] = value;
    };

    const neighbors = (x: number, y: number) => [
      get(x, y - 1),
      get(x + 1, y - 1),
      get(x + 1, y),
      get(x + 1, y + 1),
      get(x, y + 1),
      get(x - 1, y + 1),
      get(x - 1, y),
      get(x - 1, y - 1)
    ];

    const transitions = (points: number[]) => {
      let count = 0;
      for (let index = 0; index < points.length; index += 1) {
        const current = points[index];
        const next = points[(index + 1) % points.length];
        if (current === 0 && next === 1) {
          count += 1;
        }
      }
      return count;
    };

    let changed = true;
    while (changed) {
      changed = false;
      const toClear: Array<{ x: number; y: number }> = [];

      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          if (!get(x, y)) {
            continue;
          }

          const points = neighbors(x, y);
          const sum = points.reduce((acc, value) => acc + value, 0);
          if (sum < 2 || sum > 6) {
            continue;
          }
          if (transitions(points) !== 1) {
            continue;
          }
          if (points[0] * points[2] * points[4] !== 0) {
            continue;
          }
          if (points[2] * points[4] * points[6] !== 0) {
            continue;
          }

          toClear.push({ x, y });
        }
      }

      if (toClear.length > 0) {
        changed = true;
        for (const point of toClear) {
          set(point.x, point.y, 0);
        }
      }

      toClear.length = 0;

      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          if (!get(x, y)) {
            continue;
          }

          const points = neighbors(x, y);
          const sum = points.reduce((acc, value) => acc + value, 0);
          if (sum < 2 || sum > 6) {
            continue;
          }
          if (transitions(points) !== 1) {
            continue;
          }
          if (points[0] * points[2] * points[6] !== 0) {
            continue;
          }
          if (points[0] * points[4] * points[6] !== 0) {
            continue;
          }

          toClear.push({ x, y });
        }
      }

      if (toClear.length > 0) {
        changed = true;
        for (const point of toClear) {
          set(point.x, point.y, 0);
        }
      }
    }

    const rawEndpoints: GridPoint[] = [];
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        if (!get(x, y)) {
          continue;
        }
        const points = neighbors(x, y);
        const sum = points.reduce((acc, value) => acc + value, 0);
        if (sum === 1) {
          rawEndpoints.push({ x, y });
        }
      }
    }

    const clustered: GridPoint[] = [];
    const clusterSpacing = Math.max(2, Math.round(Math.min(width, height) / 36));
    for (const endpoint of rawEndpoints) {
      const tooClose = clustered.some(
        (existing) =>
          Math.hypot(existing.x - endpoint.x, existing.y - endpoint.y) < clusterSpacing
      );
      if (!tooClose) {
        clustered.push(endpoint);
      }
    }

    return clustered;
  }

  private collectEdgeCells() {
    const edges: number[] = [];

    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.columns; x += 1) {
        const index = this.toIndex(x, y);
        const inside = this.occupancy[index] === 1;

        if (inside !== this.isOccupied(x - 1, y) ||
            inside !== this.isOccupied(x + 1, y) ||
            inside !== this.isOccupied(x, y - 1) ||
            inside !== this.isOccupied(x, y + 1)) {
          edges.push(index);
        }
      }
    }

    return edges;
  }

  private buildDistanceField(edgeList: number[]) {
    if (edgeList.length === 0) {
      return;
    }

    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.columns; x += 1) {
        const index = this.toIndex(x, y);
        let nearestIndex = edgeList[0];
        let nearestDistanceSquared = Number.POSITIVE_INFINITY;

        for (let edgeCursor = 0; edgeCursor < edgeList.length; edgeCursor += 1) {
          const edgeIndex = edgeList[edgeCursor];
          const edgeX = edgeIndex % this.columns;
          const edgeY = Math.floor(edgeIndex / this.columns);
          const dx = x - edgeX;
          const dy = y - edgeY;
          const distanceSquared = dx * dx + dy * dy;

          if (distanceSquared < nearestDistanceSquared) {
            nearestDistanceSquared = distanceSquared;
            nearestIndex = edgeIndex;
          }
        }

        const edgeX = nearestIndex % this.columns;
        const edgeY = Math.floor(nearestIndex / this.columns);
        const directionX = x - edgeX;
        const directionY = y - edgeY;
        const magnitude = Math.hypot(directionX, directionY) || 1;
        const outwardX = directionX / magnitude;
        const outwardY = directionY / magnitude;
        const sign = this.occupancy[index] === 1 ? -1 : 1;

        this.distanceField[index] = sign * Math.sqrt(nearestDistanceSquared) * this.cellSize;
        this.normalField[index * 2] = outwardX;
        this.normalField[index * 2 + 1] = outwardY;
      }
    }
  }

  private isOccupied(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.columns || y >= this.rows) {
      return false;
    }

    return this.occupancy[this.toIndex(x, y)] === 1;
  }

  private toIndex(x: number, y: number) {
    return y * this.columns + x;
  }
}

function normalizeGlyphText(glyph: string) {
  const normalized = glyph.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 1);
  return normalized || 'C';
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function bilerp(
  v00: number,
  v10: number,
  v01: number,
  v11: number,
  tx: number,
  ty: number
) {
  return lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), ty);
}
