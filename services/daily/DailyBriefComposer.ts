import { BehaviorEngine } from '@/services/behavior';
import { DelightService } from '@/services/delight';
import { EmotionEngine } from '@/services/emotion';
import { OnboardingService } from '@/services/onboarding';
import { PlannerEngine } from '@/services/planner';
import { RelationshipService } from '@/services/relationships';
import { TimelineService } from '@/services/timeline';
import type { DailyBrief, DailyBriefLine, DailyBriefSourceSnapshot } from './DailyBriefTypes';

function dateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function greeting(date: Date, name?: string): string {
  const hour = date.getHours();
  const part = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : hour < 21 ? 'Good Evening' : 'Good Night';
  return name ? `${part}, ${name}` : part;
}

function titleCase(value?: string): string {
  if (!value) return 'Balanced';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function line(label: string, value: string, reason: string, confidence = 0.72): DailyBriefLine {
  return { label, value, reason, confidence };
}

function daysSince(value?: string): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

function upcomingEventText(events: Array<{ title: string; date?: string }>): string | undefined {
  const now = new Date();
  const upcoming = events
    .map((event) => ({ event, date: event.date ? new Date(event.date) : null }))
    .filter((item): item is { event: { title: string; date?: string }; date: Date } => !!item.date && !Number.isNaN(item.date.getTime()))
    .map((item) => ({ ...item, days: Math.ceil((item.date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) }))
    .filter((item) => item.days >= 0 && item.days <= 14)
    .sort((a, b) => a.days - b.days)[0];
  if (!upcoming) return undefined;
  return `${upcoming.event.title} is coming up in ${upcoming.days === 0 ? 'today' : `${upcoming.days} day${upcoming.days === 1 ? '' : 's'}`}.`;
}

export class DailyBriefComposer {
  async compose(showReason: DailyBrief['showReason']): Promise<DailyBrief> {
    const now = new Date();
    const [profile, planner, emotion, behavior, timeline, relationships, delight] = await Promise.all([
      OnboardingService.getProfile().catch(() => null),
      PlannerEngine.getSnapshot().catch(() => null),
      EmotionEngine.getCurrentEmotion().catch(() => null),
      BehaviorEngine.getSnapshot().catch(() => null),
      TimelineService.getSnapshot().catch(() => null),
      RelationshipService.getProfiles().catch(() => []),
      DelightService.getSnapshot().catch(() => null),
    ]);

    const activeGoal = planner?.goals.find((goal) => goal.status !== 'completed') ?? planner?.goals[0];
    const topTask = planner?.agenda.items[0];
    const routine = behavior?.routines[0];
    const staleRelationship = relationships
      .map((person) => ({ person, days: daysSince(person.lastDiscussed) ?? 0 }))
      .sort((a, b) => b.days - a.days)[0];
    const upcomingRelationshipEvent = relationships
      .map((person) => ({ person, text: upcomingEventText(person.importantEvents) }))
      .find((item) => item.text);
    const latestTimeline = timeline?.events[0];
    const achievement = delight?.achievements[0] ?? delight?.newlyUnlocked[0];
    const streak = Math.max(activeGoal?.progress.currentStreak ?? 0, activeGoal?.progress.longestStreak ?? 0);

    const source: DailyBriefSourceSnapshot = {
      name: profile?.nickname || profile?.name,
      mood: emotion?.state,
      moodConfidence: emotion?.confidence,
      moodReason: emotion?.reasons[0],
      focusTitle: topTask?.title ?? activeGoal?.title ?? routine?.label,
      focusReason: topTask?.reason ?? activeGoal?.motivation ?? routine?.reason,
      tasks: (planner?.agenda.items ?? []).slice(0, 3).map((task) => ({
        title: task.title,
        minutes: task.estimatedMinutes,
        reason: task.reason,
        priority: task.priority,
      })),
      relationshipName: upcomingRelationshipEvent?.person.name ?? staleRelationship?.person.name,
      relationshipReason: upcomingRelationshipEvent?.text ?? (staleRelationship?.days
        ? `You have not discussed ${staleRelationship.person.name} for ${staleRelationship.days} day${staleRelationship.days === 1 ? '' : 's'}.`
        : undefined),
      timelineTitle: latestTimeline?.title,
      timelineReason: latestTimeline?.description,
      achievementTitle: achievement?.title ?? (timeline?.stats.milestonesAchieved ? `${timeline.stats.milestonesAchieved} milestones achieved` : undefined),
      achievementReason: achievement?.reason ?? 'Derived from local timeline and planner progress.',
      streak: streak || routine?.eventCount,
      streakReason: streak ? `Planner progress shows a ${streak}-day streak.` : routine ? routine.reason : undefined,
      suggestedAction: topTask ? `Work on ${topTask.title} for ${Math.min(topTask.estimatedMinutes, 30)} minutes.` : routine ? `Start ${routine.label.toLowerCase()} for 30 minutes.` : undefined,
      suggestedActionReason: topTask?.reason ?? routine?.reason,
      companionThought: routine
        ? `You usually show up for ${routine.label.toLowerCase()} around this time.`
        : activeGoal
          ? "I'm proud that you keep returning to your goals."
          : 'One clear step is enough to start the day well.',
    };

    return {
      id: `daily_${dateKey(now)}`,
      date: dateKey(now),
      greeting: greeting(now, source.name),
      moodSummary: line('Mood', titleCase(source.mood), source.moodReason ?? 'Estimated from local emotional signals only.', source.moodConfidence ?? 0.62),
      todaysFocus: line("Today's priority", source.focusTitle ?? 'Choose one meaningful step', source.focusReason ?? 'No active planner item was available, so the brief starts gently.', topTask ? 0.88 : 0.58),
      plannerTasks: source.tasks.length
        ? source.tasks.map((task) => line('Task', `${task.title} · ${task.minutes} min`, task.reason, task.priority === 1 ? 0.86 : 0.72))
        : [line('Task', 'Start one conversation or add one goal.', 'No planner tasks were available locally.', 0.52)],
      relationshipReminder: line('People', source.relationshipName ? source.relationshipReason ?? `Check in with ${source.relationshipName}.` : 'No relationship reminder today.', source.relationshipReason ?? 'No local relationship event needs attention.', source.relationshipName ? 0.74 : 0.42),
      timelineHighlight: line('Journey', source.timelineTitle ?? 'Your story is waiting to be written.', source.timelineReason ?? 'No local timeline highlight was available yet.', source.timelineTitle ? 0.78 : 0.44),
      recentAchievement: line('Achievement', source.achievementTitle ?? 'Your next win is waiting.', source.achievementReason ?? 'No local achievement is unlocked yet.', source.achievementTitle ? 0.8 : 0.48),
      habitStreak: line('Consistency', source.streak ? `${source.streak}-day consistency streak` : 'No streak yet.', source.streakReason ?? 'No routine or planner streak is strong enough yet.', source.streak ? 0.82 : 0.4),
      suggestedAction: line('Suggested first step', source.suggestedAction ?? 'Talk to JISSI for a quick plan.', source.suggestedActionReason ?? 'Fallback action when no planner or routine suggestion exists.', source.suggestedAction ? 0.8 : 0.5),
      companionThought: source.companionThought ?? 'I will keep this simple and useful today.',
      explanation: [
        'Composed locally from onboarding, planner, emotion, behavior, timeline, relationship, and delight snapshots.',
        'No AI model or network request was used.',
        `Shown because of ${showReason.replace('_', ' ')}.`,
      ],
      showReason,
      createdAt: now.toISOString(),
    };
  }
}
