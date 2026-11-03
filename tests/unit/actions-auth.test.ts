import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Every exported Server Action is a public HTTP endpoint: anyone can POST to it, logged in or not.
 * This test parses each "use server" file and fails if an exported function never calls
 * requireUser(), unless it's on the allow-list below with a reason.
 */
const PUBLIC_ACTIONS: Record<string, string> = {
  signUpAction: "creates the account, so there is no session yet",
  loginAction: "creates the session",
  logoutAction: "only deletes the caller's own session cookie, if any",
};

type Action = { file: string; name: string; callsRequireUser: boolean };

/** Exported functions in one source file, and whether each one calls requireUser() anywhere inside. */
export function exportedActions(file: string, source: string): Action[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const isExported = (node: ts.Node) =>
    ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  const callsRequireUser = (node: ts.Node): boolean => {
    let found = false;
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "requireUser") found = true;
      if (!found) ts.forEachChild(n, visit);
    };
    visit(node);
    return found;
  };

  const actions: Action[] = [];
  for (const statement of sf.statements) {
    if (!isExported(statement)) continue;
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      actions.push({ file, name: statement.name.text, callsRequireUser: callsRequireUser(statement) });
    }
    if (ts.isVariableStatement(statement)) {
      for (const d of statement.declarationList.declarations) {
        const init = d.initializer;
        if (ts.isIdentifier(d.name) && init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          actions.push({ file, name: d.name.text, callsRequireUser: callsRequireUser(init) });
        }
      }
    }
  }
  return actions;
}

function serverActionFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return serverActionFiles(path);
    if (!/\.tsx?$/.test(entry)) return [];
    return /^\s*["']use server["']/m.test(readFileSync(path, "utf8")) ? [path] : [];
  });
}

const files = serverActionFiles(join(process.cwd(), "src"));
const actions = files.flatMap((file) => exportedActions(file, readFileSync(file, "utf8")));

describe("Server Actions require a session", () => {
  it("finds the server action files", () => {
    expect(files.map((f) => f.replace(process.cwd() + "/", ""))).toContain("src/app/actions.ts");
    expect(actions.length).toBeGreaterThan(10);
  });

  it("every exported action calls requireUser(), unless it's explicitly public", () => {
    const missing = actions.filter((a) => !a.callsRequireUser && !(a.name in PUBLIC_ACTIONS)).map((a) => a.name);
    expect(missing, "exported Server Actions with no requireUser() call").toEqual([]);
  });

  it("the allow-list only names actions that exist", () => {
    const names = new Set(actions.map((a) => a.name));
    expect(Object.keys(PUBLIC_ACTIONS).filter((name) => !names.has(name))).toEqual([]);
  });

  it("the checker catches an action that skips requireUser (self-test)", () => {
    const source = `"use server";
      export async function safeAction() { return run(async () => { const ctx = await requireUser(); }); }
      export async function unsafeAction() { return run(async () => { await deleteEverything(); }); }
      export const unsafeArrow = async () => {};
      async function notExported() {}`;
    const found = exportedActions("fake.ts", source);
    expect(found.map((a) => [a.name, a.callsRequireUser])).toEqual([
      ["safeAction", true],
      ["unsafeAction", false],
      ["unsafeArrow", false],
    ]);
  });
});
