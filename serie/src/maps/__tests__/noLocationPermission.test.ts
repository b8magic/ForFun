/// <reference types="node" />
/**
 * Accepting a pasted place link must never involve the device's location.
 * Asserted on the module sources themselves, so a future import of a location
 * API fails here.
 */
import * as fs from 'fs';
import * as path from 'path';

const DIR = path.resolve(__dirname, '..');
const sources = fs
  .readdirSync(DIR)
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => ({ file: f, text: fs.readFileSync(path.join(DIR, f), 'utf8') }));

const importsOf = (text: string) => [...text.matchAll(/(?:from|import|require\()\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

describe('src/maps never touches location permissions', () => {
  it('has sources to check', () => {
    expect(sources.map((s) => s.file).sort()).toEqual(expect.arrayContaining(['mapsUrls.ts', 'openInMaps.ts', 'parseLink.ts', 'resolveLink.ts']));
  });

  it.each(sources)('$file imports no location / permission API', ({ text }) => {
    for (const forbidden of [
      /expo-location/,
      /react-native-permissions/,
      /PermissionsAndroid/,
      /navigator\.geolocation/,
      /\bgetCurrentPosition(Async)?\b/,
      /\bwatchPosition(Async)?\b/,
      /\brequest(Foreground|Background)?PermissionsAsync\b/,
      /\bget(Foreground|Background)?PermissionsAsync\b/,
      /\buse(Foreground|Background)Permissions\b/,
      /\bgetLastKnownPositionAsync\b/,
    ]) {
      expect(text).not.toMatch(forbidden);
    }
  });

  it('pure modules import neither React nor Expo; only the open adapter talks to the platform', () => {
    const allowedPure = (spec: string) => spec.startsWith('./') || spec === '@/domain/types';
    for (const { file, text } of sources) {
      const specs = importsOf(text);
      if (file === 'openInMaps.ts') {
        expect(specs.filter((s) => !allowedPure(s)).sort()).toEqual(['expo-linking', 'react-native']);
      } else {
        expect({ file, external: specs.filter((s) => !allowedPure(s)) }).toEqual({ file, external: [] });
      }
    }
  });
});
