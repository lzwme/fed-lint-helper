import type {
  CommConfig,
  ESLintCheckConfig,
  ILintTypes,
  JestCheckConfig,
  JiraCheckConfig,
  PrettierCheckConfig,
  TsCheckConfig,
} from '../types';

export async function lintStartAsync(type: ILintTypes, config: CommConfig, isInWorker: boolean, done: (d: unknown) => void) {
  if (isInWorker) {
    const resetConfig = { checkOnInit: false, exitOnError: false, mode: 'current' };
    Object.assign(config, resetConfig);
  }

  switch (type) {
    case 'tscheck': {
      return import('../lint/ts-check.js').then(({ TsCheck }) => {
        const inc = new TsCheck(config as TsCheckConfig);
        inc.start().then(d => done(d));
      });
    }
    case 'eslint': {
      return import('../lint/eslint-check.js').then(({ ESLintCheck }) => {
        const inc = new ESLintCheck(config as ESLintCheckConfig);
        inc.start().then(d => done(d));
      });
    }
    case 'jest': {
      return import('../lint/jest-check.js').then(({ JestCheck }) => {
        const inc = new JestCheck(config as JestCheckConfig);
        inc.start().then(d => done(d));
      });
    }
    case 'jira': {
      return import('../lint/jira-check.js').then(({ JiraCheck }) => {
        const inc = new JiraCheck(config as JiraCheckConfig);
        inc.start().then(d => done(d));
      });
    }
    case 'prettier': {
      return import('../lint/prettier-check.js').then(({ PrettierCheck }) => {
        const inc = new PrettierCheck(config as PrettierCheckConfig);
        inc.start().then(d => done(d));
      });
    }
    case 'biome': {
      return import('../lint/biome-check.js').then(({ BiomeCheck }) => {
        const inc = new BiomeCheck(config);
        inc.start().then(d => done(d));
      });
    }
    default: {
      // eslint-disable-next-line no-console
      console.log('[lintStartAsync][TODO]', config, type);
      process.exit(1);
    }
  }
}
