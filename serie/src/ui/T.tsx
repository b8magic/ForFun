/**
 * Text in the Serie type system. `variant` maps to the scale in theme.ts;
 * labels are uppercase mono with tracking.
 */
import { Text, type TextProps, type TextStyle, StyleSheet } from 'react-native';
import { type as scale } from './theme';

export type Variant = keyof typeof scale;

interface Props extends TextProps {
  variant?: Variant;
  color?: string;
  align?: TextStyle['textAlign'];
  upper?: boolean;
}

export function T({ variant = 'body', color, align, upper, style, children, ...rest }: Props) {
  const base = scale[variant] as TextStyle;
  const isLabel = variant === 'label' || variant === 'labelStrong';
  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={variant === 'monthTitle' || variant === 'hero' || variant === 'heroWide' ? 1.15 : 1.6}
      style={[base, { color, textAlign: align }, (upper ?? isLabel) && styles.upper, style]}
      {...rest}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({ upper: { textTransform: 'uppercase' } });
