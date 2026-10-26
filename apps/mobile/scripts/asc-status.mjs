// What App Store Connect holds for VC Writer Notes (docs/store-setup.md §1.9).
//
// An upload the upload service accepted can still be turned away by Apple's
// processing, and a build turned away never appears in TestFlight — Apple
// emails the reason to the account holder and shows nothing. This asks the
// App Store Connect API, with the same key the release workflow uploads with,
// which app the configured id names and every build it holds, with its
// processing state, so "TestFlight says no builds" has an answer.
//
// Reads: ASC_KEY_ID, ASC_ISSUER_ID, ASC_API_KEY_P8 (the key's text), ASC_APP_ID,
// and optionally ASC_BUNDLE_ID (default com.vcwriter.notes). Writes a report
// to stdout and, under GitHub Actions, to the job summary.
import { createPrivateKey, sign } from 'node:crypto';
import { appendFileSync } from 'node:fs';

const BASE = process.env.ASC_BASE ?? 'https://api.appstoreconnect.apple.com';
const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_API_KEY_P8, ASC_APP_ID } = process.env;
const BUNDLE = process.env.ASC_BUNDLE_ID ?? 'com.vcwriter.notes';

const b64url = (value) => Buffer.from(value).toString('base64url');

/** The ES256 token App Store Connect asks for: twenty minutes, this key, this team. */
export const token = (keyId, issuerId, p8, now = Math.floor(Date.now() / 1000)) => {
  const head = b64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iss: issuerId, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' }));
  const key = createPrivateKey(p8.replace(/\\n/g, '\n'));
  const signature = sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' });
  return `${head}.${body}.${signature.toString('base64url')}`;
};

const lines = [];
const say = (line = '') => {
  lines.push(line);
  console.log(line);
};

const main = async () => {
  for (const [name, value] of Object.entries({ ASC_KEY_ID, ASC_ISSUER_ID, ASC_API_KEY_P8 })) {
    if (!value) throw new Error(`${name} is not set.`);
  }
  const jwt = token(ASC_KEY_ID, ASC_ISSUER_ID, ASC_API_KEY_P8);
  const get = async (path) => {
    const response = await fetch(`${BASE}${path}`, { headers: { authorization: `Bearer ${jwt}` } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const why = body.errors?.map((one) => `${one.title}: ${one.detail}`).join('; ') || response.statusText;
      throw new Error(`App Store Connect answered ${response.status} to ${path}: ${why}`);
    }
    return body;
  };

  say('## VC Writer Notes in App Store Connect');
  say();

  const byBundle = await get(`/v1/apps?filter[bundleId]=${encodeURIComponent(BUNDLE)}&fields[apps]=name,bundleId,sku`);
  const records = byBundle.data ?? [];
  if (records.length === 0) say(`- **No app record has the bundle id \`${BUNDLE}\`.** Create it (§1.4).`);
  for (const app of records) say(`- App record for \`${BUNDLE}\`: **${app.attributes.name}**, Apple ID \`${app.id}\``);

  // Every app this key's team can see, and its newest builds whatever app
  // they belong to: an upload that is not under the expected record may be
  // under another, which is a different fault from one Apple turned away.
  const everyApp = await get('/v1/apps?fields[apps]=name,bundleId&limit=50');
  say();
  say(`**Apps on this team (${(everyApp.data ?? []).length}):** ${(everyApp.data ?? []).map((one) => `${one.attributes.name} (\`${one.attributes.bundleId}\`)`).join(', ') || 'none'}`);
  const anywhere = await get(
    '/v1/builds?sort=-uploadedDate&limit=10&include=app,preReleaseVersion&fields[builds]=version,uploadedDate,processingState,app,preReleaseVersion&fields[apps]=name,bundleId&fields[preReleaseVersions]=version',
  );
  const names = new Map((anywhere.included ?? []).filter((one) => one.type === 'apps').map((one) => [one.id, `${one.attributes.name} (${one.attributes.bundleId})`]));
  const shortVersions = new Map((anywhere.included ?? []).filter((one) => one.type === 'preReleaseVersions').map((one) => [one.id, one.attributes.version]));
  say();
  if ((anywhere.data ?? []).length === 0) say('**This team holds no builds for any app.**');
  else {
    say('Newest builds on the team, any app:');
    say();
    say('| App | Version | Build | Uploaded | Processing |');
    say('| --- | --- | --- | --- | --- |');
    for (const build of anywhere.data) {
      const a = build.attributes;
      say(`| ${names.get(build.relationships?.app?.data?.id) ?? '?'} | ${shortVersions.get(build.relationships?.preReleaseVersion?.data?.id) ?? '?'} | ${a.version} | ${a.uploadedDate?.slice(0, 16).replace('T', ' ') ?? '?'} | ${a.processingState} |`);
    }
  }
  // Uploads Apple received but has not made builds of yet, or refused:
  // the build-upload records, where the API offers them.
  const uploads = await get(`/v1/apps/${encodeURIComponent(ASC_APP_ID || records[0]?.id || '')}/buildUploads?limit=10`).catch((error) => ({ error: error.message }));
  say();
  if (uploads.error) say(`Build uploads: not available here (${uploads.error.slice(0, 160)})`);
  else {
    say(`**Uploads Apple has received for this app: ${(uploads.data ?? []).length}.**`);
    for (const one of uploads.data ?? []) say(`- ${JSON.stringify(one.attributes)}`);
  }

  const appId = ASC_APP_ID || records[0]?.id;
  if (ASC_APP_ID) {
    const configured = records.find((one) => one.id === ASC_APP_ID);
    if (configured) say(`- \`ASC_APP_ID\` names that record. Uploads go to it.`);
    else {
      const other = await get(`/v1/apps/${encodeURIComponent(ASC_APP_ID)}?fields[apps]=name,bundleId`).catch(() => null);
      say(
        other
          ? `- **\`ASC_APP_ID\` names a different app: ${other.data.attributes.name} (\`${other.data.attributes.bundleId}\`).** Uploads went there. Set it to the Apple ID above.`
          : `- **\`ASC_APP_ID\` (\`${ASC_APP_ID}\`) names no app this key can see.** Set it to the Apple ID above.`,
      );
    }
  }
  if (!appId) return;

  const builds = await get(
    `/v1/builds?filter[app]=${encodeURIComponent(appId)}&sort=-uploadedDate&limit=20&include=preReleaseVersion` +
      '&fields[builds]=version,uploadedDate,processingState,expired,usesNonExemptEncryption,preReleaseVersion' +
      '&fields[preReleaseVersions]=version',
  );
  const versions = new Map((builds.included ?? []).map((one) => [one.id, one.attributes.version]));
  say();
  if ((builds.data ?? []).length === 0) {
    say('**Apple holds no builds for this app.** An upload that the upload service accepted and that is not here was');
    say('turned away in processing. Apple emailed the reason ("ITMS-…") to the account holder on the day of the upload.');
    return;
  }
  say('| Version | Build | Uploaded | Processing | Notes |');
  say('| --- | --- | --- | --- | --- |');
  for (const build of builds.data) {
    const a = build.attributes;
    const version = versions.get(build.relationships?.preReleaseVersion?.data?.id) ?? '?';
    const notes = [
      a.processingState === 'INVALID' ? 'Apple turned it away; the reason is in its email' : '',
      a.processingState === 'PROCESSING' ? 'still being processed' : '',
      a.expired ? 'expired' : '',
      a.processingState === 'VALID' && a.usesNonExemptEncryption === null ? 'TestFlight will ask about encryption: answer No' : '',
    ]
      .filter(Boolean)
      .join('; ');
    say(`| ${version} | ${a.version} | ${a.uploadedDate?.slice(0, 16).replace('T', ' ') ?? '?'} | ${a.processingState} | ${notes} |`);
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
