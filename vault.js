"use strict";

const plannerVault = (() => {
  const vaultKey = "bachelor-life-vault-v1";
  const legacyKey = "bachelor-life-planner-v1";
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const rounds = 600000;

  function encode(bytes) {
    let body = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      body += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return btoa(body);
  }

  function decode(value) {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  }

  function getRecord() {
    const raw = localStorage.getItem(vaultKey);
    if (raw === null) return null;
    const data = JSON.parse(raw);
    if (data?.version !== 1 || typeof data.name !== "string" || !data.name ||
        typeof data.salt !== "string" || typeof data.iv !== "string" || typeof data.payload !== "string" ||
        decode(data.salt).length !== 16 || decode(data.iv).length !== 12) {
      throw new Error("Invalid saved profile");
    }
    return { raw, data };
  }

  async function derive(password, salt) {
    const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: rounds }, material,
      { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  function cipher(name, iv) {
    return { name: "AES-GCM", iv, additionalData: encoder.encode("bachelor-life/1/" + name) };
  }

  async function seal(profile, key, raw) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const bytes = await crypto.subtle.encrypt(cipher(profile.name, iv), key, encoder.encode(raw));
    return JSON.stringify({ version: 1, name: profile.name, salt: profile.salt, iv: encode(iv), payload: encode(new Uint8Array(bytes)) });
  }

  function exclusive(task) {
    return navigator.locks ? navigator.locks.request(vaultKey, task) : task();
  }

  function session(profile, key, raw, current) {
    let latest = Promise.resolve();
    return {
      raw,
      write(next) {
        latest = latest.catch(() => {}).then(async () => {
          const replacement = await seal(profile, key, next);
          await exclusive(() => {
            if (localStorage.getItem(vaultKey) !== current) throw new Error("Profile changed in another tab");
            localStorage.setItem(vaultKey, replacement);
            current = replacement;
          });
        });
        return latest;
      },
      flush() { return latest; }
    };
  }

  async function create(name, password, migrate) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const profile = { name, salt: encode(salt) };
    const key = await derive(password, salt);
    const legacy = migrate ? localStorage.getItem(legacyKey) : null;
    const raw = legacy ?? "null";
    const saved = await seal(profile, key, raw);
    await exclusive(() => {
      if (localStorage.getItem(vaultKey) !== null) throw new Error("Profile already exists");
      localStorage.setItem(vaultKey, saved);
      if (legacy !== null && localStorage.getItem(legacyKey) === legacy) localStorage.removeItem(legacyKey);
    });
    return session(profile, key, raw, saved);
  }

  async function unlock(record, password) {
    const profile = record.data;
    const key = await derive(password, decode(profile.salt));
    const clear = await crypto.subtle.decrypt(cipher(profile.name, decode(profile.iv)), key, decode(profile.payload));
    return session(profile, key, decoder.decode(clear), record.raw);
  }

  return {
    getRecord, create, unlock,
    hasLegacy: () => localStorage.getItem(legacyKey) !== null
  };
})();
