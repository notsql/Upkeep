import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseSync } from "vite";

/** Props whose string value shows on screen or reaches a screen reader. */
const TEXT_PROPS = new Set([
  "aria-label",
  "aria-description",
  "alt",
  "cancelLabel",
  "confirmLabel",
  "description",
  "emptyMessage",
  "heading",
  "hint",
  "label",
  "message",
  "placeholder",
  "subtitle",
  "text",
  "title",
]);

/** Calls whose string arguments reach the screen. */
const TOAST = new Set(["success", "error", "info", "warning", "message"]);

export interface VisibleString {
  file: string;
  text: string;
}

type Node = Record<string, unknown> & { type?: string };

function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null;
}

/** Every string literal or template text under a node, as shown text. */
function strings(node: unknown, out: string[]): void {
  if (!isNode(node)) {
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      strings(child, out);
    }
    return;
  }
  if (node.type === "Literal" && typeof node.value === "string") {
    out.push(node.value);
    return;
  }
  if (node.type === "TemplateLiteral") {
    const quasis = node.quasis as { value: { cooked: string } }[];
    out.push(quasis.map((q) => q.value.cooked).join("…"));
    strings(node.expressions, out);
    return;
  }
  if (node.type === "JSXText") {
    out.push(String(node.value));
    return;
  }
  // Keys, class names and call targets are code, not text.
  if (node.type === "JSXAttribute" || node.type === "CallExpression") {
    collect(node, out);
    return;
  }
  for (const [key, child] of Object.entries(node)) {
    if (key === "test" || key === "left" || key === "key") {
      continue;
    }
    strings(child, out);
  }
}

function calleeName(node: Node): string | undefined {
  const callee = node.callee as Node | undefined;
  if (!callee) {
    return;
  }
  if (callee.type === "Identifier") {
    return String(callee.name);
  }
  if (callee.type === "MemberExpression") {
    const object = callee.object as Node;
    const property = callee.property as Node;
    return `${String(object.name ?? "")}.${String(property.name ?? "")}`;
  }
}

const ERROR_CLASS = /Error$/u;
const SOURCE_FILE = /\.tsx?$/u;

function collectElement(node: Node, out: string[]): void {
  for (const child of node.children as Node[]) {
    if (child.type === "JSXExpressionContainer") {
      strings(child.expression, out);
    } else {
      collect(child, out);
    }
  }
  collect(node.openingElement, out);
}

function collectAttribute(node: Node, out: string[]): void {
  const { name } = node.name as Node;
  if (TEXT_PROPS.has(String(name))) {
    strings(node.value, out);
  } else {
    collect(node.value, out);
  }
}

/** True when the node is `new …Error(…)` or `toast.…(…)`: its arguments render. */
function rendersArguments(node: Node): boolean {
  if (node.type === "NewExpression") {
    const callee = node.callee as Node;
    return (
      callee.type === "Identifier" && ERROR_CLASS.test(String(callee.name))
    );
  }
  if (node.type === "CallExpression") {
    const [object, method] = (calleeName(node) ?? "").split(".");
    return object === "toast" && TOAST.has(method ?? "");
  }
  return false;
}

/** Walks code, collecting only strings in places that render. */
function collect(node: unknown, out: string[]): void {
  if (!isNode(node)) {
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      collect(child, out);
    }
    return;
  }
  if (node.type === "JSXText") {
    out.push(String(node.value));
  } else if (node.type === "JSXElement" || node.type === "JSXFragment") {
    collectElement(node, out);
  } else if (node.type === "JSXAttribute") {
    collectAttribute(node, out);
  } else if (rendersArguments(node)) {
    strings(node.arguments, out);
  } else {
    for (const value of Object.values(node)) {
      collect(value, out);
    }
  }
}

function files(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      found.push(...files(path));
    } else if (SOURCE_FILE.test(entry) && !entry.endsWith(".gen.ts")) {
      found.push(path);
    }
  }
  return found;
}

/** Visible strings in every source file under `root`, paths relative to it. */
export function visibleStrings(root: string): VisibleString[] {
  const found: VisibleString[] = [];
  for (const path of files(root)) {
    const source = readFileSync(path, "utf8");
    const lang = path.endsWith(".tsx") ? "tsx" : "ts";
    const { program } = parseSync(path, source, { lang });
    const out: string[] = [];
    collect(program, out);
    for (const text of out) {
      const trimmed = text.replace(/\s+/gu, " ").trim();
      if (trimmed) {
        found.push({ file: relative(root, path), text: trimmed });
      }
    }
  }
  return found;
}
