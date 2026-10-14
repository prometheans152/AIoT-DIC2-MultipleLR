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
  for(const method of ['forward','backward','correlation']){
    const res=A.analyze(ds,method,42);
    ok(res.progression.length===p,`${file}: every k explored for ${method}`);
    ok(res.best.k>=1 && res.best.k<=p,`${file}: chosen k exists`);
    ok(Number.isFinite(res.best.cv) && Number.isFinite(res.best.testing.rmse),`${file}: metrics are finite`);
    ok(res.best.testing.actual.length===s1.test.length,`${file}: holdout sized correctly`);
    ok(res.split.test.map(x=>x.id).join()===s1.test.map(x=>x.id).join(),`${file}: same test samples across algorithms`);
    if(prior) ok(res.split.test.map(x=>x.id).join()===prior,`${file}: algorithm-independent split`);
    prior=res.split.test.map(x=>x.id).join();
    console.log(`${file} | ${method.padEnd(11)} | best k=${res.bestK} | CV RMSE=${res.best.cv.toFixed(4)} | holdout RMSE=${res.best.testing.rmse.toFixed(4)} | R²=${res.best.testing.r2.toFixed(4)}`);
  }
}
console.log(`PASS (${assertions} assertions)`);
