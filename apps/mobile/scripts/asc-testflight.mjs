// Getting the newest build of VC Writer Notes to the people testing it in
// TestFlight (docs/store-setup.md §1.10).
//
// From Ken: TestFlight says "no builds available" for him although build 3 is
// VALID. A valid build only reaches a tester once it is cleared for testing
// (the encryption question answered) and **added to a group the tester is in**;
// a group made by EAS ("Team (Expo)") cannot be edited in the browser, and a
// tester added outside every group is sent nothing. This reads all of that
// with the release key and, with FIX=true, does the three things:
//
//   1. answers the encryption question "no" where it is still open;
//   2. adds the newest valid build to every internal group;
//   3. puts the tester (TESTER_EMAIL, else the account holder) in each one.
//
// Reads: ASC_KEY_ID, ASC_ISSUER_ID, ASC_API_KEY_P8, ASC_APP_ID; FIX; TESTER_EMAIL.
import { createPrivateKey, sign } from 'node:crypto';
import { appendFileSync } from 'node:fs';

const BASE = process.env.ASC_BASE ?? 'https://api.appstoreconnect.apple.com';
const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_API_KEY_P8, ASC_APP_ID } = process.env;
const FIX = process.env.FIX === 'true';
const TESTER_EMAIL = (process.env.TESTER_EMAIL ?? '').trim().toLowerCase();

const b64url = (value) => Buffer.from(value).toString('base64url');
const token = () => {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iss: ASC_ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' }));
  const key = createPrivateKey(ASC_API_KEY_P8.replace(/\\n/g, '\n'));
  return `${head}.${body}.${sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
};

const lines = [];
const say = (line = '') => {
  lines.push(line);
  console.log(line);
};

let jwt = '';
const call = async (method, path, body) => {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { authorization: `Bearer ${jwt}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const why = parsed.errors?.map((one) => `${one.title}: ${one.detail}`).join('; ') || response.statusText;
    throw new Error(`${method} ${path} → ${response.status}: ${why}`);
  }
  return parsed;
};
const get = (path) => call('GET', path);

const main = async () => {
  for (const [name, value] of Object.entries({ ASC_KEY_ID, ASC_ISSUER_ID, ASC_API_KEY_P8, ASC_APP_ID })) {
    if (!value) throw new Error(`${name} is not set.`);
  }
  jwt = token();
  const app = encodeURIComponent(ASC_APP_ID);

  say(`## TestFlight for VC Writer Notes${FIX ? ' — fixing' : ''}`);
  say();

  // The newest valid build.
  const builds = await get(
    `/v1/builds?filter[app]=${app}&sort=-uploadedDate&limit=10&fields[builds]=version,processingState,usesNonExemptEncryption,expired`,
  );
  const build = (builds.data ?? []).find((one) => one.attributes.processingState === 'VALID' && !one.attributes.expired);
  if (!build) {
    say('**No valid build to test.** Run Notes App Store status to see why.');
    return;
  }
  say(`- Newest valid build: **${build.attributes.version}** (\`${build.id}\`)`);

  if (build.attributes.usesNonExemptEncryption === null) {
    say('- Encryption question: **not answered** — TestFlight holds the build until it is.');
    if (FIX) {
      await call('PATCH', `/v1/builds/${build.id}`, {
        data: { type: 'builds', id: build.id, attributes: { usesNonExemptEncryption: false } },
      });
      say('  - Answered: no non-exempt encryption.');
    }
  } else {
    say(`- Encryption question: answered (${build.attributes.usesNonExemptEncryption ? 'uses' : 'no'} non-exempt encryption).`);
  }

  const detail = await get(`/v1/builds/${build.id}/buildBetaDetail`).catch(() => null);
  if (detail?.data) {
    say(`- TestFlight state: internal **${detail.data.attributes.internalBuildState}**, external ${detail.data.attributes.externalBuildState}`);
  }

  // Who the tester is: the address given, else the account holder.
  let email = TESTER_EMAIL;
  const users = await get('/v1/users?limit=50&fields[users]=username,firstName,lastName,roles').catch(() => ({ data: [] }));
  say(`- People on the team: ${(users.data ?? []).map((one) => `${one.attributes.username} (${(one.attributes.roles ?? []).join(', ')})`).join('; ') || 'not readable with this key'}`);
  if (!email) {
    const holder = (users.data ?? []).find((one) => (one.attributes.roles ?? []).includes('ACCOUNT_HOLDER'));
    email = holder?.attributes.username?.toLowerCase() ?? '';
  }
  say(`- Tester: ${email ? `**${email}**` : 'none given, and no account holder found'}`);

  let tester = null;
  if (email) {
    const found = await get(`/v1/betaTesters?filter[email]=${encodeURIComponent(email)}&limit=5&fields[betaTesters]=email,firstName,lastName,state`);
    tester = (found.data ?? [])[0] ?? null;
    say(`  - ${tester ? `A TestFlight tester already (${tester.attributes.state ?? 'state unknown'}).` : 'Not a TestFlight tester yet.'}`);
  }

  const groups = await get(`/v1/apps/${app}/betaGroups?limit=50&fields[betaGroups]=name,isInternalGroup,hasAccessToAllBuilds`);
  say();
  say('| Group | Kind | Every build? | Has this build | Testers |');
  say('| --- | --- | --- | --- | --- |');
  if ((groups.data ?? []).length === 0) say('| (none) | | | | |');

  let internal = (groups.data ?? []).filter((one) => one.attributes.isInternalGroup);
  if (internal.length === 0 && FIX) {
    // No internal group at all: make one, which is what a tester needs to be sent anything.
    const made = await call('POST', '/v1/betaGroups', {
      data: {
        type: 'betaGroups',
        attributes: { name: 'VC Writer team', isInternalGroup: true, hasAccessToAllBuilds: true },
        relationships: { app: { data: { type: 'apps', id: ASC_APP_ID } } },
      },
    });
    say(`| ${made.data.attributes.name} | internal (made now) | yes | | |`);
    internal = [made.data];
    groups.data = [...(groups.data ?? []), made.data];
  }

  for (const group of groups.data ?? []) {
    const a = group.attributes;
    const inGroup = await get(`/v1/betaGroups/${group.id}/builds?limit=50&fields[builds]=version`).catch(() => ({ data: [] }));
    let hasBuild = (inGroup.data ?? []).some((one) => one.id === build.id) || a.hasAccessToAllBuilds === true;
    const members = await get(`/v1/betaGroups/${group.id}/betaTesters?limit=100&fields[betaTesters]=email`).catch(() => ({ data: [] }));
    let emails = (members.data ?? []).map((one) => (one.attributes.email ?? '').toLowerCase());
    const notes = [];

    if (FIX && a.isInternalGroup) {
      if (!hasBuild) {
        await call('POST', `/v1/betaGroups/${group.id}/relationships/builds`, { data: [{ type: 'builds', id: build.id }] });
        hasBuild = true;
        notes.push('build added');
      }
      if (email && !emails.includes(email)) {
        if (tester) {
          await call('POST', `/v1/betaGroups/${group.id}/relationships/betaTesters`, { data: [{ type: 'betaTesters', id: tester.id }] });
        } else {
          const made = await call('POST', '/v1/betaTesters', {
            data: {
              type: 'betaTesters',
              attributes: { email },
              relationships: { betaGroups: { data: [{ type: 'betaGroups', id: group.id }] } },
            },
          });
          tester = made.data;
        }
        emails = [...emails, email];
        notes.push(`${email} added`);
      }
    }

    say(
      `| ${a.name} | ${a.isInternalGroup ? 'internal' : 'external'} | ${a.hasAccessToAllBuilds ? 'yes' : 'no'} | ${hasBuild ? 'yes' : '**no**'} | ${emails.join(', ') || '—'}${notes.length ? ` (${notes.join('; ')})` : ''} |`,
    );
  }

  if (FIX && tester && internal.length > 0) {
    // Send the invitation (again) so it is in the tester's inbox now.
    await call('POST', '/v1/betaTesterInvitations', {
      data: {
        type: 'betaTesterInvitations',
        relationships: {
          app: { data: { type: 'apps', id: ASC_APP_ID } },
          betaTester: { data: { type: 'betaTesters', id: tester.id } },
        },
      },
    })
      .then(() => say(`\nInvitation sent to ${email}.`))
      .catch((error) => say(`\nInvitation not sent (${error.message.slice(0, 200)}). An internal tester usually gets it by themselves.`));
  }
};

main()
  .catch((error) => {
    say(`**${error.message}**`);
    process.exitCode = 1;
  })
  .finally(() => {
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
  });
