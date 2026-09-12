import { LIMITS } from "@lexiro/ai-contract";
import { t } from "./i18n";

/** Compress in the browser; the source image is never uploaded or persisted. */
export async function encodeWordPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/"))
    throw new Error(t("managed.imageInvalid"));
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(t("managed.imageInvalid"));
  });
  try {
    const scale = Math.min(
      1,
      LIMITS.imageEdge / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error(t("managed.imageInvalid"));
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", quality),
      );
      if (!blob || blob.type !== "image/webp")
        throw new Error(t("managed.imageInvalid"));
      if (blob.size > LIMITS.imageBytes) continue;
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error(t("managed.imageInvalid")));
        reader.readAsDataURL(blob);
      });
    }
    throw new Error(t("managed.imageTooLarge"));
  } finally {
    bitmap.close();
  }
}
