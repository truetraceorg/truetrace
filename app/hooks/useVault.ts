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
  openSealedPrivateKey,
  sealPrivateKeyForInvite,
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
  resetAll
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
        // User has registered before - authenticate with existing passkey
        const auth = await startAuthentication({
          optionsJSON: {
            challenge: randomBase64Url(),
            timeout: 60000,
            userVerification: "required",
            rpId: window.location.hostname
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
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to reset.");
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

  const isBusy = useMemo(
    () =>
      loginMutation.isPending ||
      generateInviteMutation.isPending ||
      linkMutation.isPending ||
      resetMutation.isPending ||
      (restoreMutation.isPending && !restoreDone),
    [
      loginMutation.isPending,
      generateInviteMutation.isPending,
      linkMutation.isPending,
      resetMutation.isPending,
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

  // Real-time profile updates via WebSocket
  const updateProfile = (field: "givenName" | "surname", value: string) => {
    eventStream.updateProfile({ [field]: value });
  };

  return {
    signedIn,
    supportsPasskeys,
    entityId,
    hasKey: !!entityPrivateKey,
    // Profile state comes from real-time event stream
    profile: eventStream.state,
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
    updateProfile
  };
}
