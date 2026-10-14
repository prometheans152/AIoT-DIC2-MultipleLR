# DIC2 — Multiple Linear Regression & Feature Selection Lab

**課程：** 國立中興大學「物聯網應用與資料分析」／DIC2 多元線性回歸 50 Startups and Boston Housing  
**作業：** 兩個 problem 都實作；以 **50 Startups** 為主要展示題目，Boston Housing 以同一套 workflow 切換。  
**入口：** `index.html`（用 Chrome/Edge 雙擊開啟，不需後端、不需 API key）。

## 與 LMS 作業要求對照

| 要求 | 本作業對應 |
|---|---|
| 50 Startups 多元線性回歸 | 內建資料集，預測 `Profit`，包含 `R&D Spend`、`Administration`、`Marketing Spend` 和 `State` 編碼欄位 |
| Boston Housing 套用相同 skill / workflow | 下拉選單切換至 Boston Housing，預測 `medv`，所有結果重新計算 |
| 加 1 分：下拉視窗呈現兩個問題 | 頁面第一區的 Problem 下拉選單 |
| 加 2 分：任意輸入資料集 | 支援本機 CSV 上傳，以及允許 CORS 的公開 CSV URL 載入，且可自由選擇數值型 Y 欄位 |
| 模型選取、可視化 | Forward SFS、Backward Elimination、Correlation Ranking；逐 k 的 CV RMSE / Test RMSE / R²；係數與 VIF、殘差、即時預測 |
| 可複現結果 | 隨機種子 `42`；先切訓練 80% / 測試 20%；只在訓練資料上進行 5-fold CV 選特徵 |

## 開啟與操作

1. 直接開啟 `index.html`。網頁使用隨附的 `data.js` 內建資料集，所以離線也能運作。
2. 「題目 / Problem」選 `50 Startups` 或 `Boston Housing`。
3. 「特徵選取方法」可以改為 Forward SFS、Backward Elimination 或 Correlation Ranking。按「執行」重新跑模型。
4. 在「檢視特徵數 k」選擇不同模型，觀察 RMSE、R²、回歸係數、測試集殘差如何改變。
5. 在「即時輸入，模擬預測」修改自變數數值，預測結果即時更新。
6. 額外加分：在「匯入自訂資料」選擇電腦中的 `.csv`；或貼上公開 CSV 網址按「載入 URL」。在目標欄位選單中決定要預測哪個數值欄位。
7. 按「匯出預測 CSV」或「匯出分析報告 JSON」保存本次模型與獨立測試集結果。

**自訂 CSV 格式：** 第一列為不重複欄位名稱，至少 20 筆有效數據、至少一個數值特徵和一個數值預測目標。數值欄位支援小數與負數，類別欄位 2–10 種類別時以 one-hot 編碼。缺值樣本會被剔除並顯示筆數；編碼後最多支援 15 個特徵。遠端 CSV 必須由伺服器允許瀏覽器跨來源讀取（CORS）；不允許時請先下載再使用檔案上傳。

## 分析方法

**1. 資料理解與整理：** 讀取 CSV、選數值目標、自動辨認數值與類別特徵、將類別展開為 one-hot 編碼（刪除基準組，避免 dummy-variable trap）；剔除不完整資料列。

**2. 訓練測試分割：** 使用固定種子 42 隨機打亂，約 80% train + 20% holdout test。不同演算法共用同一個切分，以利比較。

**3. 多元線性回歸：** 使用 OLS（ordinary least squares），在訓練資料內中心化、標準化後，以 QR 正交化解最小平方法，再把係數轉回原始單位。這能提高含不同量級特徵（例如大筆研發預算）的數值穩定性。

**4. 特徵選擇：**

- `Forward SFS`：起初沒有特徵，逐次新增使 **train-only 5-fold CV RMSE 最低**的特徵。
- `Backward Elimination`：起初全部特徵，逐次移除使 train-only CV RMSE 最低的特徵。
- `Correlation Ranking`：按訓練集與目標的絕對 Pearson 相關性排序（此法不處理特徵間冗餘，作為基準比較）。

**5. 決定 k 與測試：** 依訓練集 CV RMSE 選擇最佳特徵數 `k`（同分偏好更少特徵），之後才觀察 holdout test 的 `RMSE` / `MAE` / `R²`。圖表可檢查增加特徵時誤差可能上升的情形。

**6. 解釋與部署：** 顯示 `ŷ = β₀ + Σβᵢxᵢ`、VIF、多筆測試殘差以及即時預測；用完全靜態 GitHub Pages 即可部署。

### 指標

- **RMSE** = `sqrt(mean((y_true - y_pred)^2))`，較低較好。
- **MAE** = `mean(abs(y_true - y_pred))`，較低較好。
- **R²** = `1 - SSE / SST`，測試集可能為負數；較高通常較好。
- **VIF** = `1 / (1 - R_j²)`，協助辨識多重共線性。若接近無限大，模型存在高度共線性。

### 重要限制

- 50 Startups 只有 50 筆資料，測試集約 10 筆，換 random seed 將可能造成明顯分數差異，**請勿把教師範例中的特定分數當作固定答案**。
- Train-only CV 用於選擇特徵，仍可能有模型選擇偏差；本作業另保留獨立測試集，避免直接用 test 指標找最佳 k。
- Boston Housing 的 `medv` 是歷史性房價中位數，單位約為千美元；原始 `b` 欄位包含與種族相關的過時資料定義。此資料**僅作課堂方法示範，不適合作為現代房價服務的真實決策依據**。
- OLS 擬合不表示因果關係；自訂 CSV 可能有共線、異常值、類別過多、資料太少等問題，網頁會明確提示錯誤。

## 資料來源

- `data/50_Startups.csv`：<https://raw.githubusercontent.com/Avik-Jain/100-Days-Of-ML-Code/master/datasets/50_Startups.csv>
- `data/BostonHousing.csv`：<https://raw.githubusercontent.com/selva86/datasets/master/BostonHousing.csv>
- 老師提供的示例設計參考：<https://huanchen1107.github.io/AIoT-DIC2-MultipleLR/>

## 測試

在有 Node.js 的電腦執行：

```powershell
node tests/regression.test.cjs
```

驗證包含：CSV 引號與缺值、內建資料集筆數、OLS 合成資料精確還原、三種特徵選取在兩套真實資料集都產生有限的 RMSE、測試集不參與特徵選擇與固定種子重現性。

## GitHub Pages 部署（選擇性）

本資料夾已附 `.github/workflows/pages.yml`。把完整資料夾**內容**放到你自己的 GitHub repository 根目錄，並至 `Settings → Pages → Build and deployment → Source: GitHub Actions` 啟用。第一次 push 到 `main` 之後，網址為：`https://<你的帳號>.github.io/<repository>/`。如果不打算公開，也可以把本資料夾 ZIP 繳交 LMS，解壓後雙擊 `index.html` 即可驗收兩個問題與加分項。

**注意：** 本作業開發流程沒有自動 push、沒有上傳 GitHub，也不修改課程以外的其他專案。
