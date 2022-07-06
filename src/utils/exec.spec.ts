/* eslint-disable unicorn/no-await-expression-member */
import { execSync, execPromisfy } from './exec';

describe('utils/exec', () => {
  beforeAll(() => {
    console.error = console.warn = console.log = () => null;
  });

  it('execSync', () => {
    expect(execSync('test').stdout).toBe('');
    expect(execSync('echo test').stdout).toBe('test');
    expect(execSync('echo test', 'pipe', process.cwd(), true).stdout).toBe('test');
    expect(execSync('echo test', 'inherit', process.cwd(), true).stdout).toBe('');

    // stdio = debug ? 'inherit' : 'pipe'
    expect(execSync('echo test', null, process.cwd(), true).stdout).toBe('');
    expect(execSync('echo test', null, process.cwd(), false).stdout).toBe('test');
  });

  it('execPromisfy', async () => {
    expect((await execPromisfy('test')).stdout).toBe('');
    expect((await execPromisfy('echo test')).stdout).toBe('test');
    expect((await execPromisfy('echo test', true)).stdout).toBe('test');
  });
});
