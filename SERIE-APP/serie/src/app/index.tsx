/**
 * The living composition: REGISTRA (Lineup) and STORIA (Time) are two
 * surfaces of one world; moving between them is a transformation, not a push.
 */
import { View, StyleSheet } from 'react-native';
import { useApp } from '@/state/store';
import { Lineup } from '@/places/lineup/Lineup';
import { TimePlace } from '@/places/time/TimePlace';
import { Toast } from '@/ui/Toast';
import { palette } from '@/ui/theme';

export default function Composition() {
  const place = useApp((s) => s.place);
  return (
    <View style={styles.root}>
      {/* while STORIA covers the Lineup, VoiceOver must not reach the controls underneath */}
      <View style={StyleSheet.absoluteFill} accessibilityElementsHidden={place === 'time'} importantForAccessibility={place === 'time' ? 'no-hide-descendants' : 'auto'} aria-hidden={place === 'time'}>
        <Lineup />
      </View>
      <TimePlace visible={place === 'time'} />
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: palette.ink } });
