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
| 模型選取、可視化 | **Pearson / SelectKBest / RFE / Forward SFS / Lasso** 五條 Test RMSE / R² 曲線，另外標記 LassoCV 原生收縮模型；係數、VIF、殘差、即時預測 |
| 可複現結果 | 80/20 split、NumPy MT19937 `random_state=42`，同 Python `train_test_split(..., random_state=42, test_size=.2)`；train-only CV 選特徵 |

## 開啟與操作

1. 直接開啟 `index.html`。網頁使用隨附的 `data.js` 內建資料集，所以離線也能運作。
2. 「題目 / Problem」選 `50 Startups` 或 `Boston Housing`。
3. 兩個圖表會同時呈現五種特徵選取法的 RMSE 和 R² 軌跡；金色星號是原生 LassoCV 的結果。
4. 在「查看特徵選取方法」選擇其中一種方法，配合「檢視特徵數 k」，觀察 RMSE、R²、迴歸係數及測試集殘差的變化。重新載入 CSV 後會重新計算五種方法。
5. 在「即時輸入，模擬預測」修改自變數數值，預測結果即時更新。
6. 額外加分：在「匯入自訂資料」選擇電腦中的 `.csv`；或貼上公開 CSV 網址按「載入 URL」。在目標欄位選單中決定要預測哪個數值欄位。
7. 按「匯出預測 CSV」或「匯出分析報告 JSON」保存本次模型與獨立測試集結果。

**自訂 CSV 格式：** 第一列為不重複欄位名稱，至少 20 筆有效數據、至少一個數值特徵和一個數值預測目標。數值欄位支援小數與負數，類別欄位 2–10 種類別時以 one-hot 編碼。缺值樣本會被剔除並顯示筆數；編碼後最多支援 15 個特徵。遠端 CSV 必須由伺服器允許瀏覽器跨來源讀取（CORS）；不允許時請先下載再使用檔案上傳。

## 分析方法

**1. 資料理解與整理：** 讀取 CSV、選數值目標、自動辨認數值與類別特徵、將類別展開為 one-hot 編碼（刪除基準組，避免 dummy-variable trap）；剔除不完整資料列。

**2. 訓練測試分割：** 採用 NumPy `RandomState` 相容的 MT19937、固定種子 42 洗牌，`test_size=0.2` 向上取整。這與 Python scikit-learn `train_test_split(..., test_size=0.2, random_state=42)` 產生相同的測試列順序。50 Startups 的測試樣本原始資料列索引（0-based）為 `[13,39,30,45,17,48,26,25,32,19]`。五種方法都用此一切分。

**3. 多元線性回歸：** 使用 OLS（ordinary least squares），在訓練資料內中心化、標準化後，以 QR 正交化解最小平方法，再把係數轉回原始單位。這能提高含不同量級特徵（例如大筆研發預算）的數值穩定性。

**4. 特徵選擇：**

- `Pearson (Filter)`：將訓練集各特徵與目標的絕對 Pearson 相關性由高至低排序。
- `SelectKBest (Filter)`：用單變數線性迴歸 F-score `r²/(1-r²) × (n−2)` 選取特徵。對一維連續目標，F-score 與絕對 Pearson 相關係數的排名相同，因此兩線可能重疊。
- `RFE (Wrapper)`：在標準化特徵上擬合 OLS，依係數絕對值遞迴刪除較弱特徵，直到剩下 k 個；再用原始訓練資料重新擬合 k 特徵 OLS。
- `Forward SFS (Wrapper)`：從空特徵集逐一加入能使訓練集 **5-fold CV RMSE** 最低的特徵；重擬合 OLS 並在同一測試集評分。
- `Lasso (Embedded)`：在訓練集上以座標下降法求 L1 正則化 Lasso，使用訓練集 CV 選 alpha；依標準化的 Lasso 非零係數及重要程度排序，再用選中的 k 個特徵重新擬合 OLS。
- `★ LassoCV Native Shrinkage`：星號另外呈現選定 alpha 的**原生 Lasso 模型**（保持 L1 收縮係數直接預測），與前述五條「OLS 重擬合」折線不同，可能落在不同高度。

**5. 決定 k 與測試：** 各演算法依自身訓練集 CV RMSE 選擇 k（同分偏好較少特徵），再獨立觀察 holdout test 的 `RMSE` / `MAE` / `R²`。五條線比較同一份測試集；星號另使用 L1 shrinkage 模型。

**6. 解釋與部署：** 顯示 `ŷ = β₀ + Σβᵢxᵢ`、VIF、多筆測試殘差以及即時預測；用完全靜態 GitHub Pages 即可部署。

### 指標

- **RMSE** = `sqrt(mean((y_true - y_pred)^2))`，較低較好。
- **MAE** = `mean(abs(y_true - y_pred))`，較低較好。
- **R²** = `1 - SSE / SST`，測試集可能為負數；較高通常較好。
- **VIF** = `1 / (1 - R_j²)`，協助辨識多重共線性。若接近無限大，模型存在高度共線性。

### 重要限制

- 50 Startups 只有 50 筆資料，測試集只有 10 筆，換 random seed 將可能造成明顯分數差異。**修正為 NumPy MT19937 之後，本次單特徵 R&D 模型的測試集 RMSE=7,714.3349、R²=0.9265108，與教師截圖吻合。** 個別 CV 選 k、LassoCV alpha 與套件版本仍可能略有差異。
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

驗證包含：CSV 引號、內建資料集筆數、OLS 合成資料精確還原、NumPy RandomState 42 測試列完全比對、五種特徵選取在兩套資料集的有限分數、LassoCV L1 原生模型及與教授 k=1～3 數值比對。

## GitHub Pages 部署（選擇性）

專案已發佈於 [GitHub Repository](https://github.com/prometheans152/AIoT-DIC2-MultipleLR)，自動工作流程位於 `.github/workflows/pages.yml`。正式操作網站為 [GitHub Pages](https://prometheans152.github.io/AIoT-DIC2-MultipleLR/)。如需離線檢查，直接雙擊 `index.html` 即可操作。

**注意：** 本作業以專屬 DIC2 Repository 獨立部署，不修改其他課程或 TW01 專案。GitHub Pages 部署完成不代表 LMS 已正式繳交。
