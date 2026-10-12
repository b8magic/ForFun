/**
 * Serie visual identity — tokens taken from the trailer.
 *
 * Cream is the default surface; the dark surface is a saved preference.
 * Legacy night/calm exports remain available for fixed-tone artwork.
 * Flare is reserved for sessions (selected days, saved dots, the energy line).
 */
export const palette = {
  ink: '#0C0B09',
  ink2: '#14120F',
  ink3: '#1C1A16',
  foam: '#EEE8DA',
  bone: '#ECE5D6',
  bone2: '#E2DACA',
  cream: '#F6F2E9',
  cream2: '#EEE8DC',
  flare: '#FF4D1F',
  flareHot: '#FF6B3D',
  flareDeep: '#E2401A',
  danger: '#FF5A4E',
} as const;

export type SurfaceName = 'night' | 'calm';
export type ThemePref = 'cream' | 'dark';

export interface Surface {
  name: SurfaceName;
  bg: string;
  raised: string;
  fg: string;
  mute: string;
  faint: string;
  line: string;
  accent: string;
  onAccent: string;
  danger: string;
  warning: string;
  success: string;
}

export const surfaces: Record<SurfaceName, Surface> = {
  night: {
    name: 'night',
    bg: palette.ink,
    raised: palette.ink3,
    fg: palette.foam,
    mute: 'rgba(238,232,218,0.60)',
    faint: 'rgba(238,232,218,0.16)',
    line: palette.foam,
    accent: palette.flare,
    onAccent: palette.ink,
    danger: palette.danger,
    warning: '#F3C46E',
    success: '#9FD9A0',
  },
  calm: {
    name: 'calm',
    bg: palette.cream,
    raised: palette.cream2,
    fg: palette.ink2,
    mute: 'rgba(20,18,15,0.62)',
    faint: 'rgba(20,18,15,0.14)',
    line: palette.ink2,
    accent: '#C93D1C',
    onAccent: palette.cream,
    danger: '#AD3029',
    warning: '#876018',
    success: '#316C3D',
  },
};

/** Stable, immutable-by-convention tokens; components subscribe through useSurface. */
export function surfaceFor(theme: ThemePref): Surface {
  return theme === 'dark' ? surfaces.night : surfaces.calm;
}

/** Activity colours stay unchanged; choose a readable label over their fill. */
export function foregroundOn(color: string): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1];
  if (!hex) return palette.ink;
  const channels = [0, 2, 4].map((i) => {
    const n = parseInt(hex.slice(i, i + 2), 16) / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.18 ? palette.ink : palette.cream;
}

/** Curated activity colours. Each reads on both Ink and Bone. */
export const activityColors = [
  { id: 'flare', hex: '#FF4D1F', name: 'Fiamma' },
  { id: 'lime', hex: '#C9F06A', name: 'Lime' },
  { id: 'lilac', hex: '#B9A8FF', name: 'Lilla' },
  { id: 'sand', hex: '#F3C46E', name: 'Sabbia' },
  { id: 'kelp', hex: '#6FD6B4', name: 'Alga' },
  { id: 'rose', hex: '#FF8FB0', name: 'Rosa' },
  { id: 'clay', hex: '#D9774A', name: 'Argilla' },
  { id: 'foam', hex: '#EEE8DA', name: 'Schiuma' },
] as const;

/** Font families (static instances of Roboto Flex and Martian Mono, see assets/fonts). */
export const fonts = {
  displayCondensed: 'SerieDisplay-Condensed', // month titles, big numerals (wdth 58, wght 300)
  displayCondensedMedium: 'SerieDisplay-CondensedMedium', // emphasised numerals (wdth 62, wght 520)
  displayWide: 'SerieDisplay-Wide', // released / rolling numbers (wdth 151, wght 200)
  displayNarrow: 'SerieDisplay-Narrow', // tension state (wdth 25, wght 860)
  displayBlack: 'SerieDisplay-Black', // logotype (wdth 104, wght 880)
  textLight: 'SerieText-Light',
  text: 'SerieText-Regular',
  textMedium: 'SerieText-Medium',
  textBold: 'SerieText-Bold',
  mono: 'SerieMono-Regular', // dates, counts, labels (Martian Mono wdth 87.5)
  monoMedium: 'SerieMono-Medium',
} as const;

export const fontAssets = {
  'SerieDisplay-Condensed': require('../../assets/fonts/SerieDisplay-Condensed.ttf'),
  'SerieDisplay-CondensedMedium': require('../../assets/fonts/SerieDisplay-CondensedMedium.ttf'),
  'SerieDisplay-Wide': require('../../assets/fonts/SerieDisplay-Wide.ttf'),
  'SerieDisplay-Narrow': require('../../assets/fonts/SerieDisplay-Narrow.ttf'),
  'SerieDisplay-Black': require('../../assets/fonts/SerieDisplay-Black.ttf'),
  'SerieText-Light': require('../../assets/fonts/SerieText-Light.ttf'),
  'SerieText-Regular': require('../../assets/fonts/SerieText-Regular.ttf'),
  'SerieText-Medium': require('../../assets/fonts/SerieText-Medium.ttf'),
  'SerieText-Bold': require('../../assets/fonts/SerieText-Bold.ttf'),
  'SerieMono-Regular': require('../../assets/fonts/SerieMono-Regular.ttf'),
  'SerieMono-Medium': require('../../assets/fonts/SerieMono-Medium.ttf'),
} as const;

/** Type scale in points. Labels in mono are uppercase with tracking. */
export const type = {
  monthTitle: { fontFamily: fonts.displayCondensed, fontSize: 60, lineHeight: 62, letterSpacing: -0.5 },
  hero: { fontFamily: fonts.displayCondensed, fontSize: 84, lineHeight: 84, letterSpacing: -1 },
  heroWide: { fontFamily: fonts.displayWide, fontSize: 64, lineHeight: 70 },
  title: { fontFamily: fonts.textMedium, fontSize: 22, lineHeight: 26 },
  heading: { fontFamily: fonts.displayCondensedMedium, fontSize: 30, lineHeight: 32 },
  body: { fontFamily: fonts.text, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.textMedium, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20 },
  button: { fontFamily: fonts.textMedium, fontSize: 18, lineHeight: 22 },
  label: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 15, letterSpacing: 1.6 },
  labelStrong: { fontFamily: fonts.monoMedium, fontSize: 11, lineHeight: 15, letterSpacing: 1.6 },
  day: { fontFamily: fonts.mono, fontSize: 16, lineHeight: 20 },
  dayStrong: { fontFamily: fonts.monoMedium, fontSize: 18, lineHeight: 22 },
  data: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 19 },
  dataStrong: { fontFamily: fonts.monoMedium, fontSize: 14, lineHeight: 19 },
} as const;

/** Spacing on a 4-pt grid; screen gutter matches the trailer's 80/1080 ratio. */
export const space = { xxs: 4, xs: 8, s: 12, m: 16, l: 24, xl: 32, xxl: 48, gutter: 22 } as const;

/** Minimum touch target (Apple HIG). */
export const HIT = 44;
