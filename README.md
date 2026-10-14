# Regression Analytics Studio

互動式多元線性回歸與特徵選取分析平台。支援 50 Startups、Boston Housing 和自訂 CSV 資料集，可在瀏覽器直接進行模型評估、特徵比較、殘差檢查與即時預測。

**線上平台：** [開啟 Regression Analytics Studio](https://prometheans152.github.io/AIoT-DIC2-MultipleLR/)

系統採用 HTML、CSS、JavaScript，所有回歸運算在瀏覽器本機執行，不需要伺服器、API 金鑰或登入。亦可解壓縮檔案後直接開啟 `index.html` 使用。

## 功能

| 功能 | 內容 |
|---|---|
| 內建資料集 | 50 Startups：預測 `Profit`；Boston Housing：預測 `medv` |
| 自訂資料分析 | 上傳 CSV 或載入支援 CORS 的公開 CSV URL，並選取數值型目標欄位 |
| 基準回歸分析 | 使用固定資料切分，逐步增加特徵數 `k`，顯示 RMSE 與 R² 的單條曲線及完整數值表 |
| 特徵選取演算法 | Pearson、SelectKBest、RFE、Forward SFS、Lasso |
| 模型比較 | 比較不同演算法與 `k` 的 RMSE、R²、CV RMSE、MAE |
| LassoCV | 以金色星號獨立呈現原生 L1 收縮模型的指標 |
| 模型診斷 | 顯示回歸方程式、係數、VIF、實際值與預測值散佈圖、測試殘差 |
| 互動操作 | 點選曲線圓點顯示精確指標、特徵清單並同步反白表格；支援鍵盤 Tab、Enter、空白鍵 |
| 輸出 | 下載測試集預測 CSV 與包含模型設定、係數及評估結果的 JSON 報告 |

## 使用方式

1. 在「資料集與模型設定」選擇 50 Startups、Boston Housing 或載入自訂 CSV。
2. 在「基準分析」查看兩張互動式曲線圖。點選任一圓點，可檢視該 `k` 的 RMSE、R² 及完整特徵清單。
3. 在「五種特徵選取演算法比較」切換方法與特徵數，觀察 CV 分數、測試集誤差和係數變化。多條線重疊時，可透過圖例選擇方法。
4. 在「即時預測」修改自變數數值，使用目前選定的 OLS 模型即時估計。
5. 可將預測結果與分析報告匯出，方便保留及檢查。

**自訂 CSV 格式：** 第一列為不重複的欄位名稱，需至少 20 筆有效數據、至少一個數值特徵和一個數值目標。數值欄位支援小數與負數；類別欄位若包含 2～10 種類別，會使用 One-hot 編碼；含缺值的資料列會剔除並顯示筆數。編碼後最多支援 15 個特徵。公開 CSV URL 需允許跨來源瀏覽器請求（CORS）。

## 分析方法

### 基準回歸

以 OLS 線性回歸和 80/20 訓練測試切分進行特徵數量比較，固定使用 `random_state=0`（NumPy `RandomState` 相容的 MT19937）。

50 Startups 的基準模型依序加入 `R&D Spend`、`Marketing Spend`、`State_New York`、`State_Florida`、`Administration`，重新擬合並取得：

| 特徵數 k | Test RMSE | Test R² |
|---:|---:|---:|
| 1 | 8274.868018 | 0.946459 |
| 2 | 8198.797191 | 0.947439 |
| 3 | 8309.059683 | 0.946015 |
| 4 | 8409.916714 | 0.944697 |
| 5 | 9137.990153 | 0.934707 |

為避免完全共線性，在含有截距、`State_New York` 與 `State_Florida` 時，`State_California` 不會再作為獨立特徵加入；第五個特徵改用 `Administration`。

### 多方法比較

進階比較固定使用 `random_state=42`，讓五種方法共用同一份測試集。模型選擇只使用訓練資料的交叉驗證結果；測試集保留供獨立評估。這項切分與基準分析不同，**兩組指標不適合直接比較**。

- **Pearson**：按目標變數與特徵的絕對相關係數排序。
- **SelectKBest**：以單變數 F 統計量選取特徵。
- **RFE**：使用標準化線性回歸係數遞迴排除特徵。
- **Forward SFS**：依訓練集 CV RMSE 逐次新增特徵。
- **Lasso**：以 L1 正則化的係數篩選及排序特徵。
- **LassoCV Native**：保留原生 L1 收縮係數直接預測，因此與特徵選取後重新擬合 OLS 的折線屬不同估計模型。

RMSE = `sqrt(mean((y_true-y_pred)^2))`，MAE = `mean(abs(y_true-y_pred))`，R² = `1 - SSE/SST`，VIF = `1/(1-R_j²)`。

## 資料與限制

資料來源：

- [50 Startups CSV](https://raw.githubusercontent.com/Avik-Jain/100-Days-Of-ML-Code/master/datasets/50_Startups.csv)
- [Boston Housing CSV](https://raw.githubusercontent.com/selva86/datasets/master/BostonHousing.csv)

50 Startups 僅有 50 筆資料，測試集結果可能對切分種子敏感。模型係數不代表因果關係。Boston Housing 是歷史性資料，包含敏感人口統計代理欄位 `b`，不應直接用於現代房價或決策服務。

## 測試與部署

網站不需要任何 Node.js 依賴；以下指令只在開發時執行自動化測試：

```powershell
npm install
npm run test:all
```

- `tests/regression.test.cjs`：OLS、資料切分、特徵選取、雙資料集模型運算及數值重現性。
- `tests/chart-interaction.test.cjs`：曲線點擊、表格連動、鍵盤操作、方法切換、LassoCV 與切換資料集後的互動驗證。

靜態網站使用 `.github/workflows/pages.yml` 在 GitHub Pages 自動部署。
