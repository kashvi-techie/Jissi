import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { MessageCircleHeart } from 'lucide-react-native';
import { AppText, GlassSurface, Screen } from '@/components/ui';
import { HumanConversationEngine, HumanConversationResult } from '@/services/conversation';
import { useTheme } from '@/theme';
import { Fonts } from '@/theme/typography';
import { Radii, Spacing } from '@/theme/tokens';

const SAMPLE_USER = 'I got selected for the interview!';
const SAMPLE_RESPONSE = 'Congratulations. I can help you prepare for the next round.';

export default function HumanConversationDebugScreen() {
  const theme = useTheme();
  const [userInput, setUserInput] = useState(SAMPLE_USER);
  const [response, setResponse] = useState(SAMPLE_RESPONSE);
  const [result, setResult] = useState<HumanConversationResult>(() => HumanConversationEngine.getLastResult());

  const runPreview = async () => {
    const next = await HumanConversationEngine.process({ userInput, response });
    setResult(next);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <GlassSurface intensity={34} radius={Radii.circle} style={styles.badge}>
            <MessageCircleHeart size={28} color={theme.colors.accent} strokeWidth={1.7} />
          </GlassSurface>
          <View style={styles.headerText}>
            <AppText style={styles.title} color="primary">
              Human Conversation Debug
            </AppText>
            <AppText variant="caption" color="muted">
              Deterministic post-processing before replies are shown or spoken.
            </AppText>
          </View>
        </View>

        <GlassSurface intensity={28} radius={Radii.xl} style={styles.card}>
          <AppText variant="label" color="muted" uppercase>
            User input
          </AppText>
          <TextInput
            value={userInput}
            onChangeText={setUserInput}
            multiline
            placeholder="Type a user message"
            placeholderTextColor="rgba(255,255,255,0.38)"
            style={[styles.input, { color: theme.colors.textPrimary }]}
          />
          <AppText variant="label" color="muted" uppercase>
            Response before
          </AppText>
          <TextInput
            value={response}
            onChangeText={setResponse}
            multiline
            placeholder="Type an assistant response"
            placeholderTextColor="rgba(255,255,255,0.38)"
            style={[styles.input, styles.responseInput, { color: theme.colors.textPrimary }]}
          />
          <Pressable onPress={runPreview} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
            <AppText variant="bodyStrong" color="primary">
              Preview Humanized Reply
            </AppText>
          </Pressable>
        </GlassSurface>

        <GlassSurface intensity={28} radius={Radii.xl} style={styles.card}>
          <Line label="Detected tone" value={result.detectedTone} />
          <Line label="Conversation type" value={result.conversationType} />
          <Line label="Applied modifiers" value={result.appliedModifiers.length ? result.appliedModifiers.join(', ') : 'None'} />
          <Line label="Memory callback" value={result.memoryCallback ?? 'None'} />
        </GlassSurface>

        <GlassSurface intensity={22} radius={Radii.xl} style={styles.card}>
          <AppText variant="label" color="muted" uppercase>
            Before
          </AppText>
          <AppText variant="body" color="primary" style={styles.preview}>
            {result.responseBefore || 'No response processed yet.'}
          </AppText>
          <View style={styles.divider} />
          <AppText variant="label" color="muted" uppercase>
            After
          </AppText>
          <AppText variant="bodyStrong" color="primary" style={styles.preview}>
            {result.responseAfter || 'Run a preview to see the final reply.'}
          </AppText>
        </GlassSurface>
      </ScrollView>
    </Screen>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <AppText variant="footnote" color="muted">
        {label}
      </AppText>
      <AppText variant="caption" color="primary" style={styles.lineValue}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, paddingTop: 56, paddingBottom: 120, gap: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  badge: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: Spacing.xs },
  title: { fontFamily: Fonts.bodyBold, fontSize: 34, lineHeight: 40, letterSpacing: 0 },
  card: { padding: Spacing.lg, gap: Spacing.md },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    fontFamily: Fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  responseInput: { minHeight: 92, textAlignVertical: 'top' },
  button: {
    minHeight: 48,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(93,220,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(93,220,255,0.34)',
  },
  buttonPressed: { transform: [{ scale: 0.98 }], opacity: 0.86 },
  line: { gap: 4 },
  lineValue: { lineHeight: 21 },
  preview: { lineHeight: 24 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: Spacing.xs },
});
