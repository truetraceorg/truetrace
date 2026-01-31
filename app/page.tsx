"use client";

import { Toaster } from "sonner";
import { useVault } from "./hooks/useVault";

export default function HomePage() {
  const vault = useVault();

  const handleLinkDevice = async () => {
    if (!vault.signedIn || vault.isBusy || !vault.inviteCode.trim()) return;
    await vault.linkDevice(vault.inviteCode);
  };

  return (
    <main className="page">
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "#141a26",
            color: "#f7f8fc",
            border: "1px solid #20293a"
          }
        }}
      />
      <section className="card">
        <h1>Passkey Vault</h1>
        <p className="subtle">
          Real-time synced across all connected clients via WebSocket.
        </p>

        <div className="actions">
          <button
            onClick={vault.signedIn ? vault.logout : vault.login}
            disabled={!vault.supportsPasskeys || vault.isBusy}
            title={vault.supportsPasskeys ? "" : "Passkeys not supported."}
          >
            {vault.isLoggingIn
              ? "Signing in..."
              : vault.signedIn
              ? "Log out"
              : "Log in"}
          </button>
          <button
            className="danger"
            onClick={vault.resetEverything}
            disabled={vault.isBusy}
          >
            {vault.isResetting ? "Resetting..." : "Reset everything"}
          </button>
        </div>

        {vault.signedIn && vault.hasKey && (
          <div className="panel">
            <button onClick={vault.generateInvite} disabled={vault.isBusy}>
              {vault.isGeneratingInvite ? "Generating..." : "Generate invite code"}
            </button>
            {vault.generatedInvite && (
              <div className="code-box">
                <span>Invite code:</span>
                <strong>{vault.generatedInvite.code}</strong>
                <span className="subtle">
                  Expires at{" "}
                  {new Date(vault.generatedInvite.expiresAt).toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
        )}

        {vault.signedIn && (
          <div className="panel">
            <label htmlFor="invite-code">Invite code</label>
            <input
              id="invite-code"
              value={vault.inviteCode}
              onChange={(e) => vault.setInviteCode(e.target.value)}
              placeholder="Paste invite code to link this device"
              disabled={vault.isBusy}
            />
            <button onClick={handleLinkDevice} disabled={vault.isBusy}>
              {vault.isLinking ? "Linking..." : "Link this device to another entity"}
            </button>
          </div>
        )}

        {vault.signedIn && vault.profile && (
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Profile</h2>
              <span className={`connection-status ${vault.connected ? "connected" : "disconnected"}`}>
                {vault.connected ? "● Live" : "○ Offline"}
              </span>
            </div>
            <div className="code-box">
              <label>Entity ID</label>
              <span className="readonly-value">{vault.profile.entityId}</span>
              <label htmlFor="profile-given-name">Given name</label>
              <input
                id="profile-given-name"
                value={vault.profile.givenName}
                onChange={(e) => vault.updateProfile("givenName", e.target.value)}
                disabled={vault.isBusy || !vault.connected}
              />
              <label htmlFor="profile-surname">Surname</label>
              <input
                id="profile-surname"
                value={vault.profile.surname}
                onChange={(e) => vault.updateProfile("surname", e.target.value)}
                disabled={vault.isBusy || !vault.connected}
              />
            </div>
            <p className="hint">Changes sync instantly to all connected clients.</p>
          </div>
        )}

        {vault.signedIn && !vault.hasKey && (
          <div className="alert">
            This device is authenticated but missing the entity key. Enter an
            invite code to link it.
          </div>
        )}
      </section>
    </main>
  );
}
