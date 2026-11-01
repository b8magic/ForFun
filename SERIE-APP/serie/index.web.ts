// Web entry (verification build): load CanvasKit for React Native Skia before the app mounts.
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

LoadSkiaWeb({ locateFile: (file: string) => `/${file}` }).then(() => {
  require('expo-router/entry');
});
