import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { projectFormatSchema } from '@vcwriter/domain';

/**
 * Every project format the domain names is one the database accepts
 * (migration 0070). Three were added to the domain and never to
 * `public.project_format`, which Ken met as *Invalid input value for enum
 * project_format: "instructional"* when making a project from the Notes app.
 */
describe('the database knows every project format', () => {
  it('has each of the domain’s formats in a migration', () => {
    const folder = join(__dirname, '..', '..', '..', '..', '..', 'packages', 'supabase', 'migrations');
    const sql = readdirSync(folder)
      .filter((name) => name.endsWith('.sql'))
      .map((name) => readFileSync(join(folder, name), 'utf8'))
      .join('\n');
    const created = /create type public\.project_format as enum \(([^)]*)\)/.exec(sql)?.[1] ?? '';
    const known = new Set([
      ...[...created.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]),
      ...[...sql.matchAll(/alter type public\.project_format add value if not exists '([a-z_]+)'/g)].map((match) => match[1]),
    ]);
    expect(projectFormatSchema.options.filter((format) => !known.has(format))).toEqual([]);
  });
});
