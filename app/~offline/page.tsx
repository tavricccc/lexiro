import Link from "next/link";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <section className="max-w-md text-center">
        <Image className="mx-auto mb-8 size-20 rounded-3xl" src="/icons/lexiro.png" width={80} height={80} alt="" />
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">{t("offline.title")}</h1>
        <p className="mt-3 text-ink-muted">{t("offline.description")}</p>
        <Button asChild className="mt-7">
          <Link href="/">{t("offline.action")}</Link>
        </Button>
      </section>
    </main>
  );
}
