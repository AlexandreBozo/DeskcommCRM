import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = join(__dirname, "../../..");
const FOUNDATION_CONTRACTS = join(ROOT, "coagentica/foundation/contracts");
const CORE_CONTRACTS = join(ROOT, "coagentica/operations-kernel/contracts");
const TENANT_RUNTIME = join(ROOT, "coagentica/tenant-runtime");
const INTELLIGENCE = join(ROOT, "coagentica/intelligence");
const OPS_ADAPTERS = join(ROOT, "coagentica/operations-kernel/adapters");
const INTEGRATIONS_DESKCOMM = join(ROOT, "coagentica/integrations/deskcomm");
const TENANT_PORTS = join(ROOT, "coagentica/tenant-runtime/ports");

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

  describe("tenant-runtime/ não importa infraestrutura, integrations ou intelligence", () => {
    const files = collectTsFiles(TENANT_RUNTIME);

    it.each(files)("%s não importa Supabase", (filePath) => {
      const content = readFileContent(filePath);
      const imports = content.match(/import\s+.*from\s+["']@supabase\/[^"']+["']/g) ?? [];
      expect(imports, `${relativePath(filePath)} contém import proibido de Supabase`).toHaveLength(0);
    });

    it.each(files)("%s não importa integrations/Deskcomm", (filePath) => {
      const content = readFileContent(filePath);
      const imports = content.match(/import\s+.*from\s+["'][^"']*(?:coagentica\/integrations|deskcomm)[^"']*["']/g) ?? [];
      expect(imports, `${relativePath(filePath)} contém import proibido de integration/Deskcomm`).toHaveLength(0);
    });

    it.each(files)("%s não importa intelligence/Hermes/AI SDK", (filePath) => {
      const content = readFileContent(filePath);
      const imports = content.match(/import\s+.*from\s+["'][^"']*(?:coagentica\/intelligence|hermes|ai-sdk|anthropic|openai|google-generative)[^"']*["']/gi) ?? [];
      expect(imports, `${relativePath(filePath)} contém import proibido de intelligence/Hermes/AI SDK`).toHaveLength(0);
    });
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

  describe("intelligence/ não depende de operations-kernel/", () => {
    const files = collectTsFiles(INTELLIGENCE).filter(
      (f) => !f.includes("/adapters/")
    );

    it.each(files)(
      "%s não importa operations-kernel",
      (filePath) => {
        const content = readFileContent(filePath);
        const imports = content.match(/import\s+.*from\s+["'][^"']*operations-kernel[^"']*["']/g) ?? [];
        expect(
          imports,
          `${relativePath(filePath)} contém import proibido de operations-kernel`
        ).toHaveLength(0);
      }
    );
  });

  describe("intelligence/ fora de adapters não importa tenant-runtime, integrations, Supabase ou AI SDK", () => {
    const files = collectTsFiles(INTELLIGENCE).filter(
      (f) => !f.includes("/adapters/")
    );

    it.each(files)(
      "%s permanece independente de runtime/infraestrutura",
      (filePath) => {
        const content = readFileContent(filePath);
        const imports = content.match(
          /import\s+.*from\s+["'][^"']*(?:tenant-runtime|coagentica\/integrations|@supabase\/|@?ai-sdk|anthropic|openai|google-generative)[^"']*["']/gi
        ) ?? [];
        expect(
          imports,
          `${relativePath(filePath)} contém import proibido de runtime/infraestrutura: ${imports.join(", ")}`
        ).toHaveLength(0);
      }
    );
  });

  describe("intelligence/ports/tenant-operational-context-port.ts é puro", () => {
    const portFile = join(
      INTELLIGENCE,
      "ports",
      "tenant-operational-context-port.ts"
    );

    it("não importa tenant-runtime, operations-kernel, integrations, Supabase, Hermes ou AI SDK", () => {
      const content = readFileContent(portFile);
      const forbidden = content.match(
        /import\s+.*from\s+["'][^"']*(?:tenant-runtime|operations-kernel|coagentica\/integrations|deskcomm|@supabase\/|hermes|@?ai-sdk|anthropic|openai|google-generative)[^"']*["']/gi
      ) ?? [];
      expect(forbidden).toHaveLength(0);
    });
  });

  describe("intelligence/ports/* e runtime.ts são puros (v0.5)", () => {
    const portsDir = join(INTELLIGENCE, "ports");
    const files = [...collectTsFiles(portsDir), join(INTELLIGENCE, "runtime.ts")];

    it.each(files)(
      "%s não importa adapters nem infraestrutura de runtime",
      (filePath) => {
        const content = readFileContent(filePath);
        const forbidden = content.match(
          /import\s+.*from\s+["'][^"']*(?:adapters|tenant-runtime|operations-kernel|coagentica\/integrations|deskcomm|@\/lib\/|@supabase\/|hermes|@?ai-sdk|anthropic|openai|google-generative)[^"']*["']/gi
        ) ?? [];
        expect(
          forbidden,
          `${relativePath(filePath)} contém import proibido de adapters/runtime: ${forbidden.join(", ")}`
        ).toHaveLength(0);
      }
    );

    it.each(files)("%s não referencia Hermes", (filePath) => {
      const content = readFileContent(filePath);
      const hermesRefs = content.match(/[Hh]ermes/g) ?? [];
      expect(
        hermesRefs,
        `${relativePath(filePath)} contém referência a Hermes fora de adapters`
      ).toHaveLength(0);
    });
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

  describe("intelligence/runtime v0.5 + ports são puros (só portas)", () => {
    const RUNTIME = join(INTELLIGENCE, "runtime.ts");
    const PORTS = join(INTELLIGENCE, "ports");
    const pureFiles = [
      RUNTIME,
      join(PORTS, "policy-gate-port.ts"),
      join(PORTS, "decision-store-port.ts"),
      join(PORTS, "capability-executor-port.ts"),
      join(PORTS, "tenant-operational-context-port.ts"),
    ];

    it.each(pureFiles)(
      "%s não importa adapters ou infraestrutura de runtime",
      (filePath) => {
        const content = readFileContent(filePath);
        const forbidden = content.match(
          /import\s+.*from\s+["'][^"']*(?:adapters|tenant-runtime|operations-kernel|coagentica\/integrations|deskcomm|@supabase\/|@\/lib\/|hermes|@?ai-sdk|anthropic|openai|google-generative)[^"']*["']/gi
        ) ?? [];
        expect(
          forbidden,
          `${relativePath(filePath)} contém import proibido de adapters/runtime: ${forbidden.join(", ")}`
        ).toHaveLength(0);
      }
    );

    it.each(pureFiles)("%s não referencia Hermes", (filePath) => {
      const content = readFileContent(filePath);
      const hermesRefs = content.match(/[Hh]ermes/g) ?? [];
      expect(
        hermesRefs,
        `${relativePath(filePath)} contém referência a Hermes fora de adapters`
      ).toHaveLength(0);
    });
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
    it.each(files)("%s não importa Hermes", (filePath) => {
      const content = readFileContent(filePath);
      const imports = content.match(/import\s+.*from\s+["'][^"']*hermes[^"']*["']/gi) ?? [];
      expect(imports, `${relativePath(filePath)} contém import proibido de Hermes`).toHaveLength(0);
    });
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

  describe("operations-kernel/contracts/entity.ts — entity é puro e não importa @/lib", () => {
    const entityFile = join(CORE_CONTRACTS, "entity.ts");

    it("não contém import de @/lib", () => {
      const content = readFileContent(entityFile);
      const imports = content.match(/import\s+.*from\s+["']@\/lib\/[^"']+["']/g) ?? [];
      expect(imports).toHaveLength(0);
    });
    it("não contém import de tenant-runtime", () => {
      const content = readFileContent(entityFile);
      const imports = content.match(/import\s+.*from\s+["'][^"']*tenant-runtime[^"']*["']/g) ?? [];
      expect(imports).toHaveLength(0);
    });
  });

  describe("tenant-runtime/contracts/state.ts — state é puro e não importa @/lib", () => {
    const stateFile = join(TENANT_RUNTIME, "contracts", "state.ts");

    it("não contém import de @/lib", () => {
      const content = readFileContent(stateFile);
      const imports = content.match(/import\s+.*from\s+["']@\/lib\/[^"']+["']/g) ?? [];
      expect(imports).toHaveLength(0);
    });
    it("não contém import de intelligence", () => {
      const content = readFileContent(stateFile);
      const imports = content.match(/import\s+.*from\s+["'][^"']*intelligence[^"']*["']/g) ?? [];
      expect(imports).toHaveLength(0);
    });
  });

  describe("tenant-runtime/ports/state-source.ts — ports podem importar operations-kernel", () => {
    const portFile = join(TENANT_PORTS, "state-source.ts");

    it("pode importar operations-kernel/contracts/entity", () => {
      const content = readFileContent(portFile);
      expect(content).toContain("operations-kernel");
    });
  });

  describe("integrations/deskcomm/state-adapters.ts — adapter pode importar @/lib", () => {
    const adapterFile = join(INTEGRATIONS_DESKCOMM, "state-adapters.ts");

    it("contém import de @/lib/database.types", () => {
      const content = readFileContent(adapterFile);
      const imports = content.match(/import\s+.*from\s+["']@\/lib\/database\.types["']/g) ?? [];
      expect(imports.length).toBeGreaterThan(0);
    });
  });

  describe("intelligence canonical não carrega adapters", () => {
    const barrelFile = join(INTELLIGENCE, "index.ts");
    const runtimeFile = join(INTELLIGENCE, "runtime.ts");

    it("barrel canônico não re-exporta adapters", () => {
      const content = readFileContent(barrelFile);
      expect(content).not.toMatch(/export\s+\*\s+from\s+["']\.\/adapters["']/);
    });

    it("runtime não importa adapters, Hermes ou infraestrutura", () => {
      const content = readFileContent(runtimeFile);
      const forbidden = content.match(
        /import\s+.*from\s+["'][^"']*(?:\/adapters|hermes|tenant-runtime|operations-kernel|coagentica\/integrations|@supabase\/|@\/lib\/|ai-sdk|anthropic|openai|google-generative)[^"']*["']/gi
      ) ?? [];
      expect(forbidden).toHaveLength(0);
    });
  });

  describe("coagentica/integrations/ não importa intelligence ou business-engine", () => {
    const files = collectTsFiles(INTEGRATIONS_DESKCOMM);

    it.each(files)(
      "%s não importa intelligence",
      (filePath) => {
        const content = readFileContent(filePath);
        const imports = content.match(/import\s+.*from\s+["'][^"']*intelligence[^"']*["']/g) ?? [];
        expect(
          imports,
          `${relativePath(filePath)} contém import proibido de intelligence`
        ).toHaveLength(0);
      }
    );
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
});
