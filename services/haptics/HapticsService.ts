import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export type HapticMoment = 'listen_start' | 'listen_stop' | 'reply' | 'toggle' | 'error';

class HapticsServiceImpl {
  async play(moment: HapticMoment): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      if (moment === 'error') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
      if (moment === 'reply') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }
      await Haptics.selectionAsync();
    } catch {
      // Haptics are best-effort only.
    }
  }
}

export const HapticsService = new HapticsServiceImpl();
