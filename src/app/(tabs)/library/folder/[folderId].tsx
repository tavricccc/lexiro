import { useLocalSearchParams } from "expo-router";

import { LibraryBrowser } from "@/components/library/library-browser";

export default function FolderScreen() {
  const { folderId = "" } = useLocalSearchParams<{ folderId: string }>();
  return <LibraryBrowser folderId={folderId} />;
}
