/**
 * Apple / iPhone calendars (EventKit via expo-calendar).
 * See README.md in this folder for permissions, Info.plist and behaviour notes.
 */
export {
  AppleCalendarProvider,
  createAppleCalendarProvider,
  mapNativeError,
  isMissingPlistError,
  isExpoGoError,
  isRootApiAvailable,
  APPLE_DISCONNECTED_KEY,
  type AppleProviderOptions,
  type AppleSettingsStore,
  type AppleAccessState,
} from './provider';
export {
  MAX_CHUNK_DAYS,
  chunkDateRange,
  composeEventId,
  parseEventId,
  occurrenceKeyOf,
  toExternalCalendar,
  toExternalEvent,
  draftToDetails,
  type EKCalendarLike,
  type EKEventLike,
  type EKSourceLike,
  type EventKitDetails,
} from './mapping';
export {
  META_URL_PREFIX,
  metaToUrl,
  metaFromUrl,
  readEventMeta,
  notesWithMeta,
  splitNotesMeta,
  encodeMeta,
  decodeMeta,
} from './meta';
