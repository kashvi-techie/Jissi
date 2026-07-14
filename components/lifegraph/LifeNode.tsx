import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Award, Brain, CircleUserRound, Flag, HeartHandshake, MapPin, Sparkles, Target, Trophy } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AppText, GlassSurface, PressableScale } from '@/components/ui';
import type { LifeNode as LifeNodeModel, LifeNodeType } from '@/services/lifegraph';
import { useTheme } from '@/theme';
import { Radii } from '@/theme/tokens';

const ICONS: Record<LifeNodeType, LucideIcon> = {
  me: CircleUserRound,
  person: HeartHandshake,
  project: Brain,
  goal: Target,
  habit: Sparkles,
  place: MapPin,
  interest: Flag,
  achievement: Trophy,
  memory: Award,
};

const NODE_SIZE: Record<LifeNodeType, number> = {
  me: 92,
  person: 76,
  project: 78,
  goal: 78,
  habit: 70,
  place: 68,
  interest: 68,
  achievement: 72,
  memory: 66,
};

export function LifeNode({ node, selected, onPress }: { node: LifeNodeModel; selected?: boolean; onPress: () => void }) {
  const theme = useTheme();
  const Icon = ICONS[node.type];
  const size = NODE_SIZE[node.type];
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${node.title}`}
      style={[
        styles.wrap,
        {
          left: node.x - size / 2,
          top: node.y - size / 2,
          width: size,
          height: size,
        },
      ]}
    >
      <GlassSurface
        intensity={selected || node.type === 'me' ? 42 : 26}
        radius={Radii.circle}
        strong={node.type === 'me'}
        style={[
          styles.node,
          selected && { borderColor: theme.colors.accent, shadowColor: theme.colors.accent, shadowOpacity: 0.55, shadowRadius: 24 },
          node.type === 'me' && { backgroundColor: 'rgba(93,220,255,0.12)' },
        ]}
      >
        <View style={[styles.icon, { backgroundColor: theme.colors.accentSoft }]}>
          <Icon size={node.type === 'me' ? 22 : 17} color={theme.colors.accent} strokeWidth={1.8} />
        </View>
        <AppText variant="footnote" color="primary" numberOfLines={1} style={styles.label}>
          {node.title}
        </AppText>
      </GlassSurface>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  node: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 6 },
  icon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label: { textAlign: 'center', maxWidth: '100%' },
});
