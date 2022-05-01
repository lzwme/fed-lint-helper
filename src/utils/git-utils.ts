/*
 * @Author: lzw
 * @Date: 2021-04-23 10:44:32
 * @LastEditors: lzw
 * @LastEditTime: 2021-11-15 10:26:31
 * @Description: gh u 相关的命令。主要为常用的快捷工具方法
 */

import path from 'path';
import fs from 'fs';
import { execSync } from './common';

/** 获取当前的本地分支名 */
export function getHeadBranch(baseDirectory = process.cwd()) {
  // 支持在 Jenkins CI 中从环境变量直接获取
  let branch = process.env.CI_COMMIT_REF_NAME;

  if (!branch) {
    const headPath = path.resolve(baseDirectory, './.git/HEAD');

    if (fs.existsSync(headPath)) {
      const head = fs.readFileSync(headPath, { encoding: 'utf8' });
      branch = head.split('refs/heads/')[1];
    }
  }

  if (!branch) {
    // exec 速度比较慢
    branch = execSync('git rev-parse --abbrev-ref HEAD', 'pipe');
  }

  return branch.trim();
}

/** 获取本地或远端最新的 commitId */
export function getHeadCommitId(isRemote = false) {
  const commitId = execSync(`git rev-parse ${isRemote ? '@{upstream}' : 'HEAD'}`, 'pipe');
  return commitId;
}

/**
 * 获取指定 HEAD 的变更文件列表
 * @param headIndex HEAD 顺序，默认为 0，即最新的本地未提交变更
 */
export function getHeadDiffFileList(headIndex = 0, cwd?: string, debug = false) {
  return execSync(`git diff HEAD~${headIndex} --name-only`, 'pipe', cwd, debug).trim().split('\n');
}

/** 获取 git user eamil 地址 */
export function getUserEmail() {
  return execSync('git config --get user.email', 'pipe');
}
