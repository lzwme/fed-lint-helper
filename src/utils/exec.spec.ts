/* eslint-disable unicorn/no-await-expression-member */
import { execSync, execPromisfy } from './exec';

describe('utils/exec', () => {
  beforeAll(() => {
    console.error = console.warn = console.log = () => null;
  });

  it('execSync', () => {
    expect(execSync('test')).toBe('');
    expect(execSync('echo test')).toBe('test');
    expect(execSync('echo test', 'pipe', process.cwd(), true)).toBe('test');
    expect(execSync('echo test', 'inherit', process.cwd(), true)).toBe('');

    // stdio = debug ? 'inherit' : 'pipe'
    expect(execSync('echo test', null, process.cwd(), true)).toBe('');
    expect(execSync('echo test', null, process.cwd(), false)).toBe('test');
  });

  it('execPromisfy', async () => {
    expect((await execPromisfy('test')).stdout).toBe('');
    expect((await execPromisfy('echo test')).stdout).toBe('test');
    expect((await execPromisfy('echo test', true)).stdout).toBe('test');
  });
});
