import { readFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import * as ts from "typescript";

const roots = ["src", "server", "scripts"];
const codeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const nativeDialogNames = new Set(["alert", "confirm", "prompt"]);
const suppressions = new RegExp(["no", "alert"].join("-"));
/** @type {string[]} */
const errors = [];

/** @param {string} path */
function inspect(path) {
  const sourceText = readFileSync(path, "utf8");
  if (suppressions.test(sourceText)) {
    errors.push(`${path}: native-dialog lint suppression is forbidden`);
  }
  const kind = path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(path, sourceText, ts.ScriptTarget.Latest, true, kind);
  /** @param {import("typescript").Node} node */
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const isGlobalCall = ts.isIdentifier(callee) && nativeDialogNames.has(callee.text);
      const receiver = ts.isPropertyAccessExpression(callee)
        ? callee.expression.getText(source)
        : "";
      const isPropertyCall =
        ts.isPropertyAccessExpression(callee) &&
        ["window", "globalThis", "self"].includes(receiver) &&
        nativeDialogNames.has(callee.name.text);
      const isIndexedCall =
        ts.isElementAccessExpression(callee) &&
        ["window", "globalThis", "self"].includes(callee.expression.getText(source)) &&
        ts.isStringLiteral(callee.argumentExpression) &&
        nativeDialogNames.has(callee.argumentExpression.text);
      if (isGlobalCall || isPropertyCall || isIndexedCall) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        errors.push(`${path}:${line + 1}: browser-native dialogs are forbidden; use an in-app dialog`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

/** @param {string} path */
function walk(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) {
      walk(target);
    } else if (
      entry.isFile() &&
      codeExtensions.has(extname(entry.name)) &&
      target !== "scripts/check-native-dialogs.mjs"
    ) {
      inspect(target);
    }
  }
}

for (const root of roots) {
  walk(root);
}
if (errors.length > 0) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("No browser-native dialogs or lint suppressions found.\n");
}
