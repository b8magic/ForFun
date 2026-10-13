import { activityColors, foregroundOn, palette } from '@/ui/theme';
import { colorSliderKey, hexToHsv, hsvToHex, normalizeHex } from '../activityColor';

const sampleRgb = () => {
  const values: string[] = [];
  for (let r = 0; r <= 255; r += 17) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 17) {
    values.push(`#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase());
  }
  return values;
};

describe('activity colour editing', () => {
  it('offers 24 distinct presets and retains the eight existing identities', () => {
    expect(activityColors).toHaveLength(24);
    expect(new Set(activityColors.map((c) => c.hex)).size).toBe(24);
    expect(new Set(activityColors.map((c) => c.id)).size).toBe(24);
    expect(activityColors.slice(0, 8).map(({ id, hex }) => ({ id, hex }))).toEqual([
      { id: 'flare', hex: '#FF4D1F' }, { id: 'lime', hex: '#C9F06A' },
      { id: 'lilac', hex: '#B9A8FF' }, { id: 'sand', hex: '#F3C46E' },
      { id: 'kelp', hex: '#6FD6B4' }, { id: 'rose', hex: '#FF8FB0' },
      { id: 'clay', hex: '#D9774A' }, { id: 'foam', hex: '#EEE8DA' },
    ]);
  });

  it('accepts RGB hex and rejects incomplete, transparent or malformed colours', () => {
    expect(normalizeHex(' #Ab3 ')).toBe('#AABB33');
    expect(normalizeHex('0c129a')).toBe('#0C129A');
    expect(normalizeHex('#000000')).toBe('#000000');
    for (const value of ['', '#', '#12', '#1234', '#12345', '#12345678', '#GGGGGG', 'red', 'rgba(0,0,0,0)']) {
      expect(normalizeHex(value)).toBeNull();
    }
  });

  it('round trips arbitrary RGB samples, all presets and black/white without recolouring', () => {
    for (const hex of [...sampleRgb(), ...activityColors.map((c) => c.hex), '#123456', '#000001', '#FFFFFE']) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
    expect(hsvToHex({ h: 360, s: 1, v: 1 })).toBe('#FF0000');
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe('#00FF00');
    expect(hsvToHex({ h: 240, s: 1, v: 1 })).toBe('#0000FF');
  });

  it('retains the intended hue through grey and hue/saturation through black', () => {
    const blue = { h: 240, s: 0.75, v: 1 };
    expect(hexToHsv('#888888', blue)).toEqual({ h: 240, s: 0, v: 136 / 255 });
    const black = hexToHsv('#000000', blue);
    expect(black).toEqual({ ...blue, v: 0 });
    expect(hsvToHex({ ...black, v: 1 })).toBe(hsvToHex(blue));
  });

  it('adjusts sliders with arrows, larger steps and range endpoints', () => {
    expect(colorSliderKey(45, 100, 'ArrowRight')).toBe(46);
    expect(colorSliderKey(45, 100, 'ArrowDown')).toBe(44);
    expect(colorSliderKey(45, 100, 'ArrowUp', true)).toBe(55);
    expect(colorSliderKey(5, 100, 'PageDown')).toBe(0);
    expect(colorSliderKey(358, 360, 'PageUp')).toBe(360);
    expect(colorSliderKey(100, 100, 'ArrowRight')).toBe(100);
    expect(colorSliderKey(0, 100, 'ArrowLeft')).toBe(0);
    expect(colorSliderKey(45, 100, 'Home')).toBe(0);
    expect(colorSliderKey(45, 100, 'End')).toBe(100);
    expect(colorSliderKey(45, 100, 'Tab')).toBeNull();
  });
});

describe('activity text contrast', () => {
  const luminance = (hex: string) => {
    const linear = [1, 3, 5].map((i) => {
      const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };

  it('keeps labels at AA contrast for bright, dark and middle-tone free colours', () => {
    for (const color of [...sampleRgb(), ...activityColors.map((c) => c.hex), '#777777']) {
      const a = luminance(color);
      const b = luminance(foregroundOn(color));
      expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
    expect(foregroundOn('#000')).toBe(palette.cream);
    expect(foregroundOn('#fff')).toBe(palette.ink);
  });
});
