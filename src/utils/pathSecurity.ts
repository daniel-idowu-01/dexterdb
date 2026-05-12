import { basename, resolve } from "path";

/**
 * Normalizes and resolves a user-supplied path against `root` (defaults to cwd)
 * and rejects paths that escape `root` (directory traversal or another drive /
 * root on Windows).
 */
export function resolvePathWithinRoot(userPath: string, root: string = process.cwd()): string {
  const rootResolved = resolve(root);
  const resolved = resolve(rootResolved, userPath);

  const rootNorm = rootResolved.replace(/\\/g, "/").toLowerCase();
  const candNorm = resolved.replace(/\\/g, "/").toLowerCase();

  const rootWithSlash = rootNorm.endsWith("/") ? rootNorm : `${rootNorm}/`;

  if (candNorm !== rootNorm && !candNorm.startsWith(rootWithSlash)) {
    throw new Error(`Invalid path: resolves outside project directory (${userPath}).`);
  }

  return resolved;
}

/** Ensures joined file paths stay under baseDir (both already absolute). */
export function joinSafe(baseDir: string, fileName: string): string {
  if (fileName !== basename(fileName) || fileName.includes("..")) {
    throw new Error(`Invalid model file name: ${fileName}`);
  }

  const resolved = resolve(baseDir, fileName);
  const rootNorm = baseDir.replace(/\\/g, "/").toLowerCase();
  const candNorm = resolved.replace(/\\/g, "/").toLowerCase();
  const prefix = rootNorm.endsWith("/") ? rootNorm : `${rootNorm}/`;

  if (candNorm !== rootNorm && !candNorm.startsWith(prefix)) {
    throw new Error(`Invalid model file path: ${fileName}`);
  }

  return resolved;
}
