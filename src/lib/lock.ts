// App lock — a device-level screen lock for the PWA.
// PIN is never stored: we keep a PBKDF2 hash + salt in localStorage on this device.
// Biometrics use WebAuthn with the platform authenticator (Face ID / fingerprint /
// Windows Hello). This gates the UI; the data itself stays behind the Supabase session.

const SETTINGS_KEY = 'masari.lock.v1'

export type LockTimeout = 0 | 60 | 300 | 900 // seconds in background before re-lock
export type LockSettings = {
  enabled: boolean
  pinHash: string | null // base64
  pinSalt: string | null // base64
  pinLength: number
  biometricId: string | null // base64url credential id
  timeout: LockTimeout
}

const DEFAULTS: LockSettings = { enabled: false, pinHash: null, pinSalt: null, pinLength: 4, biometricId: null, timeout: 60 }

export function loadLockSettings(): LockSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<LockSettings>) } : { ...DEFAULTS }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveLockSettings(s: LockSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

export function clearLockSettings() {
  localStorage.removeItem(SETTINGS_KEY)
}

// ---------- PIN ----------

const te = new TextEncoder()

function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function unb64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function derive(pin: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', te.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: 150_000 }, key, 256)
  return b64(bits)
}

export async function hashPin(pin: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { hash: await derive(pin, salt), salt: b64(salt) }
}

export async function verifyPin(pin: string, s: LockSettings): Promise<boolean> {
  if (!s.pinHash || !s.pinSalt) return false
  const h = await derive(pin, unb64(s.pinSalt))
  // constant-time-ish compare
  if (h.length !== s.pinHash.length) return false
  let diff = 0
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ s.pinHash.charCodeAt(i)
  return diff === 0
}

// ---------- Biometrics (WebAuthn, platform authenticator) ----------

function b64url(buf: ArrayBuffer): string {
  return b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function unb64url(s: string): Uint8Array {
  return unb64(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))
}

export async function biometricAvailable(): Promise<boolean> {
  try {
    if (!window.PublicKeyCredential || !window.isSecureContext) return false
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export async function registerBiometric(userId: string, label: string): Promise<string> {
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Masari', id: location.hostname },
      user: { id: te.encode(userId), name: label, displayName: label },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60_000,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null
  if (!cred) throw new Error('No credential created')
  return b64url(cred.rawId)
}

export async function verifyBiometric(credentialId: string): Promise<boolean> {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: unb64url(credentialId) as BufferSource, transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null
    return Boolean(assertion)
  } catch {
    return false
  }
}
