import { LIMITS } from "@lexiro/ai-contract";
import { t } from "./i18n";

function loadPhoto(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = document.createElement("img");
    const url = URL.createObjectURL(file);
    const finish = () => URL.revokeObjectURL(url);
    image.onload = () => {
      finish();
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error(t("managed.imageInvalid")));
        return;
      }
      resolve(image);
    };
    image.onerror = () => {
      finish();
      reject(new Error(t("managed.imageInvalid")));
    };
    image.src = url;
  });
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
  const image = await loadPhoto(file);
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
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.type !== "image/jpeg")
      throw new Error(t("managed.imageInvalid"));
    if (blob.size <= LIMITS.imageBytes) return readBlob(blob);
  }
  throw new Error(t("managed.imageTooLarge"));
}
