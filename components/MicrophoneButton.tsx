import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Pressable, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Mic } from 'lucide-react-native';
import { JISSI } from '@/constants/jissiPalette';

interface MicrophoneButtonProps {
  isListening: boolean;
  onPress: () => void;
}

export function MicrophoneButton({ isListening, onPress }: MicrophoneButtonProps) {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isListening) return;
    const mk = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.timing(v, {
          toValue: 1,
          duration: 1800,
          delay,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        })
      );
    const a = mk(ring1, 0);
    const b = mk(ring2, 900);
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
      ring1.setValue(0);
      ring2.setValue(0);
    };
  }, [isListening, ring1, ring2]);

  const ringStyle = (v: Animated.Value) => ({
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) }],
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
  });

  return (
    <View style={styles.wrap}>
      {isListening && <Animated.View style={[styles.ring, ringStyle(ring1)]} />}
      {isListening && <Animated.View style={[styles.ring, ringStyle(ring2)]} />}
      <Animated.View style={{ transform: [{ scale: press }] }}>
        <Pressable
          onPress={onPress}
          onPressIn={() => Animated.spring(press, { toValue: 0.94, useNativeDriver: true }).start()}
          onPressOut={() => Animated.spring(press, { toValue: 1, useNativeDriver: true }).start()}
        >
          <LinearGradient
            colors={isListening ? [JISSI.pink, JISSI.lavender] : [JISSI.lavender, JISSI.blue]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.button}
          >
            <Mic size={40} color="#FFFFFF" strokeWidth={2} />
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: JISSI.lavender },
  button: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: JISSI.lavender,
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
});
