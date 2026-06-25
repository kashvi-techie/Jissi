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
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { SpeechState } from '@/services/speech/types';
import { useConversation, AssistantState } from '@/hooks/useConversation';
import { MessageBubble } from '@/components/MessageBubble';

/**
 * PLACEHOLDER HOME (Option A) — pink/blue glassmorphism design, now wired to the
 * FULL pipeline: useSpeechRecognition (STT) -> hand-off -> useConversation
 * (intent -> AIService/Gemini -> TTS). UI design preserved; the orb is the idle
 * hero and message bubbles appear once a conversation starts.
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
      return 'Listening…';
    case 'processing':
      return 'Processing…';
    case 'thinking':
      return 'Thinking…';
    case 'speaking':
      return 'Speaking…';
    case 'error':
      return 'Error';
    default:
      return 'Ready';
  }
}

function phaseColor(p: Phase): string {
  switch (p) {
    case 'listening':
      return '#34D399';
    case 'thinking':
    case 'processing':
      return '#C084FC';
    case 'speaking':
      return '#67E8F9';
    case 'error':
      return '#FB7185';
    default:
      return '#A88BFF';
  }
}

export default function HomeScreen() {
  const {
    state: speechState,
    transcript,
    interimTranscript,
    intentResult,
    error: speechError,
    isSupported,
    isListening,
    startListening,
    stopListening,
  } = useSpeechRecognition();

  const {
    state: assistantState,
    messages,
    error: conversationError,
    processInput,
  } = useConversation();

  const phase = computePhase(speechState, assistantState);
  const error = speechError || conversationError;
  const active = isListening || assistantState === 'thinking' || assistantState === 'speaking';

  const scrollRef = useRef<ScrollView>(null);
  const prevTranscriptRef = useRef('');

  // Gentle "energy" pulse for the orb — RN Animated only (faster while active).
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: active ? 1100 : 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: active ? 1100 : 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, active]);

  const orbScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, active ? 1.12 : 1.06] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, active ? 0.95 : 0.8] });
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, active ? 1.28 : 1.18] });

  // HAND-OFF: when a final transcript exists and both machines are idle, process it once.
  useEffect(() => {
    if (
      transcript &&
      transcript.trim().length > 0 &&
      speechState === 'idle' &&
      assistantState === 'idle' &&
      prevTranscriptRef.current !== transcript
    ) {
      prevTranscriptRef.current = transcript;
      processInput(transcript, intentResult);
    }
  }, [transcript, speechState, assistantState, intentResult, processInput]);

  // Auto-scroll to newest message.
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages]);

  const handleMic = () => {
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
            <>
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
            </>
          )}
        </View>

        {/* Live transcript / interim / error (single slot — design preserved) */}
        {error ? (
          <Text style={[styles.tagline, styles.errorText]}>{error}</Text>
        ) : (
          <Text style={styles.tagline}>
            {interimTranscript || transcript || 'Your luxury AI companion'}
          </Text>
        )}

        {/* Bottom mic area — wired to startListening / stopListening */}
        <View style={styles.micArea}>
          <BlurView intensity={50} tint="light" style={styles.micCard}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.micBtnWrap}
              onPress={handleMic}
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
  messages: { alignSelf: 'stretch', flex: 1 },
  messagesContent: { paddingVertical: 12, gap: 2 },
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
