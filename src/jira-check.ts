/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: lzw
 * @LastEditTime: 2021-11-30 21:39:53
 * @Description:  Jira check
 */

import * as path from 'path';
import fs from 'fs';
import type { IncomingHttpHeaders } from 'http';
import { color } from 'console-log-colors';
import { exit, createForkThread, assign, getHeadBranch, PlainObject, Request } from './utils';
import { JiraCheckConfig, getConfig } from './config';
import { Logger } from './utils/Logger';

const { bold, redBright, greenBright } = color;
export interface JiraCheckResult {
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

export class JiraCheck {
  /** 统计信息 */
  private stats = this.getInitStats();
  private reqeust: Request;
  private logger: Logger;

  constructor(private config: JiraCheckConfig = {}) {
    config = this.parseConfig(config);
    const level = config.silent ? 'silent' : config.debug ? 'debug' : 'info';
    this.logger = Logger.getLogger(`[JIRA][${config.type}]`, level);
    this.logger.debug('config', this.config);
    if (config.checkOnInit) this.start();
  }
  /** 获取初始化的统计信息 */
  private getInitStats() {
    const stats = {
      /** 最近一次处理是否成功。默认为 true，遇到异常时应设置为 false */
      success: true,
      /** 最近一次处理的开始时间 */
      startTime: Date.now(),
      /** pipeline 检测不通过的 jira issues 数量 */
      errCount: 0,
    };
    this.stats = stats;
    return stats;
  }
  /** 返回执行结果统计信息 */
  public get statsInfo() {
    return this.stats;
  }
  /** 配置参数格式化 */
  public parseConfig(config: JiraCheckConfig) {
    const baseConfig = getConfig();

    if (config !== this.config) config = assign<JiraCheckConfig>({}, this.config, config);
    this.config = assign<JiraCheckConfig>({}, baseConfig.jira, config);
    if (!this.config.issuePrefix.endsWith('-')) this.config.issuePrefix += '-';
    return this.config;
  }
  private init() {
    // const config = this.config;

    this.initRequest();
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

      if (jiraConfig.username && jiraConfig.pwd) {
        headers.Authorization = `Basic ${Buffer.from(`${jiraConfig.username}:${jiraConfig.pwd}`).toString('base64')}`;
      }

      if (jiraConfig.authorization) {
        headers.Authorization = `Basic ${jiraConfig.authorization}`;
      }
    }

    // 支持环境变量 JIRA_JSESSIONID 设置 cookie
    if (process.env.JIRA_JSESSIONID) headers.cookie = `JSESSIONID=${process.env.JIRA_JSESSIONID}`;
    this.logger.debug('headers', headers);

    this.reqeust = new Request(headers.cookie, headers);
  }
  /** 返回本地的 .jira.json 配置文件路径 */
  private getJiraCfgPath(isPrintTips = false) {
    const jiraFileName = '.jira.json';
    let filePath = path.resolve(this.config.rootDir, jiraFileName);

    if (!fs.existsSync(filePath)) {
      // 支持用户主目录下全局配置查找
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const homedir = require('os').homedir();
      filePath = path.resolve(homedir, jiraFileName);
    }

    if (fs.existsSync(filePath)) return filePath;

    if (isPrintTips) {
      this.logger.warn('请在项目根目录或当前用户主目录下添加 .jira.json 配置文件，以JSON格式配置 {username, pwd, proxy, cookie?}');
    }

    return null;
  }
  /** 获取 issueType 列表 */
  private async getIssueType() {
    const issueTypeCachePath = path.resolve(this.config.rootDir, 'node_modules/.cache/.jiraIssueType.json');
    let issueTypeList: { id: number; subtask: boolean; name: string }[] = [];

    if (fs.existsSync(issueTypeCachePath)) {
      issueTypeList = JSON.parse(fs.readFileSync(issueTypeCachePath, 'utf-8'));
    }

    if (!issueTypeList.length) {
      const url = `${this.config.jiraHome}/rest/api/2/issuetype`;
      const result = await this.reqeust.get<typeof issueTypeList>(url);
      if (!Array.isArray(result.data)) {
        this.logger.error('[error]', result);
        return [];
      }

      issueTypeList = result.data;
      this.logger.debug('[getIssueType]', result.data);

      // 写入缓存文件中
      if (!fs.existsSync(path.dirname(issueTypeCachePath))) {
        fs.mkdirSync(path.dirname(issueTypeCachePath), { recursive: true });
      }
      fs.writeFileSync(issueTypeCachePath, JSON.stringify(issueTypeList), 'utf8');
    }

    return issueTypeList;
  }
  /** CI pipeline 阶段执行的批量检查，主要用于 MR 阶段 */
  private async pipelineCheck() {
    const { config, stats } = this;
    const checkResult: JiraCheckResult = { isPassed: false };

    const sprintVersion = `${getHeadBranch()}`.split('_')[0];
    const query = `project = ${config.issuePrefix.replace(/-$/, '')} AND fixVersion = "${sprintVersion}" AND comment ~ "必须修复"${
      config.projectName ? ` AND comment ~ "${config.projectName}"` : ''
    } AND status in ("新建(New)", "处理中(Inprocess)", "测试验收(Test Verification)", "调试与审查(Code Review)", "关闭(Closed)") ORDER BY due ASC, priority DESC, created ASC`;
    const url = `${config.jiraHome}/rest/api/2/search?`; // jql=${encodeURIComponent(query)}&maxResults=100&fields=comment,assignee`;
    const p = assign<PlainObject>({ jql: query, maxResults: 100, fields: ['comment', 'assignee'] }, config.pipeline.requestParams);
    const r = await this.reqeust.post<{ total: number; issues: IssueItem[]; expand: string; maxResults: number } & JiraError>(url, p);
    const info = r.data;

    this.logger.debug('url:', url, info);
    if (!info.issues) {
      this.logger.error(info.errorMessages);
      stats.success = false;
      return checkResult;
    }

    this.logger.info('[检查信息]', query);
    this.logger.info('[检查信息]', `提取的JIRA(${color.magentaBright(info.total)}):`, info.issues.map(item => item.key).join(', '));
    this.logger.info('------------------------------------------------------------------------------------------');

    info.issues.forEach(async item => {
      let fields = item.fields;

      if (!fields) {
        try {
          const { data } = await this.reqeust.get(item.self);
          if (!data.fields) return (stats.errCount = -1);
          fields = data.fields;
        } catch (err) {
          this.logger.error(err);
          return (stats.errCount = -1);
        }
      }

      this.logger.debug(item.key, fields);

      // 查找必须修复的标记
      const mustRepairTagIndex = fields.comment.comments.findIndex(comment => comment.body.includes('[必须修复]'));
      if (mustRepairTagIndex === -1) return;

      if (config.debug) {
        const mustRepair = fields.comment.comments[mustRepairTagIndex];
        this.logger.debug('[检查信息]', item.key, '被', mustRepair.author.displayName, '于', mustRepair.updated, '设为必须被修复');
      }

      const comments: PlainObject[] = fields.comment.comments.slice(mustRepairTagIndex).reverse();
      /** 最新一次的 gitlab 提交信息 */
      const gitlabComment = comments.find(item => item.author.name === 'gitlab' && !item.body.includes('Merge'));

      if (!gitlabComment) {
        this.logger.debug('[检查信息]', `[${item.key}]未有代码提交`);
        return;
      }

      /** 最新一次的 review 信息 */
      const reviewComment = comments.find(item => item.body.includes('[已阅]'));
      const gitlabCommiter = gitlabComment.body.split('|')[0].slice(1);
      const reviewers = fields.customfield_13002;
      let errmsg = '';

      // review的留言需要在gitlab提交日志之后
      if (!reviewComment || reviewComment.id < gitlabComment.id) {
        errmsg = `[${gitlabCommiter}]的代码提交未被[${reviewers && reviewers[0] ? reviewers[0].displayName : '未指定'}]审阅`;
      } else {
        if (gitlabCommiter === reviewComment.author.key) {
          errmsg = `[${reviewComment.author.displayName.split('（')[0]}]不能 review 自己的提交，请指派给熟悉相关模块的开发人员审阅！`;
        } else if (config.debug) {
          this.logger.debug(
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
        this.logger.info(
          `[${++stats.errCount}] 指派给`,
          fields.assignee.displayName.split('（')[0],
          `http://jira.gf.com.cn/browse/${item.key}`,
          redBright(errmsg)
        );
        this.logger.info('------------------------------------------------------------------------------------------');
      }
    });

    checkResult.isPassed = stats.success = stats.errCount === 0;

    return checkResult;
  }
  /** git hooks commit-msg 检查 */
  private async commitMsgCheck() {
    const { config, stats } = this;
    /** 当前本地分支 */
    const branch = getHeadBranch();
    /** 根据本地分支获取分支所属迭代版本) */
    const sprintVersion = branch.split('_')[0];
    /** 允许提交的版本 - todo: cherry-pick 时的匿名分支也需要支持允许 commit */
    const allowedFixVersions = [sprintVersion, branch];
    // 自定义分支允许提交预研任务
    if (sprintVersion !== branch && !branch.includes('_dev')) allowedFixVersions.push('tech_ahead_v1');

    /** 智能匹配正则表达式，commit覆盖, JIRA号后需要输入至少一个中文、【|[、英文或者空格进行隔开 例子: JGCPS-1234测试提交123 或 [JGCPS-1234] 测试提交123 => [ET][2.9.1][feature][JGCPS-1234]测试提交123 */
    const smartRegWithMsg = new RegExp(`^\\[?${config.issuePrefix}\\d+\\]?([A-Za-z\\u4e00-\\u9fa5\\s【\\[]+.+)`);
    /**  智能匹配正则表达式，单纯匹配jira 例子: JGCPS-1234 或 [JGCPS-1234] => [ET][2.9.1][feature][JGCPS-1234]JIRA本身的标题 */
    const smartRegWithJIRA = new RegExp(`^\\[?${config.issuePrefix}(\\d+)\\]?`, 'g');
    const issueTypeList = await this.getIssueType();
    /** 禁止提交的类型 */
    const noAllowIssueType = [11007, 11019];
    const issueTypeToDesc = issueTypeList.reduce((obj, item) => {
      obj[item.id] = item.name.replace(/[^a-zA-Z]/, '').toLowerCase();
      if (obj[item.id].includes('subtask')) obj[item.id] = 'feature';
      else if (obj[item.id].includes('bug')) obj[item.id] = 'bugfix';

      // 非 bug 的主任务，不允许提交
      if (!item.subtask && obj[item.id].includes('bug')) noAllowIssueType.push(item.id);
      return obj;
    }, {} as Record<number, string>);
    /**
     * @url 忽略规则参考地址: https://github.com/conventional-changelog/commitlint/blob/master/%40commitlint/is-ignored/src/defaults.ts
     */
    const test = r => r.test.bind(r);
    const ignoredCommitList = [
      test(/^((Merge pull request)|(Merge (.*?) into (.*?)|(Merge branch (.*?)))(?:\r?\n)*$)/m),
      test(/^(R|r)evert (.*)/),
      test(/^(fixup|squash)!/),
      test(/^Merged (.*?)(in|into) (.*)/),
      test(/^Merge remote-tracking branch (.*)/),
      test(/^Automatic merge(.*)/),
      test(/^Auto-merged (.*?) into (.*)/),
    ];
    const gitPath = path.join(config.rootDir, config.COMMIT_EDITMSG || './.git/COMMIT_EDITMSG');
    const commitMsg = fs.readFileSync(gitPath, 'utf-8').replace('\n', ''); // commitMsg 后面带有 \n
    const jiraIDReg = new RegExp(`${config.issuePrefix}(\\d+)`, 'g');
    const jiraIDs = commitMsg.match(jiraIDReg);

    this.logger.info('===================================');
    this.logger.info(`[COMMIT-MSG] ${color.yellowBright(commitMsg)}`);
    this.logger.info('===================================');

    if (jiraIDs) {
      const jiraID = jiraIDs[0];
      const { data: info } = await this.reqeust.get<IssueItem & JiraError>(`${config.jiraHome}/rest/api/latest/issue/${jiraID}`);

      this.logger.debug(`[${jiraID}]info`, info);

      if (!info.fields || info.errorMessages) {
        this.logger.error(info.errorMessages || `获取 ${jiraID} 信息异常`);
        stats.success = false;
        return { isPassed: stats.success } as JiraCheckResult;
      }

      const versionName = info.fields.fixVersions[0].name;
      const versionInfo = info.fields.fixVersions[0].description;
      /** 是否已封板 */
      const isSeal = (versionInfo && versionInfo.includes('[已封版]')) || false;
      const summary = info.fields.summary;
      const issuetype = +info.fields.issuetype.id;
      this.logger.info('[JIRA信息]', color.cyanBright(jiraID), color.yellowBright(summary));

      if (info.fields.fixVersions.length === 0) {
        this.logger.error('JIRA没有挂修复版本，不允许提交');
        stats.success = false;
      }
      // 修复版本可能同时存在多个
      else if (!info.fields.fixVersions.some(item => allowedFixVersions.includes(item.name))) {
        this.logger.error('修复版本与当前本地分支不一致，不允许提交');
        stats.success = false;
      } else if (noAllowIssueType.includes(issuetype)) {
        this.logger.error('不允许在父任务jira上提交, commit 提交不通过');
        stats.success = false;
      }

      const issueText = issueTypeToDesc[issuetype] || 'feature'; // 如果是其他类型，默认feature
      const reg = new RegExp(`^\\[ET]\\[${versionName}]\\[${issueText}]\\[${jiraID}]`);

      // 如果匹配到commit中包含中文，则保留提交信息
      if (smartRegWithMsg.test(commitMsg)) {
        // 如果用户需要手动填入commit信息
        const msg = commitMsg.match(smartRegWithMsg)[1].trim();
        const smartCommit = `[ET][${versionName}][${issueText}][${jiraID}] ${msg}`;
        fs.writeFileSync(gitPath, smartCommit, { encoding: 'utf-8' });
        this.logger.info(`[智能修改commit]: ${smartCommit} \n`);
      } else if (smartRegWithJIRA.test(commitMsg)) {
        // 如果只匹配到JIRA号
        const smartCommit = `[ET][${versionName}][${issueText}][${jiraID}] ${summary}`;
        fs.writeFileSync(gitPath, smartCommit, { encoding: 'utf-8' });
        this.logger.info(`[智能修改commit]: ${smartCommit} \n`);
      } else if (!reg.test(commitMsg)) {
        // 如果都是自己填的
        this.logger.error('commit 校验不通过，请参考正确提交格式');
        this.logger.error('===================  Example  ===================');
        this.logger.error(`[ET][${versionName}][${issueText}][${jiraID}] 描述问题或改进`);
        this.logger.error('===================  Example  ===================');
        stats.success = false;
      }

      if (isSeal && stats.success) {
        this.logger.info(color.magentaBright(versionName), color.yellowBright('已经封版'));
        // 查找由产品指派给当前用户的jira，备注了 [必须修复] 文案提交
        const comment = info.fields.comment.comments.find(comment => {
          return comment.body.includes('[必须修复]') && config.sealedCommentAuthors.includes(comment.author.name);
        });

        if (!comment) {
          this.logger.error('[提交信息]', `[${jiraID}] JIRA并非必须修复，不允许提交`);
          stats.success = false;
        }
      }
    } else {
      if (/Merge branch/.test(commitMsg)) {
        this.logger.error('同分支提交禁止执行 Merge 操作请使用 git rebase 或 git pull -r 命令。若为跨分支合并，请增加 -n 参数\n');
        stats.success = false;
      } else if (!ignoredCommitList.some(check => check(commitMsg))) {
        this.logger.error(`提交代码信息不符合规范，信息中应包含字符"${config.issuePrefix}XXXX".`);
        this.logger.error('例如：', color.cyanBright(`${config.issuePrefix}9171 【两融篮子】多组合卖出，指令预览只显示一个组合。\n`));
        stats.success = false;
      }
    }

    return { isPassed: stats.success } as JiraCheckResult;
  }
  private async check() {
    this.init();
    const stats = this.getInitStats();
    const checkResult: JiraCheckResult = { isPassed: false };

    this.logger.info(color.green(`start checking`));

    try {
      this.config.type === 'commit' ? await this.commitMsgCheck() : await this.pipelineCheck();
      checkResult.isPassed = stats.success;
    } catch (err) {
      this.logger.error(err.message, err.stack);
    }

    this.logger.info(bold(checkResult.isPassed ? greenBright('Verification passed!') : redBright('Verification failed!')));
    this.logger.info(`TimeCost: ${bold(greenBright(Date.now() - stats.startTime))}ms`);
    if (!checkResult.isPassed && this.config.exitOnError) {
      const exitCode = stats.errCount || -1;
      this.logger.debug('退出码', exitCode);
      exit(exitCode);
    }

    return checkResult;
  }
  /** 在 fork 子进程中执行 */
  private checkInChildProc() {
    this.logger.info('start fork child progress');
    return createForkThread<JiraCheckResult>({
      type: 'jira',
      debug: this.config.debug,
      jiraConfig: this.config,
    }).catch(code => {
      this.logger.error('checkInChildProc error, code:', code);
      if (this.config.exitOnError) exit(code);
    });
  }
  /** 在 work_threads 子线程中执行 */
  private checkInWorkThreads() {
    this.logger.info('start create work threads');
    return import('./utils/worker-threads').then(({ createWorkerThreads }) => {
      return createWorkerThreads<JiraCheckResult>({
        type: 'jira',
        debug: this.config.debug,
        jiraConfig: this.config,
      }).catch(code => {
        this.logger.error('checkInWorkThreads error, code:', code);
        if (this.config.exitOnError) exit(code);
      });
    });
  }
  async start() {
    this.init();
    if (this.config.mode === 'current') return this.check();
    if (this.config.mode === 'thread') return this.checkInWorkThreads();
    return this.checkInChildProc();
  }
}
