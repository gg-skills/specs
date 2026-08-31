#!/usr/bin/env -S npx tsx

/**
 * @fileoverview Converts a markdown artifact to a sibling minimal HTML page (Mermaid-capable).
 *
 * Used by study, plan, and specs: after any `.md` write, emit the `.html` twin and report
 * absolute paths for both files. Keep the three copies of this script in sync.
 *
 * @example
 * ```bash
 * npx tsx .agents/skills/specs/scripts/render-markdown-html.ts --input .specs/.../01-topic.md
 * npx tsx .agents/skills/specs/scripts/render-markdown-html.ts --dir .specs/.../
 * ```
 *
 * @see skills/specs/SKILL.md - Policy that requires HTML twins and absolute-path reporting.
 * @documentation reviewed=2026-08-31 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import fs from "node:fs";
import path from "node:path";

export type RenderResult = {
  markdown: string;
  html: string;
};

const SKIP_DIR_NAMES = new Set(["node_modules", ".git", "dist", "build"]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function markdownToBody(markdown: string): { title: string; body: string } {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let title = "";
  let i = 0;

  const flushParagraph = (buffer: string[]): void => {
    const text = buffer.join(" ").trim();
    if (text.length > 0) {
      html.push(`<p>${renderInline(text)}</p>`);
    }
    buffer.length = 0;
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      const lang = line.trim().slice(3).trim();
      const fence: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        fence.push(lines[i]);
        i += 1;
      }
      i += 1;
      const code = fence.join("\n");
      if (lang === "mermaid") {
        html.push(`<pre class="mermaid">${escapeHtml(code)}</pre>`);
      } else {
        html.push(`<pre><code>${escapeHtml(code)}</code></pre>`);
      }
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitTableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      html.push("<table>");
      html.push("<thead><tr>");
      for (const header of headers) {
        html.push(`<th>${renderInline(header)}</th>`);
      }
      html.push("</tr></thead><tbody>");
      for (const row of rows) {
        html.push("<tr>");
        for (const cell of row) {
          html.push(`<td>${renderInline(cell)}</td>`);
        }
        html.push("</tr>");
      }
      html.push("</tbody></table>");
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      if (level === 1 && title === "") {
        title = text;
      }
      html.push(`<h${level}>${renderInline(text)}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^\s*([-*_]){3,}\s*$/.test(line)) {
      html.push("<hr>");
      i += 1;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      html.push(`<blockquote>${renderInline(quote.join(" "))}</blockquote>`);
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      html.push("<ul>");
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        html.push(`<li>${renderInline(lines[i].replace(/^\s*[-*+]\s+/, ""))}</li>`);
        i += 1;
      }
      html.push("</ul>");
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      html.push("<ol>");
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        html.push(`<li>${renderInline(lines[i].replace(/^\s*\d+\.\s+/, ""))}</li>`);
        i += 1;
      }
      html.push("</ol>");
      continue;
    }

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^\s*```/.test(lines[i]) &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*>/.test(lines[i])
    ) {
      if (lines[i].includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
        break;
      }
      paragraph.push(lines[i]);
      i += 1;
    }
    flushParagraph(paragraph);
  }

  return { title: title || "Untitled", body: html.join("\n") };
}

function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { max-width: 52rem; margin: 2rem auto; padding: 0 1rem; font: 16px/1.5 system-ui, sans-serif; }
    pre { background: #f6f8fa; padding: 1rem; overflow: auto; }
    table { border-collapse: collapse; margin: 1rem 0; }
    th, td { border: 1px solid #ccc; padding: 0.4rem 0.6rem; text-align: left; }
    code { font-family: ui-monospace, monospace; }
  </style>
</head>
<body>
${body}
<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
  mermaid.initialize({ startOnLoad: true, theme: "neutral" });
</script>
</body>
</html>
`;
}

export function renderMarkdownFile(inputPath: string, outputPath?: string): RenderResult {
  const markdown = path.resolve(inputPath);
  if (!fs.existsSync(markdown) || !fs.statSync(markdown).isFile()) {
    throw new Error(`Markdown file not found: ${markdown}`);
  }
  if (!markdown.endsWith(".md")) {
    throw new Error(`Not a markdown file: ${markdown}`);
  }

  const htmlPath = path.resolve(outputPath ?? markdown.replace(/\.md$/i, ".html"));
  const source = fs.readFileSync(markdown, "utf8");
  const { title, body } = markdownToBody(source);
  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  fs.writeFileSync(htmlPath, wrapHtml(title, body), "utf8");

  return { markdown, html: htmlPath };
}

function listMarkdownFiles(dirPath: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIR_NAMES.has(entry.name)) {
        results.push(...listMarkdownFiles(full));
      }
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results.sort();
}

export function renderMarkdownDirectory(dirPath: string): RenderResult[] {
  const absoluteDir = path.resolve(dirPath);
  if (!fs.existsSync(absoluteDir) || !fs.statSync(absoluteDir).isDirectory()) {
    throw new Error(`Directory not found: ${absoluteDir}`);
  }
  return listMarkdownFiles(absoluteDir).map((filePath) => renderMarkdownFile(filePath));
}

function printResults(results: RenderResult[]): void {
  for (const result of results) {
    console.log(`Markdown: ${result.markdown}`);
    console.log(`HTML: ${result.html}`);
  }
}

function parseArgs(argv: string[]): { input?: string; output?: string; dir?: string } {
  const parsed: { input?: string; output?: string; dir?: string } = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === "--input") {
      parsed.input = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (current === "--output") {
      parsed.output = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (current === "--dir") {
      parsed.dir = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument "${current}". Expected --input, --output, or --dir.`);
  }
  return parsed;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.dir && args.dir.trim().length > 0) {
    printResults(renderMarkdownDirectory(args.dir));
    return;
  }
  if (args.input && args.input.trim().length > 0) {
    printResults([renderMarkdownFile(args.input, args.output)]);
    return;
  }
  console.error("Usage: render-markdown-html.ts --input <file.md> [--output <file.html>]");
  console.error("       render-markdown-html.ts --dir <folder>");
  process.exit(1);
}

const invoked = process.argv[1] ? path.basename(process.argv[1]) : "";
if (invoked.includes("render-markdown-html")) {
  main();
}
