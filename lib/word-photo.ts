import { LIMITS } from "@lexiro/ai-contract";
import { t } from "./i18n";

function loadPhoto(
  file: File,
): Promise<{ image: HTMLImageElement; url: string }> {
  return new Promise((resolve, reject) => {
    const image = document.createElement("img");
    const url = URL.createObjectURL(file);
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        URL.revokeObjectURL(url);
        reject(new Error(t("managed.imageInvalid")));
        return;
      }
      resolve({ image, url });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(t("managed.imageInvalid")));
    };
    image.src = url;
  });
}

async function isWebp(blob: Blob) {
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  return (
    bytes.length === 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}

async function encodeWebp(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  quality: number,
) {
  const native = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
  if (native?.type === "image/webp" && (await isWebp(native))) return native;

  const { encode } = await import("@jsquash/webp");
  const buffer = await encode(
    context.getImageData(0, 0, canvas.width, canvas.height),
    { quality: Math.round(quality * 100) },
  );
  return new Blob([buffer], { type: "image/webp" });
}

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error(t("managed.imageInvalid")));
    reader.readAsDataURL(blob);
  });
}

/** Compress in the browser; the source image is never uploaded or persisted. */
export async function encodeWordPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/"))
    throw new Error(t("managed.imageInvalid"));
  const { image, url } = await loadPhoto(file);
  try {
    const scale = Math.min(
      1,
      LIMITS.imageEdge / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error(t("managed.imageInvalid"));
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      const blob = await encodeWebp(context, canvas, quality);
      if (blob.size <= LIMITS.imageBytes) return readBlob(blob);
    }
    throw new Error(t("managed.imageTooLarge"));
  } finally {
    URL.revokeObjectURL(url);
  }
}
