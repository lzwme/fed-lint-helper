/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: renxia
 * @LastEditTime: 2025-05-30 12:04:16
 * @Description:  Jira check
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingHttpHeaders } from 'node:http';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Request, assign, dateFormat, getHeadBranch, readJsonFileSync } from '@lzwme/fe-utils';
import { cyan, cyanBright, green, greenBright, magenta, magentaBright, redBright, yellowBright } from 'console-log-colors';
import { getConfig } from '../config.js';
import type { AnyObject } from '../types';
import type { JiraCheckConfig, JiraCheckResult, JiraError, JiraIssueItem, JiraReqConfig } from '../types/jira.js';
import { checkUserEmial, getCommitMsg, getLogger } from '../utils/index.js';
import { LintBase } from './LintBase.js';
import { shouldIgnoreCommitLint } from './commit-lint.js';

export class JiraCheck extends LintBase<JiraCheckConfig, JiraCheckResult> {
  private reqeust: Request;
  constructor(config: JiraCheckConfig = {}) {
    super('jira', config);
  }
  /** 配置参数格式化 */
  public override parseConfig(config: JiraCheckConfig) {
    const baseConfig = getConfig();
    config = baseConfig.jira = super.parseConfig(config);

    if (!config.issuePrefix) config.issuePrefix = [];
    if (!Array.isArray(config.issuePrefix)) config.issuePrefix = [config.issuePrefix];

    for (const [index, value] of config.issuePrefix.entries()) {
      if (!value.endsWith('-')) config.issuePrefix[index] = `${value}-`;
    }

    const level = config.silent ? 'silent' : config.debug ? 'debug' : 'log';
    this.logger = getLogger(`[JIRA][${config.type}]`, level, baseConfig.logDir);

    return config;
  }
  private async initRequest() {
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
    const jiraPath = this.getJiraCfgPath(true);

    if (jiraPath) {
      type JCType = (JiraReqConfig & { default?: JiraReqConfig }) | (() => Promise<JiraReqConfig>);
      let jiraConfig: JCType = jiraPath.endsWith('.json')
        ? readJsonFileSync<JiraReqConfig>(jiraPath)
        : await import(pathToFileURL(jiraPath).href);
      if ('default' in jiraConfig) jiraConfig = jiraConfig.default;
      if (typeof jiraConfig === 'function') jiraConfig = await jiraConfig();
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
    const isFind = [this.config.rootDir, homedir()].some(dir => {
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
      await this.initRequest();
      const result = await this.reqeust.get<typeof issueTypeList>(url);
      if (!Array.isArray(result.data)) {
        this.logger.warn('获取 issuetype 列表异常：', String(result.data).trim().slice(0, 300) || result.headers);
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
    const query = `comment ~ "gitlab"${
      config.projectName ? ` AND comment ~ "${config.projectName}"` : ''
    } AND status in ("新建(New)", "处理中(Inprocess)", "测试验收(Test Verification)", "调试与审查(Code Review)", "关闭(Closed)") ORDER BY due ASC, priority DESC, created ASC`;
    const url = `${config.jiraHome}/rest/api/2/search?`; // jql=${encodeURIComponent(query)}&maxResults=100&fields=comment,assignee`;
    const p = assign<AnyObject>(
      {
        jql: query,
        maxResults: 100,
        fields: [],
      },
      config.pipeline.requestParams
    );

    p.jql = `project IN (${projects}) AND fixVersion = "${sprintVersion}" AND ${p.jql}`.replace(/AND +AND/, 'AND');
    p.fields = [...new Set(['comment', 'assignee', 'fixVersions', ...p.fields])];

    type ReqType = { total: number; issues: JiraIssueItem[]; expand: string; maxResults: number } & JiraError;
    const { data: info } = await this.reqeust.post<ReqType>(url, p);

    logger.debug('url:', url, p, info);
    logger.info('[检查信息]', p.jql);
    if (!info.issues) {
      logger.error(info.errorMessages || info);
      stats.failedFilesNum = -1;
      return false;
    }

    logger.info('[检查信息]', `提取的JIRA(${magentaBright(info.total)}):`, info.issues.map(item => item.key).join(', '));
    logger.info('-'.repeat(80));

    const printErrorInfo = (msg: string, item: JiraIssueItem) => {
      if (!msg) return;
      logger.info(
        `[${++stats.failedFilesNum}] 指派给`,
        item.fields.assignee.displayName.split('（')[0],
        `${config.jiraHome.replace(/\/$/, '')}/browse/${item.key}`,
        redBright(msg)
      );
      logger.info('-'.repeat(80));
    };

    for (const item of info.issues) {
      let fields = item.fields;
      let errmsg = '';

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

      if (typeof config.pipeline.verify === 'function') {
        const isOk = await config.pipeline.verify(item);
        if (isOk) {
          if (typeof isOk === 'string') printErrorInfo(isOk, item);
          continue;
        }
      }

      const versionInfo = fields.fixVersions[0].description;
      /** 是否已封板 */
      const isSeal = versionInfo?.includes('[已封版]') || false;
      // 没封板不做检查
      if (!isSeal) continue;

      /** 封板开始时间 */
      const sealTimeStr = versionInfo.match(/[\d- ]{8,}/)?.[0] || '';
      const sealTime = sealTimeStr ? new Date(dateFormat('yyyy-MM-ddThh:mm:ss.S', sealTimeStr)) : new Date();
      // 查找必须修复的标记
      const mustRepairTagIndex = fields.comment.comments.findIndex(comment => comment.body.includes(config.pipeline.mustRepairTag));
      const commitAfterSeal =
        sealTimeStr &&
        fields.comment.comments.find(comment => {
          return comment.author.name === 'gitlab' && !comment.body.includes('/merge_requests/') && new Date(comment.created) > sealTime;
        });

      if (mustRepairTagIndex === -1) {
        if (commitAfterSeal) {
          const commiter = commitAfterSeal.body.split('|')[0].slice(1);
          errmsg = `[${commiter}]的代码在封板之后提交，需相关负责人审阅并添加 ${cyanBright(config.pipeline.mustRepairTag)} 标记！`;
          printErrorInfo(errmsg, item);
        }

        continue;
      }

      if (config.debug) {
        const mustRepair = fields.comment.comments[mustRepairTagIndex];
        logger.debug('[检查信息]', item.key, '被', mustRepair.author.displayName, '于', mustRepair.updated, '设为必须被修复');
      }

      const comments: AnyObject[] = fields.comment.comments.slice(mustRepairTagIndex).reverse();
      /** 最新一次的 gitlab 提交信息 */
      const gitlabComment = comments.find(item => {
        const white = config.pipeline?.whiteProjectCommit;
        // 检测jira提交是否为白名单项目，没配置的话默认为true，主要用于前端项目过滤后端项目的commit记录
        const isInWhite = white?.length > 0 ? white.some(projectName => item.body.includes(`[a commit of ${projectName}|`)) : true;
        return item.author.name === 'gitlab' && isInWhite && !item.body.includes('/merge_requests/');
      });

      if (!gitlabComment) {
        logger.debug('[检查信息]', `[${item.key}]未有代码提交`);
        continue;
      }

      /** 最新一次的 review 信息 */
      const reviewComment = comments.find(item => item.body.includes('[已阅]'));
      const commiter = gitlabComment.body.split('|')[0].slice(1);
      const reviewers = fields.customfield_13002 as { displayName: string }[];

      // review的留言需要在gitlab提交日志之后
      if (!reviewComment || reviewComment.id < gitlabComment.id) {
        errmsg = `[${commiter}]的代码提交未被[${reviewers?.[0]?.displayName || '未指定'}]审阅`;
      } else {
        if (commiter === reviewComment.author.key) {
          errmsg = `[${reviewComment.author.displayName.split('（')[0]}]不能 review 自己的提交，请指派给熟悉相关模块的开发人员审阅！`;
        } else if (config.debug) {
          logger.debug(
            ` - [检查信息][${magenta(item.key)}][${commiter}]的代码提交被`,
            cyanBright(reviewComment.author.displayName),
            `于 ${greenBright(reviewComment.updated)} 设为[已阅]`
          );
        }
      }

      printErrorInfo(errmsg, item);
    }

    return stats.failedFilesNum === 0;
  }
  /** git hooks commit-msg 检查 */
  private async commitMsgCheck(): Promise<boolean> {
    const baseConfig = getConfig();
    const { config, logger } = this;
    const issuePrefixs = config.issuePrefix as string[];

    if (baseConfig.userEmailRule && !baseConfig.ci) {
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

    const { commitMessage, gitPath } = getCommitMsg(config.commitEdit, config.rootDir);
    if (commitMessage.length === 0) {
      logger.error('获取 commit msg 提交信息失败！');
      return false;
    }

    const result = await this.validCommitMsgs(commitMessage);

    if (gitPath && result.smartCommit && result.smartCommit !== commitMessage[0]) {
      logger.info(`[智能修改commit]: ${greenBright(result.smartCommit)} \n`);
      writeFileSync(gitPath, result.smartCommit, 'utf8');
    }

    return result.isvalid;
  }
  async validCommitMsgs(msgs: string[]) {
    const result = { smartCommit: '', isvalid: false };
    const { config, logger } = this;
    const issuePrefixs = config.issuePrefix as string[];
    /** 当前本地分支。分支命名格式：3.10.1<_dev><_fix-xxx> */
    const branch = getHeadBranch();
    /** 根据本地分支获取分支所属迭代版本) */
    const sprintVersion = branch.split('_')[0];
    /** 允许提交的版本 - todo: cherry-pick 时的匿名分支也需要支持允许 commit */
    const allowedFixVersions = [sprintVersion, branch];
    let smartCommit = '';

    // 自定义分支允许提交预研任务
    if (sprintVersion !== branch && !branch.includes('_dev')) allowedFixVersions.push('tech_ahead_v1');

    for (const commitMessage of msgs) {
      const issuePrefix = issuePrefixs.find(d => commitMessage.includes(d)) || issuePrefixs[0];
      const jiraIDReg = new RegExp(`${issuePrefix}(\\d+)`, 'g');
      const jiraIDs = commitMessage.match(jiraIDReg);

      logger.info('='.repeat(40));
      logger.info(`[COMMIT-MSG] ${yellowBright(commitMessage)}`);
      logger.info('='.repeat(40));

      if (jiraIDs) {
        /** 智能匹配正则表达式，commit覆盖, JIRA号后需要输入至少一个中文、【|[、英文或者空格进行隔开 例子: JGCPS-1234测试提交123 或 [JGCPS-1234] 测试提交123 => JGCPS-1234 [ET][2.9.1][feature]测试提交123 */
        const smartRegWithMessage = new RegExp(`^\\[?${issuePrefix}\\d+\\]?\\s*([A-Za-z\\u4e00-\\u9fa5\\s【\\[]+.+)`);
        /**  智能匹配正则表达式，单纯匹配jira 例子: JGCPS-1234 或 [JGCPS-1234] => JGCPS-1234 [ET][2.9.1][feature]JIRA本身的标题 */
        const smartRegWithJIRA = new RegExp(`^\\[?${issuePrefix}(\\d+)\\]?$`, 'g');
        const issueTypeList = await this.getIssueType();
        /** 禁止提交的类型 */
        const noAllowIssueType: number[] = [];
        const issueTypeToDesc = issueTypeList.reduce(
          (object, item) => {
            object[item.id] = item.name.replace(/[^A-Za-z]/g, '').toLowerCase();
            if (object[item.id].includes('subtask')) object[item.id] = 'feature';
            else if (object[item.id].includes('bug')) object[item.id] = 'bugfix';

            // 非 bug 的主任务，不允许提交
            if (!item.subtask && object[item.id].includes('bug')) noAllowIssueType.push(item.id);
            return object;
          },
          {} as Record<number, string>
        );
        const jiraID = jiraIDs[0];
        const { data: info } = await this.reqeust.get<JiraIssueItem & JiraError>(`${config.jiraHome}/rest/api/latest/issue/${jiraID}`);

        if (!info.fields || info.errorMessages) {
          logger.error(info.errorMessages || `获取 ${jiraID} 信息异常`);
          return result;
        }

        const summary = info.fields.summary;

        logger.debug(`[${jiraID}]info`, info);
        logger.info('[JIRA信息]', cyanBright(jiraID), cyan(summary));

        if (!info.fields.fixVersions?.length) {
          logger.error('JIRA没有挂修复版本，不允许提交');
          return result;
        }

        // 修复版本可能同时存在多个
        const fixVersions = info.fields.fixVersions.map(d => d.name);
        if (!config.ignoreVersion && !fixVersions.some(d => allowedFixVersions.includes(d))) {
          if (Array.isArray(config.allowedFixVersions) && fixVersions.some(d => config.allowedFixVersions.includes(d))) {
            logger.warn('修复版本与当前本地分支不一致，但在允许跳过检查的列表中', fixVersions, config.allowedFixVersions);
          } else {
            logger.error(`修复版本[${magenta(fixVersions.join(','))}]与当前本地分支[${magentaBright(sprintVersion)}]不一致，不允许提交`);
            return result;
          }
        }

        const versionName = info.fields.fixVersions[0].name;
        const versionInfo = info.fields.fixVersions[0].description;
        /** 是否已封板 */
        const isSeal = (versionInfo && versionInfo.includes('[已封版]')) || false;
        const issuetype = +info.fields.issuetype.id;

        if (noAllowIssueType.includes(issuetype)) {
          logger.error('不允许在父任务jira上提交, commit 提交不通过');
          return result;
        }

        const issueText = issueTypeToDesc[issuetype] || 'feature'; // 如果是其他类型，默认feature
        const reg = new RegExp(`^$${jiraID} ${config.commitMsgPrefix.replace(/([.[-])/g, '\\$1')}\\[${versionName}]\\[${issueText}]`);
        smartCommit = commitMessage;

        // 如果匹配到commit中包含中文，则保留提交信息
        if (commitMessage.startsWith(`${jiraID} ${config.commitMsgPrefix}[${versionName}][${issueText}]`)) {
          smartCommit = commitMessage;
        } else if (smartRegWithMessage.test(commitMessage)) {
          // 如果用户需要手动填入commit信息
          const message = commitMessage.match(smartRegWithMessage)[1].trim();
          smartCommit = `${jiraID} ${config.commitMsgPrefix}[${versionName}][${issueText}] ${message}`;
        } else if (smartRegWithJIRA.test(commitMessage)) {
          // 如果只匹配到JIRA号
          smartCommit = `${jiraID} ${config.commitMsgPrefix}[${versionName}][${issueText}] ${summary as string}`;
        } else if (!reg.test(commitMessage)) {
          // 如果都是自己填的
          logger.debug(reg, commitMessage, reg.test(commitMessage));
          logger.error('commit 格式校验不通过，请参考正确提交格式');
          logger.log('===================  Example  ===================');
          logger.log(greenBright(`${jiraID} ${config.commitMsgPrefix}[${versionName}][${issueText}] 描述问题或改进`));
          logger.log('===================  Example  ===================');
          return result;
        }

        if (isSeal) {
          logger.info(magentaBright(versionName), yellowBright('已经封版'));
          // 查找由产品指派给当前用户的jira，备注了 [必须修复] 文案提交
          const comment = info.fields.comment.comments.find(comment => {
            return comment.body.includes(config.pipeline.mustRepairTag) && config.sealedCommentAuthors.includes(comment.author.name);
          });

          if (!comment) {
            logger.error(`[提交信息][${jiraID}] JIRA并非 [必须修复]，不允许提交`);
            return result;
          }
        }
      } else {
        if (commitMessage.includes('Merge branch')) {
          logger.error('同分支提交禁止执行 Merge 操作，请使用 git rebase 或 git pull -r 命令。若为跨分支合并，请增加 -n 参数\n');
          return result;
        }

        if (!shouldIgnoreCommitLint(commitMessage)) {
          logger.error(redBright(`提交代码信息不符合规范，信息中应包含字符"${cyan(`${issuePrefix}`)}XXXX".`));
          logger.error('例如：', cyanBright(`${issuePrefix}9171 【两融篮子】多组合卖出，指令预览只显示一个组合。\n`));
          return result;
        }
      }
    }

    result.smartCommit = smartCommit;
    result.isvalid = true;
    return result;
  }
  protected async check() {
    const stats = this.getInitStats();
    this.logger.info(green(`start checking`));

    try {
      await this.initRequest();
      stats.isPassed = this.config.type === 'commit' ? await this.commitMsgCheck() : await this.pipelineCheck();
    } catch (error) {
      this.logger.error((error as Error).message, '\n', (error as Error).stack);
      stats.isPassed = false;
    }

    return stats;
  }
  protected beforeStart() {
    return this.config.jiraHome ? true : '请配置 `jiraHome` 参数';
  }
}
