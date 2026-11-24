import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight } from "@phosphor-icons/react";
import { SHARE_CODE_LENGTH, parseShareCode } from "@lexiro/contract";
import { Button, Field, Input, Sheet, type ActionStatus } from "design-kit";
import { errorMessage } from "@/data/api";
import { sharedSet } from "@/data/library";
import { keys, queryClient } from "@/data/queries";

/** Opens a set someone shared, from its code or a pasted link. */
export function JoinSheet({ open, onOpenChange, folder }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Query string naming the folder to add into, if any. */
  folder: string;
}) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open} title="用代碼加入">
      <JoinForm folder={folder} />
    </Sheet>
  );
}

function JoinForm({ folder }: { folder: string }) {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<ActionStatus>("idle");
  const submit = async () => {
    const code = parseShareCode(text);
    if (!code) return setError(`代碼是 ${SHARE_CODE_LENGTH} 個英數字，也可以貼上分享連結。`);
    setStatus("loading");
    try {
      await queryClient.fetchQuery({ queryKey: keys.shared(code), queryFn: () => sharedSet(code), staleTime: 0 });
      navigate(`/shared/${code}${folder}`);
    } catch (reason) {
      setError(errorMessage(reason));
      setStatus("idle");
    }
  };
  return (
    <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <Field error={error} label="分享代碼">
        {({ id, describedBy, invalid }) => (
          <Input
            aria-describedby={describedBy}
            aria-invalid={invalid}
            autoCapitalize="none"
            autoComplete="off"
            autoFocus
            className={text.length > SHARE_CODE_LENGTH + 2 ? "font-latin" : "font-latin text-lg uppercase tracking-[0.2em]"}
            id={id}
            onChange={(event) => { setText(event.target.value); setError(""); }}
            onPaste={(event) => {
              const code = parseShareCode(event.clipboardData.getData("text"));
              if (!code) return;
              event.preventDefault();
              setText(code);
              setError("");
            }}
            placeholder="ABCD2345"
            spellCheck={false}
            value={text}
          />
        )}
      </Field>
      <Button className="justify-self-start" disabled={!text.trim()} size="lg" status={status} type="submit" variant="primary"><ArrowRight weight="bold" />查看單字集</Button>
    </form>
  );
}
