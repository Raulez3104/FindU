import { Platform } from 'react-native';

const read = (value: string | undefined): string => (value ?? '').trim();

const localApiUrl = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

export const API_URL = read(process.env.EXPO_PUBLIC_API_URL) || localApiUrl;

export const GOOGLE_CLIENT_IDS = {
  web: read(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
  android: read(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID),
  ios: read(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
  expo: read(process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID),
} as const;

export function getGoogleClientId(os: typeof Platform.OS = Platform.OS): string {
  switch (os) {
    case 'android':
      return GOOGLE_CLIENT_IDS.android;
    case 'ios':
      return GOOGLE_CLIENT_IDS.ios;
    case 'web':
      return GOOGLE_CLIENT_IDS.web;
    default:
      return GOOGLE_CLIENT_IDS.expo;
  }
}
