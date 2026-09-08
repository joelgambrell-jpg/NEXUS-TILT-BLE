/* ARC field recovery controller.
 * Active tests are persisted by the engine to IndexedDB after every state change.
 * This controller discovers an interrupted run after reload/crash/offline restart and
 * requires an explicit tester choice to resume or abandon it. No accepted reading is recreated.
 */
(() => {
  const $=id=>document.getElementById(id);
  let active=null;
  const fmt=v=>v?new Date(v).toLocaleString():'Unknown time';

  async function discover(){
    if(!window.NEXUSTiltDB)return;
    try{
      active=await window.NEXUSTiltDB.getActiveRun();
      if(!active)return hide();
      const box=$('recoveryPanel'); if(!box)return;
      const accepted=active.accepted?.length||0,total=active.plan?.tests?.length||0,next=active.plan?.tests?.[active.currentIndex]?.label||'Unknown test point';
      $('recoveryTitle').textContent=`INTERRUPTED TEST FOUND — ${active.plan?.equipmentName||active.plan?.name||'ARC TILT Test'}`;
      $('recoveryDetails').textContent=`Started ${fmt(active.startedAt)} · ${accepted} of ${total} readings accepted · Next: ${next}`;
      box.hidden=false;
    }catch(e){console.error('ARC recovery discovery failed',e);}
  }
  function hide(){if($('recoveryPanel'))$('recoveryPanel').hidden=true;}
  async function resume(){
    if(!active)return;
    window.dispatchEvent(new CustomEvent('arc-resume-run',{detail:active})); hide();
  }
  async function abandon(){
    if(!active)return;
    const reason=$('abandonReason').value.trim();
    if(!reason){alert('Enter a reason before abandoning the interrupted test.');return;}
    window.dispatchEvent(new CustomEvent('arc-abandon-run',{detail:{snapshot:active,reason}})); hide();
  }

  async function deleteCompletedRecord(id){
    const record=window.NEXUSTiltStore?.getCompletedTest?.(id);
    const label=record?.equipmentId||record?.plan?.name||'this ARC test record';
    const ok=confirm(`Delete ${label}?\n\nThis permanently removes the completed test record from this browser. This cannot be undone.`);
    if(!ok)return;
    try{
      window.NEXUSTiltStore?.deleteCompletedTest?.(id);
      await window.NEXUSTiltDB?.deleteCompletedTest?.(id);
      const detail=$('recordDetail');if(detail){detail.hidden=true;detail.innerHTML='';}
      const status=$('completedStatus');if(status){status.className='status good';status.textContent='Completed test record deleted.';}
      setTimeout(()=>location.reload(),250);
    }catch(e){
      console.error('ARC record deletion failed',e);
      alert('ARC could not delete this record. Try again.');
    }
  }

  function installDeleteButtons(){
    document.querySelectorAll('.view-record[data-id]').forEach(view=>{
      const row=view.closest('.row');
      if(!row||row.querySelector('.delete-record'))return;
      const button=document.createElement('button');
      button.type='button';
      button.className='bad delete-record';
      button.dataset.id=view.dataset.id||'';
      button.textContent='DELETE RECORD';
      button.addEventListener('click',()=>deleteCompletedRecord(button.dataset.id));
      row.appendChild(button);
    });
  }

  $('resumeInterrupted')?.addEventListener('click',resume);
  $('abandonInterrupted')?.addEventListener('click',abandon);
  addEventListener('load',()=>{
    setTimeout(discover,250);
    setTimeout(installDeleteButtons,300);
    const records=$('completedTests');
    if(records)new MutationObserver(installDeleteButtons).observe(records,{childList:true,subtree:true});
  });
  window.ARCRecovery={discover};
})();