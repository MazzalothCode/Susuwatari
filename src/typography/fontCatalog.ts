export type FontOption = {
  id: string;
  label: string;
  family: string;
  source: string;
};

const archivoSource = new URL('../assets/fonts/Archivo-Variable.ttf', import.meta.url).href;
const playfairSource = new URL(
  '../assets/fonts/PlayfairDisplay-Variable.ttf',
  import.meta.url
).href;
const fredokaSource = new URL('../assets/fonts/Fredoka-Variable.ttf', import.meta.url).href;
const nunitoSource = new URL('../assets/fonts/Nunito-Variable.ttf', import.meta.url).href;
const schoolbellSource = new URL('../assets/fonts/Schoolbell-Regular.ttf', import.meta.url).href;
const spaceMonoSource = new URL('../assets/fonts/SpaceMono-Regular.ttf', import.meta.url).href;

export const FONT_OPTIONS: FontOption[] = [
  {
    id: 'archivo',
    label: 'Archivo',
    family: '"CatFont Archivo"',
    source: archivoSource
  },
  {
    id: 'playfair',
    label: 'Playfair Display',
    family: '"CatFont Playfair Display"',
    source: playfairSource
  },
  {
    id: 'fredoka',
    label: 'Fredoka',
    family: '"CatFont Fredoka"',
    source: fredokaSource
  },
  {
    id: 'nunito',
    label: 'Nunito',
    family: '"CatFont Nunito"',
    source: nunitoSource
  },
  {
    id: 'schoolbell',
    label: 'Schoolbell',
    family: '"CatFont Schoolbell"',
    source: schoolbellSource
  },
  {
    id: 'space-mono',
    label: 'Space Mono',
    family: '"CatFont Space Mono"',
    source: spaceMonoSource
  }
];
