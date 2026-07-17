import React from 'react';
import { GestureResponderEvent, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Springs } from '@/theme/tokens';

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  children?: React.ReactNode;
  /** Scale at full press (depth). */
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A Pressable with a springy press-depth micro-interaction (UI-thread, 60fps via
 * Reanimated). The scale lives on an outer Animated.View so the Pressable keeps
 * its normal hit-testing.
 */
export function PressableScale({
  children,
  scaleTo = 0.96,
  style,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  ...rest
}: PressableScaleProps) {
  const pressed = useSharedValue(0);
  const hovered = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: withSpring(-hovered.value * 2, Springs.press) },
      { scale: withSpring((1 - pressed.value * (1 - scaleTo)) * (1 + hovered.value * 0.012), Springs.press) },
    ],
  }));

  const handleIn = (e: GestureResponderEvent) => {
    pressed.value = 1;
    onPressIn?.(e);
  };
  const handleOut = (e: GestureResponderEvent) => {
    pressed.value = 0;
    onPressOut?.(e);
  };
  const handleHoverIn = (e: any) => {
    hovered.value = 1;
    onHoverIn?.(e);
  };
  const handleHoverOut = (e: any) => {
    hovered.value = 0;
    onHoverOut?.(e);
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable {...rest} onHoverIn={handleHoverIn} onHoverOut={handleHoverOut} onPressIn={handleIn} onPressOut={handleOut} style={style}>
        {children}
      </Pressable>
    </Animated.View>
  );
}
