import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { color } from 'console-log-colors';
import { getObjectKeysUnsafe, type PackageJson, execSync, mkdirp, readJsonFileSync } from '@lzwme/fe-utils';
import { prompt } from 'enquirer';
import { flhSrcDir, getConfig } from '../config.js';
import { getLogger, tryGetPackageManager } from '../utils/index.js';

function getCfgInfo() {
  const config = getConfig();

  // todo: read from package.json
  const info: Record<
    string,
    {
      tpl: string;
      isExist?: boolean;
      configFile?: string;
      tplOthers?: [string, string][];
      devDeps?: string[];
    }
  > = {
    flh: {
      configFile: config.configPath,
      tpl: '.flh.config.tpl.js',
    },
    eslint: {
      tpl: `.eslintrc.tpl.js`,
      devDeps: ['eslint', '@types/eslint', 'eslint-plugin-import', 'eslint-plugin-unicorn'],
    },
    prettier: {
      tpl: `.prettierrc.tpl.js`,
      devDeps: ['prettier'],
    },
    jest: {
      tpl: `jest.config.js`,
      devDeps: ['jest', '@jest/core'],
    },
    stylelint: {
      tpl: `.stylelintrc.tpl.js`,
      devDeps: ['stylelint', 'stylelint-config-css-modules', 'stylelint-config-standard'],
    },
    tsconfig: {
      tpl: `tsconfig.tpl.json`,
      devDeps: ['typescript', '@types/node'],
    },
    editorconfig: {
      isExist: false,
      tpl: `.editorconfig`,
    },
    vscode: {
      configFile: '.vscode/settings.json',
      tpl: 'vscode/settings.json',
      tplOthers: [['vscode/extensions.json', '.vscode/extensions.json']],
    },
    husky: {
      configFile: '.husky/pre-commit',
      tpl: 'husky/pre-commit',
      tplOthers: [['husky/commit-msg', '.husky/commit-msg']],
      devDeps: ['husky'],
    },
  };

  Object.values(info).forEach(value => {
    if (!value.configFile) value.configFile = value.tpl.replace('.tpl.', '.');
    if (!value.devDeps) value.devDeps = [];
    value.isExist = existsSync(value.configFile);
  });

  info.eslint.isExist = ['', '.js', '.json', '.ts'].some(d => {
    const filename = `.eslintrc${d}`;
    const isExist = existsSync(filename);
    if (isExist) info.eslint.configFile = filename;
    return isExist;
  });

  info.prettier.isExist = ['', '.js', '.json', '.ts'].some(d => {
    const filename = `.prettierrc${d}`;
    const isExist = existsSync(filename);
    if (isExist) info.prettier.configFile = filename;
    return isExist;
  });

  info.jest.isExist = ['.js', '.json', '.ts'].some(d => {
    const filename = `jest.config${d}`;
    const isExist = existsSync(filename);
    if (isExist) info.jest.configFile = filename;
    return isExist;
  });

  return info;
}

export async function flhInit(options: Record<string, string | boolean>, packageInfo: PackageJson) {
  const logger = getLogger();

  if (!existsSync('package.json')) {
    logger.warn(`flh 仅支持前端项目。当前目录下不存在 ${color.greenBright('package.json')} 文件，请确认`);
    return false;
  }

  const info = getCfgInfo();
  const choices = getObjectKeysUnsafe(info)
    .map(key => {
      const item = info[key];

      return {
        name: key,
        message: `[${color.magentaBright(key)}] ${item.isExist ? color.gray(`已存在配置文件`) : `是否初始化配置文件？`}`,
        hint: color[item.isExist ? 'cyan' : 'cyanBright'](item.configFile),
        disabled: item.isExist,
      };
    })
    .sort((a, b) => (a.disabled === b.disabled ? 0 : a.disabled ? 1 : -1));
  const isAllConfiged = choices.every(d => d.disabled);

  if (options.force) choices.forEach(d => (d.disabled = false));

  if (isAllConfiged && !options.force) {
    logger.info(`所有配置都已存在，如需重置，请添加 --force 参数`);
    return false;
  }

  const anwsers = await prompt<{ flh: string[] }>({ type: 'multiselect', name: 'flh', message: '请选择要初始化的配置', choices });

  if (anwsers.flh.length === 0) {
    logger.info('您没有选择任何需要初始化的配置类型');
    return false;
  }

  const tplDir = resolve(flhSrcDir, '../preset/tpl');
  const pkg: PackageJson = readJsonFileSync<PackageJson>(resolve(process.cwd(), './package.json'));
  const pkgAllDeps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
  const deps = new Set<string>();
  const isUseTs = anwsers.flh.includes('tsconfig') || pkgAllDeps.typescript != null;

  for (const type of anwsers.flh) {
    const item = info[type];
    const tpl = 'tpl' in item ? resolve(tplDir, item.tpl) : '';
    let cfgInfo = '';

    if (tpl) {
      if (existsSync(tpl)) cfgInfo = readFileSync(tpl, 'utf8').replace('@ts-nocheck', '@ts-check');
      else logger.warn('模板文件不存在', color.redBright(tpl));
    }

    if (existsSync(item.configFile)) {
      logger.warn(color.yellowBright(`当前目录下已存在配置文件：`), color.cyanBright(item.configFile));
    }

    if (cfgInfo) {
      if (type === 'flh') {
        cfgInfo = cfgInfo.replace(/import\('.+'\)/m, `import('${packageInfo.name}')`);
      }

      mkdirp(dirname(item.configFile));
      writeFileSync(item.configFile, cfgInfo, { mode: type === 'husky' ? '0777' : null, encoding: 'utf8' });
      logger.log(`已在当前目录下生成配置文件：`, color.magentaBright(item.configFile));
    }

    if (item.tplOthers) {
      item.tplOthers.forEach(([tplFile, dest]) => {
        tplFile = resolve(tplDir, tplFile);
        if (!existsSync(tplFile)) {
          logger.warn('模板文件不存在', color.redBright(tplFile));
          return;
        }
        mkdirp(dirname(dest));
        writeFileSync(dest, readFileSync(tplFile), { mode: type === 'husky' ? '0777' : null });
        logger.log(`已在当前目录下生成配置文件：`, color.magentaBright(dest));
      });
    }

    item.devDeps?.forEach(dep => deps.add(dep));
  }

  // 可选依赖处理
  if (anwsers.flh.includes('eslint')) {
    if (pkgAllDeps.react) {
      [
        'eslint-plugin-jsx-a11y',
        'eslint-plugin-react',
        'eslint-plugin-react-hooks',
        'eslint-plugin-testing-library',
        'eslint-webpack-plugin',
      ].forEach(d => deps.add(d));
    }

    if (pkgAllDeps.webpack) {
      deps.add('eslint-webpack-plugin');
    }

    if (pkgAllDeps.prettier || anwsers.flh.includes('prettier')) {
      ['eslint-config-prettier', 'eslint-plugin-prettier'].forEach(d => deps.add(d));
    }

    if (isUseTs) {
      ['@typescript-eslint/eslint-plugin', '@typescript-eslint/parser'].forEach(d => deps.add(d));
    }

    if (pkgAllDeps.jest || anwsers.flh.includes('jest')) {
      deps.add('eslint-plugin-jest');
    }
  }

  if (anwsers.flh.includes('stylelint')) {
    if (deps.has('prettier') || pkgAllDeps.prettier) deps.add('stylelint-config-prettier');

    if (pkgAllDeps.sass || pkgAllDeps['node-sass']) deps.add('stylelint-scss');
  }

  if (anwsers.flh.includes('jest')) {
    if (isUseTs) {
      ['@types/jest', 'ts-jest'].forEach(d => deps.add(d));
    }

    if (pkgAllDeps.react || pkgAllDeps.vue) {
      ['identity-obj-proxy', 'jest-extened', 'jest-watch-typeahead', 'jest-environment-jsdom', '@testing-library/jest-dom'].forEach(d =>
        deps.add(d)
      );

      if (pkgAllDeps.react) {
        ['@testing-library/react', '@testing-library/react-hooks'].forEach(d => deps.add(d));
      }
    }
  }

  if (anwsers.flh.includes('babel') && pkgAllDeps.react) deps.add('@babel/preset-react');

  // 移除已存在的依赖
  deps.forEach(dep => pkgAllDeps[dep] && deps.delete(dep));

  if (deps.size > 0) {
    const packageManager = await tryGetPackageManager(pkg);
    const cmd = `${packageManager} ${packageManager === 'npm' ? 'i' : 'add'} -D ${[...deps].join(' ')}`;
    logger.info(`开始安装依赖：`, color.cyanBright(cmd));
    execSync(cmd, 'inherit');
  }

  logger.info(color.greenBright('配置初始化完成！'));
  return true;
}

// if (module === require.main) flhInit({ force: false }, null);
