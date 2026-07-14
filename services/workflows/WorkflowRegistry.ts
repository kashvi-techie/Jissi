import type { WorkflowDefinition } from './WorkflowTypes';

const WORKFLOWS: WorkflowDefinition[] = [
  {
    id: 'navigate_home',
    name: 'Navigate home',
    description: 'Open Maps and search Home.',
    estimatedDurationMs: 6000,
    steps: [
      {
        id: 'open_maps',
        label: 'Open Maps',
        capabilityId: 'maps',
        input: { payload: { url: 'https://www.google.com/maps' }, confirmed: true },
        dependsOn: [],
        condition: 'always',
        retryLimit: 1,
        timeoutMs: 12000,
        rollback: { available: false, description: 'External Maps launch cannot be rolled back.' },
      },
      {
        id: 'search_home',
        label: 'Search Home',
        capabilityId: 'maps',
        input: { payload: { query: 'Home' }, confirmed: true },
        dependsOn: ['open_maps'],
        condition: 'previous_completed',
        retryLimit: 1,
        timeoutMs: 12000,
        rollback: { available: false, description: 'Maps search cannot be rolled back.' },
      },
    ],
  },
  {
    id: 'share_current_location',
    name: 'Share current location',
    description: 'Generate a Maps link, open WhatsApp, then share the link.',
    estimatedDurationMs: 9000,
    steps: [
      {
        id: 'open_current_location',
        label: 'Open current location in Maps',
        capabilityId: 'maps',
        input: { payload: { url: 'https://www.google.com/maps/search/?api=1&query=current+location' }, confirmed: true },
        dependsOn: [],
        condition: 'always',
        retryLimit: 1,
        timeoutMs: 12000,
      },
      {
        id: 'open_whatsapp',
        label: 'Open WhatsApp',
        capabilityId: 'whatsapp',
        input: { confirmed: true },
        dependsOn: ['open_current_location'],
        condition: 'previous_completed',
        retryLimit: 1,
        timeoutMs: 12000,
      },
      {
        id: 'share_link',
        label: 'Share location link',
        capabilityId: 'share_text',
        input: { payload: { text: 'https://www.google.com/maps/search/?api=1&query=current+location' }, confirmed: true },
        dependsOn: ['open_whatsapp'],
        condition: 'previous_completed',
        retryLimit: 1,
        timeoutMs: 12000,
      },
    ],
  },
  {
    id: 'morning_routine',
    name: 'Morning routine',
    description: "Open planner context, today's focus, and Spotify focus music.",
    estimatedDurationMs: 10000,
    steps: [
      {
        id: 'open_planner',
        label: 'Open Planner',
        capabilityId: 'chrome',
        input: { payload: { url: 'http://localhost:8081/planner-debug' }, confirmed: true },
        dependsOn: [],
        condition: 'always',
        retryLimit: 1,
        timeoutMs: 12000,
      },
      {
        id: 'open_spotify',
        label: 'Open Spotify focus playlist',
        capabilityId: 'spotify',
        input: { payload: { query: 'focus playlist' }, confirmed: true },
        dependsOn: ['open_planner'],
        condition: 'previous_completed',
        retryLimit: 1,
        timeoutMs: 12000,
      },
    ],
  },
  {
    id: 'call_rahul',
    name: 'Call Rahul',
    description: 'Ask confirmation, then open the phone dialer. Requires phoneNumber payload override.',
    estimatedDurationMs: 5000,
    steps: [
      {
        id: 'confirm_call',
        label: 'Ask confirmation',
        capabilityId: 'phone',
        input: { payload: { contactName: 'Rahul' }, confirmed: false },
        dependsOn: [],
        condition: 'always',
        retryLimit: 0,
        timeoutMs: 12000,
      },
    ],
  },
];

class WorkflowRegistryImpl {
  list(): WorkflowDefinition[] {
    return WORKFLOWS;
  }

  get(id: string): WorkflowDefinition | undefined {
    return WORKFLOWS.find((workflow) => workflow.id === id);
  }
}

export const WorkflowRegistry = new WorkflowRegistryImpl();
