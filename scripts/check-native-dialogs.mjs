import { readFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import ts from "typescript";

const roots = ["src", "server", "scripts"];
const codeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const nativeDialogNames = new Set(["alert", "confirm", "prompt"]);
const suppressions = new RegExp(["no", "alert"].join("-"));
const errors = [];

function inspect(path) {
  const text = readFileSync(path, "utf8");
  if (suppressions.test(text)) {
    errors.push(`${path}: native-dialog lint suppression is forbidden`);
  }
  const kind = path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const isGlobalCall = ts.isIdentifier(callee) && nativeDialogNames.has(callee.text);
      const isPropertyCall =
        ts.isPropertyAccessExpression(callee) &&
        (callee.expression.getText(source) === "window" ||
          callee.expression.getText(source) === "globalThis" ||
          callee.expression.getText(source) === "self") &&
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

function walk(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) {
      walk(target);
    } else if (entry.isFile() && codeExtensions.has(extname(entry.name)) && target !== "scripts/check-native-dialogs.mjs") {
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
