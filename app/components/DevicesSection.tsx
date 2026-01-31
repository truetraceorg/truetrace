"use client";

import { useState } from "react";

type DevicesSectionProps = {
  generatedInvite: { code: string; expiresAt: number } | null;
  onGenerateInvite: () => Promise<unknown>;
  onLinkDevice: (code: string) => Promise<unknown>;
  disabled: boolean;
  isGenerating: boolean;
  isLinking: boolean;
};

export function DevicesSection({
  generatedInvite,
  onGenerateInvite,
  onLinkDevice,
  disabled,
  isGenerating,
  isLinking,
}: DevicesSectionProps) {
  const [inviteCode, setInviteCode] = useState("");

  const handleLinkDevice = async () => {
    if (!inviteCode.trim()) return;
    await onLinkDevice(inviteCode);
    setInviteCode("");
  };

  return (
    <div className="section">
      <div className="section-header">
        <h2>Devices</h2>
      </div>
      <p className="section-desc">
        Link multiple devices to the same entity. All devices share the same encrypted data.
      </p>

      {/* Generate invite */}
      <div className="subsection">
        <h3>Add Another Device</h3>
        <p className="subsection-desc">
          Generate an invite code to link another device to this entity.
        </p>
        <button onClick={onGenerateInvite} disabled={disabled || isGenerating}>
          {isGenerating ? "Generating..." : "Generate Invite Code"}
        </button>
        {generatedInvite && (
          <div className="invite-code-box">
            <span className="invite-code-label">Invite code:</span>
            <code className="invite-code">{generatedInvite.code}</code>
            <span className="invite-code-expires">
              Expires at {new Date(generatedInvite.expiresAt).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {/* Link to another entity */}
      <div className="subsection">
        <h3>Link to Different Entity</h3>
        <p className="subsection-desc">
          Enter an invite code to link this device to a different entity.
        </p>
        <div className="link-form">
          <input
            type="text"
            placeholder="Enter invite code..."
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            disabled={disabled}
          />
          <button
            onClick={handleLinkDevice}
            disabled={disabled || !inviteCode.trim() || isLinking}
          >
            {isLinking ? "Linking..." : "Link Device"}
          </button>
        </div>
      </div>
    </div>
  );
}
