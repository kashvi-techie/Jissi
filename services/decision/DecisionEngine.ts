import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IntentResult } from '@/engine/intentEngine';
import { BehaviorEngine } from '@/services/behavior';
import { ContextEngine } from '@/services/context';
import { EmotionEngine } from '@/services/emotion';
import { LifeEngine } from '@/services/life';
import { PlannerEngine } from '@/services/planner';
import { TimelineService } from '@/services/timeline';
import { memoryStore } from '@/services/tools/memory/MemoryStore';
import {
  DecisionAction,
  DecisionCandidate,
  DecisionInput,
  DecisionResult,
  DecisionSnapshot,
  DecisionSourceSystem,
} from './types';

const LAST_DECISION_KEY = '@jissi/decision/last';
const COOLDOWN_MS = 30 * 60 * 1000;
const THRESHOLD = 0.62;

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return AsyncStorage.getItem(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

function textIncludes(input: string, pattern: RegExp): boolean {
  return pattern.test(input.toLowerCase());
}

function candidate(
  action: DecisionAction,
  confidence: number,
  explanation: string,
  sourceSystems: DecisionSourceSystem[],
  cooldown?: string
): DecisionCandidate {
  return {
    action,
    confidence: clamp(confidence),
    explanation,
    sourceSystems,
    cooldown,
    accepted: false,
  };
}

function actionRank(action: DecisionAction): number {
  const ranks: Record<DecisionAction, number> = {
    relationship_response: 1,
    clarification_required: 2,
    planner_update: 3,
    memory_update: 4,
    congratulate: 5,
    motivate: 6,
    remind: 7,
    proactive_help: 8,
    ask_followup: 9,
    answer_user: 10,
    stay_silent: 11,
  };
  return ranks[action];
}

class DecisionEngineImpl {
  async decide(input: DecisionInput): Promise<DecisionResult> {
    const [life, planner, behavior, emotion, context, timeline, memories, lastSnapshot] = await Promise.all([
      LifeEngine.getDecision(),
      PlannerEngine.getSnapshot(),
      BehaviorEngine.getSnapshot(),
      EmotionEngine.getCurrentEmotion(),
      ContextEngine.getCurrentContext(),
      TimelineService.getSnapshot(),
      memoryStore.recall().catch(() => []),
      this.getLastSnapshot(),
    ]);
    const lowered = input.input.toLowerCase().trim();
    const candidates: DecisionCandidate[] = [];

    candidates.push(candidate('answer_user', 0.58, 'Default safe route: answer the user with the normal AI flow.', ['intent']));

    if (input.intent?.intent === 'social_greeting') {
      candidates.push(candidate('relationship_response', 0.96, 'Intent engine detected a social introduction, so relationship greeting should handle it locally.', ['intent', 'relationship', 'context']));
    }

    if (textIncludes(lowered, /\b(finished|completed|done with|skip|skipped|reschedule|daily agenda|plan my day|what should i do today)\b/)) {
      candidates.push(candidate('planner_update', 0.9, 'Message matches deterministic Planner update or agenda language.', ['planner', 'intent']));
    }

    if (textIncludes(lowered, /\b(remember|save this|note that|my preference|call me)\b/)) {
      candidates.push(candidate('memory_update', 0.82, 'Message appears to update local memory or profile-like preference.', ['memory', 'intent']));
    }

    if (textIncludes(lowered, /\b(who|what|which one|what do you mean|unclear|samajh|explain again)\b/) && context.resolvedReferences.length === 0 && lowered.length < 80) {
      candidates.push(candidate('clarification_required', 0.76, 'Short ambiguous request with no resolved reference available from ContextEngine.', ['context', 'intent']));
    }

    if (life.actionType !== 'silent') {
      const mapped = this.mapLifeAction(life.actionType);
      candidates.push(candidate(mapped, life.confidence, `LifeEngine chose ${life.actionType}: ${life.explanation}`, ['life', ...life.sources], life.cooldownUntil));
    }

    if (planner.goals.some((goal) => goal.status === 'completed')) {
      candidates.push(candidate('congratulate', 0.78, 'Planner has at least one completed goal available.', ['planner', 'timeline']));
    }

    if (emotion.state === 'frustrated' || emotion.state === 'stressed' || emotion.state === 'confused') {
      candidates.push(candidate('motivate', emotion.confidence, `EmotionEngine estimates ${emotion.state}; delivery should reduce friction.`, ['emotion']));
    }

    if (behavior.predictions.length > 0) {
      candidates.push(candidate('proactive_help', behavior.predictions[0].confidence, 'BehaviorEngine has an active routine prediction.', ['behavior']));
    }

    if (planner.agenda.items.length > 0) {
      candidates.push(candidate('remind', 0.74, `Planner agenda has ${planner.agenda.items.length} pending item(s).`, ['planner']));
    }

    if (!lowered && life.actionType === 'silent') {
      candidates.push(candidate('stay_silent', 1, 'No user input and LifeEngine recommends silence.', ['life']));
    }

    if (memories.length > 0 && textIncludes(lowered, /\b(my|mine|preference|remember)\b/)) {
      candidates.push(candidate('ask_followup', 0.68, 'Memory exists and the user referenced personal context; a follow-up may improve precision.', ['memory', 'context']));
    }

    if (timeline.events.some((event) => event.favorite || event.pinned)) {
      candidates.push(candidate('answer_user', 0.61, 'Timeline has pinned/favorite journey context that may enrich a normal answer.', ['timeline']));
    }

    const final = this.choose(candidates, lastSnapshot);
    const result: DecisionResult = {
      action: final.action,
      confidence: final.confidence,
      explanation: final.explanation,
      sourceSystems: final.sourceSystems,
      cooldown: final.cooldown,
      candidates: candidates.map((item) => ({
        ...item,
        accepted: item === final,
        rejectedReason: item === final ? undefined : this.rejectionReason(item, final),
      })),
    };
    await this.saveSnapshot(result);
    return result;
  }

  async getLastSnapshot(): Promise<DecisionSnapshot | null> {
    try {
      const raw = await getItem(LAST_DECISION_KEY);
      return raw ? JSON.parse(raw) as DecisionSnapshot : null;
    } catch {
      return null;
    }
  }

  async exportJson(): Promise<string> {
    return JSON.stringify(await this.getLastSnapshot(), null, 2);
  }

  private choose(candidates: DecisionCandidate[], lastSnapshot: DecisionSnapshot | null): DecisionCandidate {
    const last = lastSnapshot?.finalDecision;
    const now = Date.now();
    const ranked = candidates
      .map((item) => {
        const repeatedRecently =
          last?.action === item.action &&
          now - new Date(lastSnapshot?.generatedAt ?? 0).getTime() < COOLDOWN_MS &&
          item.action !== 'answer_user';
        return {
          ...item,
          confidence: repeatedRecently ? clamp(item.confidence - 0.18) : item.confidence,
          cooldown: repeatedRecently ? new Date(new Date(lastSnapshot?.generatedAt ?? 0).getTime() + COOLDOWN_MS).toISOString() : item.cooldown,
        };
      })
      .filter((item) => item.confidence >= THRESHOLD || item.action === 'answer_user')
      .sort((a, b) => b.confidence - a.confidence || actionRank(a.action) - actionRank(b.action));
    return ranked[0] ?? candidate('answer_user', 0.58, 'Fallback decision when no candidate clears threshold.', ['intent']);
  }

  private rejectionReason(candidateItem: DecisionCandidate, final: DecisionCandidate): string {
    if (candidateItem.confidence < THRESHOLD && candidateItem.action !== 'answer_user') {
      return `Below threshold: ${Math.round(candidateItem.confidence * 100)}%.`;
    }
    if (candidateItem.confidence < final.confidence) {
      return `Lower confidence than final action (${Math.round(final.confidence * 100)}%).`;
    }
    if (candidateItem.confidence === final.confidence && actionRank(candidateItem.action) > actionRank(final.action)) {
      return 'Same confidence, lower deterministic priority.';
    }
    return 'Rejected by deterministic ranking.';
  }

  private mapLifeAction(action: string): DecisionAction {
    switch (action) {
      case 'proactive_help':
        return 'proactive_help';
      case 'congratulate':
        return 'congratulate';
      case 'remind':
        return 'remind';
      case 'motivate':
        return 'motivate';
      case 'ask_question':
        return 'ask_followup';
      default:
        return 'stay_silent';
    }
  }

  private async saveSnapshot(finalDecision: DecisionResult): Promise<void> {
    const snapshot: DecisionSnapshot = {
      finalDecision,
      candidates: finalDecision.candidates,
      generatedAt: new Date().toISOString(),
    };
    await setItem(LAST_DECISION_KEY, JSON.stringify(snapshot));
  }
}

export const DecisionEngine = new DecisionEngineImpl();
