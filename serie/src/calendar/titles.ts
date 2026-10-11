/**
 * Export titles: final title = batch prefix + per-event base title + batch suffix.
 *
 *  - Characters and spacing the user typed are preserved exactly (no trimming,
 *    no automatic separators): `"🌊 " + "Surf" + " · mattina"`.
 *  - The base title defaults to the activity (category) name. A per-event
 *    override stores only the BASE, never the composed title, so changing the
 *    prefix or suffix recomputes previews without appending them twice.
 *  - Overrides are kept in a separate map keyed by session id; changing the
 *    batch prefix/suffix never touches them. `resetBaseOverride` removes one.
 *  - A blank override (empty or whitespace only) means "no override": an
 *    event never ends up without its base title.
 *
 * Pure: no React, no Expo. Nothing here touches the stored session or category.
 */

export interface TitleParts {
  prefix: string;
  base: string;
  suffix: string;
}

/** Per-event base-title overrides, keyed by session id. */
export type BaseTitleOverrides = Readonly<Record<string, string>>;

/** prefix + base + suffix, verbatim. */
export function composeTitle(p: TitleParts): string {
  return `${p.prefix ?? ''}${p.base ?? ''}${p.suffix ?? ''}`;
}

const isBlank = (s: string | null | undefined): boolean => s == null || s.trim() === '';

/** The base title in effect: the override when set and not blank, else the activity name. */
export function effectiveBase(categoryName: string, override?: string | null): string {
  return isBlank(override) ? categoryName : (override as string);
}

export interface ResolvedTitle extends TitleParts {
  /** prefix + base + suffix. */
  final: string;
  /** True when the base comes from a per-event override (a reset is available). */
  overridden: boolean;
}

/** Resolve the title of one event from batch settings and its (optional) override. */
export function resolveTitle(input: { prefix: string; suffix: string; categoryName: string; override?: string | null }): ResolvedTitle {
  const overridden = !isBlank(input.override) && input.override !== input.categoryName;
  const base = effectiveBase(input.categoryName, input.override);
  const parts = { prefix: input.prefix ?? '', base, suffix: input.suffix ?? '' };
  return { ...parts, final: composeTitle(parts), overridden };
}

/**
 * Turn what the user typed into the full-title field back into a base title.
 * When the text still starts with the current prefix and ends with the current
 * suffix they are stripped, so editing the composed preview never stores (and
 * later re-appends) the batch text. Otherwise the text is the base as typed.
 */
export function baseFromEditedTitle(edited: string, prefix: string, suffix: string): string {
  const p = prefix ?? '';
  const s = suffix ?? '';
  if ((p || s) && edited.length >= p.length + s.length && edited.startsWith(p) && edited.endsWith(s)) {
    return edited.slice(p.length, edited.length - s.length);
  }
  return edited;
}

/**
 * Set (or clear) the base override of one event. Returns a new map; the input
 * is never mutated. Setting the activity name itself or a blank text clears it.
 */
export function setBaseOverride(overrides: BaseTitleOverrides, sessionId: string, base: string | null, categoryName: string): BaseTitleOverrides {
  if (base == null || isBlank(base) || base === categoryName) return resetBaseOverride(overrides, sessionId);
  if (overrides[sessionId] === base) return overrides;
  return { ...overrides, [sessionId]: base };
}

/** Remove the override of one event (the base returns to the activity name). */
export function resetBaseOverride(overrides: BaseTitleOverrides, sessionId: string): BaseTitleOverrides {
  if (!(sessionId in overrides)) return overrides;
  const next: Record<string, string> = { ...overrides };
  delete next[sessionId];
  return next;
}

/** Remove every override. */
export function resetAllBaseOverrides(): BaseTitleOverrides {
  return {};
}
