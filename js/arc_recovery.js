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
  $('resumeInterrupted')?.addEventListener('click',resume);
  $('abandonInterrupted')?.addEventListener('click',abandon);
  addEventListener('load',()=>setTimeout(discover,250));
  window.ARCRecovery={discover};
})();