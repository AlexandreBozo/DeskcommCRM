import type { LearningObservation } from "../contracts/learning";

/**
 * Observador canônico de aprendizado da Coagentica.
 *
 * A porta recebe somente fatos já sanitizados do outcome. Não recebe input
 * bruto, output bruto, prompt, provider, modelo, canal ou credenciais.
 * Falhas nesta porta nunca podem invalidar a operação principal já concluída.
 */
export interface LearningPort {
  observe(observation: LearningObservation): Promise<void>;
}
