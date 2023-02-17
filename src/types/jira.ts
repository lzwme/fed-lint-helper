import type { IncomingHttpHeaders } from 'node:http';
import { LintResult, type AnyObject } from './base.js';
import type { CommConfig } from './config.js';

export interface JiraIssueItem {
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

export type JiraReqConfig = {
  cookie?: string;
  JSESSIONID?: string;
  authorization?: string;
  username?: string;
  pwd?: string;
};

export interface JiraCheckResult extends LintResult {
  /** 是否检测通过 */
  isPassed: boolean;
}

export interface JiraError {
  errorMessages?: string[];
  errors?: AnyObject;
}

export interface JiraCheckConfig extends CommConfig {
  /** 执行检测的类型 */
  type?: 'pipeline' | 'commit';
  /** jira 首页的 url 地址。如： http://jira.lzw.me */
  jiraHome?: string;
  /** gitlab 项目名称。如 lzwme/fed-lint-helper */
  projectName?: string;
  /** jira 请求自定义 headers 信息 */
  headers?: IncomingHttpHeaders;
  /** CI pipeline 阶段执行的批量检查相关配置 */
  pipeline?: {
    /** 必须修复的标记。默认为 `[必须修复]` */
    mustRepairTag?: string;
    /** pipeline 批量获取 jira issues 的请求参数 */
    requestParams: {
      jql?: string;
      fields?: string[];
      maxResults?: number;
      [key: string]: unknown;
    };
    /** 自定义验证逻辑。返回 true 通过，返回 string(errmsg) 失败，其他值则执行继续内置验证逻辑 */
    verify?: (item: JiraIssueItem) => boolean | string;
  };
  /** 已封板后允许回复必须修复的人员列表 */
  sealedCommentAuthors?: string[];
  /** jira issue 编号前缀，如编号为 LZWME-4321，则设置为 LZWME- */
  issuePrefix?: string | string[];
  /** commit 提交固定前缀，如： [ET] */
  commitMsgPrefix?: string;
  /**
   * 指定 git commit msg 的获取方式。可以是：
   * - COMMIT_EDITMSG 路径（默认为 ./.git/COMMIT_EDITMSG）
   * - git commitId hash
   * - 数字(0-99，表示取最近N条日志全部验证)
   */
  commitEdit?: string;
  /** 允许跳过分支版本检查提交的 jira 版本号 */
  allowedFixVersions?: string[];
  /** 是否忽略版本匹配检测 */
  ignoreVersion?: boolean;
}
