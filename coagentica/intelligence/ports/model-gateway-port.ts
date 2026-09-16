import type {
  ModelGatewayStatus,
  ModelGenerationRequest,
  ModelGenerationResult,
} from "../contracts/model-gateway";

export interface ModelGatewayPort {
  status(): Promise<ModelGatewayStatus>;
  generate(request: ModelGenerationRequest): Promise<ModelGenerationResult>;
}
