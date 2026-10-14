/* Optional DOM integration tests; require jsdom as a development-only dependency.
 * The actual GitHub Pages site still uses plain HTML/CSS/JavaScript with no runtime packages.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let checks = 0;
function ok(value, description) { assert.ok(value, description); checks++; }
function equal(actual, expected, description) { assert.equal(actual, expected, description); checks++; }
function press(window, target, key) {
  target.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles:true, cancelable:true }));
}
function click(window, target) {
  assert.ok(target, 'click target must exist');
  target.dispatchEvent(new window.MouseEvent('click', { bubbles:true, cancelable:true }));
}
function sleep(milliseconds=100) { return new Promise(resolve => setTimeout(resolve, milliseconds)); }

async function run() {
  const html = read('index.html').replace(/<script\s+src="[^"]+"\s*>\s*<\/script>/g, '');
  const dom = new JSDOM(html, { url:'http://127.0.0.1:8778/', runScripts:'outside-only', pretendToBeVisual:true });
  const { window } = dom;
  const { document } = window;
  const $ = selector => document.querySelector(selector);
  const detail = id => document.getElementById(id).textContent.replace(/,/g,'');
  try {
    if(document.readyState === 'loading') await new Promise(resolve => window.addEventListener('DOMContentLoaded', resolve, {once:true}));
    for(const file of ['data.js','analysis.js','app.js']) window.eval(read(file));
    await sleep(160);
    ok($('#dataStatus').textContent.includes('已完成'), 'initial computation finished');
    equal($('#referenceTable').querySelectorAll('tr').length, 5, 'five LMS reference rows');
    equal($('#referenceChartRMSE').querySelectorAll('[data-chart-point="baseline"]').length, 5, 'five clickable LMS RMSE points');
    equal($('#referenceChartR2').querySelectorAll('[data-chart-point="baseline"]').length, 5, 'five clickable LMS R² points');
    ok($('#referencePointDetail').textContent.includes('點擊'), 'initial detail prompts for click');

    click(window,$('#referenceChartRMSE [data-chart-point="baseline"][data-k="3"]'));
    ok($('#referencePointDetail').textContent.includes('k=3'), 'click RMSE marker selects k=3');
    ok(detail('referencePointDetail').includes('8309.059683'), 'selected k=3 displays computed RMSE');
    ok($('#referencePointDetail').textContent.includes('0.946015'), 'selected k=3 displays computed R²');
    ok($('#referenceChartRMSE [data-k="3"]').classList.contains('chart-point-active'), 'RMSE selected point is highlighted');
    ok($('#referenceChartR2 [data-k="3"]').classList.contains('chart-point-active'), 'paired R² point is highlighted');
    ok($('#referenceTable [data-baseline-k="3"]').closest('tr').classList.contains('selected-row'), 'matching LMS table row is highlighted');

    press(window,$('#referenceChartR2 [data-chart-point="baseline"][data-k="4"]'),'Enter');
    ok($('#referencePointDetail').textContent.includes('k=4'), 'keyboard Enter works on R² chart');
    ok(detail('referencePointDetail').includes('8409.916714'), 'R² marker selects same k in RMSE detail');
    press(window,$('#referenceChartRMSE [data-chart-point="baseline"][data-k="5"]'),' ');
    ok($('#referencePointDetail').textContent.includes('k=5'), 'keyboard Space activates benchmark point');
    click(window,$('#referenceTable [data-baseline-k="2"]'));
    ok(detail('referencePointDetail').includes('8198.797191'), 'LMS table click selects matching chart point');

    const advanced = $('#chartRMSE [data-chart-point="advanced"][data-method="pearson"][data-k="2"]');
    ok(advanced && advanced.getAttribute('role')==='button' && advanced.getAttribute('tabindex')==='0', 'advanced SVG point is accessible');
    click(window,advanced);
    equal($('#methodSelect').value,'pearson','advanced point changes algorithm selection');
    equal($('#kSelect').value,'2','advanced point changes k selection');
    ok($('#advancedPointDetail').textContent.includes('Pearson (Filter)'), 'advanced detail shows algorithm');
    ok(detail('advancedPointDetail').includes('8206.328813'), 'advanced detail shows actual RMSE');
    ok($('#chartRMSE [data-method="pearson"][data-k="2"]').classList.contains('chart-point-active'), 'advanced point selected on RMSE chart');
    ok($('#chartR2 [data-method="pearson"][data-k="2"]').classList.contains('chart-point-active'), 'advanced point selected on R² chart');

    const beforeNative = $('#metricRMSE').textContent;
    press(window,$('#chartR2 [data-chart-point="native-lasso"]'),'Enter');
    ok($('#advancedPointDetail').textContent.includes('LassoCV 原生 L1 模型'), 'LassoCV star is keyboard clickable');
    ok($('#advancedPointDetail').textContent.includes('原生 L1 正則化係數'), 'LassoCV star distinguishes regularized model from OLS');
    equal($('#metricRMSE').textContent,beforeNative,'LassoCV marker does not mislabel OLS summary cards');
    click(window,$('#legendRMSE [data-chart-method="rfe"]'));
    equal($('#methodSelect').value,'rfe','legend works for overlapping advanced curves');
    equal($('#kSelect').value,'2','legend keeps selected k when choosing method');
    ok($('#advancedPointDetail').textContent.includes('RFE (Wrapper)'), 'advanced legend updates detail');

    $('#datasetSelect').value='boston';
    $('#datasetSelect').dispatchEvent(new window.Event('change',{bubbles:true}));
    await sleep(500);
    ok($('#dataStatus').textContent.includes('BostonHousing.csv'), 'dataset switch still works');
    equal($('#referenceChartRMSE').querySelectorAll('[data-chart-point="baseline"]').length,5,'Boston LMS-style graph still offers five clickable dots');
    click(window,$('#referenceChartRMSE [data-chart-point="baseline"][data-k="2"]'));
    ok($('#referencePointDetail').textContent.includes('k=2'), 'benchmark marker click works after switching dataset');
    ok($('#referencePointDetail').textContent.includes('lstat'), 'new dataset uses its own features');
    console.log(`PASS (${checks} chart interaction assertions)`);
  } finally {
    dom.window.close();
  }
}

run().catch(error=>{ console.error(error); process.exitCode=1; });
