import { lint, denolint } from '@node-rs/deno-lint';

export function denoLint(filepath: string, source: string, enableAllRules = true) {
  return lint(filepath, source, enableAllRules);
}

export function denoLintAll(dirname: string, configPath: string) {
  return denolint(dirname, configPath);
}
