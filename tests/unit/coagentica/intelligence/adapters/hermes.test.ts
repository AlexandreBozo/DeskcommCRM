import { describe, it, expect } from "vitest";
import {
  createHermesAdapter,
  isHermesAvailable,
  requireHermesAdapter,
  toOrchestratorPort,
} from "@/coagentica/intelligence/adapters/hermes";

describe("coagentica/intelligence/adapters/hermes", () => {
  describe("createHermesAdapter", () => {
    it("cria adapter com available=true quando endpoint é fornecido", () => {
      const adapter = createHermesAdapter({ endpoint: "https://hermes.example.com" });
      expect(adapter.available).toBe(true);
      expect(adapter.config.endpoint).toBe("https://hermes.example.com");
    });
    it("cria adapter com available=false quando endpoint não é fornecido", () => {
      const adapter = createHermesAdapter({});
      expect(adapter.available).toBe(false);
    });
  });

  describe("isHermesAvailable", () => {
    it("retorna true quando adapter está disponível", () => {
      const adapter = createHermesAdapter({ endpoint: "https://hermes.example.com" });
      expect(isHermesAvailable(adapter)).toBe(true);
    });
    it("retorna false quando adapter não está disponível", () => {
      const adapter = createHermesAdapter({});
      expect(isHermesAvailable(adapter)).toBe(false);
    });
  });

  describe("requireHermesAdapter", () => {
    it("retorna adapter quando disponível", () => {
      const adapter = createHermesAdapter({ endpoint: "https://hermes.example.com" });
      expect(requireHermesAdapter(adapter)).toBe(adapter);
    });
    it("lança erro quando não disponível", () => {
      const adapter = createHermesAdapter({});
      expect(() => requireHermesAdapter(adapter)).toThrow("Hermes adapter is not configured");
    });
  });

  describe("toOrchestratorPort", () => {
    it("retorna null quando adapter não está disponível", () => {
      const adapter = createHermesAdapter({});
      expect(toOrchestratorPort(adapter)).toBeNull();
    });
    it("retorna OrchestratorPort quando disponível", () => {
      const adapter = createHermesAdapter({ endpoint: "https://hermes.example.com" });
      const port = toOrchestratorPort(adapter);
      expect(port).not.toBeNull();
    });
  });
});
