import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BehaviorEngine } from '@/services/behavior';
import { ContextEngine } from '@/services/context';
import { ConversationRepository } from '@/services/conversation';
import { PlannerEngine } from '@/services/planner';
import { memoryStore } from '@/services/tools/memory/MemoryStore';
import { TimelineEvent, TimelineMetadata, TimelineSnapshot } from './types';

const METADATA_KEY = '@jissi/timeline/metadata';

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = Platform.OS === 'web' && typeof localStorage !== 'undefined'
      ? localStorage.getItem(key)
      : await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  const raw = JSON.stringify(value);
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(key, raw);
    return;
  }
  await AsyncStorage.setItem(key, raw);
}

function applyMetadata(event: Omit<TimelineEvent, 'pinned' | 'favorite' | 'note'>, metadata: Record<string, TimelineMetadata>): TimelineEvent {
  const item = metadata[event.id];
  return {
    ...event,
    pinned: !!item?.pinned,
    favorite: !!item?.favorite,
    note: item?.note,
  };
}

function titleFromConversation(title: string | undefined, fallback: string): string {
  const cleaned = title?.trim();
  if (!cleaned) return fallback;
  return cleaned.length > 52 ? `${cleaned.slice(0, 49)}...` : cleaned;
}

class TimelineServiceImpl {
  async getSnapshot(): Promise<TimelineSnapshot> {
    const [planner, behavior, context, conversations, memories, metadata] = await Promise.all([
      PlannerEngine.getSnapshot(),
      BehaviorEngine.getSnapshot(),
      ContextEngine.getCurrentContext(),
      ConversationRepository.getAllConversations(),
      memoryStore.recall().catch(() => []),
      this.getMetadata(),
    ]);

    const events: TimelineEvent[] = [];

    planner.goals.forEach((goal) => {
      events.push(applyMetadata({
        id: `planner:goal:${goal.id}:created`,
        title: `Started ${goal.title}`,
        description: goal.motivation,
        timestamp: goal.createdAt,
        source: 'planner',
        filter: goal.domain === 'react' || goal.domain === 'learning' ? 'learning' : goal.domain === 'career' ? 'projects' : 'goals',
        icon: goal.domain === 'react' || goal.domain === 'learning' ? 'learning' : 'goal',
      }, metadata));

      if (goal.status === 'completed') {
        events.push(applyMetadata({
          id: `planner:goal:${goal.id}:completed`,
          title: `Finished ${goal.title}`,
          description: `${goal.progress.completedTasks}/${goal.progress.totalTasks} tasks completed.`,
          timestamp: goal.updatedAt,
          source: 'planner',
          filter: 'achievements',
          icon: 'achievement',
        }, metadata));
      }

      goal.milestones.filter((milestone) => milestone.status === 'completed').forEach((milestone) => {
        events.push(applyMetadata({
          id: `planner:milestone:${milestone.id}:completed`,
          title: milestone.title,
          description: `Milestone achieved for ${goal.title}.`,
          timestamp: milestone.targetDate ?? goal.updatedAt,
          source: 'planner',
          filter: 'achievements',
          icon: 'achievement',
        }, metadata));
      });

      goal.milestones.flatMap((milestone) => milestone.tasks).filter((task) => task.status === 'completed' && task.completedAt).forEach((task) => {
        events.push(applyMetadata({
          id: `planner:task:${task.id}:completed`,
          title: task.title,
          description: task.description,
          timestamp: task.completedAt,
          source: 'planner',
          filter: /react|learn|study|gate|coding|code/i.test(`${goal.title} ${task.title}`) ? 'learning' : 'goals',
          icon: /react|learn|study|gate|coding|code/i.test(`${goal.title} ${task.title}`) ? 'learning' : 'goal',
        }, metadata));
      });
    });

    behavior.routines.forEach((routine) => {
      events.push(applyMetadata({
        id: `behavior:routine:${routine.id}`,
        title: `New habit detected: ${routine.label}`,
        description: routine.reason,
        timestamp: routine.createdAt,
        source: 'behavior',
        filter: 'habits',
        icon: 'habit',
        confidence: routine.confidence,
      }, metadata));
    });

    context.relationships.forEach((relationship) => {
      events.push(applyMetadata({
        id: `context:relationship:${relationship.id}`,
        title: relationship.name ? `Met ${relationship.name}` : `Added ${relationship.relationship}`,
        description: `${relationship.relationship.replace('_', ' ')} context added to JISSI.`,
        timestamp: relationship.firstSeenAt,
        source: 'context',
        filter: 'people',
        icon: 'person',
        confidence: relationship.confidence,
      }, metadata));
    });

    conversations.filter((conversation) => conversation.messages.length >= 2).slice(0, 60).forEach((conversation) => {
      const userMessages = conversation.messages.filter((message) => message.role === 'user').length;
      events.push(applyMetadata({
        id: `conversation:${conversation.id}`,
        title: titleFromConversation(conversation.title, 'Important conversation'),
        description: `${userMessages} user message${userMessages === 1 ? '' : 's'} remembered in this conversation.`,
        timestamp: conversation.updatedAt || conversation.createdAt,
        source: 'conversation',
        filter: /react|gate|learn|study|coding|project|jissi/i.test(conversation.title ?? '') ? 'learning' : 'projects',
        icon: 'conversation',
      }, metadata));
    });

    memories.slice(0, 80).forEach((memory) => {
      events.push(applyMetadata({
        id: `memory:${memory.key}`,
        title: `Memory: ${memory.key}`,
        description: memory.value,
        source: 'memory',
        filter: /goal|learn|study|react|gate|coding/i.test(`${memory.key} ${memory.value}`) ? 'learning' : 'projects',
        icon: 'memory',
      }, metadata));
    });

    const completedGoals = planner.goals.filter((goal) => goal.status === 'completed').length;
    const milestonesAchieved = planner.goals.flatMap((goal) => goal.milestones).filter((milestone) => milestone.status === 'completed').length;

    return {
      events: events.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return bTime - aTime;
      }),
      stats: {
        completedGoals,
        habitsDetected: behavior.routines.length,
        conversationsRemembered: conversations.length,
        milestonesAchieved,
      },
    };
  }

  async togglePinned(eventId: string): Promise<void> {
    const metadata = await this.getMetadata();
    const current = metadata[eventId] ?? { updatedAt: new Date().toISOString() };
    await this.saveMetadata({
      ...metadata,
      [eventId]: { ...current, pinned: !current.pinned, updatedAt: new Date().toISOString() },
    });
  }

  async toggleFavorite(eventId: string): Promise<void> {
    const metadata = await this.getMetadata();
    const current = metadata[eventId] ?? { updatedAt: new Date().toISOString() };
    await this.saveMetadata({
      ...metadata,
      [eventId]: { ...current, favorite: !current.favorite, updatedAt: new Date().toISOString() },
    });
  }

  async saveNote(eventId: string, note: string): Promise<void> {
    const metadata = await this.getMetadata();
    const current = metadata[eventId] ?? { updatedAt: new Date().toISOString() };
    await this.saveMetadata({
      ...metadata,
      [eventId]: { ...current, note: note.trim() || undefined, updatedAt: new Date().toISOString() },
    });
  }

  private async getMetadata(): Promise<Record<string, TimelineMetadata>> {
    return readJson<Record<string, TimelineMetadata>>(METADATA_KEY, {});
  }

  private async saveMetadata(metadata: Record<string, TimelineMetadata>): Promise<void> {
    await writeJson(METADATA_KEY, metadata);
  }
}

export const TimelineService = new TimelineServiceImpl();
