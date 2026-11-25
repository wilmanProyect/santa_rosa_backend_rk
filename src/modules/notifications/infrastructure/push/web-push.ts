import {
  createECDH,
  createHmac,
  createCipheriv,
  createPrivateKey,
  randomBytes,
  sign,
} from 'crypto';

/**
 * Web Push sin dependencias externas, solo con `crypto` de Node:
 *  - Cifrado del mensaje: RFC 8291 (aes128gcm, RFC 8188).
 *  - Identificación del servidor: VAPID, RFC 8292 (JWT ES256).
 *
 * Los navegadores entregan el mensaje con su propio servicio de push (Google,
 * Mozilla, Apple, Microsoft), que es gratuito y no requiere cuenta.
 */

const CURVE = 'prime256v1';
const RECORD_SIZE = 4096;

export const b64url = {
  encode: (buf: Buffer) => buf.toString('base64url'),
  decode: (text: string) => Buffer.from(text, 'base64url'),
};

export interface VapidKeys {
  /** Clave pública sin comprimir (65 bytes), base64url. La usa el navegador. */
  publicKey: string;
  /** Clave privada (32 bytes), base64url. */
  privateKey: string;
}

export function generateVapidKeys(): VapidKeys {
  const ecdh = createECDH(CURVE);
  ecdh.generateKeys();
  return {
    publicKey: b64url.encode(ecdh.getPublicKey()),
    privateKey: b64url.encode(ecdh.getPrivateKey()),
  };
}

const hmac = (key: Buffer, data: Buffer) =>
  createHmac('sha256', key).update(data).digest();

/**
 * Cifra el mensaje para una suscripción (RFC 8291). `salt` y `serverPrivateKey`
 * solo se pasan en los tests; en uso normal son aleatorios en cada envío.
 */
export function encryptPayload(
  payload: Buffer,
  subscription: { p256dh: string; auth: string },
  testing?: { salt: Buffer; serverPrivateKey: Buffer },
): Buffer {
  const uaPublic = b64url.decode(subscription.p256dh);
  const authSecret = b64url.decode(subscription.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) {
    throw new Error('Clave p256dh de la suscripción inválida');
  }
  if (authSecret.length !== 16) {
    throw new Error('Secreto auth de la suscripción inválido');
  }

  const server = createECDH(CURVE);
  if (testing) server.setPrivateKey(testing.serverPrivateKey);
  else server.generateKeys();
  const asPublic = server.getPublicKey();
  const ecdhSecret = server.computeSecret(uaPublic);

  // Combina el secreto ECDH con el secreto auth (HKDF con salida de 32 bytes).
  const prkKey = hmac(authSecret, ecdhSecret);
  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'latin1'),
    uaPublic,
    asPublic,
  ]);
  const ikm = hmac(prkKey, Buffer.concat([keyInfo, Buffer.of(1)]));

  const salt = testing?.salt ?? randomBytes(16);
  const prk = hmac(salt, ikm);
  const cek = hmac(
    prk,
    Buffer.from('Content-Encoding: aes128gcm\0\x01', 'latin1'),
  ).subarray(0, 16);
  const nonce = hmac(
    prk,
    Buffer.from('Content-Encoding: nonce\0\x01', 'latin1'),
  ).subarray(0, 12);

  // Un solo registro: el mensaje + el delimitador 0x02, sin relleno.
  const plaintext = Buffer.concat([payload, Buffer.of(2)]);
  if (plaintext.length + 16 > RECORD_SIZE - 86) {
    throw new Error('El mensaje push es demasiado largo');
  }
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  const header = Buffer.alloc(16 + 4 + 1);
  salt.copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, ciphertext]);
}

/** Cabecera Authorization de VAPID (RFC 8292) para el servicio de push. */
export function vapidAuthorization(
  endpoint: string,
  subject: string,
  keys: VapidKeys,
  now: Date = new Date(),
): string {
  const ecdh = createECDH(CURVE);
  ecdh.setPrivateKey(b64url.decode(keys.privateKey));
  const pub = ecdh.getPublicKey();
  const key = createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      d: keys.privateKey,
      x: b64url.encode(pub.subarray(1, 33)),
      y: b64url.encode(pub.subarray(33, 65)),
    },
    format: 'jwk',
  });
  const header = b64url.encode(
    Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })),
  );
  const claims = b64url.encode(
    Buffer.from(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        // Máximo permitido: 24 h. Se usan 12 h.
        exp: Math.floor(now.getTime() / 1000) + 12 * 3600,
        sub: subject,
      }),
    ),
  );
  const signature = sign('sha256', Buffer.from(`${header}.${claims}`), {
    key,
    dsaEncoding: 'ieee-p1363',
  });
  return `vapid t=${header}.${claims}.${b64url.encode(signature)}, k=${keys.publicKey}`;
}

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Envía un mensaje push. Devuelve el código HTTP del servicio de push:
 * 201 = aceptado; 404 o 410 = la suscripción ya no existe (hay que borrarla).
 */
export async function sendWebPush(
  subscription: PushSubscriptionKeys,
  payload: object,
  vapid: { keys: VapidKeys; subject: string },
  options: { ttlSeconds?: number; timeoutMs?: number } = {},
): Promise<number> {
  const body = encryptPayload(
    Buffer.from(JSON.stringify(payload), 'utf8'),
    subscription,
  );
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: vapidAuthorization(
        subscription.endpoint,
        vapid.subject,
        vapid.keys,
      ),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(options.ttlSeconds ?? 86_400),
      Urgency: 'normal',
    },
    body: new Uint8Array(body),
    signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
  });
  await response.arrayBuffer().catch(() => undefined);
  return response.status;
}
