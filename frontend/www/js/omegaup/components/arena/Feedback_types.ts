// Shared enum/type extracted from Feedback.vue so plain `.ts` entry points and
// sibling test files can import them (fork-ts-checker only sees the default
// export of a `.vue` through the ambient shim, so named imports from a `.vue`
// fail with TS2614). Feedback.vue re-exports them for existing importers; no
// runtime change.

export enum FeedbackStatus {
  New = 'New',
  InProgress = 'InProgress',
  Saved = 'Saved',
  Updated = 'Updated',
  Deleted = 'Deleted',
}

export interface ArenaCourseFeedback {
  author?: string;
  authorClassname?: string;
  lineNumber: number;
  text: null | string;
  status: FeedbackStatus;
  timestamp?: Date;
  submissionFeedbackId?: number;
}
