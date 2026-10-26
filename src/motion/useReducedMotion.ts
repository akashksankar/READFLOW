import { useAppSettings } from '../app/providers';

export function useAppMotion() {
  const { isReducedMotion, isLiteMode, settings } = useAppSettings();
  return {
    isReducedMotion,
    isLiteMode,
    motionPreference: settings.motion,
  };
}
