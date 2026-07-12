export type RelationshipKind =
  | 'teacher'
  | 'mentor'
  | 'mother'
  | 'father'
  | 'friend'
  | 'best_friend'
  | 'sibling'
  | 'recruiter'
  | 'interviewer'
  | 'doctor'
  | 'manager'
  | 'guest'
  | 'senior'
  | 'colleague'
  | 'unknown';

export type RelationshipTimelineType =
  | 'met'
  | 'discussed'
  | 'remembered_like'
  | 'remembered_dislike'
  | 'remembered_event'
  | 'asked_about'
  | 'congratulated'
  | 'note';

export interface RelationshipTimelineEvent {
  id: string;
  type: RelationshipTimelineType;
  title: string;
  detail: string;
  timestamp: string;
}

export interface RelationshipImportantEvent {
  id: string;
  title: string;
  date?: string;
  note?: string;
  placeholder: boolean;
}

export interface RelationshipProfile {
  id: string;
  name: string;
  nickname?: string;
  relationship: RelationshipKind;
  firstMet: string;
  lastDiscussed: string;
  importantEvents: RelationshipImportantEvent[];
  likes: string[];
  dislikes: string[];
  memories: string[];
  tags: string[];
  timeline: RelationshipTimelineEvent[];
}

export interface RelationshipCommandResult {
  handled: true;
  reply: string;
  profile?: RelationshipProfile;
  reason: string;
}
