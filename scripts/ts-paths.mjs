// Lets Node run the app's TypeScript directly for the planner tests: `@/…` means `src/…`, as in
// tsconfig.json, and an import without an extension finds its .ts file. Used with
// `node --experimental-strip-types --import ./scripts/ts-paths.mjs`.
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, resolve as join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

registerHooks({
  resolve(specifier, context, next) {
    let path = null;
    if (specifier.startsWith('@/')) path = join(src, specifier.slice(2));
    else if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) path = join(dirname(fileURLToPath(context.parentURL)), specifier);
    if (path && !/\.[cm]?[jt]sx?$/.test(path)) {
      for (const tail of ['.ts', '.tsx', '/index.ts']) {
        if (existsSync(path + tail)) return next(pathToFileURL(path + tail).href, context);
      }
    }
    return next(path && specifier.startsWith('@/') ? pathToFileURL(path).href : specifier, context);
  },
});
