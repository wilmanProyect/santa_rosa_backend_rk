import {
  createDecipheriv,
  createECDH,
  createHmac,
  createPublicKey,
  verify,
} from 'crypto';
import {
  b64url,
  encryptPayload,
  generateVapidKeys,
  vapidAuthorization,
} from './web-push';

// Valores del Apéndice A del RFC 8291.
const RFC = {
  plaintext: 'V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  uaPublic:
    'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  uaPrivate: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  header:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  ciphertext:
    '8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ',
};

const hmac = (key: Buffer, data: Buffer) =>
  createHmac('sha256', key).update(data).digest();

/** Lo que hace el navegador al recibir el mensaje (para la prueba de ida y vuelta). */
function decrypt(body: Buffer, uaPrivate: Buffer, auth: Buffer): Buffer {
  const salt = body.subarray(0, 16);
  const idLen = body.readUInt8(20);
  const asPublic = body.subarray(21, 21 + idLen);
  const ciphertext = body.subarray(21 + idLen);
  const ua = createECDH('prime256v1');
  ua.setPrivateKey(uaPrivate);
  const secret = ua.computeSecret(asPublic);
  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'latin1'),
    ua.getPublicKey(),
    asPublic,
  ]);
  const ikm = hmac(hmac(auth, secret), Buffer.concat([keyInfo, Buffer.of(1)]));
  const prk = hmac(salt, ikm);
  const cek = hmac(
    prk,
    Buffer.from('Content-Encoding: aes128gcm\0\x01', 'latin1'),
  ).subarray(0, 16);
  const nonce = hmac(
    prk,
    Buffer.from('Content-Encoding: nonce\0\x01', 'latin1'),
  ).subarray(0, 12);
  const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
  decipher.setAuthTag(ciphertext.subarray(-16));
  const plain = Buffer.concat([
    decipher.update(ciphertext.subarray(0, -16)),
    decipher.final(),
  ]);
  expect(plain.at(-1)).toBe(2);
  return plain.subarray(0, -1);
}

describe('Web Push', () => {
  it('cifra exactamente como el ejemplo del RFC 8291', () => {
    const body = encryptPayload(
      b64url.decode(RFC.plaintext),
      { p256dh: RFC.uaPublic, auth: RFC.auth },
      {
        salt: b64url.decode(RFC.salt),
        serverPrivateKey: b64url.decode(RFC.asPrivate),
      },
    );
    expect(
      body.equals(
        Buffer.concat([
          b64url.decode(RFC.header),
          b64url.decode(RFC.ciphertext),
        ]),
      ),
    ).toBe(true);
  });

  it('el navegador puede descifrar un mensaje con claves aleatorias', () => {
    const message = Buffer.from(
      JSON.stringify({ title: 'Parto probable hoy', body: 'NALA (0) · ñandú' }),
    );
    const body = encryptPayload(message, {
      p256dh: RFC.uaPublic,
      auth: RFC.auth,
    });
    const plain = decrypt(
      body,
      b64url.decode(RFC.uaPrivate),
      b64url.decode(RFC.auth),
    );
    expect(plain.toString('utf8')).toBe(message.toString('utf8'));
  });

  it('rechaza claves de suscripción inválidas', () => {
    expect(() =>
      encryptPayload(Buffer.from('x'), { p256dh: 'AAAA', auth: RFC.auth }),
    ).toThrow(/p256dh/);
  });

  it('firma el JWT de VAPID con ES256 verificable con la clave pública', () => {
    const keys = generateVapidKeys();
    expect(b64url.decode(keys.publicKey)).toHaveLength(65);
    const now = new Date('2026-11-24T12:00:00Z');
    const header = vapidAuthorization(
      'https://fcm.googleapis.com/fcm/send/abc123',
      'mailto:admin@ejemplo.com',
      keys,
      now,
    );
    const match = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header);
    expect(match).not.toBeNull();
    const [, h, c, s, k] = match!;
    expect(k).toBe(keys.publicKey);
    const claims = JSON.parse(b64url.decode(c).toString()) as Record<
      string,
      unknown
    >;
    expect(claims).toEqual({
      aud: 'https://fcm.googleapis.com',
      exp: Math.floor(now.getTime() / 1000) + 12 * 3600,
      sub: 'mailto:admin@ejemplo.com',
    });
    const pub = b64url.decode(keys.publicKey);
    const publicKey = createPublicKey({
      key: {
        kty: 'EC',
        crv: 'P-256',
        x: b64url.encode(pub.subarray(1, 33)),
        y: b64url.encode(pub.subarray(33, 65)),
      },
      format: 'jwk',
    });
    expect(
      verify(
        'sha256',
        Buffer.from(`${h}.${c}`),
        { key: publicKey, dsaEncoding: 'ieee-p1363' },
        b64url.decode(s),
      ),
    ).toBe(true);
  });
});
