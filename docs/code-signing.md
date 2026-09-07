# Code signing and notarisation

Everything in this document needs credentials that have to be bought and tied
to a verified identity, so none of it can be done from a build container. What
*is* done: the pipeline expects these credentials, uses them when they are
present, and produces a clearly-marked unsigned build when they are not.

An unsigned build is not a broken build — it installs, with a warning — but it
must never be published to the `stable` channel. Windows shows SmartScreen's
"unrecognised app" panel and macOS refuses to open it at all without the user
right-clicking to bypass Gatekeeper.

## Windows

### What to obtain

Since June 2023 Windows code-signing certificates must have their private key
on hardware or in a cloud HSM, so the old "download a `.pfx` and put it in a
secret" flow no longer applies to newly issued certificates. Two workable
routes:

| Route | Suits | Notes |
| --- | --- | --- |
| **Azure Trusted Signing** | Most projects | Pay monthly, no hardware, no SmartScreen wait once the identity is validated. Requires an Azure subscription and a verified organisation or individual. |
| **OV certificate on a cloud HSM** | Existing CA relationships | DigiCert, Sectigo and others; the certificate lives in their KeyVault-style service and signing goes through their tool. |

An **EV** certificate buys immediate SmartScreen reputation; an **OV** one
earns reputation over time and downloads. Neither changes the code.

### What CI needs

For the file-based path (older certificates that still allow it), the workflow
already reads:

- `WINDOWS_CERTIFICATE` — the `.pfx`, base64 encoded, as a repository secret
- `WINDOWS_CERTIFICATE_PASSWORD`

For Azure Trusted Signing, replace those with the Azure credentials and add
electron-builder's `azureSignOptions` to `apps/desktop/electron-builder.yml`;
the rest of the pipeline is unchanged.

### Verifying

```powershell
Get-AuthenticodeSignature .\VCWriter-Setup-1.0.0.exe | Format-List
```

`Status` must be `Valid` and `SignerCertificate` must name your organisation.

## macOS

### What to obtain

1. **Apple Developer Program membership** ($99/year). An individual membership
   is enough; an organisation membership needs a D-U-N-S number and takes
   longer.
2. A **Developer ID Application** certificate, created in the Apple Developer
   portal and installed in the signing machine's keychain — or exported as a
   `.p12` for CI.
3. An **app-specific password** for the Apple ID, generated at appleid.apple.com.
   Notarisation will not accept the account password.

### What CI needs

Repository secrets, all already read by the release workflow:

| Secret | What it is |
| --- | --- |
| `APPLE_ID` | The Apple ID email on the developer account |
| `APPLE_APP_SPECIFIC_PASSWORD` | The app-specific password, not the account password |
| `APPLE_TEAM_ID` | The ten-character team identifier |
| `CSC_LINK` | The Developer ID `.p12`, base64 encoded |
| `CSC_KEY_PASSWORD` | Its export password |

### Making the `.p12` without a Mac

Apple's portal wants a certificate signing request and hands back a bare
certificate; the private key never leaves the machine that made the request.
Neither step needs macOS. With Git for Windows installed, in PowerShell:

```powershell
mkdir $HOME\vcwriter-signing; cd $HOME\vcwriter-signing
$openssl = "C:\Program Files\Git\usr\bin\openssl.exe"
& $openssl req -new -newkey rsa:2048 -nodes -keyout vcwriter-mac.key -out vcwriter-mac.csr -subj "/CN=VC Writer/emailAddress=<apple id email>"
# Upload vcwriter-mac.csr at developer.apple.com → Certificates → Developer ID
# Application (G2 Sub-CA); download developerID_application.cer here, then:
& $openssl x509 -in developerID_application.cer -inform DER -out vcwriter-mac.pem
& $openssl pkcs12 -export -legacy -inkey vcwriter-mac.key -in vcwriter-mac.pem -out vcwriter-mac.p12
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\vcwriter-signing\vcwriter-mac.p12")) | Set-Clipboard
```

`-legacy` matters: OpenSSL 3 otherwise writes a bundle that macOS's `security
import` rejects with "MAC verification failed (wrong password?)", the same
message a genuinely wrong password produces. The workflow's "Check the macOS
signing certificate" step opens the bundle with OpenSSL and then with
`security` and says which of the two went wrong. The `.key` file is the only
copy of the private key: keep it, and keep it out of the repository.

The workflow only asks electron-builder to notarise when `APPLE_ID` and
`APPLE_TEAM_ID` are both present — requesting notarisation without credentials
fails the build, and a fork or a dry run should still produce something
installable.

The hardened runtime is already enabled, with entitlements in
`apps/desktop/build/entitlements.mac.plist` covering the two Electron needs
(JIT and unsigned executable memory), microphone access for dictation, and
user-selected file access for opening projects. Notarisation rejects a hardened
build that uses an entitlement it has not declared, so anything added to the
app later — camera, network server, disabled library validation — has to be
added there too.

### Verifying

```bash
codesign --verify --deep --strict --verbose=2 "VC Writer.app"
spctl --assess --type execute --verbose "VC Writer.app"
xcrun stapler validate "VC Writer.dmg"
```

`spctl` should say `accepted` and `source=Notarized Developer ID`. If it says
`source=Unnotarized Developer ID`, the build is signed but the notarisation
ticket was never stapled — customers on a fresh machine will be blocked.

## Publishing a signed build

Signing and publishing are separate on purpose (§17):

1. Tag the release. The workflow packages both platforms and prints the
   SHA-256 of each installer.
2. Upload the installer at `/admin/releases` with its version, minimum OS,
   release notes and that checksum. It arrives **inactive**.
3. Verify the artifact, then make it live. Only then can customers download it,
   and only through a signed URL minted after an entitlement check.

The checksum matters beyond bookkeeping: the in-app updater refuses an
installer that does not match the published one and discards it. A build
published without a checksum cannot be verified, so the updater will not offer
it.

## What is left before a first release

- [ ] Windows certificate obtained and its secrets set
- [ ] Apple Developer membership, Developer ID certificate and app-specific
      password obtained and their secrets set
- [ ] A tagged build packaged on both platforms
- [ ] `spctl` and `Get-AuthenticodeSignature` both clean
- [ ] Installers uploaded, checked and activated at `/admin/releases`
- [ ] One end-to-end purchase on live Stripe keys, download, install, activate
