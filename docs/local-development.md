# 本機開發

使用 Node.js 24，與 workflow 相同；依 lockfile 安裝。在 PowerShell 7 執行：

```powershell
npm ci
npm run dev
```

開啟 `http://localhost:3000/app`（學習工作區）；根路徑 `/` 會轉址到 `/app`。純本機模式先不建立 Firebase 環境設定；可建立教材、練習、編輯及備份。

## 開啟登入與同步

```powershell
Copy-Item .env.example .env.local
```

填真實 Firebase／Google client 值，再重啟 dev。若使用本機 emulator，設 `NEXT_PUBLIC_FIREBASE_EMULATOR_ENABLED=true`，自行啟動 Auth 9099；`npm run dev` 不會啟動它。專案目前沒有一鍵 emulator stack，勿把 Novae 的 `test:env` 用在這裡。

## Agent Worker

在同層的 private `lexiro-worker` 使用自己的 lockfile、`.dev.vars` 和本機 D1：

```powershell
Set-Location ../lexiro-worker
npm ci
npm run db:migrate:agent
npm run db:migrate:cloud
npm run dev:agent
```

前端 `NEXT_PUBLIC_AGENT_WORKER_URL` 與 Wrangler port 一致（`dev:agent` 用 8791）；Worker 的 `APP_ORIGIN`（`wrangler.agent-local.toml` 預設 `http://localhost:3601`）要改成實際開啟的前端 origin（如 `http://localhost:3000`），可在 `.dev.vars` 覆寫。Agent 自行產生教材，Worker 不安裝模型供應商 key。

## Production PWA

```powershell
npm run build
npm run start
```

Production 才註冊 Service Worker。檢查安裝、離線重開、網路恢復不刷新、等待更新與保存後重啟。登入請求／跨來源資料不進 runtime cache。`npm run dev`（Vite dev server，port 3000）不建 Service Worker，不以它證明離線或 production cache 行為。

動態 token 來自 `config/motion.config.json`，改後跑 `npm run generate:motion` 並提交生成檔。Domain／schema 修改按[資料文件](data-and-sync.md)更新版號；UI 依 DESIGN 和[設計系統](design-system.md)維護。
