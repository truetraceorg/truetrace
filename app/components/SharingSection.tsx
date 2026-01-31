"use client";

import { useState } from "react";
import type { SharesResponse } from "../lib/api";
import type { SharedPropertyValue } from "../hooks/useEventStream";
import { CopyableEntityId } from "./CopyableEntityId";

type SharingSectionProps = {
  properties: Record<string, string>;
  shares: SharesResponse;
  sharedData: SharedPropertyValue[];
  onCreateShare: (propertyName: string) => Promise<unknown>;
  onAcceptShare: (code: string) => Promise<unknown>;
  onRemoveShare: (params: { targetEntityId?: string; sourceEntityId?: string; propertyName: string }) => Promise<unknown>;
  generatedShare: { code: string; propertyName: string; expiresAt: number } | null;
  disabled: boolean;
  isCreating: boolean;
  isAccepting: boolean;
};

export function SharingSection({
  properties,
  shares,
  sharedData,
  onCreateShare,
  onAcceptShare,
  onRemoveShare,
  generatedShare,
  disabled,
  isCreating,
  isAccepting,
}: SharingSectionProps) {
  const [selectedProperty, setSelectedProperty] = useState("");
  const [shareCode, setShareCode] = useState("");

  const propertyKeys = Object.keys(properties).sort();

  const handleCreateShare = async () => {
    if (!selectedProperty) return;
    await onCreateShare(selectedProperty);
    setSelectedProperty("");
  };

  const handleAcceptShare = async () => {
    if (!shareCode.trim()) return;
    await onAcceptShare(shareCode);
    setShareCode("");
  };

  return (
    <div className="section">
      <div className="section-header">
        <h2>Sharing</h2>
      </div>
      <p className="section-desc">
        Share specific properties with other entities. They'll receive real-time updates.
      </p>

      {/* Share a property */}
      <div className="subsection">
        <h3>Share a Property</h3>
        <div className="share-form">
          <select
            value={selectedProperty}
            onChange={(e) => setSelectedProperty(e.target.value)}
            disabled={disabled || propertyKeys.length === 0}
          >
            <option value="">Select property...</option>
            {propertyKeys.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
          <button
            onClick={handleCreateShare}
            disabled={disabled || !selectedProperty || isCreating}
          >
            {isCreating ? "Creating..." : "Create Share"}
          </button>
        </div>
        {generatedShare && (
          <div className="share-code-box">
            <span className="share-code-label">Share code for {generatedShare.propertyName}:</span>
            <code className="share-code">{generatedShare.code}</code>
            <span className="share-code-expires">
              Expires at {new Date(generatedShare.expiresAt).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {/* Accept a share */}
      <div className="subsection">
        <h3>Accept a Share</h3>
        <div className="share-form">
          <input
            type="text"
            placeholder="Enter share code..."
            value={shareCode}
            onChange={(e) => setShareCode(e.target.value)}
            disabled={disabled}
          />
          <button
            onClick={handleAcceptShare}
            disabled={disabled || !shareCode.trim() || isAccepting}
          >
            {isAccepting ? "Accepting..." : "Accept"}
          </button>
        </div>
      </div>

      {/* Outgoing shares */}
      {shares.outgoing.length > 0 && (
        <div className="subsection">
          <h3>Outgoing Shares</h3>
          <ul className="share-list">
            {shares.outgoing.map((share) => (
              <li key={`${share.targetEntityId}-${share.propertyName}`} className="share-item">
                <div className="share-info">
                  <span className="share-property">{share.propertyName}</span>
                  <span className="share-target">→ <CopyableEntityId entityId={share.targetEntityId} short /></span>
                </div>
                <button
                  className="small danger"
                  onClick={() => onRemoveShare({ targetEntityId: share.targetEntityId, propertyName: share.propertyName })}
                  disabled={disabled}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Incoming shares */}
      {shares.incoming.length > 0 && (
        <div className="subsection">
          <h3>Shared With Me</h3>
          <ul className="share-list incoming">
            {shares.incoming.map((share) => {
              const data = sharedData.find(
                (s) => s.sourceEntityId === share.sourceEntityId && s.propertyName === share.propertyName
              );
              return (
                <li key={`${share.sourceEntityId}-${share.propertyName}`} className="share-item">
                  <div className="share-info">
                    <span className="share-source"><CopyableEntityId entityId={share.sourceEntityId} short /></span>
                    <span className="share-property">{share.propertyName}</span>
                    <span className="share-value">{data?.value ?? "(waiting...)"}</span>
                  </div>
                  <button
                    className="small danger"
                    onClick={() => onRemoveShare({ sourceEntityId: share.sourceEntityId, propertyName: share.propertyName })}
                    disabled={disabled}
                  >
                    Unlink
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {shares.outgoing.length === 0 && shares.incoming.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">⬡</span>
          <p>No active shares</p>
          <span className="empty-hint">Share properties or accept shares from others</span>
        </div>
      )}
    </div>
  );
}
