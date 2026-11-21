import type { Prefs } from "@lexiro/contract";
import { toast } from "sonner";
import { ListGroup, ListRow, Segmented, Switch } from "design-kit";
import { errorMessage } from "@/data/api";
import { savePrefs } from "@/data/prefs";
import { usePrefs } from "@/data/queries";
import { useOnline } from "@/ui/offline-banner";
import { Loaded, Page } from "@/ui/page";

const SIZES = ["10", "20", "30", "50"] as const;

export default function PreferencesPage() {
  const prefs = usePrefs();
  const online = useOnline();
  const save = (change: Partial<Prefs>) => savePrefs(change).catch((error) => toast.error(errorMessage(error)));
  return (
    <Page back={{ href: "/app/me", label: "我" }} description={online ? "設定隨帳號同步至所有裝置。" : "離線時無法修改設定。"} kicker="ME // PREFERENCES" title="偏好設定" width="narrow">
      <Loaded query={prefs}>
        {(value) => (
          <div className="grid gap-6">
            <ListGroup title="01 // 外觀">
              <ListRow
                label="主題"
                trailing={<Segmented label="主題" onChange={(theme) => void save({ theme })} options={[{ label: "系統", value: "system" }, { label: "淺色", value: "light" }, { label: "深色", value: "dark" }]} value={value.theme} />}
              />
            </ListGroup>
            <ListGroup footer="從練習頁開始時預設的題數，開始前仍可調整。" title="02 // 練習">
              <ListRow
                label="每輪題數"
                trailing={<Segmented label="每輪題數" onChange={(size) => void save({ practiceSize: Number(size) })} options={SIZES.map((size) => ({ label: size, value: size }))} value={SIZES.find((size) => Number(size) === value.practiceSize) ?? "20"} />}
              />
            </ListGroup>
            <ListGroup title="03 // 單字集">
              <ListRow
                detail="關掉後可以先自己想意思"
                label="在列表顯示中文意思"
                trailing={<Switch aria-label="在列表顯示中文意思" checked={value.showMeanings} disabled={!online} onCheckedChange={(showMeanings) => void save({ showMeanings })} />}
              />
            </ListGroup>
          </div>
        )}
      </Loaded>
    </Page>
  );
}
