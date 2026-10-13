/**
 * Scrolling body inside <KeyboardSafe><Sheet scroll={false}>.
 * KeyboardSafe resizes the whole form, including its fixed footer. Adding an
 * automatic keyboard inset here would reserve the same space a second time.
 * Handled taps reach form controls immediately; dragging dismisses the keyboard.
 */
import { forwardRef, type ReactNode } from 'react';
import { Platform, ScrollView } from 'react-native';
import { space } from '@/ui/theme';

export const SheetScroll = forwardRef<ScrollView, { children: ReactNode; testID?: string }>(function SheetScroll({ children, testID }, ref) {
  return (
    <ScrollView
      ref={ref}
      style={{ flex: 1, marginHorizontal: -space.gutter }}
      contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 4, paddingBottom: 32, gap: 22 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'android' ? 'on-drag' : 'interactive'}
      automaticallyAdjustKeyboardInsets={false}
      testID={testID}
    >
      {children}
    </ScrollView>
  );
});
