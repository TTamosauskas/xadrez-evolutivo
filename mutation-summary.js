(function(){
  const PIECE_SYMBOLS={Peão:'♙',Cavalo:'♘',Bispo:'♗',Torre:'♖',Rei:'♔',Rainha:'♕'};
  const MUTATION_ICONS={
    'Locomoção':'🐪','Voo':'🐦','Predação':'🦁','Ovos':'🦎','Fertilidade':'🐇','Carapaça':'🐢',
    'Ooteca':'🕷','Veneno':'🐍','Mutação Deletéria':'💀','Mutação Disfuncional':'🦵','Camuflagem':'👀',
    'Resistência':'🧬','Reprodução Sexuada':'❤️','Esterilidade':'🚫'
  };

  const pendingLines=[];
  const pendingKeys=new Set();
  let flushTimer=null;
  let summaryOpen=false;
  let intercepting=false;

  function ensureSummaryModal(){
    let modal=document.querySelector('#mutationSummaryModal');
    if(modal)return modal;
    modal=document.createElement('div');
    modal.id='mutationSummaryModal';
    modal.className='modal-backdrop';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.innerHTML='<div class="modal mutation-summary-modal"><h2>Novas mutações:</h2><div id="mutationSummaryBody"></div><div class="modal-actions"><button class="btn primary" id="mutationSummaryContinue" type="button">Continuar</button></div></div>';
    document.body.appendChild(modal);
    modal.querySelector('#mutationSummaryContinue').addEventListener('click',closeSummary);
    return modal;
  }

  function stripKnownIcon(text){
    let value=String(text||'').trim();
    for(const icon of Object.values(MUTATION_ICONS))value=value.replace(icon,'').trim();
    return value;
  }

  function conciseMutation(title,bodyText){
    const piece=String(title||'').match(/^Mutação de peça:\s*(.+)$/i);
    if(piece){
      const name=piece[1].trim();
      return {key:`piece:${name}`,line:`${PIECE_SYMBOLS[name]||'♙'} Mutação de peça: ${name}`};
    }

    const mutation=String(title||'').match(/^Mutação:\s*(.+)$/i);
    if(mutation){
      const name=stripKnownIcon(mutation[1]);
      const icon=MUTATION_ICONS[name]||'•';
      const lost=/perdeu esta característica|efeito perdido|perdeu a especialização/i.test(bodyText||'');
      const label=lost?`Perda de ${name}`:name;
      return {key:`trait:${lost?'loss':'gain'}:${name}`,line:`${icon} ${label}`};
    }

    if(/^Mutação$/i.test(String(title||'').trim())){
      const text=String(bodyText||'').replace(/\s+/g,' ').trim();
      if(text)return {key:`generic:${text}`,line:`• ${text}`};
    }
    return null;
  }

  function rememberMutation(item){
    if(!item||pendingKeys.has(item.key))return;
    pendingKeys.add(item.key);
    pendingLines.push(item.line);
  }

  function scheduleFlush(){
    if(flushTimer!==null)clearTimeout(flushTimer);
    flushTimer=setTimeout(()=>{
      flushTimer=null;
      const explanation=document.querySelector('#explanationModal.open');
      if(explanation){scheduleFlush();return}
      showSummary();
    },35);
  }

  function showSummary(){
    if(summaryOpen||!pendingLines.length)return;
    const modal=ensureSummaryModal();
    const body=modal.querySelector('#mutationSummaryBody');
    body.innerHTML=pendingLines.map(line=>`<div class="mutation-summary-line">${line}</div>`).join('');
    modal.classList.add('open');
    summaryOpen=true;
    window.xeModalBlocking=true;
    modal.querySelector('#mutationSummaryContinue')?.focus();
  }

  function closeSummary(){
    const modal=ensureSummaryModal();
    modal.classList.remove('open');
    summaryOpen=false;
    pendingLines.length=0;
    pendingKeys.clear();
    if(!document.querySelector('.modal-backdrop.open'))window.xeModalBlocking=false;
  }

  function inspectExplanationModal(){
    if(intercepting||summaryOpen)return;
    const modal=document.querySelector('#explanationModal');
    if(!modal?.classList.contains('open'))return;
    const title=(modal.querySelector('#explanationModalTitle')?.textContent||'').trim();
    const bodyText=(modal.querySelector('#explanationModalBody')?.textContent||'').trim();
    const item=conciseMutation(title,bodyText);
    if(!item)return;

    rememberMutation(item);
    intercepting=true;
    modal.style.visibility='hidden';
    window.xeModalBlocking=true;
    const button=modal.querySelector('#explanationModalContinue');
    if(button)button.click();
    queueMicrotask(()=>{
      modal.style.removeProperty('visibility');
      intercepting=false;
      scheduleFlush();
    });
  }

  function ensureStyles(){
    let style=document.querySelector('#mutationSummaryStyles');
    if(!style){
      style=document.createElement('style');
      style.id='mutationSummaryStyles';
      document.head.appendChild(style);
    }
    style.textContent=`
      .mutation-summary-modal{max-width:520px}
      .mutation-summary-modal h2{margin-bottom:16px}
      #mutationSummaryBody{display:flex;flex-direction:column;gap:9px}
      .mutation-summary-line{font-size:17px;line-height:1.35;color:var(--text)}
    `;
  }

  const observer=new MutationObserver(inspectExplanationModal);
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  ensureStyles();
  inspectExplanationModal();
})();
