/**
 * PSP constants.
 *
 * The phase list is PROVISIONAL: it follows Humphrey's PSP2 phase set and must be
 * verified against the course materials. Every part of the app reads phases from
 * here, so changing this array is the only edit needed.
 */
export const PHASES = [
  'Plan',
  'Design',
  'Design Review',
  'Code',
  'Code Review',
  'Compile',
  'Test',
  'Postmortem',
] as const;

export type Phase = (typeof PHASES)[number];

export const WORK_MODES = ['manual', 'ai_assisted', 'ai_agent'] as const;

export type WorkMode = (typeof WORK_MODES)[number];

export const WORK_MODE_INFO: Record<WorkMode, { label: string; short: string; description: string }> = {
  manual: {
    label: 'Manual',
    short: 'Manual',
    description: 'Traditional unassisted work: writing code, designing, running tests by hand.',
  },
  ai_assisted: {
    label: 'AI-Assisted',
    short: 'Assisted',
    description: 'Actively working with conversational AI or inline code completion.',
  },
  ai_agent: {
    label: 'AI-Agent',
    short: 'Agent',
    description:
      'Formulating tasks for coding agents, reviewing their output, monitoring or steering them. Counts your supervision time, not unattended agent runtime.',
  },
};

export const PROJECT_STATUSES = ['active', 'completed', 'archived'] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
};

export function isPhase(value: unknown): value is Phase {
  return typeof value === 'string' && (PHASES as readonly string[]).includes(value);
}

export function isWorkMode(value: unknown): value is WorkMode {
  return typeof value === 'string' && (WORK_MODES as readonly string[]).includes(value);
}

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === 'string' && (PROJECT_STATUSES as readonly string[]).includes(value);
}
