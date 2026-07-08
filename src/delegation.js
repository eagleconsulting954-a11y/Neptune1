(function(){
  var duties = [
    ['HW-104','Hot Work','Chief Officer','Engine workshop','Master approval','Critical'],
    ['HW-108','Hot Work','Chief Engineer','Pump room','Gas test pending','Hold'],
    ['IN-221','Inspection','Bosun','Main deck rounds','Due 16:00','Open'],
    ['IN-244','Inspection','2nd Engineer','Aux generator check','Evidence needed','Open'],
    ['IN-250','Inspection','Safety Officer','Fire locker audit','Ready review','Ready']
  ];
  function html(){
    return '<section class="page-head glass premium-glow delegation-hero"><p class="eyebrow">Delegation Center</p><h1>Hot work and inspection duties, assigned with clear ownership.</h1><p>Track who owns each duty, where it is happening, what approval is required, and what evidence still needs to be attached before closeout.</p><div class="action-row"><button data-delegate-action="new-hot-work">New hot work duty</button><button data-delegate-action="new-inspection">New inspection duty</button><button data-delegate-action="handover">Generate handover</button></div></section><section class="delegation-grid"><article class="glass delegation-card"><span>Open duties</span><b>5</b><i></i></article><article class="glass delegation-card"><span>Hot work</span><b>2</b><i></i></article><article class="glass delegation-card"><span>Inspection</span><b>3</b><i></i></article><article class="glass delegation-card"><span>Needs evidence</span><b>2</b><i></i></article></section><section class="glass panel-block"><div class="card-title"><h2>Duty Board</h2><button data-delegate-action="filter">Filter duties</button></div><div class="duty-list">' + duties.map(function(d){ return '<button class="duty-row" data-duty="' + d.join('|') + '"><strong>' + d[0] + '</strong><span>' + d[1] + '</span><em>' + d[2] + '</em><small>' + d[3] + ' · ' + d[4] + '</small><b>' + d[5] + '</b></button>'; }).join('') + '</div></section><section class="delegation-grid two"><article class="glass panel-block"><h2>Hot Work Chain</h2><div class="chain"><span>Requester</span><span>Gas Test</span><span>Chief Officer</span><span>Master</span><span>Closeout</span></div></article><article class="glass panel-block"><h2>Inspection Chain</h2><div class="chain"><span>Assign</span><span>Inspect</span><span>Attach</span><span>Review</span><span>Close</span></div></article></section>';
  }
  function openPanel(title, body){
    var old=document.querySelector('.delegate-backdrop'); if(old) old.remove();
    var wrap=document.createElement('div'); wrap.className='delegate-backdrop';
    wrap.innerHTML='<aside class="delegate-panel glass"><button class="delegate-close">×</button><p class="eyebrow">Delegation Detail</p><h1>'+title+'</h1><p>'+body+'</p><div class="fallback-grid"><label>Owner<input value="Chief Officer" /></label><label>Due<input value="Today" /></label><label>Evidence<input value="Required" /></label><label>Status<input value="Open" /></label></div><button class="primary small delegate-save">Save delegation</button></aside>';
    document.body.appendChild(wrap);
    wrap.addEventListener('click',function(e){ if(e.target===wrap || e.target.classList.contains('delegate-close') || e.target.classList.contains('delegate-save')) wrap.remove(); });
  }
  function injectNav(){
    var nav=document.querySelector('.condensed-nav'); if(!nav || document.querySelector('[data-delegation-open]')) return;
    var block=document.createElement('details'); block.className='nav-section delegation-nav'; block.open=true;
    block.innerHTML='<summary><span>Delegation</span><small>2</small></summary><div class="nav-mini-grid"><button class="side-link delegation-link" data-delegation-open="true"><span>Duty Center</span></button><button class="side-link" data-delegate-action="handover"><span>Handover</span></button></div>';
    nav.prepend(block);
  }
  function showDelegation(){
    var ws=document.querySelector('.workspace'); if(!ws) return;
    var top=document.querySelector('.topbar');
    ws.innerHTML=(top?top.outerHTML:'')+html();
    var app=document.querySelector('.app-shell'); if(app) app.classList.remove('menu-active');
  }
  document.addEventListener('click',function(e){
    var open=e.target.closest('[data-delegation-open]'); if(open){ e.preventDefault(); showDelegation(); return; }
    var action=e.target.closest('[data-delegate-action]'); if(action){ e.preventDefault(); var a=action.dataset.delegateAction; openPanel(action.textContent.trim() || 'Delegation action','This action opens the duty workflow for hot work and inspection assignments. It will assign an owner, set the required approval path, request evidence, and record the closeout audit trail.'); return; }
    var duty=e.target.closest('[data-duty]'); if(duty){ e.preventDefault(); var d=duty.dataset.duty.split('|'); openPanel(d[0]+' · '+d[1], 'Owner: '+d[2]+'<br>Location: '+d[3]+'<br>Requirement: '+d[4]+'<br>Status: '+d[5]); }
  });
  new MutationObserver(injectNav).observe(document.body,{childList:true,subtree:true});
  setTimeout(injectNav,300);
})();
