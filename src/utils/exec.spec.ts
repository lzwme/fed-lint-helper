import { execSync, execPromisfy } from './exec';

describe('utils/exec', () => {
  it('execSync', () => {
    expect(execSync('test')).toBeNull();
    expect(execSync('echo test')).toBe('test');
    expect(execSync('echo test', 'pipe', process.cwd(), true)).toBe('test');
    expect(execSync('echo test', 'inherit', process.cwd(), true)).toBe('');

    // stdio = debug ? 'inherit' : 'pipe'
    expect(execSync('echo test', null, process.cwd(), true)).toBe('');
    expect(execSync('echo test', null, process.cwd(), false)).toBe('test');
  });

  it('execPromisfy', async () => {
    expect(await execPromisfy('test')).toBeNull();
    expect(await execPromisfy('echo test')).toBe('test');
    expect(await execPromisfy('echo test', true)).toBe('test');
  });
});
