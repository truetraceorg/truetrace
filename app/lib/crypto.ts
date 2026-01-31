import sodium from "libsodium-wrappers-sumo";
import { get, set } from "idb-keyval";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type EncryptedPayload = {
  version: number;
  alg: "XSALSA20-POLY1305";
  nonce: string;
  ciphertext: string;
};

export type SealedInvitePayload = {
  version: number;
  alg: "XSALSA20-POLY1305";
  nonce: string;
  salt: string;
  ciphertext: string;
  opslimit: number;
  memlimit: number;
  kdf: string;
};

async function getSodium() {
  await sodium.ready;
  return sodium;
}

export function generateInviteCode(length = 16): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export type EntityKeyPair = {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
};

async function getOrCreateDeviceKey(): Promise<Uint8Array> {
  const storeKey = "deviceWrappingKey";
  const existing = await get<string>(storeKey);
  if (existing) {
    const sodiumLib = await getSodium();
    return sodiumLib.from_base64(existing, sodiumLib.base64_variants.URLSAFE_NO_PADDING);
  }
  const sodiumLib = await getSodium();
  const raw = sodiumLib.randombytes_buf(sodiumLib.crypto_secretbox_KEYBYTES);
  const encoded = sodiumLib.to_base64(
    raw,
    sodiumLib.base64_variants.URLSAFE_NO_PADDING
  );
  await set(storeKey, encoded);
  return raw;
}

function toBase64(bytes: Uint8Array): string {
  return sodium.to_base64(bytes, sodium.base64_variants.URLSAFE_NO_PADDING);
}

function fromBase64(value: string): Uint8Array {
  return sodium.from_base64(value, sodium.base64_variants.URLSAFE_NO_PADDING);
}

export async function generateEntityKeyPair(): Promise<EntityKeyPair> {
  const sodiumLib = await getSodium();
  const keyPair = sodiumLib.crypto_box_keypair();
  return { publicKey: keyPair.publicKey, privateKey: keyPair.privateKey };
}

export async function wrapPrivateKey(
  rawPrivateKey: Uint8Array
): Promise<{ wrapped: string; nonce: string }> {
  const sodiumLib = await getSodium();
  const deviceKey = await getOrCreateDeviceKey();
  const nonce = sodiumLib.randombytes_buf(sodiumLib.crypto_secretbox_NONCEBYTES);
  const ciphertext = sodiumLib.crypto_secretbox_easy(rawPrivateKey, nonce, deviceKey);
  return { wrapped: toBase64(ciphertext), nonce: toBase64(nonce) };
}

export async function unwrapPrivateKey(
  wrapped: string,
  nonce: string
): Promise<Uint8Array> {
  const sodiumLib = await getSodium();
  const deviceKey = await getOrCreateDeviceKey();
  const ciphertext = fromBase64(wrapped);
  const nonceBytes = fromBase64(nonce);
  const plaintext = sodiumLib.crypto_secretbox_open_easy(
    ciphertext,
    nonceBytes,
    deviceKey
  );
  return plaintext;
}

function deriveEntityContentKey(rawPrivateKey: Uint8Array): Uint8Array {
  return sodium.crypto_generichash(
    sodium.crypto_secretbox_KEYBYTES,
    rawPrivateKey,
    textEncoder.encode("truetrace-entity-content")
  );
}

export async function encryptJson(
  rawPrivateKey: Uint8Array,
  data: unknown
): Promise<EncryptedPayload> {
  const sodiumLib = await getSodium();
  const key = deriveEntityContentKey(rawPrivateKey);
  const nonce = sodiumLib.randombytes_buf(sodiumLib.crypto_secretbox_NONCEBYTES);
  const plaintext = textEncoder.encode(JSON.stringify(data));
  const ciphertext = sodiumLib.crypto_secretbox_easy(plaintext, nonce, key);
  return {
    version: 1,
    alg: "XSALSA20-POLY1305",
    nonce: toBase64(nonce),
    ciphertext: toBase64(ciphertext)
  };
}

export async function decryptJson<T>(
  rawPrivateKey: Uint8Array,
  payload: EncryptedPayload
): Promise<T> {
  const sodiumLib = await getSodium();
  const key = deriveEntityContentKey(rawPrivateKey);
  const nonce = fromBase64(payload.nonce);
  const ciphertext = fromBase64(payload.ciphertext);
  const plaintext = sodiumLib.crypto_secretbox_open_easy(ciphertext, nonce, key);
  return JSON.parse(textDecoder.decode(plaintext)) as T;
}

export async function sealPrivateKeyForInvite(
  rawPrivateKey: Uint8Array,
  inviteCode: string
): Promise<SealedInvitePayload> {
  const sodiumLib = await getSodium();
  const salt = sodiumLib.randombytes_buf(sodiumLib.crypto_pwhash_SALTBYTES);
  const nonce = sodiumLib.randombytes_buf(sodiumLib.crypto_secretbox_NONCEBYTES);
  const opslimit = sodiumLib.crypto_pwhash_OPSLIMIT_MODERATE;
  const memlimit = sodiumLib.crypto_pwhash_MEMLIMIT_MODERATE;
  const kdf = "crypto_pwhash_MODERATE";
  const key = sodiumLib.crypto_pwhash(
    sodiumLib.crypto_secretbox_KEYBYTES,
    inviteCode,
    salt,
    opslimit,
    memlimit,
    sodiumLib.crypto_pwhash_ALG_DEFAULT
  );
  const ciphertext = sodiumLib.crypto_secretbox_easy(rawPrivateKey, nonce, key);
  return {
    version: 1,
    alg: "XSALSA20-POLY1305",
    nonce: toBase64(nonce),
    salt: toBase64(salt),
    ciphertext: toBase64(ciphertext),
    opslimit,
    memlimit,
    kdf
  };
}

export async function openSealedPrivateKey(
  sealed: SealedInvitePayload,
  inviteCode: string
): Promise<Uint8Array> {
  const sodiumLib = await getSodium();
  const salt = fromBase64(sealed.salt);
  const nonce = fromBase64(sealed.nonce);
  const ciphertext = fromBase64(sealed.ciphertext);
  const key = sodiumLib.crypto_pwhash(
    sodiumLib.crypto_secretbox_KEYBYTES,
    inviteCode,
    salt,
    sealed.opslimit,
    sealed.memlimit,
    sodiumLib.crypto_pwhash_ALG_DEFAULT
  );
  return sodiumLib.crypto_secretbox_open_easy(ciphertext, nonce, key);
}
