/**
 * Unsaved edits are never dropped silently: while `dirty`, closing the sheet
 * (button, swipe down, back) asks first. Saving or deleting calls
 * `allowLeave()` so the sheet closes without the question.
 */
import { useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { t } from '@/i18n/it';

export function useConfirmDiscard(dirty: boolean) {
  const navigation = useNavigation();
  const allowed = useRef(false);
  usePreventRemove(dirty, ({ data }) => {
    const leave = () => navigation.dispatch(data.action);
    if (allowed.current) return leave();
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${t.discardTitle}\n${t.discardBody}`)) leave();
      return;
    }
    Alert.alert(t.discardTitle, t.discardBody, [
      { text: t.keepEditing, style: 'cancel' },
      { text: t.discard, style: 'destructive', onPress: leave },
    ]);
  });
  return useCallback(() => {
    allowed.current = true;
  }, []);
}
