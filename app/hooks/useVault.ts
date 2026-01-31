"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration
} from "@simplewebauthn/browser";
import { del, get, set } from "idb-keyval";
import { toast } from "sonner";
import {
  generateEntityKeyPair,
  generateInviteCode,
  generateShareCode,
  openSealedPrivateKey,
  sealPrivateKeyForInvite,
  sealKeyForShare,
  unwrapPrivateKey,
  wrapPrivateKey,
  type SealedInvitePayload
} from "../lib/crypto";
import {
  clearSession,
  consumeInvite,
  createInvite,
  createSession,
  getSession,
  initEntity,
  initEntityIfExists,
  linkPasskey,
  resetAll,
  createShare,
  consumeShare,
  revokeShare,
  getShares,
  type SharesResponse
} from "../lib/api";
import { useEventStream, type EntityState } from "./useEventStream";

const CREDENTIAL_ID_KEY = "passkeyCredentialId";
const USER_ID_KEY = "passkeyUserId";
const ENTITY_KEY_PREFIX = "entityKey:";

type WrappedKeyRecord = { wrapped: string; nonce: string };

function randomBase64Url(size = 32): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getLocal(key: string): string | null {
  return typeof window !== "undefined" ? localStorage.getItem(key) : null;
}

function setLocal(key: string, value: string): void {
  localStorage.setItem(key, value);
}

function removeLocal(key: string): void {
  localStorage.removeItem(key);
}

export function useVault() {
  const [signedIn, setSignedIn] = useState(false);
  const [supportsPasskeys, setSupportsPasskeys] = useState(false);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [entityPrivateKey, setEntityPrivateKey] = useState<Uint8Array | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [generatedInvite, setGeneratedInvite] = useState<{ code: string; expiresAt: number } | null>(null);
  const [isNewEntity, setIsNewEntity] = useState(false);
  const restoreAttemptedRef = useRef(false);
  const [restoreDone, setRestoreDone] = useState(false);

  // Share-related state
  const [sharePropertyName, setSharePropertyName] = useState("");
  const [shareCode, setShareCode] = useState("");
  const [generatedShare, setGeneratedShare] = useState<{ code: string; propertyName: string; expiresAt: number } | null>(null);
  const [shares, setShares] = useState<SharesResponse>({ outgoing: [], incoming: [] });
  const [pendingShareCodes, setPendingShareCodes] = useState<Map<string, string>>(new Map()); // sourceEntityId -> code

  // Real-time event stream for profile data (encrypted)
  const eventStream = useEventStream(
    signedIn ? entityId : null,
    signedIn ? entityPrivateKey : null
  );

  // Send initial EntityCreated event for new entities
  useEffect(() => {
    if (isNewEntity && eventStream.connected && entityId && eventStream.events.length === 0) {
      eventStream.appendEvent({
        type: "EntityCreated",
        data: { entityId },
      });
      setIsNewEntity(false);
    }
  }, [isNewEntity, eventStream.connected, entityId, eventStream.events.length, eventStream]);

  useEffect(() => {
    setSupportsPasskeys(browserSupportsWebAuthn());
  }, []);

  const entityKeyStorageKey = (id: string) => `${ENTITY_KEY_PREFIX}${id}`;

  const loadWrappedKey = async (id: string): Promise<WrappedKeyRecord | null> => {
    const value = await get(entityKeyStorageKey(id));
    return (value as WrappedKeyRecord | undefined) ?? null;
  };

  const storeWrappedKey = async (id: string, record: WrappedKeyRecord) => {
    await set(entityKeyStorageKey(id), record);
  };

  const clearWrappedKey = async (id: string) => {
    await del(entityKeyStorageKey(id));
  };

  const registerNewPasskey = async (): Promise<string> => {
    const userId = getLocal(USER_ID_KEY) ?? randomBase64Url(16);
    setLocal(USER_ID_KEY, userId);

    const registration = await startRegistration({
      optionsJSON: {
        challenge: randomBase64Url(),
        rp: { name: "Truetrace Vault", id: window.location.hostname },
        user: { id: userId, name: "user@truetrace.local", displayName: "User" },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 }
        ],
        authenticatorSelection: { residentKey: "required", userVerification: "required" },
        timeout: 60000,
        attestation: "none"
      }
    });

    setLocal(CREDENTIAL_ID_KEY, registration.id);
    return registration.id;
  };

  const hydrateEntity = async (passkeyId: string, allowCreate: boolean) => {
    const lookup = allowCreate ? await initEntity(passkeyId) : await initEntityIfExists(passkeyId);
    if (!lookup.entityId) throw new Error("No entity found.");

    let key: Uint8Array | null = null;
    const stored = await loadWrappedKey(lookup.entityId);
    if (stored) {
      key = await unwrapPrivateKey(stored.wrapped, stored.nonce);
    }

    if (!key && lookup.created) {
      const keyPair = await generateEntityKeyPair();
      key = keyPair.privateKey;
      const wrapped = await wrapPrivateKey(key);
      await storeWrappedKey(lookup.entityId, wrapped);
      setIsNewEntity(true);
    }

    setEntityId(lookup.entityId);
    setEntityPrivateKey(key);
    setSignedIn(true);
  };

  const loginMutation = useMutation({
    mutationFn: async () => {
      const storedCredentialId = getLocal(CREDENTIAL_ID_KEY);

      let credentialId: string;

      if (storedCredentialId) {
        // User has registered before - authenticate with specific credential
        const auth = await startAuthentication({
          optionsJSON: {
            challenge: randomBase64Url(),
            timeout: 60000,
            userVerification: "required",
            rpId: window.location.hostname,
            allowCredentials: [
              {
                id: storedCredentialId,
                type: "public-key",
                transports: ["internal", "hybrid"]
              }
            ]
          }
        });
        credentialId = auth.id;
        setLocal(CREDENTIAL_ID_KEY, credentialId);
      } else {
        // First time user - register a new passkey directly
        credentialId = await registerNewPasskey();
      }

      await hydrateEntity(credentialId, true);
      await createSession(credentialId);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Login failed.");
    }
  });

  const generateInviteMutation = useMutation({
    mutationFn: async () => {
      if (!entityId || !entityPrivateKey) return;
      const code = generateInviteCode();
      const sealed = await sealPrivateKeyForInvite(entityPrivateKey, code);
      const { expiresAt } = await createInvite(entityId, code, sealed);
      setGeneratedInvite({ code, expiresAt });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to generate invite.");
    }
  });

  const linkMutation = useMutation({
    mutationFn: async (code: string) => {
      const passkeyId = getLocal(CREDENTIAL_ID_KEY);
      if (!passkeyId) throw new Error("Missing passkey.");
      const invite = await consumeInvite(code);
      const key = await openSealedPrivateKey(invite.sealed as SealedInvitePayload, code);

      if (entityId && entityId !== invite.entityId) {
        await clearWrappedKey(entityId);
      }

      const wrapped = await wrapPrivateKey(key);
      await storeWrappedKey(invite.entityId, wrapped);
      await linkPasskey(passkeyId, invite.entityId);

      setEntityId(invite.entityId);
      setEntityPrivateKey(key);
      setInviteCode("");
      setGeneratedInvite(null);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to link device.");
    }
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      await resetAll();
      removeLocal(CREDENTIAL_ID_KEY);
      removeLocal(USER_ID_KEY);
      if (entityId) await clearWrappedKey(entityId);
    },
    onSuccess: () => {
      toast.success(
        "App data cleared. To delete passkeys, go to your browser's password settings.",
        { duration: 8000 }
      );
      setSignedIn(false);
      setEntityId(null);
      setEntityPrivateKey(null);
      setInviteCode("");
      setGeneratedInvite(null);
      setShares({ outgoing: [], incoming: [] });
      setGeneratedShare(null);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to reset.");
    }
  });

  // Create a share invite
  const createShareMutation = useMutation({
    mutationFn: async (propertyName: string) => {
      if (!entityId || !entityPrivateKey) throw new Error("Not authenticated");
      const code = generateShareCode();
      const sealedKey = await sealKeyForShare(entityPrivateKey, code);
      const { expiresAt } = await createShare(code, propertyName, sealedKey);
      setGeneratedShare({ code, propertyName, expiresAt });
      toast.success(`Share code generated for ${propertyName}`);
      return { code, propertyName, expiresAt };
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to create share.");
    }
  });

  // Consume a share invite
  const consumeShareMutation = useMutation({
    mutationFn: async (code: string) => {
      const result = await consumeShare(code);
      // Store the code temporarily so we can decrypt events later
      setPendingShareCodes(prev => new Map(prev).set(result.sourceEntityId, code));
      // Register the key in the event stream
      await eventStream.registerSharedKey(
        result.sourceEntityId,
        result.sealedKey as SealedInvitePayload,
        code
      );
      // Refresh shares list
      const updatedShares = await getShares();
      setShares(updatedShares);
      toast.success(`Now receiving ${result.propertyName} from ${result.sourceEntityId.slice(0, 8)}...`);
      return result;
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to consume share.");
    }
  });

  // Revoke a share
  const revokeShareMutation = useMutation({
    mutationFn: async (params: { targetEntityId?: string; sourceEntityId?: string; propertyName: string }) => {
      const { removed } = await revokeShare(
        params.targetEntityId || null,
        params.sourceEntityId || null,
        params.propertyName
      );
      if (removed) {
        // If revoking incoming share, unregister the key
        if (params.sourceEntityId) {
          eventStream.unregisterSharedKey(params.sourceEntityId);
        }
        // Refresh shares list
        const updatedShares = await getShares();
        setShares(updatedShares);
        toast.success("Share removed");
      }
      return removed;
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to revoke share.");
    }
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      const session = await getSession();
      if (!session.passkeyId) return;
      await hydrateEntity(session.passkeyId, false);
    },
    onError: () => {
      void clearSession();
    },
    onSettled: () => setRestoreDone(true)
  });

  // Load shares when signed in
  useEffect(() => {
    if (signedIn && entityId) {
      getShares().then(setShares).catch(console.error);
    }
  }, [signedIn, entityId]);

  // Register keys for incoming shares when we have them
  useEffect(() => {
    shares.incoming.forEach(async (share) => {
      const code = pendingShareCodes.get(share.sourceEntityId);
      if (code) {
        await eventStream.registerSharedKey(
          share.sourceEntityId,
          share.keyWrapped as SealedInvitePayload,
          code
        );
      }
    });
  }, [shares.incoming, pendingShareCodes, eventStream]);

  const isBusy = useMemo(
    () =>
      loginMutation.isPending ||
      generateInviteMutation.isPending ||
      linkMutation.isPending ||
      resetMutation.isPending ||
      createShareMutation.isPending ||
      consumeShareMutation.isPending ||
      revokeShareMutation.isPending ||
      (restoreMutation.isPending && !restoreDone),
    [
      loginMutation.isPending,
      generateInviteMutation.isPending,
      linkMutation.isPending,
      resetMutation.isPending,
      createShareMutation.isPending,
      consumeShareMutation.isPending,
      revokeShareMutation.isPending,
      restoreMutation.isPending,
      restoreDone
    ]
  );

  useEffect(() => {
    if (signedIn || restoreAttemptedRef.current) return;
    restoreAttemptedRef.current = true;
    restoreMutation.mutate();
  }, [signedIn, restoreMutation]);

  const login = () => loginMutation.mutateAsync();

  const logout = async () => {
    await clearSession();
    setSignedIn(false);
    setEntityId(null);
    setEntityPrivateKey(null);
    setInviteCode("");
    setGeneratedInvite(null);
  };

  const generateInvite = () => generateInviteMutation.mutateAsync();

  const linkDevice = (code: string) => linkMutation.mutateAsync(code.trim().toUpperCase());

  const resetEverything = () => resetMutation.mutateAsync();

  // Share actions
  const createShareInvite = (propertyName: string) => createShareMutation.mutateAsync(propertyName);
  const acceptShare = (code: string) => consumeShareMutation.mutateAsync(code.trim().toUpperCase());
  const removeShare = (params: { targetEntityId?: string; sourceEntityId?: string; propertyName: string }) =>
    revokeShareMutation.mutateAsync(params);

  return {
    signedIn,
    supportsPasskeys,
    entityId,
    hasKey: !!entityPrivateKey,
    // Entity state comes from real-time event stream
    state: eventStream.state,
    properties: eventStream.state?.properties ?? {},
    connected: eventStream.connected,
    inviteCode,
    setInviteCode,
    generatedInvite,
    isBusy,
    isLoggingIn: loginMutation.isPending,
    isGeneratingInvite: generateInviteMutation.isPending,
    isLinking: linkMutation.isPending,
    isResetting: resetMutation.isPending,
    login,
    logout,
    generateInvite,
    linkDevice,
    resetEverything,
    // Property management
    setProperty: eventStream.setProperty,
    deleteProperty: eventStream.deleteProperty,
    // Share-related
    shares,
    sharedData: eventStream.sharedData,
    sharePropertyName,
    setSharePropertyName,
    shareCode,
    setShareCode,
    generatedShare,
    isCreatingShare: createShareMutation.isPending,
    isAcceptingShare: consumeShareMutation.isPending,
    isRevokingShare: revokeShareMutation.isPending,
    createShareInvite,
    acceptShare,
    removeShare,
  };
}
