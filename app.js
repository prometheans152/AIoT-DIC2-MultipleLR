/* Interactive interface: two course problems + upload/URL CSV extra-credit. */
(function () {
  'use strict';
  const A = window.MLR;
  const el = id => document.getElementById(id);
  const state = { parsed: null, dataset: null, analysis: null,
    selectedK: null, sourceName: '', key: 'startups', custom: null, defaults: {} };

  function esc(v) { return String(v).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]); }
  function csvCell(v) {
    const s = String(v ?? '');
    return /[,\r\n"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  function fmt(n, places = 2) {
    if (n === null || n === undefined || !Number.isFinite(n)) return '—';
    return Number(n).toLocaleString('en-US', { maximumFractionDigits: places, minimumFractionDigits: places });
  }
  function currency(n) { return (state.key === 'startups' ? '$' : '') + fmt(n, 2); }
  function unitName() {
    return state.key === 'startups' ? '美元 ($)' : state.key === 'boston' ? '千美元 ($1,000)' : '原資料單位';
  }
  function status(message, error = false) {
    el('dataStatus').textContent = message;
    el('dataStatus').classList.toggle('error', error);
    el('sourceBadge').textContent = error ? 'CHECK YOUR CSV' : 'MODEL READY';
    el('sourceBadge').style.background = error ? '#fff2f1' : '#edf7f3';
    el('sourceBadge').style.color = error ? '#bd5655' : '#23795e';
  }
  function getRaw(key) {
    if (key === 'custom') return state.custom;
    return { text: window.DIC2_BUILTIN[key],
      name: key === 'startups' ? '50_Startups.csv' : 'BostonHousing.csv' };
  }
  function populateTarget(parsed, targetName) {
    const desc = A.describeColumns(parsed, targetName);
    const select = el('targetSelect');
    select.innerHTML = desc.viableTargets.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
    if (!desc.viableTargets.length) throw new Error('沒有數值型目標欄位');
    select.value = desc.suggested;
  }
  function loadProblem(key, message) {
    const raw = getRaw(key);
    if (!raw || !raw.text) return;
    try {
      state.key = key;
      state.parsed = A.parseCSV(raw.text);
      state.sourceName = raw.name;
      populateTarget(state.parsed);
      rebuildDataset();
      if (message) status(message);
    } catch (e) { status(`載入失敗：${e.message}`, true); }
  }
  function rebuildDataset() {
    try {
      state.dataset = A.prepareDataset(state.parsed, el('targetSelect').value);
      runAnalysis();
    } catch (e) { status(`資料準備失敗：${e.message}`, true); }
  }
  function runAnalysis() {
    if (!state.dataset) return;
    const button = el('runButton');
    button.disabled = true;
    button.textContent = '正在分析資料…';
    // Leave an event-loop tick so large custom datasets show the progress label.
    window.setTimeout(() => {
      try {
        state.analysis = A.analyze(state.dataset, el('methodSelect').value, 42);
        state.selectedK = state.analysis.bestK;
        const select = el('kSelect');
        select.innerHTML = state.analysis.progression.map(x => `<option value="${x.k}">k = ${x.k}${x.k === state.analysis.bestK ? ' ★ CV 最佳' : ''}</option>`).join('');
        select.value = String(state.selectedK);
        renderDatasetSummary();
        renderAll();
        status(`已完成分析：${state.sourceName} · ${state.dataset.rows.length} 筆有效資料 · ${state.analysis.progression.length} 組模型`);
      } catch (e) { status(`模型計算失敗：${e.message}`, true); console.error(e); }
      finally { button.disabled = false; button.innerHTML = '執行特徵選取與回歸分析 <span aria-hidden="true">→</span>'; }
    }, 10);
  }
  function renderDatasetSummary() {
    const d = state.dataset, a = state.analysis;
    el('dataSummary').innerHTML = [
      `<span>Dataset<strong>${esc(state.sourceName)}</strong></span>`,
      `<span>有效樣本<strong>${d.rows.length}</strong></span>`,
      `<span>Train / Test<strong>${a.split.train.length} / ${a.split.test.length}</strong></span>`,
      `<span>編碼後特徵<strong>${d.features.length}</strong></span>`,
      `<span>目標 Y<strong>${esc(d.target)}</strong></span>`,
      d.dropped.length ? `<span class="notice">已排除 ${d.dropped.length} 筆缺失／不合法資料。</span>` : '',
      d.ignored.length ? `<span class="notice">已略過無法處理的欄位：${esc(d.ignored.join(', '))}</span>` : ''
    ].join('');
  }
  function current() { return state.analysis?.progression.find(x => x.k === state.selectedK); }
  function renderAll() {
    renderMetricCards();
    renderProgression();
    renderCharts();
    renderCoefficients();
    renderScatter();
    renderResiduals();
    renderPredictor();
  }
  function renderMetricCards() {
    const p = current(), a = state.analysis;
    el('metricRMSE').textContent = p?.testing ? currency(p.testing.rmse) : '—';
    el('metricR2').textContent = p?.testing ? fmt(p.testing.r2, 4) : '—';
    el('metricCV').textContent = p?.cv != null ? currency(p.cv) : '—';
    el('metricMAE').textContent = p?.testing ? currency(p.testing.mae) : '—';
    const best = a.best;
    el('bestHint').innerHTML = `訓練集交叉驗證建議 <strong>k = ${best.k}</strong>（CV RMSE = ${esc(currency(best.cv))}）。
      最佳模型特徵：<strong>${esc(best.names.join('、'))}</strong>。
      目前檢視 k = ${p.k}；${p.k === best.k ? '這是依 CV 決定的模型。' : '目前選的是比較用模型，而非 CV 最佳模型。'}
      <span class="micro">測試集指標只供獨立評估，不參與選 k。</span>`;
  }
  function renderProgression() {
    const a = state.analysis;
    el('progressBody').innerHTML = a.progression.map(p => `<tr class="${p.k === state.selectedK ? 'selected-row' : ''} ${p.k === a.bestK ? 'best-row' : ''}">
      <td><button class="row-action" type="button" data-k="${p.k}">k = ${p.k}</button></td>
      <td class="feature-list">${esc(p.names.join(' · '))}</td>
      <td>${fmt(p.cv)}</td><td>${p.testing ? esc(currency(p.testing.rmse)) : '—'}</td>
      <td>${p.testing ? fmt(p.testing.r2, 4) : '—'}</td><td>${p.training ? fmt(p.training.r2, 4) : '—'}</td>
      <td>${p.k === a.bestK ? '★ CV 最佳' : p.error ? esc(p.error) : '可比較'}</td>
      </tr>`).join('');
    for (const b of el('progressBody').querySelectorAll('button[data-k]')) {
      b.addEventListener('click', () => selectK(Number(b.dataset.k)));
    }
  }
  function selectK(k) {
    if (!state.analysis?.progression.some(p => p.k === k)) return;
    state.selectedK = k;
    el('kSelect').value = String(k);
    renderAll();
  }
  function chartLine(points, otherPoints, opts) {
    const W = 620, H = 285, L = 62, R = 22, T = 24, B = 49;
    const values = [...points, ...otherPoints].filter(Number.isFinite);
    if (!values.length) return '<p>沒有可顯示的資料。</p>';
    const lo0 = Math.min(...values), hi0 = Math.max(...values);
    const spread = Math.max((hi0 - lo0) * 0.15, Math.abs(hi0) * 0.035, 0.0001);
    const lo = lo0 - spread, hi = hi0 + spread;
    const x = i => L + (points.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (points.length - 1));
    const y = n => T + (hi - n) * (H - T - B) / (hi - lo);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.title)}" xmlns="http://www.w3.org/2000/svg">`;
    for (let i = 0; i < 5; i++) {
      const v = lo + i * (hi - lo) / 4, yy = y(v);
      s += `<path d="M ${L} ${yy} H ${W-R}" stroke="#e8edf6" stroke-width="1"/>
        <text x="${L-10}" y="${yy+4}" text-anchor="end" fill="#98a4b7" font-size="12">${esc(opts.ticks(v))}</text>`;
    }
    for (let i = 0; i < points.length; i++)
      s += `<text x="${x(i)}" y="${H-B+24}" text-anchor="middle" fill="#8492a7" font-size="12">${i+1}</text>`;
    s += `<text x="${(L+W-R)/2}" y="${H-5}" text-anchor="middle" fill="#8290a7" font-size="12">Number of Features (k)</text>`;
    const selectionX = x(state.selectedK - 1);
    s += `<path d="M ${selectionX} ${T} V ${H-B}" stroke="#adb7cb" stroke-dasharray="3 6"/>`;
    function series(data, color, dash) {
      const valid = data.map((v,i) => ({v,i})).filter(p => Number.isFinite(p.v));
      if (!valid.length) return '';
      const line = valid.map((p,j) => `${j ? 'L':'M'}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
      return `<path d="${line}" fill="none" stroke="${color}" stroke-width="3" ${dash ? 'stroke-dasharray="7 6"' : ''} stroke-linecap="round" stroke-linejoin="round"/>`
        + valid.map(p => `<circle cx="${x(p.i)}" cy="${y(p.v)}" r="${state.selectedK === p.i+1 ? 6 : 4}" fill="#fff" stroke="${color}" stroke-width="2.4"><title>k=${p.i+1}: ${p.v.toFixed(4)}</title></circle>`).join('');
    }
    s += series(otherPoints, opts.otherColor, true) + series(points, '#5069eb', false) + '</svg>';
    return s;
  }
  function renderCharts() {
    const p = state.analysis.progression;
    el('chartRMSE').innerHTML = chartLine(p.map(r => r.testing?.rmse), p.map(r => r.cv),
      { title: '測試 RMSE 和交叉驗證 RMSE 隨特徵數變化', otherColor:'#d59a55', ticks: n => Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + 'k' : n.toFixed(n < 10 ? 1 : 0) });
    el('chartR2').innerHTML = chartLine(p.map(r => r.testing?.r2), p.map(r => r.training?.r2),
      { title: '測試與訓練 R-squared 隨特徵數變化', otherColor: '#8870d0', ticks: n => n.toFixed(2) });
  }
  function renderCoefficients() {
    const p = current(), d = state.dataset;
    if (!p.model) { el('equation').textContent = p.error; el('coeffBody').innerHTML = ''; return; }
    const m = p.model;
    el('equation').textContent = `${d.target} = ${fmt(m.intercept, 4)} ` + m.coefficients.map((v,i) =>
      `${v >= 0 ? '+' : '−'} ${fmt(Math.abs(v), 5)} × (${d.features[p.indices[i]].name})`).join(' ');
    el('activeFeatures').innerHTML = p.names.map(x => `<strong>${esc(x)}</strong>`).join(' · ');
    const vif = A.calculateVIF(state.analysis.split.train, p.indices);
    el('coeffBody').innerHTML = `<tr><td>Intercept (β₀)</td><td>${fmt(m.intercept, 6)}</td><td>—</td></tr>`
      + m.coefficients.map((v,i) => `<tr><td>${esc(p.names[i])}</td><td>${fmt(v,6)}</td>
        <td class="${vif[i]>5?'bad-value':'good-value'}">${fmt(vif[i], 2)}</td></tr>`).join('');
  }
  function renderScatter() {
    const p = current();
    if (!p.testing) { el('chartScatter').innerHTML = '模型不可用'; return; }
    const actual = p.testing.actual, predicted = p.testing.predicted;
    const W=615,H=293,L=67,R=24,T=22,B=49;
    const min = Math.min(...actual,...predicted), max = Math.max(...actual,...predicted);
    const pad = (max-min || 1)*.08, lo = min-pad, hi = max+pad;
    const x = v => L + (v-lo)/(hi-lo)*(W-L-R), y = v => H-B - (v-lo)/(hi-lo)*(H-T-B);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="測試集真實值與預測值散佈圖">`;
    for(let i=0;i<=4;i++){
      const v=lo+i*(hi-lo)/4;
      svg += `<path d="M${x(v)} ${T} V${H-B} M${L} ${y(v)} H${W-R}" stroke="#e8edf6"/>
        <text x="${x(v)}" y="${H-B+20}" text-anchor="middle" fill="#9ba5b5" font-size="10">${esc(shortNum(v))}</text>
        <text x="${L-8}" y="${y(v)+4}" text-anchor="end" fill="#9ba5b5" font-size="10">${esc(shortNum(v))}</text>`;
    }
    svg += `<path d="M${x(lo)} ${y(lo)} L${x(hi)} ${y(hi)}" stroke="#8f9bc2" stroke-width="2" stroke-dasharray="6 5"/>`;
    for(let i=0;i<actual.length;i++){
      svg += `<circle cx="${x(actual[i])}" cy="${y(predicted[i])}" r="${actual.length>200?3:4}" fill="#5067e6" fill-opacity=".67"><title>Actual ${fmt(actual[i])}; Predicted ${fmt(predicted[i])}</title></circle>`;
    }
    svg += `<text x="${(L+W-R)/2}" y="${H-3}" text-anchor="middle" fill="#8491a7" font-size="12">Actual value</text>
      <text x="16" y="${H/2}" text-anchor="middle" fill="#8491a7" font-size="12" transform="rotate(-90 16 ${H/2})">Predicted value</text></svg>`;
    el('chartScatter').innerHTML=svg;
    el('scatterSummary').innerHTML = `測試樣本 <strong>${actual.length}</strong> 筆；R² = <strong>${fmt(p.testing.r2,4)}</strong>，RMSE = <strong>${esc(currency(p.testing.rmse))}</strong>（${esc(unitName())}）。`;
  }
  function shortNum(n) { return Math.abs(n)>=1000 ? (n/1000).toFixed(1)+'k' : n.toFixed(Math.abs(n)<10?1:0); }
  function renderResiduals() {
    const p = current();
    if(!p.testing) { el('residualBody').innerHTML=''; return; }
    const pairs = state.analysis.split.test.map((row,i) => ({ id: row.id, y:row.y,
      pred: p.testing.predicted[i], err: row.y-p.testing.predicted[i] }));
    pairs.sort((a,b)=>Math.abs(b.err)-Math.abs(a.err));
    el('residualBody').innerHTML = pairs.slice(0,20).map(r=>`<tr><td>#${r.id}</td><td>${fmt(r.y)}</td><td>${fmt(r.pred)}</td>
      <td class="${Math.abs(r.err)>p.testing.rmse*1.6?'bad-value':''}">${r.err>=0?'+':''}${fmt(r.err)}</td>
      <td>${fmt(Math.abs(r.err))}</td><td>${Math.abs(r.y)>1e-12?fmt(Math.abs(r.err/r.y)*100,1)+'%':'—'}</td></tr>`).join('');
    el('residualCount').textContent = `${pairs.length} TEST ROWS · TOP ${Math.min(20,pairs.length)}`;
  }
  function renderPredictor() {
    const d = state.dataset, p = current();
    const defaults = {};
    el('predictForm').innerHTML = d.columns.map(c => {
      if (c.numeric) {
        const med = A.median(d.rows.map(r=>A.num(r.original[c.name])));
        defaults[c.name] = med;
        return `<div class="input-field"><label for="input-${esc(c.name)}">${esc(c.name)}</label>
          <input data-feature="${esc(c.name)}" id="input-${esc(c.name)}" type="number" step="any" value="${med}" required></div>`;
      }
      defaults[c.name] = c.levels[0];
      return `<div class="input-field"><label for="input-${esc(c.name)}">${esc(c.name)}</label>
        <select data-feature="${esc(c.name)}" id="input-${esc(c.name)}">${c.levels.map(l=>`<option value="${esc(l)}">${esc(l)}</option>`).join('')}</select></div>`;
    }).join('');
    state.defaults = defaults;
    el('predTitle')?.textContent;
    el('predictTitle').textContent = `預測 ${d.target}`;
    el('predModel').textContent = p.model ? `OLS · k=${p.k} · ${unitName()}` : '模型不可用';
    for (const input of el('predictForm').querySelectorAll('[data-feature]')) {
      input.addEventListener('input', updatePrediction);
      input.addEventListener('change', updatePrediction);
    }
    updatePrediction();
  }
  function updatePrediction() {
    const p = current();
    if (!p?.model) { el('predNumber').textContent='—'; return; }
    const inputs = {};
    for (const input of el('predictForm').querySelectorAll('[data-feature]')) {
      inputs[input.dataset.feature] = input.value;
    }
    const x = A.rowFromInputs(state.dataset, inputs);
    if (x.some(v=>!Number.isFinite(v))) { el('predNumber').textContent='請輸入有效數值'; return; }
    el('predNumber').textContent = currency(A.predict(p.model,x));
  }
  function download(name, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=name;
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function downloadCSV() {
    if (!state.analysis) return;
    const p=current(), rows=state.analysis.split.test;
    if(!p.model) return;
    const lines = [['sample_id','actual','predicted','residual','abs_error',...state.dataset.columns.map(c=>c.name)].map(csvCell).join(',')];
    for (const row of rows) {
      const predicted=A.predict(p.model,row.x), e=row.y-predicted;
      lines.push([row.id,row.y,predicted,e,Math.abs(e),...state.dataset.columns.map(c=>row.original[c.name])].map(csvCell).join(','));
    }
    download(`DIC2_${state.key}_k${p.k}_test_predictions.csv`,lines.join('\r\n'),'text/csv;charset=utf-8');
  }
  function downloadReport() {
    if(!state.analysis) return;
    const a=state.analysis,p=current(),d=state.dataset;
    const report={title:'DIC2 Multiple Linear Regression & Feature Selection',
      generatedAt:new Date().toISOString(),source:state.sourceName,problem:state.key,
      target:d.target,units:unitName(),totalRows:d.parsed.rows.length,validRows:d.rows.length,
      droppedRows:d.dropped,ignoredColumns:d.ignored,encodedFeatures:d.features,
      split:{seed:42,train:a.split.train.length,test:a.split.test.length,
        splitRule:'80% train / 20% holdout; shuffled seed=42'},
      modeling:{type:'Ordinary Least Squares with centered/scaled QR',method:a.method,
        folds:a.foldCount,featureSelectionOn:'training set only',criterion:'min CV RMSE',
        recommendedK:a.bestK,displayedK:p.k},
      progression:a.progression.map(r=>({k:r.k,features:r.names,cvRMSE:r.cv,
        train:r.training&&{rmse:r.training.rmse,mae:r.training.mae,r2:r.training.r2},
        test:r.testing&&{rmse:r.testing.rmse,mae:r.testing.mae,r2:r.testing.r2},error:r.error})),
      displayedModel:p.model&&{intercept:p.model.intercept,
        features:p.names,coefficients:p.model.coefficients,
        vif:A.calculateVIF(a.split.train,p.indices),
        testMetrics:{rmse:p.testing.rmse,mae:p.testing.mae,r2:p.testing.r2,mape:p.testing.mape}},
      limitations:['Holdout results depend on dataset and chosen split',
        'Feature-selection CV is an internal selection criterion, not an unbiased final estimate',
        'The historical BostonHousing data contains demographic proxy column b; educational use only']};
    download(`DIC2_${state.key}_analysis_report.json`,JSON.stringify(report,null,2),'application/json;charset=utf-8');
  }
  function onCustomCSV(text,name) {
    state.custom={text,name};
    const select=el('datasetSelect');
    if(!select.querySelector('option[value="custom"]')) {
      const opt=document.createElement('option');opt.value='custom';opt.textContent='自訂資料集 — '+name;select.add(opt);
    } else select.querySelector('option[value="custom"]').textContent='自訂資料集 — '+name;
    select.value='custom';
    loadProblem('custom',`已匯入 ${name}。可改變預測目標欄位並重新執行模型。`);
  }
  async function loadCSVUrl() {
    const url=el('csvUrl').value.trim();
    if (!/^https?:\/\//i.test(url)) { status('請輸入以 https:// 或 http:// 開頭的公開 CSV 網址',true); return; }
    const button=el('loadUrlButton');button.disabled=true;button.textContent='讀取中…';
    try {
      const response=await fetch(url,{cache:'no-store'});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const text=await response.text();
      if(text.length>8e6) throw new Error('檔案超過 8MB；請先精簡');
      onCustomCSV(text,decodeURIComponent(url.split('/').pop().split('?')[0])||'remote.csv');
    } catch(e) { status(`網址載入失敗：${e.message}。若網站未開放 CORS，請先下載 CSV 再使用上傳功能。`,true); }
    finally{button.disabled=false;button.textContent='載入 URL';}
  }
  function initialize() {
    el('datasetSelect').addEventListener('change',e=>loadProblem(e.target.value));
    el('targetSelect').addEventListener('change',rebuildDataset);
    el('methodSelect').addEventListener('change',runAnalysis);
    el('kSelect').addEventListener('change',e=>selectK(Number(e.target.value)));
    el('runButton').addEventListener('click',runAnalysis);
    el('loadUrlButton').addEventListener('click',loadCSVUrl);
    el('csvFile').addEventListener('change',async e=>{
      const file=e.target.files?.[0];if(!file)return;
      if(file.size>8e6){status('檔案超過 8MB；請精簡資料後重新上傳',true);return;}
      try{onCustomCSV(await file.text(),file.name);}catch(ex){status(`讀取失敗：${ex.message}`,true);}
    });
    el('csvButton').addEventListener('click',downloadCSV);
    el('reportButton').addEventListener('click',downloadReport);
    el('predictForm').addEventListener('submit',e=>e.preventDefault());
    loadProblem('startups');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initialize);
  else initialize();
})();
