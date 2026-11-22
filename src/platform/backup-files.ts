import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { calendarDay } from "@/core/contract";

/** Writes a JSON backup to cache and opens the native share sheet (Files, AirDrop, etc.). */
export async function exportBackupFile(backup: unknown): Promise<void> {
  const filename = `lexiro-${calendarDay(new Date())}.json`;
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(backup));
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/json",
    UTI: "public.json",
  });
}

/** Picks a Lexiro JSON backup file from Files; null if dismissed. */
export async function pickBackupFile(): Promise<{ name: string; data: unknown } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "public.json", "text/plain"],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const raw = await new File(asset.uri).text();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("這不是 Lexiro 的備份檔。");
  }
  return { name: asset.name, data };
}
