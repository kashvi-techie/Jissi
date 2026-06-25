import { useEffect, useCallback, useState } from 'react';
import { Platform, Alert, Linking } from 'react-native';

const OVERLAY_PERMISSION_ACTION = 'android.settings.action.MANAGE_OVERLAY_PERMISSION';

export function useOverlayPermission() {
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [isChecking, setIsChecking] = useState(false);

  const checkPermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setPermissionStatus('granted');
      return;
    }

    setIsChecking(true);

    try {
      const url = `package:jissi`;
      const canOpen = await Linking.canOpenURL(url);
      setPermissionStatus('unknown');
    } catch {
      setPermissionStatus('unknown');
    } finally {
      setIsChecking(false);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setPermissionStatus('granted');
      return true;
    }

    try {
      await Linking.openSettings();
      setPermissionStatus('unknown');
      return false;
    } catch {
      Alert.alert(
        'Permission Required',
        'JISSI needs "Display over other apps" permission to show the floating assistant. Please grant this in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => Linking.openSettings(),
          },
        ]
      );
      return false;
    }
  }, []);

  const promptPermissionIfNeeded = useCallback(
    async (onGranted: () => void) => {
      if (Platform.OS !== 'android') {
        setPermissionStatus('granted');
        onGranted();
        return;
      }

      if (permissionStatus === 'granted') {
        onGranted();
        return;
      }

      Alert.alert(
        '"Display Over Other Apps" Permission',
        'To show the JISSI floating assistant above other apps, you need to allow "Display over other apps" in Android settings.',
        [
          {
            text: 'Not Now',
            style: 'cancel',
          },
          {
            text: 'Open Settings',
            onPress: async () => {
              await requestPermission();
            },
          },
          {
            text: 'I Granted It',
            onPress: () => {
              setPermissionStatus('granted');
              onGranted();
            },
          },
        ]
      );
    },
    [permissionStatus, requestPermission]
  );

  useEffect(() => {
    if (Platform.OS === 'web') {
      setPermissionStatus('granted');
    }
  }, []);

  return {
    permissionStatus,
    isChecking,
    checkPermission,
    requestPermission,
    promptPermissionIfNeeded,
    isGranted: permissionStatus === 'granted',
  };
}
