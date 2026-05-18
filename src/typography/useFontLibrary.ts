import { startTransition, useEffect, useState } from 'react';
import type { FontOption } from './fontCatalog';
import { loadFontOption, type LoadedFont } from './fontRuntime';

type FontLibraryState = {
  loadedFonts: Record<string, LoadedFont>;
  isLoading: boolean;
};

export function useFontLibrary(options: FontOption[]): FontLibraryState {
  const [loadedFonts, setLoadedFonts] = useState<Record<string, LoadedFont>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all(options.map((option) => loadFontOption(option)))
      .then((fonts) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setLoadedFonts(
            fonts.reduce<Record<string, LoadedFont>>((accumulator, font) => {
              accumulator[font.id] = font;
              return accumulator;
            }, {})
          );
          setIsLoading(false);
        });
      })
      .catch(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [options]);

  return {
    loadedFonts,
    isLoading
  };
}
