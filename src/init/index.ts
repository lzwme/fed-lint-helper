import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { color } from 'console-log-colors';
import { getObjectKeysUnsafe, type PackageJson, execSync, mkdirp } from '@lzwme/fe-utils';
import { prompt } from 'enquirer';
import { getConfig } from '../config';
import { getLogger } from '../utils';

function getCfgInfo() {
  const config = getConfig();

  // todo: read from package.json
  const info: Record<
    string,
    {
      tpl: string;
      exist?: boolean;
      configFile?: string;
      tplOthers?: [string, string][];
      devDeps?: string[];
    }
  > = {
    flh: {
      configFile: config.configPath,
      tpl: 'flh.config.tpl.js',
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
      exist: false,
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
    value.exist = existsSync(value.configFile);
    if (!value.configFile) value.configFile = value.tpl.replace('.tpl.', '.');
    if (!value.devDeps) value.devDeps = [];
  });

  info.eslint.exist = ['', '.js', '.json', '.ts'].some(d => {
    const filename = `.eslintrc${d}`;
    const exist = existsSync(filename);
    if (exist) info.eslint.configFile = filename;
    return exist;
  });

  info.prettier.exist = ['', '.js', '.json', '.ts'].some(d => {
    const filename = `.prettierrc${d}`;
    const exist = existsSync(filename);
    if (exist) info.prettier.configFile = filename;
    return exist;
  });

  info.jest.exist = ['.js', '.json', '.ts'].some(d => {
    const filename = `jest.config${d}`;
    const exist = existsSync(filename);
    if (exist) info.jest.configFile = filename;
    return exist;
  });

  return info;
}

async function getPackageManager(pkg: PackageJson) {
  let packageManager = pkg.packageManager ? pkg.packageManager.split('@')[0] : '';

  if (!packageManager) {
    const execpath = process.env.npm_execpath || '';
    packageManager = /pnpm/.test(execpath) ? 'pnpm' : /yarn/.test(execpath) ? 'yarn' : 'npm';
  }

  if (!packageManager) {
    const anwsers = await prompt<{ pm: string }>([
      {
        type: 'select',
        name: 'pm',
        message: '请选择使用的包管理器类型',
        choices: ['pnpm', 'yarn', 'npm'],
      },
    ]);
    packageManager = anwsers.pm;
  }

  return packageManager;
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
        message: `[${color.magentaBright(key)}] ${item.exist ? `已存在配置文件` : `是否初始化配置文件？`}`,
        hint: color.cyanBright(item.configFile),
        disabled: item.exist,
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

  const tplDir = resolve(__dirname, '../../preset/tpl');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg: PackageJson = require(resolve(process.cwd(), './package.json'));
  const pkgAllDeps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
  const deps = new Set<string>();
  const isUseTs = anwsers.flh.includes('tsconfig') || pkgAllDeps.typescript != null;

  for (const type of anwsers.flh) {
    const item = info[type];
    const tpl = 'tpl' in item ? resolve(tplDir, item.tpl) : '';
    let cfgInfo = '';

    if (tpl && !existsSync(tpl)) {
      logger.warn('模板文件不存在', color.redBright(tpl));
    } else cfgInfo = readFileSync(tpl, 'utf8');

    if (existsSync(item.configFile)) {
      logger.warn(color.yellowBright(`当前目录下已存在配置文件：`), color.cyanBright(item.configFile));
    }

    if (cfgInfo) {
      if (type === 'flh') {
        cfgInfo = readFileSync(tpl, 'utf8').replace(`import('./src/config')`, `import('${packageInfo.name}')`);
      }

      mkdirp(dirname(item.configFile));
      writeFileSync(item.configFile, cfgInfo, 'utf8');
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
        writeFileSync(dest, readFileSync(tplFile));
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

    if (pkgAllDeps.scss) deps.add('stylelint-scss');
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
    const packageManager = await getPackageManager(pkg);
    const cmd = `${packageManager} ${packageManager === 'npm' ? 'i' : 'add'} -D ${[...deps].join(' ')}`;
    logger.info(`开始安装依赖：`, color.cyanBright(cmd));
    execSync(cmd, 'inherit');
  }

  logger.info(color.greenBright('配置初始化完成！'));
  return true;
}

if (module === require.main) flhInit({ force: false }, null);
