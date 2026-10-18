/**
 * Unsaved edits are never dropped silently: while `dirty`, closing the sheet
 * (button, swipe down, back) asks first. Saving or deleting calls
 * `allowLeave()` so the sheet closes without the question.
 */
import { useCallback, useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { t } from '@/i18n/it';

interface DiscardCopy { title?: string; body?: string }

/** Local sheet steps also use this confirmation before unmounting their form. */
export function confirmDiscard(leave: () => void, { title = t.discardTitle, body = t.discardBody }: DiscardCopy = {}) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n${body}`)) leave();
    return;
  }
  Alert.alert(title, body, [
    { text: t.keepEditing, style: 'cancel' },
    { text: t.discard, style: 'destructive', onPress: leave },
  ]);
}

export function useConfirmDiscard(dirty: boolean, options: DiscardCopy & { blocked?: boolean } = {}) {
  const navigation = useNavigation();
  const allowed = useRef(false);
  const preventing = dirty || !!options.blocked;
  useEffect(() => {
    if (Platform.OS !== 'web' || !preventing || typeof window === 'undefined') return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (allowed.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [preventing]);
  usePreventRemove(preventing, ({ data }) => {
    const leave = () => navigation.dispatch(data.action);
    if (allowed.current) return leave();
    if (options.blocked) return;
    confirmDiscard(leave, options);
  });
  return useCallback(() => {
    allowed.current = true;
  }, []);
}
