"use client";

import Link from "next/link";

import { QuestionList } from "@/components/questions/question-list";
import { BackControl } from "@/components/ui/back-control";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { t } from "@/lib/i18n";

/** The question bank is a destination in its own right, not a Library tab. */
export function QuestionBankPage() {
  return (
    <div>
      <PageHeader
        actions={
          <Button asChild className="text-primary" size="icon" variant="ghost">
            <Link
              aria-label={t("questions.generate")}
              href="/app/questions/generate"
            >
              <Icons.generate className="size-5" />
            </Link>
          </Button>
        }
        back={<BackControl href="/app/library" label={t("library.title")} />}
        title={t("questions.title")}
      />
      <QuestionList />
    </div>
  );
}
