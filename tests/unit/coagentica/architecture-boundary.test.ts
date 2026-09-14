import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = join(__dirname, "../../..");
const FOUNDATION_CONTRACTS = join(ROOT, "coagentica/foundation/contracts");
const CORE_CONTRACTS = join(ROOT, "coagentica/operations-kernel/contracts");
const TENANT_RUNTIME = join(ROOT, "coagentica/tenant-runtime");
const INTELLIGENCE = join(ROOT, "coagentica/intelligence");
const OPS_ADAPTERS = join(ROOT, "coagentica/operations-kernel/adapters");

function collectTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectTsFiles(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
}

function readFileContent(path: string): string {
  return readFileSync(path, "utf-8");
}

function relativePath(full: string): string {
  return relative(ROOT, full);
}

/**
 * Testes arquiteturais — validam invariantes de dependência entre camadas.
 *
 * Estes testes leem os fontes como texto e verificam padrões de import.
 * Eles NÃO testam comportamento runtime; testam que a estrutura de
 * dependências obedece às regras arquiteturais do coagentica.
 */
describe("coagentica — barreiras arquiteturais", () => {
  describe("foundation/contracts não importa @/lib (Deskcomm)", () => {
    const files = collectTsFiles(FOUNDATION_CONTRACTS);

    it.each(files)(
      "%s não contém import de @/lib",
      (filePath) => {
        const content = readFileContent(filePath);
        const imports = content.match(/import\s+.*from\s+[\"']@\/lib\/[^\"']+[\"']/g) ?? [];
        expect(
          imports,
          `${relativePath(filePath)} contém imports proibidos de @/lib: ${imports.join(", ")}`
        ).toHaveLength(0);
      }
    );
  });

  describe("contracts/operations-kernel não importa @/lib (Deskcomm)", () => {
    const files = collectTsFiles(CORE_CONTRACTS);

    it.each(files)(
      "%s não contém import de @/lib",
      (filePath) => {
        const content = readFileContent(filePath);
        const imports = content.match(/import\s+.*from\s+["']@\/lib\/[^"']+["']/g) ?? [];
        expect(
          imports,
          `${relativePath(filePath)} contém imports proibidos de @/lib: ${imports.join(", ")}`
        ).toHaveLength(0);
      }
    );
  });

  describe("tenant-runtime/ não importa @/lib (Deskcomm)", () => {
    const files = collectTsFiles(TENANT_RUNTIME);

    it.each(files)(
      "%s não contém import de @/lib",
      (filePath) => {
        const content = readFileContent(filePath);
        const imports = content.match(/import\s+.*from\s+[\"']@\/lib\/[^\"']+[\"']/g) ?? [];
        expect(
          imports,
          `${relativePath(filePath)} contém imports proibidos de @/lib: ${imports.join(", ")}`
        ).toHaveLength(0);
      }
    );
  });

  describe("intelligence/ não importa @/lib (Deskcomm)", () => {
    const files = collectTsFiles(INTELLIGENCE).filter(
      (f) => !f.includes("/adapters/")
    );

    it.each(files)(
      "%s não contém import de @/lib",
      (filePath) => {
        const content = readFileContent(filePath);
        const imports = content.match(/import\s+.*from\s+["']@\/lib\/[^"']+["']/g) ?? [];
        expect(
          imports,
          `${relativePath(filePath)} contém imports proibidos de @/lib: ${imports.join(", ")}`
        ).toHaveLength(0);
      }
    );
  });

  describe("Hermes só aparece em intelligence/adapters/", () => {
    const files = collectTsFiles(INTELLIGENCE).filter(
      (f) => !f.includes("/adapters/")
    );

    it.each(files)(
      "%s não referencia Hermes",
      (filePath) => {
        const content = readFileContent(filePath);
        const hermesRefs = content.match(/[Hh]ermes/g) ?? [];
        expect(
          hermesRefs,
          `${relativePath(filePath)} contém referência a Hermes fora de adapters`
        ).toHaveLength(0);
      }
    );
  });

  describe("operations-kernel/ não conhece tenant-runtime/", () => {
    const files = [
      ...collectTsFiles(CORE_CONTRACTS),
      ...collectTsFiles(OPS_ADAPTERS),
    ];

    it.each(files)(
      "%s não importa tenant-runtime",
      (filePath) => {
        const content = readFileContent(filePath);
        const imports = content.match(/import\s+.*from\s+[\"'][^\"']*tenant-runtime[^\"']*[\"']/g) ?? [];
        expect(
          imports,
          `${relativePath(filePath)} contém import proibido de tenant-runtime`
        ).toHaveLength(0);
      }
    );
  });

  describe("operations-kernel/ não importa business-engine/", () => {
    const files = [
      ...collectTsFiles(CORE_CONTRACTS),
      ...collectTsFiles(OPS_ADAPTERS),
    ];

    it.each(files)(
      "%s não importa business-engine",
      (filePath) => {
        const content = readFileContent(filePath);
        const imports = content.match(/import\s+.*from\s+["'][^"']*business-engine[^"']*["']/g) ?? [];
        expect(
          imports,
          `${relativePath(filePath)} contém import proibido de business-engine`
        ).toHaveLength(0);
      }
    );
  });

  describe("intelligence/ não importa intelligence-core/", () => {
    const files = collectTsFiles(INTELLIGENCE);

    it.each(files)(
      "%s não importa intelligence-core",
      (filePath) => {
        const content = readFileContent(filePath);
        const imports = content.match(/import\s+.*from\s+["'][^"']*intelligence-core[^"']*["']/g) ?? [];
        expect(
          imports,
          `${relativePath(filePath)} contém import proibido de intelligence-core`
        ).toHaveLength(0);
      }
    );
  });
});
