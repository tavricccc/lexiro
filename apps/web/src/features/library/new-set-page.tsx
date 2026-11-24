import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "design-kit";
import { errorMessage } from "@/data/api";
import { createSet } from "@/data/library";
import { useLibrary } from "@/data/queries";
import { useOnline } from "@/ui/offline-banner";
import { Page } from "@/ui/page";
import { SetForm, type SetFormValue } from "./set-form";

export default function NewSetPage() {
  const [params] = useSearchParams();
  const library = useLibrary();
  const navigate = useNavigate();
  const online = useOnline();
  const initialFolder = params.get("folder");
  const [value, setValue] = useState<SetFormValue>({ name: "", folderId: initialFolder, hue: "mint", icon: "books" });
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const submit = async () => {
    if (!value.name.trim()) return setError("請輸入名稱");
    setStatus("loading");
    try {
      const set = await createSet({ ...value, name: value.name.trim() });
      navigate(`/app/sets/${set.id}`, { replace: true });
    } catch (reason) {
      setError(errorMessage(reason));
      setStatus("idle");
    }
  };
  return (
    <Page
      back={initialFolder ? { href: `/app/library/folder/${initialFolder}`, label: "回到資料夾" } : { href: "/app/library", label: "回到我的單字" }}
      title="新增單字集"
    >
      <form className="grid gap-8" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <SetForm error={error} folders={library.data?.folders ?? []} onChange={(next) => { setValue(next); setError(""); }} online={online} value={value} />
        <Button className="justify-self-start" disabled={!online} size="lg" status={status} type="submit" variant="primary">建立</Button>
      </form>
    </Page>
  );
}
