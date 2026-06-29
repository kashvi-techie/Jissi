import React from 'react';
import { Modal } from 'react-native';
import { Screen } from '@/components/ui';
import { TalkView, TalkViewProps } from '@/components/TalkView';

interface VoiceOverlayProps extends TalkViewProps {
  visible: boolean;
}

/**
 * Full-screen voice view as a Modal — used on desktop, where Home is a landing
 * page and the talk surface overlays it during a session. (On mobile, TalkView is
 * the screen itself.)
 */
export function VoiceOverlay({ visible, ...talk }: VoiceOverlayProps) {
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={talk.onBack} statusBarTranslucent>
      <Screen>
        <TalkView {...talk} />
      </Screen>
    </Modal>
  );
}
