/* ARC standalone POC UI extensions.
 * Keep this module independent from NEXUS. Completed records are read-only evidence.
 * Future NEXUS integration consumes the completed ARC record contract; it does not own test execution.
 */
(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const store = window.NEXUSTiltStore;
  if (!store) return;

  function selectedPlan() { return store.getPlan($('savedPlans')?.value); }

  function refreshPlanSelect(selectId) {
    const select = $('savedPlans'); if (!select) return;
    const plans = store.listPlans(); select.innerHTML = '';
    plans.forEach(plan => { const o=document.createElement('option'); o.value=plan.planId; o.textContent=`${plan.equipmentName ? plan.equipmentName+' — ' : ''}${plan.name} (${plan.tests.length} tests)`; select.appendChild(o); });
    if (selectId) select.value=selectId;
    $('startTest').disabled = !plans.length;
  }

  $('duplicatePlan')?.addEventListener('click', async () => {
    const source=selectedPlan(); if(!source) return;
    const copy=structuredClone(source); copy.planId=`PLAN-${Date.now()}`; copy.name=`${source.name} — Copy`; copy.createdAt=new Date().toISOString(); copy.status='PLANNED'; copy.planType='CUSTOM';
    store.savePlan(copy); if(window.NEXUSTiltDB) await window.NEXUSTiltDB.savePlan(copy); refreshPlanSelect(copy.planId);
  });

  $('loadSavedPlan')?.addEventListener('click', () => {
    const plan=selectedPlan(); if(!plan) return;
    $('planName').value=plan.name||''; $('equipmentName').value=plan.equipmentName||''; $('projectName').value=plan.projectName||'';
    alert('Plan identity loaded. Test-point editing will be enabled in the next builder pass; the saved plan itself has not been changed.');
  });

  function matches(test, q) {
    if(!q) return true;
    const hay=[test.equipmentName,test.planName,test.projectName,test.projectId,test.technicianName,test.completedTestId,test.testEnd?.reason].join(' ').toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  function showRecord(id) {
    const test=store.getCompletedTest(id), box=$('recordDetail'); if(!test||!box)return;
    const end=test.testEnd?.endedByTester ? `ENDED BY TESTER — ${esc(test.testEnd.reason||'No reason recorded')}` : 'SEQUENCE COMPLETED';
    const rows=(test.readings||[]).map((r,i)=>`<div class="test-row done"><strong>${i+1}</strong><span>${esc(r.testLabel||r.label||r.testId||'Test point')}</span><span class="pill">${esc(r.reading||r.observedIndication||'—')}</span></div>`).join('');
    box.hidden=false; box.innerHTML=`<div class="section-title-row"><h2>${esc(test.equipmentName||test.planName)}</h2><button id="closeRecordDetail" class="secondary" type="button">CLOSE</button></div><p><strong>${esc(test.planName)}</strong></p><p class="muted">Tester: ${esc(test.technicianName||'—')} · Started: ${test.startedAt?new Date(test.startedAt).toLocaleString():'—'} · Recorded: ${new Date(test.completedAt).toLocaleString()}</p><div class="status">${end}</div><div class="test-list">${rows||'<p class="muted">No accepted readings recorded.</p>'}</div><p class="muted">Record ID: ${esc(test.completedTestId)} · ARC record format: ${esc(test.format)}</p>`;
    $('closeRecordDetail')?.addEventListener('click',()=>box.hidden=true); box.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  function renderRecords() {
    const wrap=$('completedTests'); if(!wrap)return; const q=$('recordSearch')?.value||''; const tests=store.listCompletedTests().filter(t=>matches(t,q)); wrap.innerHTML='';
    if(!tests.length){wrap.innerHTML='<p class="muted">No matching ARC test records saved.</p>';return;}
    tests.slice(0,100).forEach(test=>{const div=document.createElement('div');div.className='record';const ended=test.testEnd?.endedByTester;div.innerHTML=`<strong>${esc(test.equipmentName||test.planName)}</strong><br><span>${test.acceptedReadingCount??test.readings?.length??0} accepted reading(s) · ${new Date(test.completedAt).toLocaleString()}</span><br><span class="small muted">${ended?'Ended by tester: '+esc(test.testEnd.reason):'Test sequence completed'} · ${esc(test.technicianName||'')}</span><div class="row" style="margin-top:8px"><button class="secondary view-record" type="button">VIEW RECORD</button><button class="secondary save-record" type="button">SAVE TEST FILE</button></div>`;
      div.querySelector('.view-record').addEventListener('click',()=>showRecord(test.completedTestId)); div.querySelector('.save-record').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(test,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ARC-${(test.equipmentName||test.planName||'Test').replace(/[^a-z0-9-_]+/gi,'-')}-${test.completedTestId}.arc.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}); wrap.appendChild(div);});
  }

  $('recordSearch')?.addEventListener('input',renderRecords);
  $('technicianName')?.addEventListener('input',()=>{$('footerUser').textContent=$('technicianName').value.trim()||'ARC POC User';});
  window.addEventListener('arc-records-changed',renderRecords);
  setTimeout(renderRecords,0);
})();
