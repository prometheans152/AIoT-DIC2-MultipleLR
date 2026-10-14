/* DIC2: dependency-free, reproducible multiple linear regression engine.
 * Works in a browser (window.MLR) and in Node.js unit tests (module.exports).
 */
(function (root) {
  'use strict';

  function parseCSV(csv) {
    const text = String(csv || '').replace(/^\uFEFF/, '');
    const records = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (char === '"') quoted = false;
        else cell += char;
      } else if (char === '"') quoted = true;
      else if (char === ',') { row.push(cell.trim()); cell = ''; }
      else if (char === '\n' || char === '\r') {
        if (char === '\r' && text[i + 1] === '\n') i++;
        row.push(cell.trim()); cell = '';
        if (row.some(v => v !== '')) records.push(row);
        row = [];
      } else cell += char;
    }
    if (quoted) throw new Error('CSV 格式錯誤：引號沒有關閉');
    row.push(cell.trim());
    if (row.some(v => v !== '')) records.push(row);
    if (records.length < 4) throw new Error('CSV 至少需要標題列和 3 筆資料');
    const headers = records.shift().map((h, i) => h || `欄位${i + 1}`);
    if (new Set(headers).size !== headers.length) throw new Error('CSV 欄名不可重複');
    const rows = records.map(r => Object.fromEntries(headers.map((h, j) => [h, (r[j] || '').trim()])));
    return { headers, rows };
  }

  function num(v) {
    if (v === null || v === undefined || String(v).trim() === '') return NaN;
    const n = Number(String(v).replace(/,/g, ''));
    return Number.isFinite(n) ? n : NaN;
  }
  function mean(v) { return v.reduce((a, b) => a + b, 0) / v.length; }
  function sum(v) { return v.reduce((a, b) => a + b, 0); }
  function std(v) { const m = mean(v); return Math.sqrt(mean(v.map(x => (x - m) ** 2))); }
  function median(v) { const s = [...v].sort((a, b) => a - b); return (s[Math.floor((s.length - 1) / 2)] + s[Math.floor(s.length / 2)]) / 2; }
  function unique(v) { return [...new Set(v)]; }

  function describeColumns(parsed, targetName) {
    const columns = parsed.headers.map(name => {
      const values = parsed.rows.map(r => r[name]).filter(v => v !== '');
      const validNumbers = values.filter(v => Number.isFinite(num(v)));
      const levels = unique(values).sort();
      const numeric = values.length > 0 && validNumbers.length / values.length >= 0.95;
      return { name, numeric, levels, missing: parsed.rows.length - values.length,
        supported: numeric || (levels.length >= 2 && levels.length <= 10) };
    });
    const viableTargets = columns.filter(c => c.numeric).map(c => c.name);
    let suggested = viableTargets.find(x => /^profit$|^medv$|^price$|^target$|^y$/i.test(x));
    if (!suggested) suggested = viableTargets[viableTargets.length - 1];
    if (targetName && viableTargets.includes(targetName)) suggested = targetName;
    return { columns, viableTargets, suggested };
  }

  function prepareDataset(parsed, targetName) {
    const desc = describeColumns(parsed, targetName);
    const target = targetName || desc.suggested;
    if (!desc.viableTargets.includes(target)) throw new Error('請選擇數值型的預測目標欄位');
    const columns = desc.columns.filter(c => c.name !== target && c.supported);
    if (columns.length < 1) throw new Error('沒有可用的特徵欄位');
    const features = [];
    for (const c of columns) {
      if (c.numeric) {
        features.push({ name: c.name, source: c.name, kind: 'number' });
      } else {
        for (const level of c.levels.slice(1)) {
          features.push({ name: `${c.name}=${level}`, source: c.name,
            kind: 'dummy', level, reference: c.levels[0] });
        }
      }
    }
    if (features.length > 15) throw new Error(`編碼後有 ${features.length} 個特徵；目前最多支援 15 個，請簡化資料欄位`);
    const valid = [], dropped = [];
    for (let index = 0; index < parsed.rows.length; index++) {
      const original = parsed.rows[index];
      const y = num(original[target]);
      const ok = Number.isFinite(y) && columns.every(c => c.numeric
        ? Number.isFinite(num(original[c.name]))
        : c.levels.includes(original[c.name]));
      if (!ok) { dropped.push(index + 1); continue; }
      const x = features.map(f => f.kind === 'number' ? num(original[f.source])
        : Number(original[f.source] === f.level));
      valid.push({ id: index + 1, x, y, original });
    }
    if (valid.length < 20) throw new Error(`有效資料只有 ${valid.length} 筆，至少需要 20 筆來建立訓練/測試集`);
    if (valid.length <= features.length + 10) throw new Error('資料筆數太少或特徵數過多，無法穩定評估');
    return { parsed, target, features, columns, rows: valid, dropped,
      ignored: desc.columns.filter(c => c.name !== target && !c.supported).map(c => c.name) };
  }

  function seededRandom(seed) {
    let x = seed >>> 0;
    return () => {
      x += 0x6D2B79F5;
      let t = x;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffledIndices(n, seed) {
    const out = Array.from({ length: n }, (_, i) => i), rnd = seededRandom(seed);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  function splitDataset(dataset, seed = 42) {
    const order = shuffledIndices(dataset.rows.length, seed);
    const testN = Math.max(4, Math.round(order.length * 0.20));
    return { train: order.slice(testN).map(i => dataset.rows[i]),
      test: order.slice(0, testN).map(i => dataset.rows[i]), seed, testRatio: testN / order.length };
  }

  /** Mean-centered, variance-scaled QR least squares; no train/test leakage. */
  function fitOLS(rows, featureIndices) {
    const p = featureIndices.length, n = rows.length;
    if (n <= p + 1 || !p) throw new Error('OLS 要求資料筆數大於特徵數+1');
    const y = rows.map(r => r.y), yMean = mean(y);
    const mus = featureIndices.map(j => mean(rows.map(r => r.x[j])));
    const scales = featureIndices.map((j, i) => std(rows.map(r => r.x[j])));
    if (scales.some(s => !Number.isFinite(s) || s < 1e-12)) throw new Error('部分特徵沒有變異，無法估計係數');
    const q = [], R = Array.from({ length: p }, () => Array(p).fill(0));
    for (let j = 0; j < p; j++) {
      const v = rows.map(r => (r.x[featureIndices[j]] - mus[j]) / scales[j]);
      // Re-orthogonalize for additional numerical stability.
      for (let pass = 0; pass < 2; pass++) {
        for (let k = 0; k < j; k++) {
          let dot = 0;
          for (let i = 0; i < n; i++) dot += q[k][i] * v[i];
          R[k][j] += dot;
          for (let i = 0; i < n; i++) v[i] -= dot * q[k][i];
        }
      }
      const length = Math.sqrt(sum(v.map(x => x * x)));
      if (length < 1e-8) throw new Error('特徵高度共線，OLS 無法估計；請減少特徵');
      R[j][j] = length;
      q.push(v.map(x => x / length));
    }
    const wScaled = Array(p).fill(0);
    for (let j = p - 1; j >= 0; j--) {
      let rhs = 0;
      for (let i = 0; i < n; i++) rhs += q[j][i] * (y[i] - yMean);
      for (let k = j + 1; k < p; k++) rhs -= R[j][k] * wScaled[k];
      wScaled[j] = rhs / R[j][j];
    }
    const coefficients = wScaled.map((b, i) => b / scales[i]);
    const intercept = yMean - sum(coefficients.map((b, i) => b * mus[i]));
    return { featureIndices: [...featureIndices], intercept, coefficients, n, p };
  }
  function predict(model, x) {
    let prediction = model.intercept;
    for (let i = 0; i < model.featureIndices.length; i++) {
      prediction += model.coefficients[i] * x[model.featureIndices[i]];
    }
    return prediction;
  }
  function evaluate(rows, model) {
    const actual = rows.map(r => r.y), predicted = rows.map(r => predict(model, r.x));
    const residual = actual.map((y, i) => y - predicted[i]), yBar = mean(actual);
    const sse = sum(residual.map(e => e ** 2));
    const sst = sum(actual.map(y => (y - yBar) ** 2));
    const r2 = sst > 1e-20 ? 1 - sse / sst : null;
    const nonzero = actual.map((y, i) => [y, residual[i]]).filter(([y]) => Math.abs(y) > 1e-12);
    return { rmse: Math.sqrt(sse / rows.length), mae: mean(residual.map(Math.abs)),
      r2, mape: nonzero.length ? mean(nonzero.map(([y, e]) => Math.abs(e / y))) * 100 : null,
      actual, predicted, residual, sse };
  }

  function cvRMSE(train, features, seed = 2026) {
    const folds = Math.min(5, Math.max(3, Math.floor(train.length / 8)));
    const order = shuffledIndices(train.length, seed);
    let errors = 0, count = 0;
    for (let k = 0; k < folds; k++) {
      const hold = [], fit = [];
      for (let i = 0; i < order.length; i++) {
        (i % folds === k ? hold : fit).push(train[order[i]]);
      }
      const m = fitOLS(fit, features);
      for (const row of hold) { errors += (row.y - predict(m, row.x)) ** 2; count++; }
    }
    return Math.sqrt(errors / count);
  }
  function pearsonAbs(a, b) {
    const am = mean(a), bm = mean(b);
    let cross = 0, aa = 0, bb = 0;
    for (let i = 0; i < a.length; i++) {
      const x = a[i] - am, y = b[i] - bm;
      cross += x * y; aa += x * x; bb += y * y;
    }
    return aa > 0 && bb > 0 ? Math.abs(cross / Math.sqrt(aa * bb)) : 0;
  }
  function selectFeatureOrder(train, p, method = 'forward') {
    const available = Array.from({ length: p }, (_, i) => i);
    if (method === 'correlation') {
      const y = train.map(r => r.y);
      return available.sort((a, b) => pearsonAbs(train.map(r => r.x[b]), y)
        - pearsonAbs(train.map(r => r.x[a]), y));
    }
    const cache = new Map();
    function loss(indices) {
      const key = [...indices].sort((a, b) => a - b).join(',');
      if (cache.has(key)) return cache.get(key);
      let score;
      try { score = cvRMSE(train, indices); }
      catch (_) { score = Infinity; }
      cache.set(key, score);
      return score;
    }
    if (method === 'backward') {
      let current = [...available];
      const removed = [];
      while (current.length > 1) {
        const candidates = current.map(j => ({ j, score: loss(current.filter(x => x !== j)) }));
        candidates.sort((a, b) => a.score - b.score || a.j - b.j);
        const chosen = candidates[0].j;
        current = current.filter(j => j !== chosen);
        removed.push(chosen);
      }
      return [...current, ...removed.reverse()];
    }
    if (method !== 'forward') throw new Error('不支援的特徵選取方法');
    let current = [], remaining = [...available];
    while (remaining.length) {
      const candidates = remaining.map(j => ({ j, score: loss([...current, j]) }));
      candidates.sort((a, b) => a.score - b.score || a.j - b.j);
      if (!Number.isFinite(candidates[0].score)) {
        current.push(...remaining); break; // full-size model may be rank deficient
      }
      current.push(candidates[0].j);
      remaining = remaining.filter(j => j !== candidates[0].j);
    }
    return current;
  }

  function analyze(dataset, method = 'forward', seed = 42) {
    const split = splitDataset(dataset, seed);
    const order = selectFeatureOrder(split.train, dataset.features.length, method);
    const progression = order.map((_, k) => {
      const indices = order.slice(0, k + 1);
      let model = null, training = null, testing = null, cv = null, error = null;
      try {
        model = fitOLS(split.train, indices);
        training = evaluate(split.train, model);
        testing = evaluate(split.test, model);
        cv = cvRMSE(split.train, indices);
      } catch (e) { error = e.message; }
      return { k: k + 1, indices, names: indices.map(i => dataset.features[i].name),
        model, training, testing, cv, error };
    });
    const eligible = progression.filter(p => Number.isFinite(p.cv));
    if (!eligible.length) throw new Error('所有特徵組合均無法建立有效模型，請檢查資料');
    const best = [...eligible].sort((a, b) => a.cv - b.cv || a.k - b.k)[0];
    return { dataset, split, method, seed, order, progression, bestK: best.k,
      best, foldCount: Math.min(5, Math.max(3, Math.floor(split.train.length / 8))) };
  }

  function calculateVIF(rows, indices) {
    return indices.map(j => {
      if (indices.length === 1) return 1;
      const others = indices.filter(i => i !== j);
      try {
        const training = rows.map(r => ({ x: r.x, y: r.x[j] }));
        const m = fitOLS(training, others), res = evaluate(training, m);
        return res.r2 === null || res.r2 >= 1 ? Infinity : 1 / (1 - res.r2);
      } catch (_) { return Infinity; }
    });
  }
  function rowFromInputs(dataset, inputs) {
    return dataset.features.map(f => f.kind === 'number' ? num(inputs[f.source])
      : Number(inputs[f.source] === f.level));
  }

  const api = { parseCSV, describeColumns, prepareDataset, splitDataset, shuffledIndices,
    fitOLS, predict, evaluate, cvRMSE, selectFeatureOrder, analyze, calculateVIF,
    rowFromInputs, num, mean, median };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MLR = api;
})(typeof window !== 'undefined' ? window : globalThis);
