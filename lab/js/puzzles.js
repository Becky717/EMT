import { CH_A } from './puzzles_a.js';
import { CH_B } from './puzzles_b.js';
// Codex order: chapters I–VII, three or four machines each.
export const PUZZLES = [...CH_A, ...CH_B].sort((a, b) => a.ch - b.ch);
