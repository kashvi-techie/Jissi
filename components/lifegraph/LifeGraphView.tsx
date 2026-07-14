import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg from 'react-native-svg';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Minus, Plus, RotateCcw } from 'lucide-react-native';
import { LifeEdge } from './LifeEdge';
import { LifeNode } from './LifeNode';
import { AppText, GlassSurface, PressableScale } from '@/components/ui';
import type { LifeGraph, LifeGraphSelection } from '@/services/lifegraph';
import { LifeGraphEngine } from '@/services/lifegraph';
import { useTheme } from '@/theme';
import { Fonts } from '@/theme/typography';
import { Radii, Spacing } from '@/theme/tokens';

const CANVAS = { width: 1040, height: 720 };

export function LifeGraphView({ graph }: { graph: LifeGraph }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [selectedId, setSelectedId] = useState('me');
  const [scale, setScale] = useState(width < 700 ? 0.72 : 0.9);
  const [offset, setOffset] = useState({ x: width < 700 ? -260 : -80, y: width < 700 ? -80 : 0 });
  const startRef = useRef(offset);
  const nodeMap = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const selection = useMemo<LifeGraphSelection | null>(() => LifeGraphEngine.selectNode(graph, selectedId), [graph, selectedId]);
  const connectedEdgeIds = useMemo(() => new Set(selection?.edges.map((edge) => edge.id) ?? []), [selection]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3,
    onPanResponderGrant: () => {
      startRef.current = offset;
    },
    onPanResponderMove: (_, gesture) => {
      setOffset({ x: startRef.current.x + gesture.dx, y: startRef.current.y + gesture.dy });
    },
  }), [offset]);

  const zoom = (delta: number) => setScale((current) => Math.max(0.55, Math.min(1.45, Number((current + delta).toFixed(2)))));
  const reset = () => {
    setScale(width < 700 ? 0.72 : 0.9);
    setOffset({ x: width < 700 ? -260 : -80, y: width < 700 ? -80 : 0 });
  };

  return (
    <View style={styles.root}>
      <View style={styles.graphPanel} {...panResponder.panHandlers}>
        <View
          style={[
            styles.canvas,
            {
              width: CANVAS.width,
              height: CANVAS.height,
              transform: [{ translateX: offset.x }, { translateY: offset.y }, { scale }],
            },
          ]}
        >
          <Svg width={CANVAS.width} height={CANVAS.height} style={StyleSheet.absoluteFill}>
            {graph.edges.map((edge) => {
              const source = nodeMap.get(edge.source);
              const target = nodeMap.get(edge.target);
              if (!source || !target) return null;
              return <LifeEdge key={edge.id} edge={edge} source={source} target={target} selected={connectedEdgeIds.has(edge.id)} />;
            })}
          </Svg>
          {graph.nodes.map((node) => (
            <LifeNode key={node.id} node={node} selected={node.id === selectedId} onPress={() => setSelectedId(node.id)} />
          ))}
        </View>
      </View>

      <View style={styles.controls}>
        <Control icon={Plus} label="Zoom in" onPress={() => zoom(0.1)} />
        <Control icon={Minus} label="Zoom out" onPress={() => zoom(-0.1)} />
        <Control icon={RotateCcw} label="Reset graph" onPress={reset} />
      </View>

      <Animated.View entering={FadeInUp.duration(360)} style={styles.detailWrap}>
        <GlassSurface intensity={34} radius={Radii.xxl} style={styles.detail}>
          {selection ? (
            <>
              <View style={styles.detailHeader}>
                <View>
                  <AppText style={styles.detailTitle} color="primary" numberOfLines={2}>
                    {selection.node.title}
                  </AppText>
                  <AppText variant="caption" color="accent" style={styles.capitalize}>
                    {selection.node.type}
                  </AppText>
                </View>
                <AppText variant="caption" color="muted">
                  {Math.round(selection.node.confidence * 100)}%
                </AppText>
              </View>
              <Line label="Reason" value={selection.node.reason} />
              <Line label="Connected" value={selection.connectedNodes.map((node) => node.title).join(', ') || 'No connected nodes yet.'} />
              <Line label="Last updated" value={formatDate(selection.node.lastUpdated)} />
              <Line label="Edge reasons" value={selection.edges.slice(0, 3).map((edge) => edge.reason).join(' ')} />
            </>
          ) : (
            <AppText variant="body" color="muted">
              Select a node to inspect why it exists.
            </AppText>
          )}
        </GlassSurface>
      </Animated.View>
      <View pointerEvents="none" style={[styles.glow, { backgroundColor: theme.colors.accentSoft }]} />
    </View>
  );
}

function Control({ icon: Icon, label, onPress }: { icon: typeof Plus; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.control}>
      <Icon size={18} color={theme.colors.textSecondary} strokeWidth={1.8} />
    </PressableScale>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <AppText variant="footnote" color="muted">
        {label}
      </AppText>
      <AppText variant="caption" color="primary">
        {value}
      </AppText>
    </View>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const styles = StyleSheet.create({
  root: { minHeight: 680, overflow: 'hidden', borderRadius: Radii.xxxl },
  graphPanel: { minHeight: 680, backgroundColor: 'rgba(2,8,18,0.42)', overflow: 'hidden' },
  canvas: { position: 'absolute', left: 0, top: 0 },
  controls: { position: 'absolute', top: 18, right: 18, flexDirection: 'row', gap: 8 },
  control: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  detailWrap: { position: 'absolute', left: 18, right: 18, bottom: 18 },
  detail: { padding: Spacing.lg, gap: Spacing.md },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.md },
  detailTitle: { fontFamily: Fonts.bodyBold, fontSize: 24, lineHeight: 30, letterSpacing: 0 },
  capitalize: { textTransform: 'capitalize' },
  line: { gap: 3 },
  glow: { position: 'absolute', width: 260, height: 260, borderRadius: 130, right: -80, top: -70, opacity: 0.32 },
});
