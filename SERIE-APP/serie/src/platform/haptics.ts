/** Tactile punctuation for the motion grammar. Silent on web. */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const ok = Platform.OS === 'ios' || Platform.OS === 'android';
const safe = (p: () => Promise<void>) => {
  if (!ok) return;
  p().catch(() => undefined);
};

export const haptics = {
  /** A crest rising under the finger. */
  crest: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Releasing a crest (deselect). */
  release: () => safe(() => Haptics.selectionAsync()),
  /** The wave breaking after a successful save. */
  breakImpact: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  select: () => safe(() => Haptics.selectionAsync()),
};
