import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The gate in front of the AI structural read (spec §8.2, §12.1).
 *
 * Every call past this point costs real money, so what is tested here is who
 * gets through and who does not — and that a refusal says which of the three
 * things is missing, because "it did not work" is not something a writer can
 * act on.
 */

const state = {
  cookieUserId: null as string | null,
  bearerUserId: null as string | null,
  admin: false,
  licenses: [] as Array<{ id: string }>,
  licenseError: null as { message: string } | null,
  configured: true,
  reviewed: 0,
  reviewError: null as Error | null,
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

vi.mock('@/lib/ai', () => ({
  isAiConfigured: () => state.configured,
  reviewScene: async () => {
    state.reviewed += 1;
    if (state.reviewError) throw state.reviewError;
    return {
      opening: 'She is afraid.',
      change: 'She climbs anyway.',
      turn: 'She lets go of the rail.',
      valueShift: 'positive',
      purpose: 'It earns the ending.',
      concerns: [],
      model: 'a-model',
      usage: { inputTokens: 10, outputTokens: 20 },
    };
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  RULES: { sceneReview: { name: 'scene-review', limit: 60, windowSeconds: 3600 } },
  rateLimit: async (_request: Request, _rule: unknown, _consume: unknown, subject?: string) =>
    state.limitedFor && state.limitedFor === subject
      ? new Response(JSON.stringify({ error: 'Too many requests on this account. Try again shortly.' }), {
          status: 429,
        })
      : null,
}));

const { GET, POST } = await import('@/app/api/ai/scene-review/route');

const post = (body: unknown = { sceneText: 'INT. LIGHTHOUSE - NIGHT', format: 'screenplay' }, bearer?: string) =>
  POST(
    new Request('https://vc-writer.com/api/ai/scene-review', {
      method: 'POST',
      headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
      body: JSON.stringify(body),
    }),
  );

const get = () => GET(new Request('https://vc-writer.com/api/ai/scene-review'));

const body = async (response: Response) => (await response.json()) as Record<string, unknown>;

beforeEach(() => {
  state.cookieUserId = null;
  state.bearerUserId = null;
  state.admin = false;
  state.licenses = [];
  state.licenseError = null;
  state.configured = true;
  state.reviewed = 0;
  state.reviewError = null;
  state.limitedFor = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('who may ask for a read', () => {
  it('turns away a visitor who is not signed in, before spending anything', async () => {
    const response = await post();
    expect(response.status).toBe(401);
    expect(state.reviewed).toBe(0);
  });

  it('turns away a signed-in writer with no licence', async () => {
    state.cookieUserId = 'writer';
    const response = await post();
    expect(response.status).toBe(403);
    expect((await body(response))['error']).toContain('license');
    expect(state.reviewed).toBe(0);
  });

  it('lets a licensed writer through, by cookie or by token', async () => {
    state.cookieUserId = 'writer';
    state.licenses = [{ id: 'lic' }];
    expect((await post()).status).toBe(200);

    state.cookieUserId = null;
    state.bearerUserId = 'desktop';
    const response = await post(undefined, 'a-token');
    expect(response.status).toBe(200);
    expect(((await body(response))['verdict'] as Record<string, unknown>)['turn']).toBe('She lets go of the rail.');
  });

  it('lets an administrator through without a licence row', async () => {
    // Nobody sold Ken a copy of his own application.
    state.cookieUserId = 'kevin';
    state.admin = true;
    expect((await post()).status).toBe(200);
  });

  it('says so plainly when the deployment has no key at all', async () => {
    state.configured = false;
    state.cookieUserId = 'writer';
    state.licenses = [{ id: 'lic' }];
    const response = await post();
    expect(response.status).toBe(503);
    expect(state.reviewed).toBe(0);
  });

  it('does not read a scene it could not check the licence for', async () => {
    state.cookieUserId = 'writer';
    state.licenseError = { message: 'the database is down' };
    expect((await post()).status).toBe(500);
    expect(state.reviewed).toBe(0);
  });
});

describe('what it accepts and what it costs', () => {
  it('refuses a request with no scene in it', async () => {
    state.cookieUserId = 'writer';
    state.licenses = [{ id: 'lic' }];
    expect((await post({ format: 'screenplay' })).status).toBe(400);
    expect((await post({ sceneText: '', format: 'screenplay' })).status).toBe(400);
    expect(state.reviewed).toBe(0);
  });

  it('counts the spending against the account, not the address', async () => {
    state.cookieUserId = 'writer';
    state.licenses = [{ id: 'lic' }];
    state.limitedFor = 'writer';
    expect((await post()).status).toBe(429);
    expect(state.reviewed).toBe(0);
  });

  it('passes on a failed read as a failure, in words meant for the writer', async () => {
    state.cookieUserId = 'writer';
    state.licenses = [{ id: 'lic' }];
    state.reviewError = new Error('The reader is busy just now. Try that scene again in a moment.');
    const response = await post();
    expect(response.status).toBe(502);
    expect((await body(response))['error']).toContain('busy');
  });
});

describe('asking whether a read is possible', () => {
  it('costs nothing and reaches no model', async () => {
    state.cookieUserId = 'writer';
    state.licenses = [{ id: 'lic' }];
    const answer = await body(await get());
    expect(answer).toMatchObject({ configured: true, signedIn: true, entitled: true, reason: null });
    expect(state.reviewed).toBe(0);
  });

  it('names the one thing that is missing', async () => {
    expect((await body(await get()))['reason']).toContain('Sign in');

    state.cookieUserId = 'writer';
    expect((await body(await get()))['reason']).toContain('license');

    state.configured = false;
    expect((await body(await get()))['reason']).toContain('not configured');
  });
});
