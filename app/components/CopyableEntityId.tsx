"use client";

import { useState } from "react";
import { toast } from "sonner";

type CopyableEntityIdProps = {
  entityId: string;
  short?: boolean;
  className?: string;
};

export function CopyableEntityId({ entityId, short = false, className = "" }: CopyableEntityIdProps) {
  const [copied, setCopied] = useState(false);

  const displayId = short ? `${entityId.slice(0, 8)}...` : entityId;

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(entityId);
      setCopied(true);
      toast.success("Entity ID copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy entity ID");
    }
  };

  return (
    <code
      className={`copyable-entity-id ${className} ${copied ? "copied" : ""}`}
      onClick={handleClick}
      title="Click to copy full entity ID"
      style={{ cursor: "pointer", userSelect: "none" }}
    >
      {displayId}
    </code>
  );
}
