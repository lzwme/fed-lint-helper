/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: lzw
 * @LastEditTime: 2022-08-16 15:39:45
 * @Description:  Jira check
 */

import { resolve, join } from 'path';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import type { IncomingHttpHeaders } from 'http';
import { color } from 'console-log-colors';
import { assign, getHeadBranch } from '@lzwme/fe-utils';
import { PlainObject, getLogger, checkUserEmial } from './utils';
import { getConfig } from './config';
import type { JiraCheckConfig } from './types';
import { Request } from '@lzwme/fe-utils';
import { LintBase, type LintResult } from './LintBase';

const { magenta, magentaBright, cyanBright, yellowBright, redBright, green, greenBright } = color;

export interface JiraCheckResult extends LintResult {
  /** 是否检测通过 */
  isPassed: boolean;
}

interface JiraError {
  errorMessages?: string[];
  errors?: PlainObject;
}

interface IssueItem {
  expand: string;
  id: string;
  /** 查询该 jira 信息的 api 地址 */
  self: string;
  /** issues 编号 */
  key: string;
  fields: {
    comment: {
      comments: {
        self: string;
        id: string;
        author: Author;
        body: string;
        updateAuthor: Author;
        created: string;
        updated: string;
      }[];
      maxResults: number;
      total: number;
      startAt: number;
    };
    assignee: Author;
    issuetype?: {
      self: string;
      id: string;
      description: string;
      iconUrl: string;
      name: string;
      subtask: boolean;
      avatarId: number;
    };
    fixVersions?: {
      name: string;
      description: string;
    }[];
    [key: string]: unknown;
  };
}

interface Author {
  self: string;
  name: string;
  key: string;
  emailAddress: string;
  avatarUrls: {
    '48x48': string;
    '24x24': string;
    '16x16': string;
    '32x32': string;
  };
  displayName: string;
  active: boolean;
  timeZone: string;
}

/**
 * @url 忽略规则参考地址: https://github.com/conventional-changelog/commitlint/blob/master/%40commitlint/is-ignored/src/defaults.ts
 */
const ignoredCommitList = [
  /^((Merge pull request)|(Merge (.*?) into (.*?)|(Merge branch (.*?)))(?:\r?\n)*$)/m,
  /^(R|r)evert (.*)/,
  /^(fixup|squash)!/,
  /^Merged (.*?)(in|into) (.*)/,
  /^Merge remote-tracking branch (.*)/,
  /^Automatic merge(.*)/,
  /^Auto-merged (.*?) into (.*)/,
];

export class JiraCheck extends LintBase<JiraCheckConfig, JiraCheckResult> {
  private reqeust: Request;

  constructor(config: JiraCheckConfig = {}) {
    super('jira', config);
  }
  /** 配置参数格式化 */
  public parseConfig(config: JiraCheckConfig) {
    const baseConfig = getConfig();

    if (config !== this.config) config = assign<JiraCheckConfig>({}, this.config, config);
    config = assign<JiraCheckConfig>({ commitMsgPrefix: '[ET]' }, baseConfig.jira, config);
    baseConfig.jira = config;
    if (!config.issuePrefix) config.issuePrefix = [];
    if (!Array.isArray(config.issuePrefix)) config.issuePrefix = [config.issuePrefix];

    for (const [index, value] of config.issuePrefix.entries()) {
      if (!value.endsWith('-')) config.issuePrefix[index] = value + '-';
    }

    const level = config.silent ? 'silent' : config.debug ? 'debug' : 'log';
    this.logger = getLogger(`[JIRA][${config.type}]`, level, baseConfig.logDir);

    return config;
  }
  private initRequest() {
    if (this.reqeust) return;

    const headers = assign<IncomingHttpHeaders>(
      {
        /** @see https://developer.atlassian.com/server/jira/platform/cookie-based-authentication/ */
        cookie: '',
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36`,
        'Content-Type': 'application/json;charset=UTF-8',
        Host: this.config.jiraHome.split('://')[1],
        Origin: this.config.jiraHome,
        Referer: this.config.jiraHome,
      },
      this.config.headers
    );
    // 在当前工作目录下存在 .jira.json 文件
    const jiraPath = this.getJiraCfgPath(true);

    if (jiraPath) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const jiraConfig: PlainObject = require(jiraPath);

      if (jiraConfig.cookie) headers.cookie = jiraConfig.cookie;

      if (jiraConfig.JSESSIONID && !headers.cookie.includes('JSESSIONID=')) {
        headers.cookie += `;JSESSIONID=${jiraConfig.JSESSIONID}`;
      }

      if (jiraConfig.authorization) {
        headers.Authorization = `Basic ${jiraConfig.authorization}`;
      } else if (jiraConfig.username && jiraConfig.pwd) {
        headers.Authorization = `Basic ${Buffer.from(`${jiraConfig.username}:${jiraConfig.pwd}`).toString('base64')}`;
      }
    }

    // 支持环境变量 JIRA_JSESSIONID 设置 cookie
    if (process.env.JIRA_JSESSIONID) headers.cookie = `JSESSIONID=${process.env.JIRA_JSESSIONID}`;
    this.logger.debug('[initRequest]headers', headers);

    this.reqeust = new Request(headers.cookie, headers);
  }
  /** 返回本地的 .jira.json 配置文件路径 */
  private getJiraCfgPath(isPrintTips = false) {
    let filePath = '';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const isFind = [this.config.rootDir, require('os').homedir()].some(dir => {
      const fileNames = ['.jira.json', '.jira.js'];
      for (const filename of fileNames) {
        filePath = resolve(dir, filename);
        if (existsSync(filePath)) return true;
      }
      return false;
    });
    if (isFind) return filePath;

    if (isPrintTips) {
      this.logger.warn('请在项目根目录或当前用户主目录下添加 .jira.json 配置文件，以JSON格式配置 {username, pwd, proxy, cookie?}');
    }
    return '';
  }
  /** 获取 issueType 列表 */
  private async getIssueType() {
    const issueTypeCachePath = resolve(this.config.rootDir, 'node_modules/.cache/.jiraIssueType.json');
    let issueTypeList: { id: number; subtask: boolean; name: string }[] = [];

    if (existsSync(issueTypeCachePath)) {
      issueTypeList = JSON.parse(readFileSync(issueTypeCachePath, 'utf8'));
    }

    if (issueTypeList.length === 0) {
      const url = `${this.config.jiraHome}/rest/api/2/issuetype`;
      const result = await this.reqeust.get<typeof issueTypeList>(url);
      if (!Array.isArray(result.data)) {
        this.logger.warn('获取 issuetype 列表异常：', result.data || result.headers);
        return [];
      }

      issueTypeList = result.data;
      this.logger.debug('[getIssueType]', result.data);

      // 写入缓存文件中
      this.saveCache(issueTypeCachePath, issueTypeList, true);
    }

    return issueTypeList;
  }
  /** CI pipeline 阶段执行的批量检查，主要用于 MR 阶段 */
  private async pipelineCheck(): Promise<boolean> {
    const { config, stats, logger } = this;
    const sprintVersion = `${getHeadBranch()}`.split('_')[0];
    const projects = (config.issuePrefix as string[]).map(d => d.replace(/-$/, '')).join(',');
    const query = `project IN (${projects}) AND fixVersion = "${sprintVersion}" AND comment ~ "必须修复"${
      config.projectName ? ` AND comment ~ "${config.projectName}"` : ''
    } AND status in ("新建(New)", "处理中(Inprocess)", "测试验收(Test Verification)", "调试与审查(Code Review)", "关闭(Closed)") ORDER BY due ASC, priority DESC, created ASC`;
    const url = `${config.jiraHome}/rest/api/2/search?`; // jql=${encodeURIComponent(query)}&maxResults=100&fields=comment,assignee`;
    const p = assign<PlainObject>({ jql: query, maxResults: 100, fields: ['comment', 'assignee'] }, config.pipeline.requestParams);
    const r = await this.reqeust.post<{ total: number; issues: IssueItem[]; expand: string; maxResults: number } & JiraError>(url, p);
    const info = r.data;

    logger.debug('url:', url, info);
    if (!info.issues) {
      logger.error(info.errorMessages || info);
      stats.failedFilesNum = -1;
      return false;
    }

    logger.info('[检查信息]', query);
    logger.info('[检查信息]', `提取的JIRA(${magentaBright(info.total)}):`, info.issues.map(item => item.key).join(', '));
    logger.info('-'.repeat(80));

    for (const item of info.issues) {
      let fields = item.fields;

      if (!fields) {
        try {
          const { data } = await this.reqeust.get(item.self);
          if (!data.fields) {
            stats.failedFilesNum = -1;
            return false;
          }
          fields = data.fields as typeof fields;
        } catch (error) {
          logger.error(error);
          stats.failedFilesNum = -1;
          return false;
        }
      }

      logger.debug(item.key, fields);

      // 查找必须修复的标记
      const mustRepairTagIndex = fields.comment.comments.findIndex(comment => comment.body.includes('[必须修复]'));
      if (mustRepairTagIndex === -1) continue;

      if (config.debug) {
        const mustRepair = fields.comment.comments[mustRepairTagIndex];
        logger.debug('[检查信息]', item.key, '被', mustRepair.author.displayName, '于', mustRepair.updated, '设为必须被修复');
      }

      const comments: PlainObject[] = fields.comment.comments.slice(mustRepairTagIndex).reverse();
      /** 最新一次的 gitlab 提交信息 */
      const gitlabComment = comments.find(item => item.author.name === 'gitlab' && !item.body.includes('Merge'));

      if (!gitlabComment) {
        logger.debug('[检查信息]', `[${item.key}]未有代码提交`);
        continue;
      }

      /** 最新一次的 review 信息 */
      const reviewComment = comments.find(item => item.body.includes('[已阅]'));
      const gitlabCommiter = gitlabComment.body.split('|')[0].slice(1);
      const reviewers = fields.customfield_13002 as { displayName: string }[];
      let errmsg = '';

      // review的留言需要在gitlab提交日志之后
      if (!reviewComment || reviewComment.id < gitlabComment.id) {
        errmsg = `[${gitlabCommiter}]的代码提交未被[${reviewers?.[0]?.displayName || '未指定'}]审阅`;
      } else {
        if (gitlabCommiter === reviewComment.author.key) {
          errmsg = `[${reviewComment.author.displayName.split('（')[0]}]不能 review 自己的提交，请指派给熟悉相关模块的开发人员审阅！`;
        } else if (config.debug) {
          logger.debug(
            ' - [检查信息]',
            item.key,
            `[${gitlabCommiter}]的代码提交被`,
            reviewComment.author.displayName,
            '于',
            reviewComment.updated,
            '设为已阅'
          );
        }
      }

      if (errmsg) {
        logger.info(
          `[${++stats.failedFilesNum}] 指派给`,
          fields.assignee.displayName.split('（')[0],
          `http://jira.gf.com.cn/browse/${item.key}`,
          redBright(errmsg)
        );
        logger.info('-'.repeat(80));
      }
    }

    return stats.failedFilesNum === 0;
  }
  /** git hooks commit-msg 检查 */
  private async commitMsgCheck(): Promise<boolean> {
    const baseConfig = getConfig();
    const { config, stats, logger } = this;
    const issuePrefixs = config.issuePrefix as string[];

    if (baseConfig.userEmailRule) {
      const errmsg = checkUserEmial(baseConfig.userEmailRule, false, baseConfig.rootDir);
      if (errmsg) {
        logger.error(errmsg);
        return false;
      }
    }

    if (issuePrefixs.length === 0) {
      logger.error(`请在配置文件中指定 issuePrefix 参数`);
      return false;
    }

    /** 当前本地分支。分支命名格式：3.10.1<_dev><_fix-xxx> */
    const branch = getHeadBranch();
    /** 根据本地分支获取分支所属迭代版本) */
    const sprintVersion = branch.split('_')[0];
    /** 允许提交的版本 - todo: cherry-pick 时的匿名分支也需要支持允许 commit */
    const allowedFixVersions = [sprintVersion, branch];
    // 自定义分支允许提交预研任务
    if (sprintVersion !== branch && !branch.includes('_dev')) allowedFixVersions.push('tech_ahead_v1');

    const gitPath = join(config.rootDir, config.COMMIT_EDITMSG || './.git/COMMIT_EDITMSG');
    const commitMessage = readFileSync(gitPath, 'utf8').trim();

    const issuePrefix = issuePrefixs.find(d => commitMessage.includes(d)) || issuePrefixs[0];
    const jiraIDReg = new RegExp(`${issuePrefix}(\\d+)`, 'g');
    const jiraIDs = commitMessage.match(jiraIDReg);

    logger.info('='.repeat(40));
    logger.info(`[COMMIT-MSG] ${yellowBright(commitMessage)}`);
    logger.info('='.repeat(40));

    if (jiraIDs) {
      /** 智能匹配正则表达式，commit覆盖, JIRA号后需要输入至少一个中文、【|[、英文或者空格进行隔开 例子: JGCPS-1234测试提交123 或 [JGCPS-1234] 测试提交123 => [ET][2.9.1][feature][JGCPS-1234]测试提交123 */
      const smartRegWithMessage = new RegExp(`^\\[?${issuePrefix}\\d+\\]?([A-Za-z\\u4e00-\\u9fa5\\s【\\[]+.+)`);
      /**  智能匹配正则表达式，单纯匹配jira 例子: JGCPS-1234 或 [JGCPS-1234] => [ET][2.9.1][feature][JGCPS-1234]JIRA本身的标题 */
      const smartRegWithJIRA = new RegExp(`^\\[?${issuePrefix}(\\d+)\\]?`, 'g');
      const issueTypeList = await this.getIssueType();
      /** 禁止提交的类型 */
      const noAllowIssueType: number[] = [];
      // eslint-disable-next-line unicorn/no-array-reduce
      const issueTypeToDesc = issueTypeList.reduce((object, item) => {
        object[item.id] = item.name.replace(/[^A-Za-z]/g, '').toLowerCase();
        if (object[item.id].includes('subtask')) object[item.id] = 'feature';
        else if (object[item.id].includes('bug')) object[item.id] = 'bugfix';

        // 非 bug 的主任务，不允许提交
        if (!item.subtask && object[item.id].includes('bug')) noAllowIssueType.push(item.id);
        return object;
      }, {} as Record<number, string>);
      const jiraID = jiraIDs[0];
      const { data: info } = await this.reqeust.get<IssueItem & JiraError>(`${config.jiraHome}/rest/api/latest/issue/${jiraID}`);

      if (!info.fields || info.errorMessages) {
        logger.error(info.errorMessages || `获取 ${jiraID} 信息异常`);
        return false;
      }

      const summary = info.fields.summary;

      logger.debug(`[${jiraID}]info`, info);
      logger.info('[JIRA信息]', cyanBright(jiraID), yellowBright(summary));

      if (!info.fields.fixVersions?.length) {
        logger.error('JIRA没有挂修复版本，不允许提交');
        return false;
      }

      // 修复版本可能同时存在多个
      const fixVersions = info.fields.fixVersions.map(d => d.name);
      if (!config.ignoreVersion && !fixVersions.some(d => allowedFixVersions.includes(d))) {
        if (Array.isArray(config.allowedFixVersions) && fixVersions.some(d => config.allowedFixVersions.includes(d))) {
          logger.warn('修复版本与当前本地分支不一致，但在允许跳过检查的列表中', fixVersions, config.allowedFixVersions);
        } else {
          logger.error(`修复版本[${magenta(fixVersions.join(','))}]与当前本地分支[${magentaBright(sprintVersion)}]不一致，不允许提交`);
          return false;
        }
      }

      const versionName = info.fields.fixVersions[0].name;
      const versionInfo = info.fields.fixVersions[0].description;
      /** 是否已封板 */
      const isSeal = (versionInfo && versionInfo.includes('[已封版]')) || false;
      const issuetype = +info.fields.issuetype.id;

      if (noAllowIssueType.includes(issuetype)) {
        logger.error('不允许在父任务jira上提交, commit 提交不通过');
        return false;
      }

      const issueText = issueTypeToDesc[issuetype] || 'feature'; // 如果是其他类型，默认feature
      const reg = new RegExp(`^${config.commitMsgPrefix.replace(/([.[-])/g, '\\$1')}\\[${versionName}]\\[${issueText}]\\[${jiraID}]`);
      let smartCommit = '';

      // 如果匹配到commit中包含中文，则保留提交信息
      if (smartRegWithMessage.test(commitMessage)) {
        // 如果用户需要手动填入commit信息
        const message = commitMessage.match(smartRegWithMessage)[1].trim();
        smartCommit = `${config.commitMsgPrefix}[${versionName}][${issueText}][${jiraID}] ${message}`;
        logger.info(`[智能修改commit]: ${greenBright(smartCommit)} \n`);
      } else if (smartRegWithJIRA.test(commitMessage)) {
        // 如果只匹配到JIRA号
        smartCommit = `${config.commitMsgPrefix}[${versionName}][${issueText}][${jiraID}] ${summary}`;
        logger.info(`[智能修改commit]: ${greenBright(smartCommit)} \n`);
      } else if (!reg.test(commitMessage)) {
        // 如果都是自己填的
        logger.debug(reg, commitMessage, reg.test(commitMessage));
        logger.error('commit 格式校验不通过，请参考正确提交格式');
        logger.log('===================  Example  ===================');
        logger.log(greenBright(`${config.commitMsgPrefix}[${versionName}][${issueText}][${jiraID}] 描述问题或改进`));
        logger.log('===================  Example  ===================');
        return false;
      }

      writeFileSync(gitPath, smartCommit, { encoding: 'utf8' });

      if (isSeal && stats.isPassed) {
        logger.info(magentaBright(versionName), yellowBright('已经封版'));
        // 查找由产品指派给当前用户的jira，备注了 [必须修复] 文案提交
        const comment = info.fields.comment.comments.find(comment => {
          return comment.body.includes('[必须修复]') && config.sealedCommentAuthors.includes(comment.author.name);
        });

        if (!comment) {
          logger.error('[提交信息]', `[${jiraID}] JIRA并非必须修复，不允许提交`);
          return false;
        }
      }
    } else {
      if (/Merge branch/.test(commitMessage)) {
        logger.error('同分支提交禁止执行 Merge 操作，请使用 git rebase 或 git pull -r 命令。若为跨分支合并，请增加 -n 参数\n');
        return false;
      } else if (!ignoredCommitList.some(reg => reg.test(commitMessage))) {
        logger.error(`提交代码信息不符合规范，信息中应包含字符"${issuePrefix}XXXX".`);
        logger.error('例如：', cyanBright(`${issuePrefix}9171 【两融篮子】多组合卖出，指令预览只显示一个组合。\n`));
        return false;
      }
    }

    return true;
  }
  protected init() {
    return this.initRequest();
  }
  protected async check() {
    const stats = this.getInitStats();
    this.logger.info(green(`start checking`));

    try {
      stats.isPassed = this.config.type === 'commit' ? await this.commitMsgCheck() : await this.pipelineCheck();
    } catch (error) {
      this.logger.error((error as Error).message, '\n', (error as Error).stack);
      stats.isPassed = false;
    }

    return stats;
  }
  protected beforeStart(): boolean {
    return true;
  }
}
