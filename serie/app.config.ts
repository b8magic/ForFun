/**
 * Dynamic config: registers the Google OAuth redirect scheme (reversed iOS
 * client id) when EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is set. Everything else
 * lives in app.json.
 */
import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosClient = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const reversed = iosClient && /\.apps\.googleusercontent\.com$/.test(iosClient) ? `com.googleusercontent.apps.${iosClient.replace(/\.apps\.googleusercontent\.com$/, '')}` : null;
  const base = config as ExpoConfig;
  const schemes = ['serie', ...(reversed ? [reversed] : [])];
  return {
    ...base,
    name: base.name ?? 'Serie',
    slug: base.slug ?? 'serie',
    scheme: schemes,
    ios: { ...base.ios },
  };
};
