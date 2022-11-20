import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function repalceForCjsConfig() {
  const cjsConfigFile = resolve('./cjs/config.js');
  if (existsSync(cjsConfigFile)) {
    let content = readFileSync(cjsConfigFile, 'utf8');
    const findStr = `typeof __dirname !== 'undefined' ? __dirname :`;
    if (content.includes(findStr)) {
      content = content.replace(findStr, `__dirname; //`);
      writeFileSync(cjsConfigFile, content, 'utf8');
    } else console.error('在文件中未找到要替换的字符串！', findStr, cjsConfigFile);
  } else console.error('文件不存在！', cjsConfigFile);
}

repalceForCjsConfig();
