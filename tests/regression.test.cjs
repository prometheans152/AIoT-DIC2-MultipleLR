const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../analysis.js');

let assertions = 0;
function ok(condition, label) {assert.ok(condition, label);assertions++;}
function close(a, b, tol, label) {ok(Math.abs(a - b) <= tol, `${label}: ${a} vs ${b}`);}

const quoted = A.parseCSV('"a,b",target,category\r\n"1,000",3,"A"\r\n4,5,"B"\r\n7,8,"A"\r\n');
ok(quoted.headers[0] === 'a,b', 'Quoted heading');
ok(quoted.rows[0]['a,b'] === '1,000', 'Quoted comma value');

const synthetic = Array.from({length:75},(_,i)=>({x:[i,i*i+2],y:10 + 3*i - 0.25*(i*i+2)}));
const model = A.fitOLS(synthetic,[0,1]);
close(model.intercept, 10, 1e-6, 'OLS intercept');
close(model.coefficients[0], 3, 1e-8, 'OLS slope 1');
close(model.coefficients[1], -0.25, 1e-8, 'OLS slope 2');
close(A.evaluate(synthetic,model).rmse,0,1e-8,'OLS training residual');
ok(A.numpyPermutation(50,42).slice(0,10).join() ===
  [13,39,30,45,17,48,26,25,32,19].join(),
  'NumPy RandomState(42).permutation(50) compatibility');
const strongerL1 = A.fitLasso(synthetic,[0,1],100000);
ok(strongerL1.coefficients.every(x=>Math.abs(x)<1e-10),
  'A sufficiently high L1 penalty zeroes coefficients');

const datasetPairs = [['50_Startups.csv','Profit',50,5],['BostonHousing.csv','medv',506,13]];
for(const [file,target,n,p] of datasetPairs){
  const csv=fs.readFileSync(path.join(__dirname,'..','data',file),'utf8');
  const parsed=A.parseCSV(csv), ds=A.prepareDataset(parsed,target);
  ok(parsed.rows.length===n,`${file}: CSV row count`);
  ok(ds.rows.length===n,`${file}: usable row count`);
  ok(ds.features.length===p,`${file}: encoded predictor count`);
  const s1=A.splitDataset(ds),s2=A.splitDataset(ds);
  ok(s1.test.map(x=>x.id).join()===s2.test.map(x=>x.id).join(),`${file}: deterministic split`);
  ok(s1.test.every(x=>!s1.train.includes(x)),`${file}: train/test do not overlap`);
  let prior;
  const comparison=A.compareAllMethods(ds,42);
  ok(comparison.methods.length===5,`${file}: five selection methods`);
  for(const method of comparison.methods){
    const res=comparison.results[method.id];
    ok(res.progression.length===p,`${file}: every k explored for ${method.id}`);
    ok(res.best.k>=1 && res.best.k<=p,`${file}: chosen k exists`);
    ok(Number.isFinite(res.best.cv) && Number.isFinite(res.best.testing.rmse),`${file}: metrics are finite`);
    ok(res.best.testing.actual.length===s1.test.length,`${file}: holdout sized correctly`);
    ok(res.split.test.map(x=>x.id).join()===s1.test.map(x=>x.id).join(),`${file}: same test samples across algorithms`);
    if(prior) ok(res.split.test.map(x=>x.id).join()===prior,`${file}: algorithm-independent split`);
    prior=res.split.test.map(x=>x.id).join();
    console.log(`${file} | ${method.id.padEnd(11)} | best k=${res.bestK} | CV RMSE=${res.best.cv.toFixed(4)} | holdout RMSE=${res.best.testing.rmse.toFixed(4)} | R²=${res.best.testing.r2.toFixed(4)}`);
  }
  ok(comparison.lassoNative.k>=1 && comparison.lassoNative.k<=p,`${file}: native LassoCV nonzero k`);
  ok(Number.isFinite(comparison.lassoNative.testing.rmse),`${file}: native LassoCV RMSE finite`);
  ok(comparison.lassoNative.model.type==='LassoL1',`${file}: native LassoCV uses actual L1 model`);
  const rp=comparison.results.pearson.progression;
  const rs=comparison.results.selectkbest.progression;
  rp.forEach((v,i)=>close(v.testing.rmse,rs[i].testing.rmse,1e-8,`${file}: Pearson equals f_regression ranking at k=${i+1}`));
  if(file==='50_Startups.csv'){
    ok(s1.test.map(r=>r.id).join() === [14,40,31,46,18,49,27,26,33,20].join(),
      '50 Startups holdout matches sklearn train_test_split random_state=42');
    close(rp[0].testing.rmse,7714.334890830185,1e-6,'Teacher graph at k=1 RMSE');
    close(rp[0].testing.r2,0.9265108109341951,1e-9,'Teacher graph at k=1 R2');
    close(rp[1].testing.rmse,8206.3288,1e-3,'Teacher graph Pearson k=2 RMSE');
    close(rp[2].testing.rmse,8242.783,1e-3,'Teacher graph Pearson k=3 RMSE');
    close(comparison.results.rfe.progression[2].testing.rmse,8995.9058,1e-3,
      'Teacher graph RFE k=3 RMSE');
  }
}
console.log(`PASS (${assertions} assertions)`);
