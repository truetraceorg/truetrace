"use client";

import { CopyableEntityId } from "./CopyableEntityId";

type SettingsSectionProps = {
  entityId: string | null;
  onReset: () => Promise<unknown>;
  disabled: boolean;
  isResetting: boolean;
};

export function SettingsSection({ entityId, onReset, disabled, isResetting }: SettingsSectionProps) {
  return (
    <div className="section">
      <div className="section-header">
        <h2>Settings</h2>
      </div>

      {/* Entity info */}
      <div className="subsection">
        <h3>Entity Information</h3>
        <div className="info-grid">
          <span className="info-label">Entity ID</span>
          {entityId ? (
            <CopyableEntityId entityId={entityId} className="info-value" />
          ) : (
            <code className="info-value">—</code>
          )}
        </div>
      </div>

      {/* Danger zone */}
      <div className="subsection danger-zone">
        <h3>Danger Zone</h3>
        <p className="subsection-desc">
          Reset everything will delete all entities, properties, and shares from the server.
          Passkeys must be manually deleted from your browser settings.
        </p>
        <button className="danger" onClick={onReset} disabled={disabled || isResetting}>
          {isResetting ? "Resetting..." : "Reset Everything"}
        </button>
      </div>
    </div>
  );
}
