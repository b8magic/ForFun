/**
 * Dynamic config: registers the Google OAuth redirect scheme (reversed iOS
 * client id) when EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is set, and the development
 * variant: APP_VARIANT=development (eas.json "development", tools/live.sh) makes
 * a separate "Serie Dev" app (bundle id app.serie.ios.dev), so the live
 * development build sits next to an installed release instead of replacing it.
 * Google sign-in in that variant needs its own iOS client. Everything else
 * lives in app.json.
 */
import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosClient = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const reversed = iosClient && /\.apps\.googleusercontent\.com$/.test(iosClient) ? `com.googleusercontent.apps.${iosClient.replace(/\.apps\.googleusercontent\.com$/, '')}` : null;
  const base = config as ExpoConfig;
  const dev = process.env.APP_VARIANT === 'development';
  // exp+serie-dev: the dev client's own launch scheme. The release also carries exp+serie (added by
  // expo-dev-client), and the CLI opens the longest exp+ scheme, so links and QR codes reach Serie Dev only.
  const schemes = ['serie', ...(dev ? ['exp+serie-dev'] : []), ...(reversed ? [reversed] : [])];
  return {
    ...base,
    name: dev ? 'Serie Dev' : (base.name ?? 'Serie'),
    slug: base.slug ?? 'serie',
    scheme: schemes,
    ios: { ...base.ios, ...(dev ? { bundleIdentifier: `${base.ios?.bundleIdentifier ?? 'app.serie.ios'}.dev` } : {}) },
  };
};
