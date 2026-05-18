type GlyphLayoutOptions = {
  glyph: string;
  fontFamily: string;
  fontData?: any | null;
  fontWeight?: number;
  width: number;
  height: number;
  fillRatio?: number;
};

type PathCommand =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | { type: 'Q'; x1: number; y1: number; x: number; y: number }
  | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: 'Z' };

export function buildGlyphLayout({
  glyph,
  fontFamily,
  fontData,
  fontWeight = 700,
  width,
  height,
  fillRatio = 0.37
}: GlyphLayoutOptions) {
  const normalizedGlyph = normalizeGlyphText(glyph);
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);

  if (!fontData || fontWeight !== 700) {
    const fontSize = Math.min(safeWidth, safeHeight) * fillRatio;
    return {
      glyph: normalizedGlyph,
      fontFamily,
      fontSize,
      fontWeight,
      textX: safeWidth * 0.5,
      textY: safeHeight * 0.64,
      pathCommands: null
    };
  }

  const unitsPerEm = fontData.unitsPerEm || 1000;
  const draftPath = fontData.getPath(normalizedGlyph, 0, 0, unitsPerEm);
  const glyphBox = draftPath.getBoundingBox();
  const glyphWidth = Math.max(1, glyphBox.x2 - glyphBox.x1);
  const glyphHeight = Math.max(1, glyphBox.y2 - glyphBox.y1);
  const availableWidth = safeWidth * fillRatio;
  const availableHeight = safeHeight * fillRatio;
  const fontSize =
    Math.min(availableWidth / glyphWidth, availableHeight / glyphHeight) * unitsPerEm;

  const scaledDraftPath = fontData.getPath(normalizedGlyph, 0, 0, fontSize);
  const draftBox = scaledDraftPath.getBoundingBox();
  const offsetX = safeWidth * 0.5 - (draftBox.x1 + draftBox.x2) * 0.5;
  const offsetY = safeHeight * 0.62 - (draftBox.y1 + draftBox.y2) * 0.5;
  const path = fontData.getPath(normalizedGlyph, offsetX, offsetY, fontSize);

  return {
    glyph: normalizedGlyph,
    fontFamily,
    fontSize,
    fontWeight,
    textX: safeWidth * 0.5,
    textY: safeHeight * 0.64,
    pathCommands: path.commands as PathCommand[]
  };
}

export function pathCommandsToSvgD(commands: PathCommand[]) {
  return commands
    .map((command) => {
      switch (command.type) {
        case 'M':
          return `M ${command.x} ${command.y}`;
        case 'L':
          return `L ${command.x} ${command.y}`;
        case 'Q':
          return `Q ${command.x1} ${command.y1} ${command.x} ${command.y}`;
        case 'C':
          return `C ${command.x1} ${command.y1} ${command.x2} ${command.y2} ${command.x} ${command.y}`;
        case 'Z':
          return 'Z';
      }
    })
    .join(' ');
}

function normalizeGlyphText(glyph: string) {
  const normalized = glyph.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 1);
  return normalized || 'C';
}
