import type { DecisionRecord } from "../contracts";

/**
 * Persistência canônica de decisões.
 *
 * O Intelligence Runtime só conhece este port; banco, event log ou audit log
 * ficam em adapters/composition roots.
 */
export interface DecisionStorePort {
  saveDecision(record: DecisionRecord): Promise<DecisionRecord>;
}
