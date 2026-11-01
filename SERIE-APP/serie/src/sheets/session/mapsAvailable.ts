import { Platform } from 'react-native';

/** expo-maps renders Apple Maps from iOS 17; the deployment target is 16.4, so older iPhones get the readout. */
export const APPLE_MAPS_OK = Platform.OS === 'ios' && parseInt(String(Platform.Version), 10) >= 17;
