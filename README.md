# Lexiro Worker

Lexiro 的獨立 private AI 後端，負責 Firebase 身分、模型生成、點數預留／結算、用量及管理。教材、詞義、練習與 Firestore 同步由公開前端處理。Prompt、schema 和供應商 key 留在此邊界。

## 請求流程

Firebase ID token／Origin → 輸入與模型驗證 → D1 預留 → Responses 串流 → 結算或 pending usage → 前端校對。管理員由 ADMIN_EMAILS 和 verified email 判定，沒有前端授權入口；管理修改帶閱讀 expected 版本。

## 本機

使用 PowerShell 7，配置 `.dev.vars` 後執行：

```powershell
npm ci
npm run db:migrate
npm run dev
```

本機 migration 只用 local D1。`npm run dev` 若使用真實 provider key，生成會消耗供應商用量；自動測試使用合成 provider。

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
```

## 文件

- [程式責任](structure.md)
- [公開端點與資料生命週期](docs/architecture.md)
- [設定、部署與維運](docs/deployment.md)
- [決策與驗收紀錄](docs/product-decisions.md)
- [Prompt 評測](docs/prompt-evaluation.md)

共用契約 2.1.0 來自 frontend packages/ai-contract，以 vendor tgz 固定。D1 目前 migration 至 0012；正式是否套齊以部署紀錄為準。Main push 會部署，普通本機檢查不會；本地通過不等於真實 Firebase／供應商、Cron 或 Cloudflare CPU 已驗收。
