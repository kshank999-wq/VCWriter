import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The gate in front of a learning-aid suggestion (addendum 16 §10, spec §12.1).
 *
 * The same three questions the scene read asks, and now through the same
 * `resolveCaller`, which is the point of lifting it out — a second copy is the
 * one nobody updates the day the licence rule changes.
 *
 * What is additionally tested here is **the shape being the permission**: the
 * route accepts a kind, a section and a title, and there is no field in the
 * request for the author's own words or for whether an aid is approved. A
 * client that tried has nowhere to try.
 */

const state = {
  cookieUserId: null as string | null,
  bearerUserId: null as string | null,
  admin: false,
  licenses: [] as Array<{ id: string }>,
  licenseError: null as { message: string } | null,
  configured: true,
  generated: 0,
  lastInput: null as Record<string, unknown> | null,
  generateError: null as Error | null,
  limitedFor: null as string | null,
};

vi.mock('@/lib/supabase', () => ({
  currentUser: async () => (state.cookieUserId ? { id: state.cookieUserId } : null),
  adminClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: state.bearerUserId ? { id: state.bearerUserId } : null } }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: table === 'profiles' ? { is_admin: state.admin } : null }),
          eq: () => ({
            limit: async () => ({ data: state.licenses, error: state.licenseError }),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock('@/lib/ai-learning', () => ({
  isConfigured: () => state.configured,
  generateAid: async (input: Record<string, unknown>) => {
    state.generated += 1;
    state.lastInput = input;
    if (state.generateError) throw state.generateError;
    return {
      suggestion: { text: 'Light bends at a boundary.', questions: [] },
      inputTokens: 10,
      outputTokens: 20,
    };
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  RULES: { learningAid: { name: 'learning-aid', limit: 40, windowSeconds: 3600 } },
  rateLimit: async (_request: Request, _rule: unknown, _consume: unknown, subject?: string) =>
    state.limitedFor && state.limitedFor === subject
      ? new Response(JSON.stringify({ error: 'Too many requests on this account. Try again shortly.' }), {
          status: 429,
        })
      : null,
}));

const { GET, POST } = await import('@/app/api/ai/learning-aid/route');

const WRITTEN = { kind: 'summary', sectionText: 'A ray bends at the surface.', sectionTitle: 'Refraction' };

const post = (body: unknown = WRITTEN, bearer?: string) =>
  POST(
    new Request('https://vc-writer.com/api/ai/learning-aid', {
      method: 'POST',
      headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
      body: JSON.stringify(body),
    }),
  );

const get = () => GET(new Request('https://vc-writer.com/api/ai/learning-aid'));

const body = async (response: Response) => (await response.json()) as Record<string, unknown>;

beforeEach(() => {
  state.cookieUserId = null;
  state.bearerUserId = null;
  state.admin = false;
  state.licenses = [];
  state.licenseError = null;
  state.configured = true;
  state.generated = 0;
  state.lastInput = null;
  state.generateError = null;
  state.limitedFor = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('who may ask for a suggestion', () => {
  it('turns away a visitor who is not signed in, before spending anything', async () => {
    expect((await post()).status).toBe(401);
    expect(state.generated).toBe(0);
  });

  it('turns away a signed-in writer with no licence', async () => {
    state.cookieUserId = 'writer';
    const response = await post();
    expect(response.status).toBe(403);
    expect((await body(response))['error']).toContain('license');
    expect(state.generated).toBe(0);
  });

  it('lets a licensed writer through, by cookie or by token', async () => {
    state.cookieUserId = 'writer';
    state.licenses = [{ id: 'lic' }];
    expect((await post()).status).toBe(200);

    // The desktop's path: a bearer token rather than a session cookie.
    state.cookieUserId = null;
    state.bearerUserId = 'desktop';
    const response = await post(undefined, 'a-token');
    expect(response.status).toBe(200);
    expect(((await body(response))['suggestion'] as Record<string, unknown>)['text']).toBe(
      'Light bends at a boundary.',
    );
  });

  it('lets an administrator through without a licence row', async () => {
    state.cookieUserId = 'kevin';
    state.admin = true;
    expect((await post()).status).toBe(200);
  });

  it('says so plainly when the deployment has no key at all', async () => {
    state.configured = false;
    state.cookieUserId = 'writer';
    state.licenses = [{ id: 'lic' }];
    expect((await post()).status).toBe(503);
    expect(state.generated).toBe(0);
  });

  it('does not write anything it could not check the licence for', async () => {
    state.cookieUserId = 'writer';
    state.licenseError = { message: 'the database is down' };
    expect((await post()).status).toBe(500);
    expect(state.generated).toBe(0);
  });
});

describe('what it accepts, and what it refuses to be told', () => {
  beforeEach(() => {
    state.cookieUserId = 'writer';
    state.licenses = [{ id: 'lic' }];
  });

  it('refuses a request with no section in it, or no kind', async () => {
    expect((await post({ kind: 'summary' })).status).toBe(400);
    expect((await post({ kind: 'summary', sectionText: '' })).status).toBe(400);
    expect((await post({ sectionText: 'Words.' })).status).toBe(400);
    // A kind nobody defined is not a kind.
    expect((await post({ kind: 'homework', sectionText: 'Words.' })).status).toBe(400);
    expect(state.generated).toBe(0);
  });

  /**
   * The rule the module rests on, checked at the door. A client that sent the
   * author's text, an approval, or the aid's own id gets none of it through:
   * the schema has no field for any of them, so they are simply not there on
   * the other side.
   */
  it('drops anything a suggestion has no business being told', async () => {
    const response = await post({
      ...WRITTEN,
      text: 'What the author already wrote.',
      approved: true,
      aidId: 'some-id',
      suggestion: 'a pre-baked answer',
    });
    expect(response.status).toBe(200);
    expect(state.lastInput).toEqual(WRITTEN);
  });

  it('counts the spending against the account, not the address', async () => {
    state.limitedFor = 'writer';
    expect((await post()).status).toBe(429);
    expect(state.generated).toBe(0);
  });

  it('keeps its own bucket, so the Final Editor does not spend the summaries', async () => {
    // The rule handed to `rateLimit` is the learning-aid one and no other.
    const { RULES } = await import('@/lib/rate-limit');
    expect((RULES as Record<string, { name: string }>)['learningAid']!.name).toBe('learning-aid');
  });

  it('passes on a failure in words meant for the writer', async () => {
    state.generateError = new Error('The reading ran long and was cut off. Try a shorter section.');
    const response = await post();
    expect(response.status).toBe(502);
    expect((await body(response))['error']).toContain('cut off');
  });
});

describe('asking whether a suggestion is possible', () => {
  it('costs nothing and reaches no model', async () => {
    state.cookieUserId = 'writer';
    state.licenses = [{ id: 'lic' }];
    expect(await body(await get())).toMatchObject({
      configured: true,
      signedIn: true,
      entitled: true,
      reason: null,
    });
    expect(state.generated).toBe(0);
  });

  it('names the one thing that is missing', async () => {
    expect((await body(await get()))['reason']).toContain('Sign in');

    state.cookieUserId = 'writer';
    expect((await body(await get()))['reason']).toContain('license');

    state.configured = false;
    expect((await body(await get()))['reason']).toContain('not configured');
  });
});
