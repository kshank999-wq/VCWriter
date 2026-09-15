import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Sending a one-sheet (master spec §4's last bullet).
 *
 * The rule the route exists to keep is that **the request carries fields and
 * never markup**. The obvious design is to let the client post the page it
 * already has on screen, and it would turn vc-writer.com into a machine for
 * sending whatever HTML anybody posts to it, over its own domain and its own
 * sending reputation. So the tests worth having are: an anonymous caller gets
 * nothing, and a tag in a field arrives as text.
 */

const state = {
  cookieUserId: null as string | null,
  bearerUserId: null as string | null,
  admin: false,
  licenses: [] as Array<{ id: string }>,
  licenseError: null as { message: string } | null,
  sent: 0,
  lastSend: null as Record<string, unknown> | null,
  sendResult: { sent: true, error: null as string | null },
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
          eq: () => ({ limit: async () => ({ data: state.licenses, error: state.licenseError }) }),
        }),
      }),
    }),
  }),
}));

vi.mock('@/lib/email', () => ({
  sendOneSheet: async (input: Record<string, unknown>) => {
    state.sent += 1;
    state.lastSend = input;
    return state.sendResult;
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  RULES: { oneSheet: { name: 'one-sheet', limit: 20, windowSeconds: 3600 } },
  rateLimit: async (_request: Request, _rule: unknown, _consume: unknown, subject?: string) =>
    state.limitedFor && state.limitedFor === subject
      ? new Response(JSON.stringify({ error: 'Too many requests on this account. Try again shortly.' }), {
          status: 429,
        })
      : null,
}));

const { POST } = await import('@/app/api/one-sheet/route');

const SHEET = {
  title: 'The Brass Key',
  author: 'K. Shank',
  standfirst: 'Script · Thriller',
  logline: 'A locksmith is asked to open a door she installed.',
  elevatorPitch: '',
  synopsis: '',
  notes: '',
  status: 'Revising',
  figures: '43 words · 7 scenes',
};

const post = (body: unknown = { to: 'reader@example.com', message: 'Have a look.', sheet: SHEET }) =>
  POST(
    new Request('https://vc-writer.com/api/one-sheet', { method: 'POST', body: JSON.stringify(body) }),
  );

const body = async (response: Response) => (await response.json()) as Record<string, unknown>;

beforeEach(() => {
  state.cookieUserId = null;
  state.bearerUserId = null;
  state.admin = false;
  state.licenses = [];
  state.licenseError = null;
  state.sent = 0;
  state.lastSend = null;
  state.sendResult = { sent: true, error: null };
  state.limitedFor = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('who may send one', () => {
  it('turns away an anonymous caller: an open send endpoint is a spam relay', async () => {
    expect((await post()).status).toBe(401);
    expect(state.sent).toBe(0);
  });

  it('lets any signed-in writer through, licensed or not', async () => {
    // Sending your own one-sheet is not a licensed feature; it costs a message.
    state.cookieUserId = 'writer';
    expect((await post()).status).toBe(200);
    expect(state.sent).toBe(1);
  });

  it('counts against the account rather than the address', async () => {
    state.cookieUserId = 'writer';
    state.limitedFor = 'writer';
    expect((await post()).status).toBe(429);
    expect(state.sent).toBe(0);
  });
});

describe('what it accepts', () => {
  beforeEach(() => {
    state.cookieUserId = 'writer';
  });

  it('refuses a request with no address, or one that is not an address', async () => {
    expect((await post({ sheet: SHEET })).status).toBe(400);
    expect((await post({ to: 'not-an-address', sheet: SHEET })).status).toBe(400);
    expect(state.sent).toBe(0);
  });

  it('refuses a sheet with no title', async () => {
    expect((await post({ to: 'r@example.com', sheet: { ...SHEET, title: '' } })).status).toBe(400);
    expect(state.sent).toBe(0);
  });

  /**
   * The rule the whole route exists for. A field is a string, the server
   * renders it, and a tag comes out the other side as text.
   */
  it('renders the markup itself, so a tag in a field arrives as text', async () => {
    await post({
      to: 'reader@example.com',
      message: '',
      sheet: { ...SHEET, logline: '<img src=x onerror=alert(1)>' },
    });

    const html = String(state.lastSend!['sheetHtml']);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x');
  });

  it('has no field for markup at all, so a client cannot supply a page', async () => {
    await post({
      to: 'reader@example.com',
      sheet: SHEET,
      sheetHtml: '<h1>anything at all</h1>',
      html: '<h1>or this</h1>',
    } as never);

    // Whatever was sent, what goes out is what the server built.
    expect(String(state.lastSend!['sheetHtml'])).not.toContain('anything at all');
    expect(String(state.lastSend!['sheetHtml'])).toContain('The Brass Key');
  });

  it('never sends the key art, whatever was posted', async () => {
    await post({
      to: 'reader@example.com',
      sheet: { ...SHEET, poster: { data: 'data:image/png;base64,AAAA' } },
    } as never);
    expect(String(state.lastSend!['sheetHtml'])).not.toContain('data:image');
    expect(String(state.lastSend!['sheetHtml'])).toContain('no-art');
  });

  it('says so when the message could not be sent, rather than claiming it went', async () => {
    state.sendResult = { sent: false, error: 'The address bounced.' };
    const response = await post();
    expect(response.status).toBe(502);
    expect((await body(response))['error']).toContain('bounced');
  });
});
