import { ridgelineGeometry, ridgelineY } from '../ridgelineGeometry';

describe('monthly ridgeline bounds', () => {
  it.each([64, 346, 800])('keeps dense overlapping peaks and eased highlights inside padding at width %i', (width) => {
    const perDay = [0, ...Array.from({ length: 31 }, (_, day) => day % 2 ? 40 : 4)];
    const curve = ridgelineGeometry(width, 44, perDay, [1, 2, 16, 31]);
    for (const point of [...curve.points, ...curve.marks]) {
      for (const grow of [-0.2, 0.5, 1, 1.4]) {
        for (const glow of [-0.2, 0.5, 1, 1.4]) {
          const y = ridgelineY(point, curve.base, grow, glow);
          expect(y).toBeGreaterThanOrEqual(curve.padding - 1e-10);
          expect(y).toBeLessThanOrEqual(44 - curve.padding);
        }
      }
    }
    for (const mark of curve.marks) {
      const y = ridgelineY(mark, curve.base, 1, 1);
      expect(y - curve.dotRadius).toBeGreaterThanOrEqual(0);
      expect(y + curve.dotRadius).toBeLessThanOrEqual(44);
    }
  });

  it('keeps highlights on their original dates while normalizing dense peaks', () => {
    const perDay = [0, ...new Array(31).fill(4)];
    const curve = ridgelineGeometry(346, 44, perDay, [1, 16, 31, 16]);
    expect(curve.marks.map((mark) => mark.x)).toEqual([1, 16, 31].map((day) => (day - 0.5) / 31 * 346));
    expect(perDay).toEqual([0, ...new Array(31).fill(4)]);
  });

  it('leaves an empty month as a flat line', () => {
    const curve = ridgelineGeometry(346, 44, new Array(32).fill(0));
    expect(curve.points.every((point) => ridgelineY(point, curve.base, 1, 1) === curve.base)).toBe(true);
    expect(curve.marks).toHaveLength(0);
  });
});
