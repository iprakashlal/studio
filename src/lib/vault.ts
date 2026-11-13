// Small secrets kept on this device only, encrypted with a key made from the Studio's GitHub login token, so
// they only open while the Studio is signed in. Never written to any repository.
const enc = new TextEncoder();
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (h: string) => new Uint8Array((h.match(/../g) || []).map((x) => parseInt(x, 16)));
async function keyFor(secret: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export function vault<T>(name: string) {
  const KEY = "site-studio:" + name;
  return {
    async save(value: T, studioToken: string) {
      const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
      const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFor(studioToken, salt), enc.encode(JSON.stringify(value))));
      localStorage.setItem(KEY, JSON.stringify({ v: 1, salt: hex(salt), iv: hex(iv), data: hex(data) }));
    },
    async load(studioToken: string): Promise<T | null> {
      try {
        const s = JSON.parse(localStorage.getItem(KEY) || "null");
        if (!s) return null;
        const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unhex(s.iv) }, await keyFor(studioToken, unhex(s.salt)), unhex(s.data));
        return JSON.parse(new TextDecoder().decode(pt)) as T;
      } catch { return null; }
    },
    saved: () => { try { return !!localStorage.getItem(KEY); } catch { return false; } },
    clear: () => { try { localStorage.removeItem(KEY); } catch { /* private mode */ } },
  };
}
