import { describe, expect, it } from 'vitest';
import {
  buildErrorReport,
  isWorthReporting,
  redact,
  sanitiseErrorReport,
  type ErrorContext,
} from '../error-report.js';

const context: ErrorContext = {
  appVersion: '1.0.0',
  platform: 'windows',
  osVersion: '10.0.19045',
  surface: 'main',
};

describe('redaction', () => {
  it('removes Windows paths, which carry the project title', () => {
    const redacted = redact(String.raw`Cannot read C:\Users\Kevin\Documents\The Lighthouse.vcw`);
    expect(redacted).toBe('Cannot read <path>');
    expect(redacted).not.toContain('Kevin');
    expect(redacted).not.toContain('Lighthouse');
  });

  it('removes macOS and Linux home paths', () => {
    expect(redact('ENOENT: /Users/kevin/Drive/Act Two.vcw missing')).toBe('ENOENT: <path> missing');
    expect(redact('open /home/kevin/notes.json')).toBe('open <path>');
  });

  it('strips paths out of a stack trace but keeps the frames', () => {
    const stack = [
      'TypeError: cannot read properties of undefined',
      '    at saveProject (C:\\Program Files\\VC Writer\\out\\main\\index.js:412:19)',
      '    at async handle (/Users/kevin/app/out/main/ipc.js:88:5)',
    ].join('\n');

    const redacted = redact(stack);
    // The useful half survives: which functions, in what order.
    expect(redacted).toContain('at saveProject');
    expect(redacted).toContain('at async handle');
    expect(redacted).not.toContain('Program Files');
    expect(redacted).not.toContain('kevin');
  });

  it('removes a filename that contains spaces', () => {
    // The bug this guards: a pattern that stops at the first space redacts the
    // directory and leaves "The Lighthouse.vcw" — the project's title, which
    // is the single thing most worth not storing.
    expect(redact('failed on projects/My Great Novel.vcw today')).toBe('failed on <path> today');
    expect(redact(String.raw`saving C:\Users\Kevin\Act Two Rewrite.vcw`)).toBe('saving <path>');
  });

  it('leaves ordinary prose alone', () => {
    const message = 'The scene did not parse and the beat was empty';
    expect(redact(message)).toBe(message);
    expect(redact('Invalid version 1.10.0 for platform windows')).toBe(
      'Invalid version 1.10.0 for platform windows',
    );
  });

  it('removes signed URLs and email addresses', () => {
    expect(redact('GET https://storage.example.com/x?token=secret failed')).toBe('GET <path> failed');
    expect(redact('no license for kevin@example.com')).toBe('no license for <email>');
  });
});

describe('building a report', () => {
  it('survives a non-Error being thrown', () => {
    // An unhandled rejection is frequently a string or a plain object. A
    // reporter that assumed Error would throw inside the crash handler.
    const report = buildErrorReport('everything broke', context);
    expect(report.errorName).toBe('Error');
    expect(report.errorMessage).toBe('everything broke');
    expect(report.stack).toBe('');
  });

  it('redacts the message as well as the stack', () => {
    const error = new Error(String.raw`ENOENT: no such file, open 'C:\Users\Kevin\Act One.vcw'`);
    const report = buildErrorReport(error, context);
    expect(report.errorMessage).not.toContain('Act One');
    expect(report.errorMessage).toContain('ENOENT');
  });

  it('truncates a runaway message rather than storing a manuscript', () => {
    // The failure mode this guards: an error that interpolates the value it
    // choked on, where that value is the writer's scene.
    const report = buildErrorReport(new Error('x'.repeat(20_000)), context);
    expect(report.errorMessage.length).toBeLessThanOrEqual(500);
    expect(report.errorMessage.endsWith('…')).toBe(true);
  });

  it('has nowhere to put project content', () => {
    const report = buildErrorReport(new Error('boom'), context);
    expect(Object.keys(report).sort()).toEqual([
      'appVersion',
      'errorMessage',
      'errorName',
      'osVersion',
      'platform',
      'stack',
      'surface',
    ]);
  });
});

describe('sanitising what arrived', () => {
  it('redacts again on the receiving side', () => {
    // The sender is the least trusted half. A report that arrives with a path
    // in it — an old build, or a forged request — must not be stored with one.
    const stored = sanitiseErrorReport({
      appVersion: '1.0.0',
      platform: 'macos',
      osVersion: '14.4',
      errorName: 'Error',
      errorMessage: 'failed reading /Users/kevin/Novel.vcw',
      stack: '',
      surface: 'renderer',
    });
    expect(stored.errorMessage).toBe('failed reading <path>');
  });
});

describe('what is worth sending', () => {
  it('drops conditions that are not defects', () => {
    expect(isWorthReporting(buildErrorReport(new Error('fetch failed'), context))).toBe(false);
    expect(isWorthReporting(buildErrorReport(new Error('getaddrinfo ENOTFOUND api'), context))).toBe(false);
  });

  it('drops an empty report', () => {
    expect(isWorthReporting(buildErrorReport(undefined, context))).toBe(false);
  });

  it('keeps a real crash', () => {
    expect(isWorthReporting(buildErrorReport(new TypeError('x is not a function'), context))).toBe(true);
  });
});
