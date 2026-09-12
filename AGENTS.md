# Lexiro — 修改本專案前必讀

先讀本檔，再讀 `structure.md`（檔案地圖，說明每個檔案負責什麼）。
不要為了找東西大規模掃描 repo；先查 `structure.md`，搜尋時避開 `node_modules/`、`.next/`、`dev-dist/`、`output/`、`artifacts/`、`src/generated/`。

## 一、絕對規則

1. **不做 fallback、不做相容舊代碼、不做防禦性編程。** 一步到位。遷移只在我明講時做一次。
2. **舊流程換新流程後，把舊的 API、props、CSS、轉場、註解、環境變數全部刪掉。** 不留死程式碼、不留「以防萬一」的分支。
3. **不建 PR、不開 branch**，除非我明講。我說 push 就直接 commit and push 到當前分支。
4. **不覆蓋、不回復工作樹裡跟本次任務無關的變更。**
5. **不改路由名、IndexedDB store 名、Firestore 欄位名、部署設定**，即使是重構。
6. **保留 Lexiro 自己的名稱、圖示與森林墨綠品牌。** 它跟 Novae 共用前端手法，不共用身分。
7. **持久化結構改變要有明確的 migration 與版號。** `structure.md` 末尾那張版本表是唯一清單，改了就更新它。
8. 新增／刪除／搬移／拆分檔案時，**同步更新 `structure.md`**。

## 二、東西放哪

| 要寫的東西 | 放這裡 | 規則 |
|---|---|---|
| 路由頁面 | `app/<route>/page.tsx` | 只組裝畫面。預設 Server Component，需要瀏覽器狀態或互動才加 `"use client"` |
| 有業務語意的元件 | `components/<domain>/` | 資料透過 store 或 hook 拿 |
| 無業務邏輯的共用元件 | `components/ui/` | 純視覺。不可 import `stores/`、`src/lib/` 的領域邏輯 |
| 動畫元件與 route surface | `components/motion/` | |
| 前端狀態 | `stores/*-store.ts` | Zustand。非同步伺服器狀態用 TanStack Query |
| 前端小工具、文案 | `lib/` | 不可 import `@/components`、`@/app` |
| 領域邏輯、持久化、Firebase、匯入匯出 | `src/lib/` | 不可 import `react`、`@/components`、`@/app`、`@/stores` |
| 固定常數 | `src/constants/` | |
| 跨模組共用型別 | `src/types/` | 只被一個模組用的型別就留在該模組 |
| 文案 | `lib/i18n.ts` | 所有使用者看得到的字都在這裡，不要散落在元件裡 |
| 設計 token、版面 | `app/globals.css` | 顏色／圓角／陰影一律用 token，不寫死色碼；尺寸用 rem |
| 動畫 recipe | `app/styles/motion.css` | 時長與曲線一律用 ladder token，不寫死；`:hover` 必須包在 `@media (hover: hover)` 內 |
| 動畫時長與曲線本身 | `config/motion.config.json` | 唯一來源，CSS 與 JS 都從這裡產生；JS 動畫一律透過 `lib/motion-timing.ts` 的 `timing()` 取用 |
| 圖示 | `components/ui/icons.ts` | 功能元件一律從 `Icons` 這張概念對照表取用，不直接 import `lucide-react` 的圖示；`components/ui/` 的控制項自己的符號（勾、箭頭）和 `LucideIcon` 型別不在此限 |

### 設定改了要重跑產生器

`config/motion.config.json` 是 `src/generated/motion-ladder.css` 與 `src/generated/motion-tokens.ts` 的唯一來源。**不要手改產出檔**，改完跑：

```bash
npm run generate:motion
```

產出檔要一起 commit。

### 資料與雲端

- Library 只由 `src/lib/library-repository.ts` 寫入，內容定址 + manifest + head pointer，細節見 `structure.md`。
- 同步的單位是 record，不是整個 Library。刪除是雲端陳述的事實（`deleted` 旗標），不是下一台裝置要自己推斷的缺席。
- AI 使用 managed Worker；供應商金鑰、prompt、模型設定與計費在 private `lexiro-worker`，前端不保存或同步舊 AI 設定。
- Firestore 規則與索引在 `firestore.rules`、`firestore.indexes.json`，隨部署發布。

### 文件

| 內容 | 放這裡 |
|---|---|
| 檔案地圖 | `structure.md` |
| 產品範圍與決策 | `PRODUCT.md`、`docs/product-decisions.md` |
| 設計系統、動畫、token 規則 | `docs/design-system.md` |
| AI 介接與題目品質 | `docs/ai-api.md`、`docs/prompt-evaluation.md` |
| 部署與 secrets | `docs/deployment.md` |

不要新增一次性的 `handoff.md`／`IMPLEMENTATION.md` 這類進度檔，會過期誤導後續 agent。

## 三、依賴方向

```
app / components  →  stores  →  src/lib
       ↓                ↓          ↓
      ui              lib      src/constants, src/types
```

箭頭反向就是錯的。`src/lib` 不含 React；`lib/` 與 `components/ui/` 不認識業務資料。

## 四、拆分與共用

- **相同 UI／流程出現兩次就抽共用**，差異只有 props／slots／callback。返回鍵、頁首、空狀態都已經是共用件，不要再手寫第二份。
- **不要**為只有一個呼叫點的簡單片段建抽象。
- React 元件 **超過 400 行不可接受**；接近 350 行就先拆功能區塊或把可複用邏輯搬走。
- 有成熟的免費現成元件就優先用，不要自己重造。
- 桌機與手機能做的事必須一樣多，只有外殼可以不同。沒有哪一邊是次要的。

## 五、測試放哪

| 要驗證的東西 | 放這裡 |
|---|---|
| 純函式、領域邏輯、持久化、同步、題目組裝 | `tests-next/*.test.ts` |
| 元件實際行為（選取、鍵盤、導覽） | `tests-next/*.test.tsx` |

Vitest + jsdom，全部跑在 `tests-next/`。

**測試只斷言可觀察行為**：回傳值、DOM、儲存狀態。
**禁止** `expect(source).toContain("某段原始碼")` 這種比對實作字串的寫法——它抓不到 bug，只會在你改實作時假性失敗。

## 六、安全

- Firestore 規則是唯一的權限邊界，前端只負責顯示。前端擋不住的東西規則一定要擋。
- record id 的形狀由 `canonicalHash` 決定，`firestore.rules` 依賴它，不要改雜湊定義。
- 不要把 service account 或任何 secret 寫進 repo；部署 secrets 全在 GitHub Environment，清單見 `docs/deployment.md`。

## 七、驗證

**每次改動後，這四個都要跑：**

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

`npm run format` 只覆蓋 `stores/` 與 `src/lib/`，其餘檔案維持既有風格。

失敗與 warning 能修就修，修不掉要在回報裡說明原因。

## 八、程式風格

代碼追求簡潔、乾淨、好維護。不要打補丁式修改，以可復用為目標。嚴格型別，不用 `any`。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
