/**
 * Scrolling body for the session sheets (use with <Sheet scroll={false}>).
 * Same rhythm as the shared Sheet body, plus keyboard handling: on iOS the
 * content inset follows the keyboard (automaticallyAdjustKeyboardInsets), so
 * the timing fields at the bottom of a form sheet are never hidden behind it;
 * dragging the content dismisses the keyboard interactively. The sheet's header
 * and footer overlay this scroll view, so its content is padded by their height.
 */
import { forwardRef, type ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { space } from '@/ui/theme';
import { useSheetInsets } from '@/ui/controls';

export const SheetScroll = forwardRef<ScrollView, { children: ReactNode; testID?: string }>(function SheetScroll({ children, testID }, ref) {
  const pads = useSheetInsets();
  return (
    <ScrollView
      ref={ref}
      style={{ flex: 1, marginHorizontal: -space.gutter }}
      contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: pads.top + 4, paddingBottom: pads.bottom + 32, gap: 22 }}
      scrollIndicatorInsets={{ top: pads.top, bottom: pads.bottom }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
      testID={testID}
    >
      {children}
    </ScrollView>
  );
});
