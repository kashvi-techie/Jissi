import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BehaviorEngine } from '@/services/behavior';
import { EmotionEngine } from '@/services/emotion';
import {
  PlannerAgendaItem,
  PlannerConversationResult,
  PlannerDailyAgenda,
  PlannerDomain,
  PlannerGoal,
  PlannerHistoryEntry,
  PlannerMilestone,
  PlannerProgress,
  PlannerSnapshot,
  PlannerTask,
  PlannerTaskState,
} from './types';

const GOALS_KEY = '@jissi/planner/goals';
const HISTORY_KEY = '@jissi/planner/history';
const MAX_HISTORY = 300;
const DAY_MS = 24 * 60 * 60 * 1000;

type GoalTemplate = {
  domain: PlannerDomain;
  title: string;
  motivation: string;
  durationDays: number;
  milestones: Array<{
    title: string;
    description: string;
    tasks: Array<Pick<PlannerTask, 'title' | 'description' | 'estimatedMinutes' | 'priority'>>;
  }>;
};

function id(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function addDays(days: number, from = new Date()): string {
  return new Date(from.getTime() + days * DAY_MS).toISOString();
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function cleanGoalText(input: string): string {
  return input
    .replace(/\b(i want to|i wanna|i need to|my goal is to|my goal is|i am planning to|i'm planning to|help me|please help me|mujhe)\b/gi, ' ')
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

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

async function removeKey(key: string): Promise<void> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
    return;
  }
  await AsyncStorage.removeItem(key);
}

function inferTemplate(input: string): GoalTemplate {
  const text = input.toLowerCase();
  if (/\bgate\b|graduate aptitude test/.test(text)) {
    return {
      domain: 'gate',
      title: 'Crack GATE',
      motivation: 'A steady plan beats panic. We will keep this structured and doable.',
      durationDays: 180,
      milestones: [
        {
          title: 'Map the syllabus',
          description: 'Create the subject list, weak areas, and exam timeline.',
          tasks: [
            { title: 'List GATE subjects', description: 'Write every subject and mark comfort level.', estimatedMinutes: 45, priority: 1 },
            { title: 'Collect previous year papers', description: 'Save papers and identify repeated topics.', estimatedMinutes: 60, priority: 1 },
          ],
        },
        {
          title: 'Build concepts',
          description: 'Cover core subjects with notes and examples.',
          tasks: [
            { title: 'Study engineering mathematics basics', description: 'Revise formulas and solve starter problems.', estimatedMinutes: 90, priority: 1 },
            { title: 'Revise core subject fundamentals', description: 'Pick one core subject and complete one chapter.', estimatedMinutes: 90, priority: 1 },
          ],
        },
        {
          title: 'Practice deeply',
          description: 'Move from reading to problem solving.',
          tasks: [
            { title: 'Solve one previous year set', description: 'Attempt timed questions and review mistakes.', estimatedMinutes: 120, priority: 1 },
            { title: 'Create mistake notebook', description: 'Track patterns instead of repeating them.', estimatedMinutes: 40, priority: 2 },
          ],
        },
        {
          title: 'Mock test rhythm',
          description: 'Use mocks to build speed and confidence.',
          tasks: [
            { title: 'Take first mock test', description: 'Attempt a full mock and note section timing.', estimatedMinutes: 180, priority: 1 },
            { title: 'Review mock mistakes', description: 'Classify mistakes into concept, speed, and careless.', estimatedMinutes: 90, priority: 1 },
          ],
        },
      ],
    };
  }

  if (/\breact\b|reactjs|react\.js/.test(text)) {
    return {
      domain: 'react',
      title: 'Learn React',
      motivation: 'We will turn React from theory into small finished projects.',
      durationDays: 90,
      milestones: [
        {
          title: 'React fundamentals',
          description: 'Understand components, JSX, props, and rendering.',
          tasks: [
            { title: 'Learn JSX and components', description: 'Build three small reusable components.', estimatedMinutes: 60, priority: 1 },
            { title: 'Practice props and state', description: 'Create a counter and a profile card.', estimatedMinutes: 60, priority: 1 },
          ],
        },
        {
          title: 'Hooks and data flow',
          description: 'Use hooks to manage UI state and side effects.',
          tasks: [
            { title: 'Practice useState and useEffect', description: 'Build a searchable list.', estimatedMinutes: 75, priority: 1 },
            { title: 'Create custom hook', description: 'Extract reusable logic into one hook.', estimatedMinutes: 60, priority: 2 },
          ],
        },
        {
          title: 'Projects',
          description: 'Build portfolio-ready mini apps.',
          tasks: [
            { title: 'Build React todo app', description: 'Add create, complete, filter, and persist behavior.', estimatedMinutes: 120, priority: 1 },
            { title: 'Build API project', description: 'Fetch real data and handle loading/error states.', estimatedMinutes: 150, priority: 1 },
          ],
        },
        {
          title: 'Revision and interview prep',
          description: 'Polish concepts and explain your work clearly.',
          tasks: [
            { title: 'Revise React interview questions', description: 'Explain hooks, rendering, props, state, and effects.', estimatedMinutes: 90, priority: 1 },
            { title: 'Polish one React project', description: 'Improve UI, README, and deploy notes.', estimatedMinutes: 120, priority: 2 },
          ],
        },
      ],
    };
  }

  if (/\blose weight\b|weight loss|fitness|workout|gym|walking|fat loss/.test(text)) {
    return {
      domain: 'fitness',
      title: 'Build Fitness Routine',
      motivation: 'Small repeatable habits will matter more than intense one-day bursts.',
      durationDays: 84,
      milestones: [
        {
          title: 'Baseline habits',
          description: 'Start with movement, water, sleep, and simple tracking.',
          tasks: [
            { title: 'Walk for 20 minutes', description: 'Keep it easy enough to repeat tomorrow.', estimatedMinutes: 25, priority: 1 },
            { title: 'Track water intake', description: 'Note daily water without judging the number.', estimatedMinutes: 5, priority: 2 },
          ],
        },
        {
          title: 'Workout rhythm',
          description: 'Create a weekly bodyweight or gym routine.',
          tasks: [
            { title: 'Do beginner workout', description: 'Complete a simple full-body session.', estimatedMinutes: 35, priority: 1 },
            { title: 'Plan weekly workout days', description: 'Choose realistic days and rest days.', estimatedMinutes: 20, priority: 2 },
          ],
        },
        {
          title: 'Recovery',
          description: 'Improve sleep and sustainable consistency.',
          tasks: [
            { title: 'Set sleep target', description: 'Pick a practical bedtime window.', estimatedMinutes: 10, priority: 2 },
            { title: 'Review weekly consistency', description: 'Look at what worked and reschedule what did not.', estimatedMinutes: 20, priority: 2 },
          ],
        },
      ],
    };
  }

  const cleaned = cleanGoalText(input);
  return {
    domain: /\bjob|interview|career|placement\b/.test(text) ? 'career' : /\blearn|study|course\b/.test(text) ? 'learning' : 'generic',
    title: cleaned ? titleCase(cleaned).slice(0, 60) : 'New Personal Goal',
    motivation: 'We will keep this clear, flexible, and practical.',
    durationDays: 60,
    milestones: [
      {
        title: 'Define the outcome',
        description: 'Make the goal specific enough to plan.',
        tasks: [
          { title: 'Write success criteria', description: 'Define what finished means in one paragraph.', estimatedMinutes: 25, priority: 1 },
          { title: 'List constraints', description: 'Note time, resources, and blockers.', estimatedMinutes: 20, priority: 2 },
        ],
      },
      {
        title: 'Build the base',
        description: 'Cover the core material or habit.',
        tasks: [
          { title: 'Complete first learning block', description: 'Spend one focused session on the basics.', estimatedMinutes: 60, priority: 1 },
          { title: 'Create practice notes', description: 'Summarize what you learned and what is unclear.', estimatedMinutes: 30, priority: 2 },
        ],
      },
      {
        title: 'Practice and revise',
        description: 'Turn understanding into repeatable progress.',
        tasks: [
          { title: 'Do one practical exercise', description: 'Apply the goal in a small real task.', estimatedMinutes: 75, priority: 1 },
          { title: 'Review and adjust plan', description: 'Move delayed work without guilt.', estimatedMinutes: 20, priority: 2 },
        ],
      },
    ],
  };
}

function createGoal(rawText: string): PlannerGoal {
  const template = inferTemplate(rawText);
  const createdAt = new Date().toISOString();
  const deadline = addDays(template.durationDays);
  const milestoneSpacing = Math.max(1, Math.floor(template.durationDays / template.milestones.length));
  const milestones: PlannerMilestone[] = template.milestones.map((milestone, milestoneIndex) => ({
    id: id('milestone'),
    title: milestone.title,
    description: milestone.description,
    status: milestoneIndex === 0 ? 'in_progress' : 'pending',
    targetDate: addDays((milestoneIndex + 1) * milestoneSpacing),
    tasks: milestone.tasks.map((task, taskIndex) => ({
      ...task,
      id: id('task'),
      status: milestoneIndex === 0 && taskIndex === 0 ? 'scheduled' : 'pending',
      scheduledFor: milestoneIndex === 0 && taskIndex === 0 ? todayKey() : undefined,
      dueAt: addDays(milestoneIndex * milestoneSpacing + taskIndex + 1),
    })),
  }));

  const goal: PlannerGoal = {
    id: id('goal'),
    title: template.title,
    rawText,
    domain: template.domain,
    status: 'in_progress',
    createdAt,
    updatedAt: createdAt,
    deadline,
    motivation: template.motivation,
    milestones,
    progress: emptyProgress(deadline),
  };

  return recalculateGoal(goal);
}

function emptyProgress(deadline?: string): PlannerProgress {
  return {
    completionPercent: 0,
    consistency: 0,
    currentStreak: 0,
    longestStreak: 0,
    estimatedFinishDate: deadline,
    completedTasks: 0,
    totalTasks: 0,
  };
}

function allTasks(goal: PlannerGoal): PlannerTask[] {
  return goal.milestones.flatMap((milestone) => milestone.tasks);
}

function recalculateGoal(goal: PlannerGoal): PlannerGoal {
  const tasks = allTasks(goal);
  const completedTasks = tasks.filter((task) => task.status === 'completed').length;
  const completionPercent = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const completedDates = [...new Set(tasks.filter((task) => task.completedAt).map((task) => todayKey(new Date(task.completedAt as string))))].sort();
  let currentStreak = 0;
  let longestStreak = 0;
  let previousTime = 0;

  completedDates.forEach((date, index) => {
    const time = new Date(`${date}T00:00:00.000Z`).getTime();
    currentStreak = index === 0 || time - previousTime <= DAY_MS * 1.5 ? currentStreak + 1 : 1;
    longestStreak = Math.max(longestStreak, currentStreak);
    previousTime = time;
  });

  const updatedMilestones = goal.milestones.map((milestone) => {
    const milestoneTasks = milestone.tasks;
    const allDone = milestoneTasks.every((task) => task.status === 'completed');
    const hasStarted = milestoneTasks.some((task) => task.status === 'completed' || task.status === 'in_progress' || task.status === 'scheduled');
    return {
      ...milestone,
      status: allDone ? 'completed' : hasStarted ? 'in_progress' : milestone.status,
    };
  });

  const activeDays = Math.max(1, Math.ceil((Date.now() - new Date(goal.createdAt).getTime()) / DAY_MS));
  const consistency = clamp(completedDates.length / activeDays);
  const remainingTasks = Math.max(0, tasks.length - completedTasks);
  const pacePerDay = Math.max(0.2, completedTasks / activeDays);
  const estimatedFinishDate = remainingTasks === 0 ? new Date().toISOString() : addDays(Math.ceil(remainingTasks / pacePerDay));

  return {
    ...goal,
    milestones: updatedMilestones,
    status: completionPercent >= 100 ? 'completed' : goal.status === 'completed' ? 'completed' : 'in_progress',
    updatedAt: new Date().toISOString(),
    progress: {
      completionPercent,
      consistency,
      currentStreak,
      longestStreak,
      estimatedFinishDate,
      completedTasks,
      totalTasks: tasks.length,
    },
  };
}

function isGoalCreation(input: string): boolean {
  const text = input.toLowerCase();
  return (
    /\b(i want to|i wanna|i need to|my goal is|i am planning to|i'm planning to|mujhe|help me)\b/.test(text) &&
    /\b(crack|learn|study|prepare|lose|build|finish|improve|start|get fit|gate|react|weight)\b/.test(text)
  ) || /\b(crack gate|learn react|lose weight|prepare for gate)\b/.test(text);
}

function extractCompletionQuery(input: string): string | null {
  const match = input.match(/\b(?:i\s+)?(?:finished|completed|did|done with|mark|complete)\s+(.+?)(?:\s+as\s+done)?[.!?]*$/i);
  return match?.[1]?.trim() ?? null;
}

function extractSkipQuery(input: string): string | null {
  const match = input.match(/\b(?:skip|skipped|missed|could not do|couldn't do|delay|reschedule)\s+(.+?)[.!?]*$/i);
  return match?.[1]?.trim() ?? null;
}

function matchesText(source: string, query: string): boolean {
  const normalizedSource = source.toLowerCase();
  const normalizedQuery = cleanGoalText(query).toLowerCase();
  if (!normalizedQuery) return false;
  return normalizedSource.includes(normalizedQuery) || normalizedQuery.includes(normalizedSource);
}

function findTask(goals: PlannerGoal[], query: string): { goal: PlannerGoal; milestone: PlannerMilestone; task: PlannerTask } | null {
  for (const goal of goals) {
    for (const milestone of goal.milestones) {
      const task = milestone.tasks.find((candidate) => matchesText(candidate.title, query));
      if (task) return { goal, milestone, task };
    }
  }
  return null;
}

function chooseNextTask(goal: PlannerGoal): { milestone: PlannerMilestone; task: PlannerTask } | null {
  for (const milestone of goal.milestones) {
    const task = milestone.tasks.find((candidate) => candidate.status === 'scheduled' || candidate.status === 'in_progress' || candidate.status === 'pending' || candidate.status === 'delayed');
    if (task) return { milestone, task };
  }
  return null;
}

function findGoal(goals: PlannerGoal[], query: string): PlannerGoal | null {
  return goals.find((goal) => matchesText(goal.title, query) || matchesText(goal.rawText, query) || query.toLowerCase().includes(goal.domain)) ?? null;
}

function addHistory(type: PlannerHistoryEntry['type'], reason: string, goalId?: string, taskId?: string): PlannerHistoryEntry {
  return {
    id: id('planhist'),
    timestamp: new Date().toISOString(),
    type,
    goalId,
    taskId,
    reason,
  };
}

function updateTaskStatus(goal: PlannerGoal, taskId: string, status: PlannerTaskState, reason: string): PlannerGoal {
  return recalculateGoal({
    ...goal,
    milestones: goal.milestones.map((milestone) => ({
      ...milestone,
      tasks: milestone.tasks.map((task) => {
        if (task.id !== taskId) return task;
        return {
          ...task,
          status,
          reason,
          completedAt: status === 'completed' ? new Date().toISOString() : task.completedAt,
          skippedAt: status === 'skipped' || status === 'delayed' ? new Date().toISOString() : task.skippedAt,
          scheduledFor: status === 'delayed' ? todayKey(new Date(Date.now() + DAY_MS)) : task.scheduledFor,
        };
      }),
    })),
  });
}

function replaceGoal(goals: PlannerGoal[], nextGoal: PlannerGoal): PlannerGoal[] {
  return goals.map((goal) => goal.id === nextGoal.id ? nextGoal : goal);
}

function completionReply(goal: PlannerGoal, taskTitle: string): string {
  const percent = goal.progress.completionPercent;
  if (percent >= 100) return `Beautiful, ${goal.title} is complete. You followed through, and that counts.`;
  return `Done. I marked "${taskTitle}" complete. ${goal.title} is now ${percent}% complete. Steady progress, no drama.`;
}

function creationReply(goal: PlannerGoal): string {
  const firstTask = chooseNextTask(goal)?.task;
  return [
    `Absolutely. I created a plan for ${goal.title}.`,
    `It has ${goal.milestones.length} milestones and ${goal.progress.totalTasks} tasks.`,
    firstTask ? `For today, start with "${firstTask.title}".` : undefined,
    goal.motivation,
  ].filter(Boolean).join(' ');
}

function skipReply(goal: PlannerGoal, task: PlannerTask): string {
  return `No problem. I moved "${task.title}" forward gently instead of treating it like a failure. ${goal.title} is still at ${goal.progress.completionPercent}%, and we will continue from the next realistic step.`;
}

function agendaItem(goal: PlannerGoal, milestone: PlannerMilestone, task: PlannerTask, reason: string): PlannerAgendaItem {
  return {
    goalId: goal.id,
    goalTitle: goal.title,
    milestoneId: milestone.id,
    taskId: task.id,
    title: task.title,
    estimatedMinutes: task.estimatedMinutes,
    priority: task.priority,
    reason,
  };
}

class PlannerEngineImpl {
  async handleConversationInput(input: string): Promise<PlannerConversationResult | null> {
    const [goals, history] = await Promise.all([this.getGoals(), this.getHistory()]);

    if (isGoalCreation(input)) {
      const goal = createGoal(input);
      await this.saveGoals([goal, ...goals]);
      await this.saveHistory([addHistory('goal_created', `Created deterministic plan from: ${input}`, goal.id), ...history]);
      return { handled: true, reply: creationReply(goal), reason: 'Detected goal creation intent.', goal };
    }

    const completionQuery = extractCompletionQuery(input);
    if (completionQuery) {
      const exact = findTask(goals, completionQuery);
      const goal = exact?.goal ?? findGoal(goals, completionQuery);
      const target = exact ?? (goal ? { goal, ...chooseNextTask(goal) } : null);
      if (target?.goal && target.milestone && target.task) {
        const nextGoal = updateTaskStatus(target.goal, target.task.id, 'completed', `User said: ${input}`);
        await this.saveGoals(replaceGoal(goals, nextGoal));
        await this.saveHistory([addHistory('task_completed', `Completed from conversation: ${input}`, nextGoal.id, target.task.id), ...history]);
        return { handled: true, reply: completionReply(nextGoal, target.task.title), reason: 'Detected task completion.', goal: nextGoal };
      }
    }

    const skipQuery = extractSkipQuery(input);
    if (skipQuery) {
      const exact = findTask(goals, skipQuery);
      const goal = exact?.goal ?? findGoal(goals, skipQuery);
      const target = exact ?? (goal ? { goal, ...chooseNextTask(goal) } : null);
      if (target?.goal && target.milestone && target.task) {
        const nextGoal = updateTaskStatus(target.goal, target.task.id, 'delayed', `Rescheduled without penalty after: ${input}`);
        await this.saveGoals(replaceGoal(goals, nextGoal));
        await this.saveHistory([addHistory('task_rescheduled', `Rescheduled from conversation: ${input}`, nextGoal.id, target.task.id), ...history]);
        return { handled: true, reply: skipReply(nextGoal, target.task), reason: 'Detected skip/reschedule intent.', goal: nextGoal };
      }
    }

    if (/\b(today'?s agenda|daily agenda|what should i do today|plan my day)\b/i.test(input)) {
      const agenda = await this.getTodayAgenda(goals);
      await this.saveHistory([addHistory('agenda_created', `Agenda requested from conversation: ${input}`), ...history]);
      return { handled: true, reply: this.agendaReply(agenda), reason: 'Detected daily agenda request.', agenda };
    }

    return null;
  }

  async getSnapshot(): Promise<PlannerSnapshot> {
    const goals = await this.getGoals();
    return {
      goals,
      agenda: await this.getTodayAgenda(goals),
      history: await this.getHistory(),
    };
  }

  async getGoals(): Promise<PlannerGoal[]> {
    const goals = await readJson<PlannerGoal[]>(GOALS_KEY, []);
    const recalculated = goals.map(recalculateGoal);
    if (JSON.stringify(goals) !== JSON.stringify(recalculated)) {
      await this.saveGoals(recalculated);
    }
    return recalculated;
  }

  async getHistory(): Promise<PlannerHistoryEntry[]> {
    return readJson<PlannerHistoryEntry[]>(HISTORY_KEY, []);
  }

  async getTodayAgenda(seedGoals?: PlannerGoal[]): Promise<PlannerDailyAgenda> {
    const goals = seedGoals ?? await this.getGoals();
    const predictions = await BehaviorEngine.getPredictions();
    const emotion = await EmotionEngine.getCurrentEmotion();
    const items: PlannerAgendaItem[] = [];
    const today = todayKey();

    for (const goal of goals.filter((candidate) => candidate.status !== 'completed')) {
      const dueTask = goal.milestones.flatMap((milestone) =>
        milestone.tasks
          .filter((task) => task.status !== 'completed' && task.status !== 'skipped' && (task.scheduledFor === today || (task.dueAt && task.dueAt.slice(0, 10) <= today)))
          .map((task) => agendaItem(goal, milestone, task, task.scheduledFor === today ? 'Scheduled for today.' : 'Due or overdue.'))
      )[0];

      if (dueTask) {
        items.push(dueTask);
        continue;
      }

      const next = chooseNextTask(goal);
      if (next) {
        items.push(agendaItem(goal, next.milestone, next.task, 'Next useful step for this goal.'));
      }
    }

    const sorted = items.sort((a, b) => a.priority - b.priority).slice(0, emotion.state === 'tired' || emotion.state === 'stressed' ? 2 : 4);
    return {
      date: today,
      items: sorted,
      reasons: [
        'Agenda is generated on demand from local goals and task status.',
        emotion.state === 'tired' || emotion.state === 'stressed'
          ? 'Agenda is intentionally lighter because the local emotion estimate suggests lower bandwidth.'
          : 'Agenda favors high-priority next steps.',
      ],
      behaviorHint: predictions[0] ? `Behavior hint: ${predictions[0].routineType} at ${Math.round(predictions[0].confidence * 100)}%.` : undefined,
      emotionHint: `Emotion hint: ${emotion.state} at ${Math.round(emotion.confidence * 100)}%.`,
    };
  }

  async exportJson(): Promise<string> {
    return JSON.stringify(await this.getSnapshot(), null, 2);
  }

  async clearData(): Promise<void> {
    await removeKey(GOALS_KEY);
    await removeKey(HISTORY_KEY);
  }

  private agendaReply(agenda: PlannerDailyAgenda): string {
    if (!agenda.items.length) return 'Your agenda is clear right now. We can create a goal whenever you are ready.';
    const top = agenda.items.slice(0, 3).map((item, index) => `${index + 1}. ${item.title}`).join(' ');
    return `Here is a light plan for today: ${top}. We will keep it realistic and adjust if the day changes.`;
  }

  private async saveGoals(goals: PlannerGoal[]): Promise<void> {
    await writeJson(GOALS_KEY, goals);
  }

  private async saveHistory(history: PlannerHistoryEntry[]): Promise<void> {
    await writeJson(HISTORY_KEY, history.slice(0, MAX_HISTORY));
  }
}

export const PlannerEngine = new PlannerEngineImpl();
