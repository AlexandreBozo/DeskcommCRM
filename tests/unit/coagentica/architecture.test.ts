import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

/**
 * Testes arquiteturais — garantem que a separação de camadas do Coagentica
 * não é violada por imports acidentais.
 *
 * Regras:
 * 1. foundation/contracts, operations-kernel/contracts e intelligence NÃO importam @/lib (Deskcomm).
 * 2. intelligence (exceto adapters/) NÃO menciona "hermes".
 * 3. operations-kernel e intelligence NÃO importam business-engine ou intelligence-core.
 */

const ROOT = join(__dirname, "..", "..", "..");
const COAGENTICA = join(ROOT, "coagentica");

function walkDir(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walkDir(full));
    } else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

function readRelative(filePath: string): string {
  return readFileSync(filePath, "utf-8");
}

describe("Arquitetura — separação de camadas", () => {
  describe("Regra 1: contratos canônicos e intelligence não importam @/lib", () => {
    const forbiddenPaths = [
      join(COAGENTICA, "foundation", "contracts"),
      join(COAGENTICA, "operations-kernel", "contracts"),
      join(COAGENTICA, "intelligence"),
    ];


    const offendingFiles: string[] = [];

    for (const dir of forbiddenPaths) {
      const files = walkDir(dir);
      for (const file of files) {
        const content = readRelative(file);
        const importLines = content.split("\n").filter(
          (line) => (line.startsWith("import ") || line.startsWith("export ")) && line.includes("@/lib/")
        );
        if (importLines.length > 0) {
          offendingFiles.push(`${relative(ROOT, file)}: ${importLines.join("; ")}`);
        }
      }
    }

    it("nenhum contrato canônico ou núcleo de intelligence importa @/lib", () => {
      expect(offendingFiles).toEqual([]);
    });
  });

  describe("Regra 2: intelligence (exceto adapters/) não menciona 'hermes'", () => {
    const intelligenceDir = join(COAGENTICA, "intelligence");
    const adaptersDir = join(intelligenceDir, "adapters");
    const offendingFiles: string[] = [];

    const files = walkDir(intelligenceDir).filter((f) => !f.startsWith(adaptersDir));
    for (const file of files) {
      const content = readRelative(file).toLowerCase();
      if (content.includes("hermes")) {
        offendingFiles.push(relative(ROOT, file));
      }
    }

    it("intelligence (sem adapters) não referencia Hermes", () => {
      expect(offendingFiles).toEqual([]);
    });
  });

  describe("Regra 3: operations-kernel e intelligence não importam business-engine ou intelligence-core", () => {
    const sourceDirs = [
      join(COAGENTICA, "operations-kernel"),
      join(COAGENTICA, "intelligence"),
    ];
    const offendingFiles: string[] = [];

    for (const dir of sourceDirs) {
      const files = walkDir(dir);
      for (const file of files) {
        const content = readRelative(file);
        const importLines = content.split("\n").filter(
          (line) =>
            (line.startsWith("import ") || line.startsWith("export ")) &&
            (line.includes("business-engine") || line.includes("intelligence-core"))
        );
        if (importLines.length > 0) {
          offendingFiles.push(`${relative(ROOT, file)}: ${importLines.join("; ")}`);
        }
      }
    }

    it("operations-kernel e intelligence não importam business-engine ou intelligence-core", () => {
      expect(offendingFiles).toEqual([]);
    });
  });
});
