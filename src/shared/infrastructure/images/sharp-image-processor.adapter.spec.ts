import sharp from 'sharp';
import {
  SharpImageProcessorAdapter,
  THUMBNAIL_MAX_SIDE,
} from './sharp-image-processor.adapter';

const image = (width: number, height: number) =>
  sharp({
    create: { width, height, channels: 3, background: '#88aa55' },
  });

describe('SharpImageProcessorAdapter', () => {
  const processor = new SharpImageProcessorAdapter();

  it('reconoce JPEG, PNG y WEBP con sus dimensiones', async () => {
    const cases = [
      [await image(40, 30).jpeg().toBuffer(), 'image/jpeg', 'jpg'],
      [await image(40, 30).png().toBuffer(), 'image/png', 'png'],
      [await image(40, 30).webp().toBuffer(), 'image/webp', 'webp'],
    ] as const;

    for (const [content, mimeType, extension] of cases) {
      await expect(processor.analyze(content)).resolves.toEqual({
        mimeType,
        extension,
        width: 40,
        height: 30,
        takenAt: null,
      });
    }
  });

  it('rechaza archivos que no son imágenes o formatos no admitidos', async () => {
    const pdf = Buffer.from('%PDF-1.4\n%%EOF\n');
    const gif = await image(10, 10).gif().toBuffer();
    await expect(processor.analyze(pdf)).resolves.toBeNull();
    await expect(processor.analyze(gif)).resolves.toBeNull();
  });

  it('lee la fecha de captura del EXIF', async () => {
    const content = await image(20, 20)
      .withExif({ IFD2: { DateTimeOriginal: '2025:06:10 18:45:00' } })
      .jpeg()
      .toBuffer();
    const info = await processor.analyze(content);
    expect(info?.takenAt).toBe('2025-06-10');
  });

  it('informa las dimensiones según la orientación EXIF (foto girada)', async () => {
    // Orientación 6 = girada 90°: se ve vertical aunque se guardó apaisada.
    const content = await image(40, 30)
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const info = await processor.analyze(content);
    expect([info?.width, info?.height]).toEqual([30, 40]);
  });

  it('genera una miniatura WEBP sin agrandar las imágenes chicas', async () => {
    const big = await processor.createThumbnail(
      await image(2000, 1000).jpeg().toBuffer(),
    );
    const bigMeta = await sharp(big.content).metadata();
    expect(big.mimeType).toBe('image/webp');
    expect([bigMeta.width, bigMeta.height]).toEqual([
      THUMBNAIL_MAX_SIDE,
      THUMBNAIL_MAX_SIDE / 2,
    ]);

    const small = await processor.createThumbnail(
      await image(100, 50).png().toBuffer(),
    );
    const smallMeta = await sharp(small.content).metadata();
    expect([smallMeta.width, smallMeta.height]).toEqual([100, 50]);
  });

  it('la miniatura no conserva el EXIF (fecha, GPS, cámara)', async () => {
    const content = await image(50, 50)
      .withExif({ IFD0: { Make: 'Camara' } })
      .jpeg()
      .toBuffer();
    const thumbnail = await processor.createThumbnail(content);
    expect((await sharp(thumbnail.content).metadata()).exif).toBeUndefined();
  });
});
