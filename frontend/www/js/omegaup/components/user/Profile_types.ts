// Shared interface extracted from Profile.vue so plain `.ts` entry points can
// import it (fork-ts-checker only sees the default export of a `.vue` through
// the ambient shim). The SFC re-exports it for existing importers.

import { DifficultyStats } from './ProblemSolvingProgress_types';

export interface ProfileStatistics {
  solved: number;
  attempting: number;
  difficulty: DifficultyStats;
  tags: Array<{ name: string; count: number }>;
}
