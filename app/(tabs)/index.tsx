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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Menu, Settings, Mic, Sparkles } from 'lucide-react-native';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { SpeechState } from '@/services/speech/types';

/**
 * PLACEHOLDER HOME (Option A) — pink/blue glassmorphism design, now wired to
 * the real speech pipeline (useSpeechRecognition -> SpeechService).
 *
 * Self-contained UI deps only (react-native + expo-linear-gradient + expo-blur +
 * lucide). The only logic dependency is the restored useSpeechRecognition hook.
 * Replace with the full real HomeScreen in Phase 6.
 */

function statusLabel(state: SpeechState, isSupported: boolean): string {
  if (!isSupported) return 'Unavailable';
  switch (state) {
    case 'listening':
      return 'Listening…';
    case 'processing':
      return 'Processing…';
    case 'error':
      return 'Error';
    default:
      return 'Ready';
  }
}

function statusDotColor(state: SpeechState): string {
  switch (state) {
    case 'listening':
      return '#34D399';
    case 'processing':
      return '#C084FC';
    case 'error':
      return '#FB7185';
    default:
      return '#A88BFF';
  }
}

export default function HomeScreen() {
  const {
    state,
    transcript,
    interimTranscript,
    error,
    isSupported,
    isListening,
    startListening,
    stopListening,
  } = useSpeechRecognition();

  // Gentle "energy" pulse for the orb — RN Animated only (no extra deps).
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: isListening ? 1100 : 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: isListening ? 1100 : 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, isListening]);

  const orbScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, isListening ? 1.12 : 1.06] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, isListening ? 0.95 : 0.8] });
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, isListening ? 1.28 : 1.18] });

  useEffect(() => {
    console.log('[MICDBG] HomeScreen mounted. isSupported =', isSupported);
  }, [isSupported]);

  const handleMic = () => {
    console.log('[MICDBG] handleMic fired. isListening =', isListening);
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Soft pink -> lavender -> blue glassmorphism backdrop */}
      <LinearGradient
        colors={['#FFE3EF', '#F3E8FF', '#E2F0FF']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Blurred colour blobs for depth */}
      <View style={[styles.blob, styles.blobPink]} />
      <View style={[styles.blob, styles.blobBlue]} />

      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <BlurView intensity={40} tint="light" style={styles.iconPill}>
            <TouchableOpacity activeOpacity={0.7} style={styles.iconBtn}>
              <Menu size={20} color="#6D5BD0" strokeWidth={2} />
            </TouchableOpacity>
          </BlurView>

          <View style={styles.titleBlock}>
            <Text style={styles.title}>JISSI</Text>
            <Text style={styles.subtitle}>AI Assistant</Text>
          </View>

          <BlurView intensity={40} tint="light" style={styles.iconPill}>
            <TouchableOpacity activeOpacity={0.7} style={styles.iconBtn}>
              <Settings size={20} color="#6D5BD0" strokeWidth={2} />
            </TouchableOpacity>
          </BlurView>
        </View>

        {/* Status pill */}
        <View style={styles.statusWrap}>
          <BlurView intensity={30} tint="light" style={styles.statusPill}>
            <View style={[styles.statusDot, { backgroundColor: statusDotColor(state) }]} />
            <Text style={styles.statusText}>{statusLabel(state, isSupported)}</Text>
          </BlurView>
        </View>

        {/* Central energy orb */}
        <View style={styles.orbArea}>
          <Animated.View
            style={[styles.ring, { transform: [{ scale: ringScale }], opacity: glowOpacity }]}
          />
          <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />
          <Animated.View style={[styles.orb, { transform: [{ scale: orbScale }] }]}>
            <LinearGradient
              colors={['#8FD3FF', '#A88BFF', '#FF9EC4']}
              start={{ x: 0.1, y: 0.1 }}
              end={{ x: 0.9, y: 0.9 }}
              style={styles.orbFill}
            >
              <View style={styles.orbHighlight} />
              <Sparkles size={34} color="rgba(255,255,255,0.9)" strokeWidth={1.6} />
            </LinearGradient>
          </Animated.View>
        </View>

        {/* Live transcript / interim / error (single slot — design preserved) */}
        {error ? (
          <Text style={[styles.tagline, styles.errorText]}>{error}</Text>
        ) : (
          <Text style={styles.tagline}>
            {interimTranscript || transcript || 'Your luxury AI companion'}
          </Text>
        )}

        {/* Bottom mic area — now wired to startListening / stopListening */}
        <View style={styles.micArea}>
          <BlurView intensity={50} tint="light" style={styles.micCard}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.micBtnWrap}
              onPress={() => {
                console.log('[MICDBG] mic button pressed');
                handleMic();
              }}
            >
              <LinearGradient
                colors={isListening ? ['#FF9EC4', '#A88BFF'] : ['#A88BFF', '#7CB8FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.micBtn}
              >
                <Mic size={28} color="#FFFFFF" strokeWidth={2} />
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.micHint}>
              {!isSupported
                ? 'Speech recognition unavailable here'
                : isListening
                ? 'Tap to stop'
                : 'Tap to speak'}
            </Text>
          </BlurView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3E8FF' },
  safe: { flex: 1, paddingHorizontal: 22 },

  blob: { position: 'absolute', borderRadius: 999 },
  blobPink: { width: 320, height: 320, top: -60, right: -80, backgroundColor: 'rgba(255,158,196,0.45)' },
  blobBlue: { width: 300, height: 300, bottom: 40, left: -90, backgroundColor: 'rgba(124,184,255,0.40)' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 },
  iconPill: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  iconBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { alignItems: 'center', flex: 1 },
  title: {
    fontSize: 36,
    fontFamily: 'Exo2_700Bold',
    letterSpacing: 10,
    color: '#5B4B9E',
    textShadowColor: 'rgba(168,139,255,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  subtitle: { fontSize: 12, color: '#8B83AE', letterSpacing: 1, marginTop: 2, fontFamily: 'Inter_400Regular' },

  statusWrap: { alignItems: 'center', marginTop: 14 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 99,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399' },
  statusText: { fontSize: 13, color: '#5C5680', fontFamily: 'Inter_600SemiBold', letterSpacing: 0.4 },

  orbArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 1,
    borderColor: 'rgba(168,139,255,0.45)',
  },
  glow: {
    position: 'absolute',
    width: 262,
    height: 262,
    borderRadius: 131,
    backgroundColor: 'rgba(168,139,255,0.35)',
  },
  orb: {
    width: 210,
    height: 210,
    borderRadius: 105,
    shadowColor: '#A88BFF',
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  orbFill: {
    flex: 1,
    borderRadius: 105,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orbHighlight: {
    position: 'absolute',
    top: 26,
    left: 40,
    width: 70,
    height: 40,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.45)',
    transform: [{ rotate: '-20deg' }],
  },

  tagline: { textAlign: 'center', color: '#7B7399', fontSize: 14, fontFamily: 'Inter_400Regular', marginBottom: 8, paddingHorizontal: 8 },
  errorText: { color: '#E11D7A' },

  micArea: { paddingBottom: 18 },
  micCard: {
    borderRadius: 28,
    overflow: 'hidden',
    paddingVertical: 22,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  micBtnWrap: { borderRadius: 40 },
  micBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7CB8FF',
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  micHint: { fontSize: 13, color: '#8B83AE', fontFamily: 'Inter_400Regular', letterSpacing: 0.4 },
});
