import { parse } from 'opentype.js';
import type { FontOption } from './fontCatalog';

export type OpenTypeFont = any;

export type LoadedFont = FontOption & {
  fontData: OpenTypeFont;
};

const fontCache = new Map<string, Promise<LoadedFont>>();
const registeredFamilies = new Set<string>();

export function loadFontOption(option: FontOption): Promise<LoadedFont> {
  const cached = fontCache.get(option.id);

  if (cached) {
    return cached;
  }

  const promise = fetch(option.source)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch font asset for ${option.label}.`);
      }

      const bytes = await response.arrayBuffer();
      await registerFontFace(option, bytes);

      return {
        ...option,
        fontData: parse(bytes)
      };
    })
    .catch((error) => {
      fontCache.delete(option.id);
      throw error;
    });

  fontCache.set(option.id, promise);
  return promise;
}

async function registerFontFace(option: FontOption, bytes: ArrayBuffer) {
  if (registeredFamilies.has(option.family)) {
    return;
  }

  const fontFace = new FontFace(option.family.replaceAll('"', ''), bytes);
  await fontFace.load();
  document.fonts.add(fontFace);
  registeredFamilies.add(option.family);
}
