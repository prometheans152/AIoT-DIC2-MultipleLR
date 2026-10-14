# DIC2 — Multiple Linear Regression & Feature Selection Lab

**課程：** 國立中興大學「物聯網應用與資料分析」／DIC2 多元線性回歸 50 Startups and Boston Housing  
**作業：** 兩個 problem 都實作；以 **50 Startups** 為主要展示題目，Boston Housing 以同一套 workflow 切換。  
**正式入口：** <https://prometheans152.github.io/AIoT-DIC2-MultipleLR/>。也可以雙擊 `index.html` 離線操作。

**兩個實驗必須分開：** LMS 作業原始截圖的單條藍線用 `random_state=0`，另一張五演算法對照圖用 `random_state=42`。本網站把標準主圖放在上方，將五演算法作為進階分析保留在下方。

## 與 LMS 作業要求對照

| 要求 | 本作業對應 |
|---|---|
| 50 Startups 多元線性回歸 | 內建資料集，預測 `Profit`，包含 `R&D Spend`、`Administration`、`Marketing Spend` 和 `State` 編碼欄位 |
| Boston Housing 套用相同 skill / workflow | 下拉選單切換至 Boston Housing，預測 `medv`，所有結果重新計算 |
| 加 1 分：下拉視窗呈現兩個問題 | 頁面第一區的 Problem 下拉選單 |
| 加 2 分：任意輸入資料集 | 支援本機 CSV 上傳，以及允許 CORS 的公開 CSV URL 載入，且可自由選擇數值型 Y 欄位 |
| LMS 作業標準圖 | 主畫面兩張**單條藍色折線**，RMSE／R² 曲線和下方逐 k 數值表格重算自 `random_state=0` |
| 延伸模型比較 | **Pearson / SelectKBest / RFE / Forward SFS / Lasso** 五條 Test RMSE / R² 曲線，另標記 LassoCV 原生收縮模型，使用 `random_state=42` |
| 可複現結果 | 80/20 split，NumPy MT19937 與 Python scikit-learn `train_test_split` 相容；兩個實驗各自固定 seed |

## LMS 作業原圖：完整驗算（seed=0）

下表不是抄入網站的固定成績；每個數值都由程式在同一份 `50_Startups.csv` 重新擬合與獨立測試算出，精度到小數第六位。

| k | 真正加入 OLS 的新特徵 | RMSE | R-squared |
|---|---|---:|---:|
| 1 | R&D Spend | 8274.868018 | 0.946459 |
| 2 | Marketing Spend | 8198.797191 | 0.947439 |
| 3 | State_New York | 8309.059683 | 0.946015 |
| 4 | State_Florida | 8409.916714 | 0.944697 |
| 5 | Administration | 9137.990153 | 0.934707 |

**原始圖片的 k=5 標籤與運算結果不一致：** LMS 圖片最後一欄標示 `State_California`，但包含截距、`State_New York` 與 `State_Florida` 時，加上 `State_California` 只是完全共線的冗餘欄位，OLS 測試集的分數不會改變。使用 scikit-learn 驗算確認，**第五欄加入 `Administration` 才會得到 9137.990153**。網站以實際模型輸入顯示 `Administration`，並明確標註截圖中的差異，不使用誤導性的欄位名稱。

## 開啟與操作

1. 直接開啟 `index.html`。網頁使用隨附的 `data.js` 內建資料集，所以離線也能運作。
2. 「題目 / Problem」選 `50 Startups` 或 `Boston Housing`。
3. 優先查看**「課堂標準結果：RMSE 與 R-squared」**：兩張單折線圖和下方 k=1～5 數值表格，這才是 LMS 原始作業截圖所顯示的主要結果。
4. 下方「延伸分析：五種特徵選取演算法」是另外一張課堂進階圖，金色星號代表原生 LassoCV。可以選擇方法與 k，比較係數和測試集殘差；此區使用不同 random seed。
   - **圖表可以點選**：點擊 LMS 圖上任一藍色圓點，即會反白相同 k 的兩張圖與表格列，並顯示 RMSE、R² 和特徵清單。
   - **進階圖也可以點選**：點選任一演算法的資料點，會連動下拉選單切換方法和 k；若多條曲線重疊，可先點圖例指定演算法。點擊金色星號會獨立顯示 LassoCV 原生 L1 的數值，不會把它錯當成 OLS 指標。
   - 所有可點選的圖上資料點支援鍵盤 **Tab → Enter / 空白鍵**，也提供較大的滑鼠與觸控點擊範圍。
5. 在「即時輸入，模擬預測」修改自變數數值，預測結果即時更新。
6. 額外加分：在「匯入自訂資料」選擇電腦中的 `.csv`；或貼上公開 CSV 網址按「載入 URL」。在目標欄位選單中決定要預測哪個數值欄位。
7. 按「匯出預測 CSV」或「匯出分析報告 JSON」保存本次模型與獨立測試集結果。

**自訂 CSV 格式：** 第一列為不重複欄位名稱，至少 20 筆有效數據、至少一個數值特徵和一個數值預測目標。數值欄位支援小數與負數，類別欄位 2–10 種類別時以 one-hot 編碼。缺值樣本會被剔除並顯示筆數；編碼後最多支援 15 個特徵。遠端 CSV 必須由伺服器允許瀏覽器跨來源讀取（CORS）；不允許時請先下載再使用檔案上傳。

## 分析方法

**1. 資料理解與整理：** 讀取 CSV、選數值目標、自動辨認數值與類別特徵、將類別展開為 one-hot 編碼（刪除基準組，避免 dummy-variable trap）；剔除不完整資料列。

**2. 訓練測試分割：** 採用 NumPy `RandomState` 相容的 MT19937、`test_size=0.2` 向上取整。LMS 原始單曲線模式 seed=0，50 Startups 測試列索引（0-based）為 `[28,11,10,41,2,27,38,31,22,4]`；五方法延伸模式 seed=42，測試列索引為 `[13,39,30,45,17,48,26,25,32,19]`。兩個實驗都可由 scikit-learn 完整重現，但不能直接交叉比較分數。

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

- 50 Startups 只有 50 筆資料，測試集只有 10 筆，因此 random seed 改變會造成明顯分數差異：**LMS 原圖 seed=0 的 k=1 為 RMSE=8274.868018、R²=0.946459；進階圖 seed=42 的 k=1 則是 RMSE=7714.334891、R²=0.926511。兩者都正確，但不可混在同一條曲線。** LassoCV alpha 與交叉驗證設定仍可能因版本差異而不同。
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

驗證包含：CSV 引號、內建資料集筆數、OLS 合成資料精確還原、NumPy RandomState 0/42 測試列比對、**LMS 原圖 RMSE 與 R² 的五個數值全部六位小數精確匹配**、五種進階選取法、Boston Housing、LassoCV 原生模型。

可選的互動驗收（需 Node.js 20+；`jsdom` 僅用於測試，不是網站執行依賴）：

```powershell
npm install
npm run test:ui
```

此測試驗證 LMS RMSE/R² 點選、表格反白、鍵盤 Enter/空白鍵、五演算法點選、重疊曲線圖例、LassoCV 星號，以及切換 Boston Housing 後仍能點選。

## GitHub Pages 部署（選擇性）

專案已發佈於 [GitHub Repository](https://github.com/prometheans152/AIoT-DIC2-MultipleLR)，自動工作流程位於 `.github/workflows/pages.yml`。正式操作網站為 [GitHub Pages](https://prometheans152.github.io/AIoT-DIC2-MultipleLR/)。如需離線檢查，直接雙擊 `index.html` 即可操作。

**注意：** 本作業以專屬 DIC2 Repository 獨立部署，不修改其他課程或 TW01 專案。GitHub Pages 部署完成不代表 LMS 已正式繳交。
