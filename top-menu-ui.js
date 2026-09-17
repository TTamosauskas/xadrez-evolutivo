(function(){
  const HOW_TO_PLAY_HTML='<p><strong>Xadrez Evolutivo</strong> mistura regras do xadrez com darwinismo:</p><ul><li>Peças se reproduzem</li><li>Filhos herdam características</li><li>Mutações são aleatórias</li><li>Tabuleiro exige adaptação</li><li>Eventos ecológicos mudam o jogo</li></ul><p>Ganhe o jogo ao tornar-se a linhagem dominante.</p>';

  function ensureStyles(){
    if(document.querySelector('#topMenuUiStyles'))return;
    const style=document.createElement('style');
    style.id='topMenuUiStyles';
    style.textContent=`
      .topbar{
        position:relative!important;
        display:flex!important;
        flex-direction:row!important;
        align-items:center!important;
        justify-content:space-between!important;
        gap:16px!important;
      }
      .topbar .brand{
        flex:1 1 auto!important;
        min-width:0!important;
        text-align:left!important;
      }
      .topbar .brand h1{
        text-align:left!important;
        margin-left:0!important;
        margin-right:0!important;
      }
      .xe-hamburger-menu{
        position:relative;
        flex:0 0 auto;
        margin-left:auto;
        z-index:60;
      }
      .xe-hamburger-toggle{
        width:44px;
        height:40px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:0!important;
        font-size:23px;
        line-height:1;
        font-weight:800;
      }
      .xe-hamburger-menu > .top-actions{
        position:absolute!important;
        top:calc(100% + 8px)!important;
        right:0!important;
        width:min(260px,calc(100vw - 24px))!important;
        display:none!important;
        flex-direction:column!important;
        flex-wrap:nowrap!important;
        align-items:stretch!important;
        justify-content:flex-start!important;
        gap:6px!important;
        padding:8px!important;
        margin:0!important;
        background:rgba(31,22,17,.98)!important;
        border:1px solid rgba(187,123,68,.55)!important;
        border-radius:12px!important;
        box-shadow:0 16px 40px rgba(0,0,0,.38)!important;
        z-index:70!important;
      }
      .xe-hamburger-menu.open > .top-actions{
        display:flex!important;
      }
      .xe-hamburger-menu > .top-actions > .btn,
      .xe-hamburger-menu > .top-actions > button{
        display:block!important;
        width:100%!important;
        margin:0!important;
        text-align:left!important;
        justify-content:flex-start!important;
      }
      .xe-hamburger-menu > .top-actions > [hidden]{
        display:none!important;
      }
      @media(max-width:720px){
        .topbar{
          flex-direction:row!important;
          align-items:center!important;
        }
        .topbar .brand h1{font-size:clamp(22px,7vw,30px)!important}
      }
    `;
    document.head.appendChild(style);
  }

  function syncVisibleButtons(){
    const save=document.querySelector('#saveBtn');
    const reset=document.querySelector('#resetBtn');
    for(const btn of [save,reset]){
      if(!btn)continue;
      btn.hidden=false;
      btn.removeAttribute('hidden');
      btn.removeAttribute('aria-hidden');
      btn.removeAttribute('tabindex');
    }
  }

  function closeMenu(){
    const menu=document.querySelector('.xe-hamburger-menu');
    const toggle=document.querySelector('#hamburgerMenuBtn');
    menu?.classList.remove('open');
    toggle?.setAttribute('aria-expanded','false');
  }

  function ensureMenu(){
    ensureStyles();
    syncVisibleButtons();
    const topbar=document.querySelector('.topbar');
    const actions=document.querySelector('.topbar .top-actions, .xe-hamburger-menu .top-actions');
    if(!topbar||!actions)return;

    let menu=document.querySelector('.xe-hamburger-menu');
    if(!menu){
      menu=document.createElement('div');
      menu.className='xe-hamburger-menu';
      const toggle=document.createElement('button');
      toggle.type='button';
      toggle.id='hamburgerMenuBtn';
      toggle.className='btn xe-hamburger-toggle';
      toggle.setAttribute('aria-label','Abrir menu');
      toggle.setAttribute('aria-controls','topActionsMenu');
      toggle.setAttribute('aria-expanded','false');
      toggle.textContent='☰';
      menu.appendChild(toggle);
      topbar.appendChild(menu);
      toggle.addEventListener('click',e=>{
        e.stopPropagation();
        const open=menu.classList.toggle('open');
        toggle.setAttribute('aria-expanded',open?'true':'false');
      });
    }

    actions.id='topActionsMenu';
    if(actions.parentNode!==menu)menu.appendChild(actions);

    if(!menu.dataset.bound){
      menu.dataset.bound='1';
      actions.addEventListener('click',e=>{
        if(e.target.closest('button'))closeMenu();
      });
    }
  }

  function syncHowToPlay(){
    const modal=document.querySelector('#rulesModal .modal');if(!modal)return;
    let title=modal.querySelector(':scope > h2');
    const actions=modal.querySelector(':scope > .modal-actions');if(!actions)return;
    if(!title){title=document.createElement('h2');modal.prepend(title)}
    if(title.textContent!=='Como jogar')title.textContent='Como jogar';
    let content=modal.querySelector(':scope > .how-to-play-summary');
    for(const child of [...modal.children]){
      if(child===title||child===actions||child===content)continue;
      child.remove();
    }
    if(!content){
      content=document.createElement('div');
      content.className='how-to-play-summary';
      modal.insertBefore(content,actions);
    }
    if(content.innerHTML!==HOW_TO_PLAY_HTML)content.innerHTML=HOW_TO_PLAY_HTML;
  }

  document.addEventListener('click',e=>{
    const menu=document.querySelector('.xe-hamburger-menu');
    if(menu?.classList.contains('open')&&!menu.contains(e.target))closeMenu();
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});

  const previousRender=typeof render==='function'?render:null;
  if(previousRender){
    render=function(){
      const result=previousRender.apply(this,arguments);
      ensureMenu();syncHowToPlay();
      return result;
    };
  }

  const previousRenderActions=typeof renderActions==='function'?renderActions:null;
  if(previousRenderActions){
    renderActions=function(){
      const result=previousRenderActions.apply(this,arguments);
      ensureMenu();syncHowToPlay();
      return result;
    };
  }

  const observer=new MutationObserver(()=>queueMicrotask(()=>{ensureMenu();syncHowToPlay()}));
  observer.observe(document.body,{subtree:true,childList:true});

  ensureMenu();
  syncHowToPlay();
})();
