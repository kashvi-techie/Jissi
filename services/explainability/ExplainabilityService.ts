import type { LifeDecision } from '@/services/life';
import { LifeEngine } from '@/services/life';
import type { PlannerAgendaItem } from '@/services/planner';
import { PlannerEngine } from '@/services/planner';
import type { ProactiveSuggestion } from '@/services/proactive';
import { ProactiveExperience } from '@/services/proactive';
import type { RelationshipProfile } from '@/services/relationships';
import { RelationshipService } from '@/services/relationships';
import type { ExplainabilitySnapshot, ExplanationItem } from './types';

function now(): string {
  return new Date().toISOString();
}

function label(value: string): string {
  return value.replace(/_/g, ' ').trim();
}

function formatHour(hour: string): string {
  const value = Number(hour);
  if (Number.isNaN(value)) return `${hour}:00`;
  const suffix = value >= 12 ? 'PM' : 'AM';
  const normalized = value % 12 || 12;
  return `${normalized} ${suffix}`;
}

function relativeDay(value?: string): string {
  if (!value) return 'recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startToday - startDate) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

function explainObservedReason(reason: string, fallback: string): string {
  const observed = reason.match(/Observed\s+(\d+)\s+(.+?)\s+signals.*between\s+(\d+):00\s+and\s+(\d+):00/i);
  if (observed) {
    return `Because you've repeated ${label(observed[2]).toLowerCase()} ${observed[1]} times around ${formatHour(observed[3])}-${formatHour(observed[4])}.`;
  }
  const localEntries = reason.match(/(\d+)\s+local memory entries/i);
  if (localEntries) {
    return `Because JISSI has ${localEntries[1]} local memories that can make this more personal.`;
  }
  if (/priority/i.test(reason)) return fallback;
  if (/active task context/i.test(reason)) return fallback;
  return reason.trim() ? `Because ${reason.trim().replace(/\.$/, '').toLowerCase()}.` : fallback;
}

class ExplainabilityServiceImpl {
  explainProactiveSuggestion(suggestion: ProactiveSuggestion): string {
    switch (suggestion.source) {
      case 'behavior':
        return explainObservedReason(suggestion.reason, 'Because your recent routine points to this moment.');
      case 'planner':
        return `Because "${suggestion.title}" is a useful next step in your current plan.`;
      case 'emotion':
        return 'Because recent local signals suggest a gentler pace may help right now.';
      case 'context':
        return `Because your current context still points to ${suggestion.title.replace(/^Resume\s+/i, '').toLowerCase()}.`;
      case 'memory':
        return explainObservedReason(suggestion.reason, 'Because saved local memories can make this check-in more personal.');
      default:
        return 'Because local signals suggest this may be useful now.';
    }
  }

  explainPlannerAgendaItem(item: PlannerAgendaItem): string {
    if (item.priority === 1) {
      return `Because "${item.title}" is the highest priority next step for ${item.goalTitle}.`;
    }
    return `Because "${item.title}" moves ${item.goalTitle} forward today.`;
  }

  explainRelationshipReminder(profile: RelationshipProfile): string {
    const lastTalked = relativeDay(profile.lastDiscussed);
    if (lastTalked === 'today') {
      return `Because ${profile.name} was part of your journey today.`;
    }
    if (profile.likes[0]) {
      return `Because you haven't talked about ${profile.name} since ${lastTalked}, and JISSI remembers they like ${profile.likes[0]}.`;
    }
    return `Because you haven't talked about ${profile.name} since ${lastTalked}.`;
  }

  explainLifeDecision(decision: LifeDecision): string {
    if (decision.actionType === 'silent') {
      return 'Because there is no strong local signal that JISSI should interrupt right now.';
    }
    if (decision.actionType === 'congratulate') {
      return 'Because your planner progress and journey timeline point to a completed milestone.';
    }
    if (decision.actionType === 'motivate') {
      return 'Because your recent progress suggests a smaller, kinder next step may help.';
    }
    if (decision.actionType === 'remind') {
      return 'Because there is a pending plan or routine that is relevant right now.';
    }
    if (decision.actionType === 'proactive_help') {
      return explainObservedReason(decision.reason, 'Because your local routines, context and plan are pointing in the same direction.');
    }
    if (decision.actionType === 'ask_question') {
      return 'Because a lightweight question may help without taking action for you.';
    }
    return decision.explanation || 'Because local signals suggest this is the right moment.';
  }

  async getSnapshot(): Promise<ExplainabilitySnapshot> {
    const [proactive, planner, relationships, life] = await Promise.all([
      ProactiveExperience.getSnapshot().catch(() => null),
      PlannerEngine.getSnapshot().catch(() => null),
      RelationshipService.getProfiles().catch(() => []),
      LifeEngine.getSnapshot().catch(() => null),
    ]);
    const timestamp = now();
    const items: ExplanationItem[] = [];

    proactive?.suggestions.slice(0, 8).forEach((suggestion) => {
      items.push({
        id: `proactive:${suggestion.id}`,
        kind: 'proactive',
        title: suggestion.title,
        message: suggestion.message,
        explanation: this.explainProactiveSuggestion(suggestion),
        sourceSystems: [suggestion.source],
        createdAt: timestamp,
      });
    });

    planner?.agenda.items.slice(0, 8).forEach((item) => {
      items.push({
        id: `planner:${item.goalId}:${item.taskId}`,
        kind: 'planner',
        title: item.title,
        message: `Next step for ${item.goalTitle}.`,
        explanation: this.explainPlannerAgendaItem(item),
        sourceSystems: ['planner'],
        createdAt: timestamp,
      });
    });

    relationships.slice(0, 8).forEach((profile) => {
      items.push({
        id: `relationship:${profile.id}`,
        kind: 'relationship',
        title: profile.name,
        message: `${label(profile.relationship)} relationship memory.`,
        explanation: this.explainRelationshipReminder(profile),
        sourceSystems: ['relationship', 'memory'],
        createdAt: timestamp,
      });
    });

    if (life) {
      [life.chosenAction, ...life.candidates.slice(0, 5)].forEach((decision) => {
        items.push({
          id: `life:${decision.id}`,
          kind: 'life',
          title: decision.title,
          message: decision.message,
          explanation: this.explainLifeDecision(decision),
          sourceSystems: ['life', ...decision.sources],
          createdAt: timestamp,
        });
      });
    }

    return { generatedAt: timestamp, items };
  }

  async exportJson(): Promise<string> {
    return JSON.stringify(await this.getSnapshot(), null, 2);
  }
}

export const ExplainabilityService = new ExplainabilityServiceImpl();
