import { LicensePanel } from "./LicensePanel";
import { SignInForm } from "./SignInForm";
import { ReportingPanel } from "./ReportingPanel";
import type { AccountStatus } from "../../preload/index";

interface AccountPanelProps {
  status: AccountStatus;
  onSignedIn(status: AccountStatus): void;
  onSignOut(): void;
}

/**
 * Sign-in for sync (spec §11, §12.1).
 *
 * A six-digit code typed into the app: no browser round trip, no protocol
 * handler to register per platform, and no password for VC Writer to be
 * responsible for. Sync is optional — the panel says so, because a writer who
 * never signs in still has a complete application.
 */
export function AccountPanel({
  status,
  onSignedIn,
  onSignOut,
}: AccountPanelProps) {
  if (!status.configured) {
    return (
      <>
        <div className="account">
          <h2>Sync is not set up in this build</h2>
          <p className="muted">
            VC Writer works fully without it — your projects are files on this
            computer. Sync and VC Writer Notes need the Supabase keys to be
            present when the app is built.
          </p>
        </div>
        <ReportingPanel />
      </>
    );
  }

  if (status.signedIn) {
    return (
      <>
        <div className="account">
          <h2>Signed in</h2>
          <p className="muted">{status.email}</p>
          <p className="muted">
            Notes captured on your phone appear here for review. Nothing is
            added to a project until you approve it.
          </p>
          <button type="button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
        <LicensePanel />
        <ReportingPanel />
      </>
    );
  }

  return (
    <>
      <div className="account">
        <h2>Sign in</h2>
        <p className="muted">
          Signing in activates this computer, syncs this project and brings in
          notes captured on your phone. Your projects stay files on this
          computer either way.
        </p>

        <SignInForm onSignedIn={onSignedIn} />
      </div>
      <ReportingPanel />
    </>
  );
}
