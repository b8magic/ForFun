import type { SessionDetailsDraft } from './types';

/** Date snapshots are internal save inputs; only entered details are an activity draft. */
export function hasDraftDetails(details: SessionDetailsDraft | null | undefined): boolean {
  const place = details?.place;
  return !!(details?.notes?.trim() || place?.label?.trim() || place?.address?.trim() || place?.mapUrl?.trim() || place?.coords || (details?.timing && details.timing.state !== 'date_only'));
}
