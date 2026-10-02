"use client";

import { useRef } from "react";
import { Input } from "./input";
import { Button } from "./button";
import { Icons } from "./icons";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

export function SearchField({
  label,
  value,
  onValueChange,
  className,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const clear = () => {
    onValueChange("");
    input.current?.focus();
  };
  return (
    <div className={cn("relative", className)}>
      <Icons.search
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        ref={input}
        aria-label={label}
        placeholder={label}
        className="pl-10 pr-12 [&::-webkit-search-cancel-button]:appearance-none"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === "Escape" &&
            value &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            event.stopPropagation();
            clear();
          }
        }}
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 size-11"
          aria-label={t("common.clearSearch")}
          onClick={clear}
        >
          <Icons.cancel />
        </Button>
      )}
    </div>
  );
}
