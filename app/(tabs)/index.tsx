import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Animated,
  Easing,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Menu, Settings, Mic, Sparkles } from 'lucide-react-native';
import { SpeechState } from '@/services/speech/types';
import { AssistantState } from '@/hooks/useConversation';
import { useConversationMode } from '@/hooks/useConversationMode';
import { MessageBubble } from '@/components/MessageBubble';
import { Colors } from '@/constants/colors';
import { Spacing, Radius, Duration, Elevation } from '@/constants/theme';

/**
 * HOME — "luxury AI OS" surface. A calm, dark, ambient-glass environment with a
 * single luminous orb as the idle hero. Fully wired to the live pipeline:
 * useSpeechRecognition (STT) -> hand-off -> useConversation (intent ->
 * AIService/Gemini -> TTS). Only the visual layer changed in Phase 2.1; all
 * state, hooks, and the hand-off contract are preserved.
 */

type Phase = 'idle' | 'listening' | 'processing' | 'thinking' | 'speaking' | 'error';

function computePhase(s: SpeechState, a: AssistantState): Phase {
  if (s === 'error') return 'error';
  if (a === 'thinking') return 'thinking';
  if (a === 'speaking') return 'speaking';
  if (s === 'listening') return 'listening';
  if (s === 'processing') return 'processing';
  return 'idle';
}

function phaseLabel(p: Phase, isSupported: boolean): string {
  if (!isSupported) return 'Unavailable';
  switch (p) {
    case 'listening':
      return 'Listening';
    case 'processing':
      return 'Processing';
    case 'thinking':
      return 'Thinking';
    case 'speaking':
      return 'Speaking';
    case 'error':
      return 'Error';
    default:
      return 'Ready';
  }
}

function phaseColor(p: Phase): string {
  switch (p) {
    case 'listening':
      return Colors.status.listening;
    case 'thinking':
    case 'processing':
      return Colors.status.thinking;
    case 'speaking':
      return Colors.status.speaking;
    case 'error':
      return Colors.status.error;
    default:
      return Colors.status.idle;
  }
}

/** Subtle three-dot "thinking" shimmer (presentational only). */
function ThinkingDots() {
  const a = useRef(new Animated.Value(0.3)).current;
  const b = useRef(new Animated.Value(0.3)).current;
  const c = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const mk = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 420, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
    const anims = [mk(a, 0), mk(b, 180), mk(c, 360)];
    anims.forEach((x) => x.start());
    return () => anims.forEach((x) => x.stop());
  }, [a, b, c]);
  return (
    <View style={styles.thinkingRow}>
      {[a, b, c].map((v, i) => (
        <Animated.View key={i} style={[styles.thinkingDot, { opacity: v, transform: [{ scale: v }] }]} />
      ))}
    </View>
  );
}

export default function HomeScreen() {
  const {
    speechState,
    assistantState,
    transcript,
    interimTranscript,
    error,
    isSupported,
    isListening,
    isActive,
    messages,
    toggle,
  } = useConversationMode();

  const phase = computePhase(speechState, assistantState);
  const active = isListening || assistantState === 'thinking' || assistantState === 'speaking';
  const hasTranscript = !!(interimTranscript || transcript);

  const scrollRef = useRef<ScrollView>(null);

  // ── Ambient motion (all native-driver: transform / opacity only) ───────────
  // Orb breathing.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: active ? Duration.pulseActive : Duration.pulse,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: active ? Duration.pulseActive : Duration.pulse,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, active]);

  // Orb floating (vertical drift).
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: Duration.float, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: Duration.float, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  // Ambient background glows (slow blur movement).
  const drift1 = useRef(new Animated.Value(0)).current;
  const drift2 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const mk = (v: Animated.Value, dur: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
    const a = mk(drift1, Duration.drift);
    const b = mk(drift2, Math.round(Duration.drift * 1.4));
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [drift1, drift2]);

  // Microphone "morph" glow while listening.
  const micGlow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isListening) {
      micGlow.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(micGlow, { toValue: 1, duration: Duration.ring, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => {
      loop.stop();
      micGlow.setValue(0);
    };
  }, [isListening, micGlow]);

  const orbScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, active ? 1.1 : 1.05] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, active ? 0.85 : 0.65] });
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, active ? 1.22 : 1.14] });
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [9, -9] });
  const drift1X = drift1.interpolate({ inputRange: [0, 1], outputRange: [-24, 28] });
  const drift1Y = drift1.interpolate({ inputRange: [0, 1], outputRange: [0, 44] });
  const drift1S = drift1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const drift2X = drift2.interpolate({ inputRange: [0, 1], outputRange: [22, -30] });
  const drift2Y = drift2.interpolate({ inputRange: [0, 1], outputRange: [12, -28] });
  const drift2S = drift2.interpolate({ inputRange: [0, 1], outputRange: [1.12, 0.94] });
  const micGlowScale = micGlow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const micGlowOpacity = micGlow.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  // Hand-off (transcript → Gemini) and the continuous listen↔speak loop are
  // owned by useConversationMode; this screen only renders the resulting state.

  // Auto-scroll to newest message.
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages]);

  const handleMic = () => {
    if (!isSupported) return; // gracefully no-op on unsupported runtimes (e.g. Expo Go)
    toggle(); // one tap starts the hands-free conversation; tap again to stop
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Deep ambient backdrop */}
      <LinearGradient
        colors={Colors.surface.gradient}
        locations={[0, 0.55, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Slow-drifting soft light sources for depth */}
      <Animated.View
        style={[
          styles.glow,
          styles.glowViolet,
          { transform: [{ translateX: drift1X }, { translateY: drift1Y }, { scale: drift1S }] },
        ]}
      />
      <Animated.View
        style={[
          styles.glow,
          styles.glowBlue,
          { transform: [{ translateX: drift2X }, { translateY: drift2Y }, { scale: drift2S }] },
        ]}
      />

      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity activeOpacity={0.7} style={styles.iconPill}>
            <Menu size={20} color={Colors.onDark.secondary} strokeWidth={1.8} />
          </TouchableOpacity>

          <View style={styles.titleBlock}>
            <Text style={styles.title}>JISSI</Text>
            <Text style={styles.subtitle}>AI Assistant</Text>
          </View>

          <TouchableOpacity activeOpacity={0.7} style={styles.iconPill}>
            <Settings size={20} color={Colors.onDark.secondary} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>

        {/* Status pill */}
        <View style={styles.statusWrap}>
          <BlurView intensity={24} tint="dark" style={styles.statusPill}>
            <View style={[styles.statusDot, { backgroundColor: phaseColor(phase) }]} />
            <Text style={styles.statusText}>{phaseLabel(phase, isSupported)}</Text>
          </BlurView>
        </View>

        {/* Central area: conversation when active, orb when idle */}
        <View style={styles.orbArea}>
          {messages.length > 0 ? (
            <ScrollView
              ref={scrollRef}
              style={styles.messages}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
            >
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </ScrollView>
          ) : (
            <Animated.View style={[styles.orbWrap, { transform: [{ translateY: floatY }] }]}>
              <Animated.View
                style={[styles.halo, { opacity: glowOpacity, transform: [{ scale: ringScale }] }]}
              />
              <Animated.View
                style={[styles.ring, { opacity: glowOpacity, transform: [{ scale: ringScale }] }]}
              />
              <Animated.View style={[styles.orb, { transform: [{ scale: orbScale }] }]}>
                <LinearGradient
                  colors={Colors.premiumGradient.orb}
                  start={{ x: 0.15, y: 0.1 }}
                  end={{ x: 0.85, y: 0.95 }}
                  style={styles.orbFill}
                >
                  <View style={styles.orbHighlight} />
                  <Sparkles size={30} color={Colors.onDark.primary} strokeWidth={1.4} />
                </LinearGradient>
              </Animated.View>
            </Animated.View>
          )}
        </View>

        {/* Live transcript / interim / error / thinking (single slot) */}
        {error ? (
          <Text style={[styles.tagline, styles.errorText]}>{error}</Text>
        ) : phase === 'thinking' ? (
          <ThinkingDots />
        ) : (
          <Text style={[styles.tagline, hasTranscript && styles.taglineActive]}>
            {interimTranscript || transcript || 'Your luxury AI companion'}
          </Text>
        )}

        {/* Bottom mic dock — wired to startListening / stopListening */}
        <View style={styles.micArea}>
          <BlurView intensity={36} tint="dark" style={styles.micCard}>
            <View style={styles.micButtonWrap}>
              {isListening && (
                <Animated.View
                  style={[styles.micGlowRing, { transform: [{ scale: micGlowScale }], opacity: micGlowOpacity }]}
                />
              )}
              <TouchableOpacity
                activeOpacity={0.85}
                style={{ opacity: isSupported ? 1 : 0.4 }}
                onPress={handleMic}
                disabled={!isSupported}
              >
                <LinearGradient
                  colors={isActive ? Colors.premiumGradient.micActive : Colors.premiumGradient.micIdle}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.micBtn}
                >
                  <Mic size={26} color={Colors.onDark.primary} strokeWidth={2} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
            <Text style={styles.micHint}>
              {!isSupported ? 'Unavailable here' : isActive ? 'Tap to stop' : 'Tap to speak'}
            </Text>
          </BlurView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface.void },
  safe: { flex: 1, paddingHorizontal: Spacing.screen },

  glow: { position: 'absolute', borderRadius: Radius.circle },
  glowViolet: { width: 380, height: 380, top: -130, left: -110, backgroundColor: Colors.ambient.violet },
  glowBlue: { width: 360, height: 360, bottom: -90, right: -130, backgroundColor: Colors.ambient.blue },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.md },
  iconPill: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.frost.fill,
    borderWidth: 1,
    borderColor: Colors.frost.border,
  },
  titleBlock: { alignItems: 'center', flex: 1 },
  title: {
    fontSize: 34,
    fontFamily: 'Exo2_700Bold',
    letterSpacing: 12,
    color: Colors.onDark.primary,
    textShadowColor: Colors.ambient.halo,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  subtitle: {
    fontSize: 10,
    color: Colors.onDark.muted,
    letterSpacing: 4,
    marginTop: 4,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
  },

  statusWrap: { alignItems: 'center', marginTop: Spacing.xl },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.frost.border,
    backgroundColor: Colors.frost.fill,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: {
    fontSize: 11,
    color: Colors.onDark.secondary,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },

  orbArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messages: { alignSelf: 'stretch', flex: 1 },
  messagesContent: { paddingVertical: Spacing.lg, gap: Spacing.xs },

  orbWrap: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: Colors.ambient.halo },
  ring: {
    position: 'absolute',
    width: 268,
    height: 268,
    borderRadius: 134,
    borderWidth: 1,
    borderColor: Colors.frost.border,
  },
  orb: { width: 196, height: 196, borderRadius: 98, ...Elevation.orbDark },
  orbFill: { flex: 1, borderRadius: 98, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  orbHighlight: {
    position: 'absolute',
    top: 22,
    left: 38,
    width: 66,
    height: 38,
    borderRadius: 38,
    backgroundColor: Colors.frost.specular,
    transform: [{ rotate: '-20deg' }],
  },

  tagline: {
    textAlign: 'center',
    color: Colors.onDark.muted,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    letterSpacing: 0.5,
  },
  taglineActive: { color: Colors.onDark.secondary },
  errorText: { color: Colors.status.error },

  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 18,
    marginBottom: Spacing.md,
  },
  thinkingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.onDark.secondary },

  micArea: { paddingBottom: Spacing.xl },
  micCard: {
    borderRadius: Radius.xl3,
    overflow: 'hidden',
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.frost.border,
    backgroundColor: Colors.frost.fill,
  },
  micButtonWrap: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  micGlowRing: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.ambient.micGlow,
  },
  micBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    ...Elevation.micDark,
  },
  micHint: {
    fontSize: 12,
    color: Colors.onDark.muted,
    fontFamily: 'Inter_400Regular',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
