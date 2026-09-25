(() => {
  const clamp=v=>Math.max(0,Math.min(1,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const ease=t=>1-Math.pow(1-t,3);
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const money=v=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(v);
  const round1000=v=>Math.ceil(v/1000)*1000;

  /* Specification tabs */
  const specTabs=[...document.querySelectorAll('[data-spec-tab]')];
  const specPanels=[...document.querySelectorAll('[data-spec-panel]')];
  const activateSpec=id=>{
    specTabs.forEach(btn=>{
      const on=btn.dataset.specTab===id;
      btn.classList.toggle('is-active',on);
      btn.setAttribute('aria-selected',String(on));
    });
    specPanels.forEach(panel=>panel.classList.toggle('is-active',panel.dataset.specPanel===id));
    requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
  };
  specTabs.forEach(btn=>btn.addEventListener('click',()=>activateSpec(btn.dataset.specTab)));

  /* Lift&Slide mechanism canvas */
  const mechanismRoot=document.querySelector('[data-hs-canvas]');
  if(mechanismRoot){
    const canvas=mechanismRoot.querySelector('#hsSystemCanvas');
    const stage=mechanismRoot.querySelector('.hs-canvas-stage');
    const toggle=mechanismRoot.querySelector('[data-hs-toggle]');
    const state=mechanismRoot.querySelector('[data-hs-state]');
    const ctx=canvas?.getContext('2d',{alpha:true});
    if(canvas&&stage&&toggle&&state&&ctx){
      let p=0,target=0,raf=0,drag=false;

      const glass=(x,y,w,h,frame)=>{
        const g=ctx.createLinearGradient(x,y,x+w,y+h);
        g.addColorStop(0,'rgba(250,252,252,.82)');
        g.addColorStop(.48,'rgba(190,205,206,.22)');
        g.addColorStop(1,'rgba(248,249,246,.72)');
        ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
        ctx.strokeStyle='#202221';ctx.lineWidth=frame;ctx.strokeRect(x,y,w,h);
      };

      const draw=()=>{
        const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
        ctx.clearRect(0,0,w,h);
        const bg=ctx.createLinearGradient(0,0,0,h);
        bg.addColorStop(0,'#f0eee8');bg.addColorStop(1,'#d9d5cb');
        ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);

        const mobile=w<640,left=w*.065,right=w-left,top=h*.14,bottom=h*.79;
        const ow=right-left,oh=bottom-top,fw=mobile?5:8;
        ctx.strokeStyle='#1e201f';ctx.lineWidth=fw;ctx.strokeRect(left,top,ow,oh);

        const leaf=ow*.52,fixed=ow*.48,travel=ow-leaf-fw*.7;
        const lift=Math.min(1,p/.15),slide=p<=.15?0:(p-.15)/.85;
        const liftY=lerp(0,mobile?-5:-8,ease(lift));
        const paneH=oh-(mobile?10:14),fixedX=right-fixed-fw*.35;
        glass(fixedX,top+(mobile?5:7),fixed-(mobile?5:7),paneH,mobile?4:6);

        const ax=left+fw+travel*ease(slide),ay=top+fw+liftY,aw=leaf-fw*.35;
        glass(ax,ay,aw,paneH,mobile?5:7);
        ctx.fillStyle='#151615';ctx.fillRect(ax+12,ay+paneH*.45,3,mobile?30:40);

        const wheelY=bottom-2;
        ctx.fillStyle='#f4f2ec';ctx.strokeStyle='#252625';ctx.lineWidth=1.4;
        [ax+aw*.27,ax+aw*.73].forEach(x=>{ctx.beginPath();ctx.arc(x,wheelY,5,0,Math.PI*2);ctx.fill();ctx.stroke()});

        if(p<.08){ctx.strokeStyle='#9a8660';ctx.lineWidth=2;ctx.strokeRect(ax-3,ay-3,aw+6,paneH+6)}
        state.textContent=p<.02?'Закрыто':p>.98?'Открыто':Math.round(p*100)+'%';
        toggle.textContent=p>.5?'Закрыть':'Открыть';
      };

      const resize=()=>{
        const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
        canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));
        ctx.setTransform(dpr,0,0,dpr,0,0);draw();
      };
      const animate=()=>{
        cancelAnimationFrame(raf);
        if(reduce){p=target;draw();return}
        const step=()=>{p+=(target-p)*.105;if(Math.abs(target-p)<.002){p=target;draw();return}draw();raf=requestAnimationFrame(step)};step();
      };

      toggle.addEventListener('click',()=>{target=p>.5?0:1;animate()});
      stage.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;drag=true;stage.setPointerCapture?.(e.pointerId);cancelAnimationFrame(raf)});
      stage.addEventListener('pointermove',e=>{if(!drag)return;const r=stage.getBoundingClientRect();p=clamp((e.clientX-r.left)/r.width);target=p;draw()});
      const finish=e=>{if(!drag)return;drag=false;target=p>.45?1:0;animate();try{stage.releasePointerCapture?.(e.pointerId)}catch(_){}};
      stage.addEventListener('pointerup',finish);stage.addEventListener('pointercancel',finish);
      if('ResizeObserver'in window)new ResizeObserver(resize).observe(canvas);else addEventListener('resize',resize,{passive:true});
      resize();
    }
  }

  /* Grouped scheme visualizer */
  const schemeRoot=document.querySelector('[data-scheme-ui]');
  if(schemeRoot){
    const canvas=schemeRoot.querySelector('#hsSchemeCanvas');
    const ctx=canvas?.getContext('2d',{alpha:true});
    const familyButtons=[...schemeRoot.querySelectorAll('[data-family]')];
    const variantHost=schemeRoot.querySelector('[data-variant-tabs]');
    const viewButtons=[...schemeRoot.querySelectorAll('[data-scheme-view]')];
    const stateButtons=[...schemeRoot.querySelectorAll('[data-scheme-state]')];
    const fields={
      name:schemeRoot.querySelector('[data-scheme-name]'),status:schemeRoot.querySelector('[data-scheme-status]'),
      size:schemeRoot.querySelector('[data-scheme-size]'),passage:schemeRoot.querySelector('[data-scheme-passage]'),
      openPct:schemeRoot.querySelector('[data-scheme-openpct]'),width:schemeRoot.querySelector('[data-scheme-width]'),
      height:schemeRoot.querySelector('[data-scheme-height]'),sections:schemeRoot.querySelector('[data-scheme-sections]'),
      active:schemeRoot.querySelector('[data-scheme-active]'),opening:schemeRoot.querySelector('[data-scheme-opening]'),
      use:schemeRoot.querySelector('[data-scheme-use]')
    };

    const families={
      hs30:{label:'HS / 30',width:3000,height:2300,variants:{
        left:{label:'Активная слева',name:'HS / 30 · активная слева',sections:2,active:1,moving:[0],fixed:[1],targets:[1],opening:'створка → вправо',passage:'≈ 1500 мм*',openPct:'около 50% проёма',openSlots:[0,1],use:'Выход на террасу'},
        right:{label:'Активная справа',name:'HS / 30 · активная справа',sections:2,active:1,moving:[1],fixed:[0],targets:[0],opening:'створка ← влево',passage:'≈ 1500 мм*',openPct:'около 50% проёма',openSlots:[1,2],use:'Выход на террасу'}
      }},
      hs36:{label:'HS / 36',width:3600,height:2300,variants:{
        left:{label:'2 активные слева',name:'HS / 36 · 2 активные слева',sections:3,active:2,moving:[0,1],fixed:[2],targets:[2,2],opening:'2 створки → вправо',passage:'≈ 2400 мм*',openPct:'около 66% проёма',openSlots:[0,2],use:'Широкий выход'},
        right:{label:'2 активные справа',name:'HS / 36 · 2 активные справа',sections:3,active:2,moving:[1,2],fixed:[0],targets:[0,0],opening:'2 створки ← влево',passage:'≈ 2400 мм*',openPct:'около 66% проёма',openSlots:[1,3],use:'Широкий выход'}
      }},
      hs48:{label:'HS / 48',width:4800,height:2300,variants:{
        center:{label:'Открывание от центра',name:'HS / 48 · от центра',sections:4,active:2,moving:[1,2],fixed:[0,3],targets:[0,3],opening:'← от центра →',passage:'≈ 2400 мм*',openPct:'около 50% проёма',openSlots:[1,3],use:'Главный панорамный выход'}
      }}
    };

    let currentFamily='hs30',currentVariant='left',view='diagram',openProgress=0,openTarget=0,raf=0;
    const current=()=>({...families[currentFamily],...families[currentFamily].variants[currentVariant]});

    const line=(x1,y1,x2,y2,color='#77736a',width=1)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()};
    const arrowHead=(x,y,dir,color='#77736a')=>{ctx.fillStyle=color;ctx.beginPath();if(dir==='left'){ctx.moveTo(x,y);ctx.lineTo(x+6,y-4);ctx.lineTo(x+6,y+4)}else if(dir==='right'){ctx.moveTo(x,y);ctx.lineTo(x-6,y-4);ctx.lineTo(x-6,y+4)}else if(dir==='up'){ctx.moveTo(x,y);ctx.lineTo(x-4,y+6);ctx.lineTo(x+4,y+6)}else{ctx.moveTo(x,y);ctx.lineTo(x-4,y-6);ctx.lineTo(x+4,y-6)}ctx.closePath();ctx.fill()};
    const dimensionH=(x1,x2,y,label)=>{line(x1,y,x2,y,'#756f63',1);arrowHead(x1,y,'left','#756f63');arrowHead(x2,y,'right','#756f63');ctx.fillStyle='#665f55';ctx.font='9px Arial';ctx.textAlign='center';ctx.fillText(label,(x1+x2)/2,y-7)};
    const dimensionV=(x,y1,y2,label)=>{line(x,y1,x,y2,'#756f63',1);arrowHead(x,y1,'up','#756f63');arrowHead(x,y2,'down','#756f63');ctx.save();ctx.translate(x-8,(y1+y2)/2);ctx.rotate(-Math.PI/2);ctx.fillStyle='#665f55';ctx.font='9px Arial';ctx.textAlign='center';ctx.fillText(label,0,0);ctx.restore()};
    const drawPane=(x,y,w,h,moving=false)=>{const g=ctx.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,moving?'rgba(245,250,249,.96)':'rgba(220,228,226,.78)');g.addColorStop(1,moving?'rgba(166,192,196,.46)':'rgba(241,242,238,.74)');ctx.fillStyle=g;ctx.fillRect(x,y,w,h);ctx.strokeStyle=moving?'#171816':'#5f625e';ctx.lineWidth=moving?2:1.2;ctx.strokeRect(x,y,w,h)};
    const geometry=()=>{const w=canvas.clientWidth,h=canvas.clientHeight,mobile=w<640,left=mobile?w*.09:w*.12,right=mobile?w*.94:w*.91,top=mobile?h*.19:h*.16,bottom=mobile?h*.70:h*.72;return{w,h,mobile,left,right,top,bottom,frameW:right-left,frameH:bottom-top}};
    const openingRect=(s,g)=>{const slotW=g.frameW/s.sections;return{x:g.left+s.openSlots[0]*slotW,y:g.top,w:(s.openSlots[1]-s.openSlots[0])*slotW,h:g.frameH}};

    const drawPortal=(s,g)=>{
      const slotW=g.frameW/s.sections,inset=5,paneW=slotW-inset*2,paneH=g.frameH-inset*2,slots=Array.from({length:s.sections},(_,i)=>g.left+i*slotW);
      const op=openingRect(s,g);
      if(openProgress>.03){ctx.fillStyle='rgba(169,157,121,.16)';ctx.fillRect(op.x+2,op.y+2,op.w-4,op.h-4);ctx.strokeStyle='#9f916e';ctx.setLineDash([6,5]);ctx.strokeRect(op.x+2,op.y+2,op.w-4,op.h-4);ctx.setLineDash([])}
      ctx.strokeStyle='#202120';ctx.lineWidth=g.mobile?5:7;ctx.strokeRect(g.left,g.top,g.frameW,g.frameH);
      s.fixed.forEach(i=>drawPane(slots[i]+inset,g.top+inset,paneW,paneH,false));
      s.moving.forEach((i,k)=>{const target=s.targets[k],from=slots[i]+inset,to=slots[target]+inset+(s.targets.filter(t=>t===target).length>1?(k-(s.moving.length-1)/2)*(g.mobile?5:8):0);const x=lerp(from,to,ease(openProgress));drawPane(x,g.top+inset,paneW,paneH,true);ctx.fillStyle='#171816';ctx.fillRect(x+(to>=from?paneW*.12:paneW*.88-2),g.top+paneH*.44,2,Math.max(20,paneH*.13))});
      return op;
    };

    const drawDiagram=()=>{const s=current(),g=geometry();ctx.fillStyle='#e9e6de';ctx.fillRect(0,0,g.w,g.h);const op=drawPortal(s,g);dimensionH(g.left,g.right,g.top-28,s.width+' мм');dimensionV(g.left-24,g.top,g.bottom,s.height+' мм');dimensionH(op.x+3,op.x+op.w-3,g.bottom+28,s.passage.replace('*',''));ctx.fillStyle='#6e695f';ctx.font=(g.mobile?'8px':'9px')+' Arial';ctx.textAlign='center';ctx.fillText(openProgress>.88?'СВОБОДНАЯ ЗОНА ПРОХОДА':'ОТКРЫВАЕМАЯ ЗОНА',op.x+op.w/2,g.bottom+44)};
    const drawFacade=()=>{const s=current(),g0=geometry(),{w,h}=g0;const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#cfd5d2');sky.addColorStop(.52,'#ecebe5');sky.addColorStop(.53,'#c9c0ae');sky.addColorStop(1,'#b3a58f');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);const wallX=w*.04,wallY=h*.09,wallW=w*.92,wallH=h*.72;ctx.fillStyle='#e1ded4';ctx.fillRect(wallX,wallY,wallW,wallH);ctx.fillStyle='#c8bca7';ctx.fillRect(0,h*.81,w,h*.19);const portalW=wallW*(w<640?.88:.72),portalH=wallH*.62,left=wallX+(wallW-portalW)/2,top=wallY+wallH*.23,g={w,h,mobile:w<640,left,right:left+portalW,top,bottom:top+portalH,frameW:portalW,frameH:portalH};drawPortal(s,g);ctx.fillStyle='#57534c';ctx.font=(w<640?'8px':'9px')+' Arial';ctx.textAlign='left';ctx.fillText(s.width+' × '+s.height+' мм',left,top-14);ctx.textAlign='right';ctx.fillText(openProgress>.5?'ОТКРЫТО · '+s.openPct.toUpperCase():'ЗАКРЫТО',left+portalW,top-14)};
    const draw=()=>{if(!ctx||!canvas||!canvas.clientWidth)return;ctx.clearRect(0,0,canvas.clientWidth,canvas.clientHeight);view==='facade'?drawFacade():drawDiagram()};
    const resize=()=>{const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);draw()};
    const animateOpen=()=>{cancelAnimationFrame(raf);if(reduce){openProgress=openTarget;draw();return}const step=()=>{openProgress+=(openTarget-openProgress)*.12;if(Math.abs(openTarget-openProgress)<.002){openProgress=openTarget;draw();return}draw();raf=requestAnimationFrame(step)};step()};

    const renderVariants=()=>{
      const variants=families[currentFamily].variants;
      if(!variants[currentVariant])currentVariant=Object.keys(variants)[0];
      variantHost.innerHTML=Object.entries(variants).map(([key,v])=>`<button type="button" role="tab" aria-selected="${key===currentVariant}" class="${key===currentVariant?'is-active':''}" data-variant="${key}">${v.label}</button>`).join('');
      [...variantHost.querySelectorAll('[data-variant]')].forEach(btn=>btn.addEventListener('click',()=>{currentVariant=btn.dataset.variant;renderVariants();updateMeta();draw()}));
    };
    const updateMeta=()=>{const s=current();fields.name.textContent=s.name;fields.status.textContent=openTarget>.5?'Открыто':'Закрыто';fields.size.textContent=s.width+' × '+s.height+' мм';fields.passage.textContent=s.passage;fields.openPct.textContent=s.openPct;fields.width.textContent=s.width+' мм';fields.height.textContent=s.height+' мм';fields.sections.textContent=s.sections;fields.active.textContent=s.active;fields.opening.textContent=s.opening;fields.use.textContent=s.use};
    familyButtons.forEach(btn=>btn.addEventListener('click',()=>{currentFamily=btn.dataset.family;currentVariant=Object.keys(families[currentFamily].variants)[0];familyButtons.forEach(b=>{const on=b===btn;b.classList.toggle('is-active',on);b.setAttribute('aria-selected',String(on))});renderVariants();updateMeta();draw()}));
    viewButtons.forEach(btn=>btn.addEventListener('click',()=>{view=btn.dataset.schemeView||'diagram';viewButtons.forEach(b=>b.classList.toggle('is-active',b===btn));draw()}));
    stateButtons.forEach(btn=>btn.addEventListener('click',()=>{openTarget=btn.dataset.schemeState==='open'?1:0;stateButtons.forEach(b=>b.classList.toggle('is-active',b===btn));fields.status.textContent=openTarget?'Открыто':'Закрыто';animateOpen()}));

    renderVariants();updateMeta();
    if('ResizeObserver'in window)new ResizeObserver(resize).observe(canvas);else addEventListener('resize',resize,{passive:true});
    resize();
  }

  /* HS-only calculator */
  const calc=document.querySelector('[data-hs-calculator]');
  if(calc){
    const widthInput=calc.querySelector('[data-hs-width]'),heightInput=calc.querySelector('[data-hs-height]');
    const layoutButtons=[...calc.querySelectorAll('[data-layout]')],glassButtons=[...calc.querySelectorAll('[data-glass]')],colorButtons=[...calc.querySelectorAll('[data-color]')],addonInputs=[...calc.querySelectorAll('[data-hs-addon]')];
    const out={layout:calc.querySelector('[data-hs-result-layout]'),price:calc.querySelector('[data-hs-result-price]'),size:calc.querySelector('[data-hs-result-size]'),opening:calc.querySelector('[data-hs-result-opening]'),glass:calc.querySelector('[data-hs-result-glass]'),note:calc.querySelector('[data-hs-result-note]'),preview:calc.querySelector('[data-hs-preview]')};
    const refs={2:{price:375000,w:3000,h:2300,open:.5,label:'2 секции'},3:{price:489000,w:3600,h:2300,open:2/3,label:'3 секции'},4:{price:620000,w:4800,h:2300,open:.5,label:'4 секции · от центра'}};
    let layout=3,glass='climate',glassFactor=1.26,color='white',colorFactor=1;

    const select=(buttons,key,value)=>buttons.forEach(btn=>btn.classList.toggle('is-active',btn.dataset[key]===String(value)));
    const renderPreview=(count)=>{
      const panes=Array.from({length:count},(_,i)=>`<i class="${count===2&&i===0?'is-moving':count===3&&i<2?'is-moving':count===4&&(i===1||i===2)?'is-moving':'is-fixed'}"></i>`).join('');
      out.preview.innerHTML=`<div class="hs-calc-preview__frame hs-calc-preview__frame--${count}">${panes}</div>`;
    };
    const calculate=()=>{
      const w=Number(widthInput.value),h=Number(heightInput.value),ref=refs[layout];
      const leafW=w/layout,valid=Number.isFinite(w)&&Number.isFinite(h)&&w>=1400&&h>=1800&&h<=3100&&leafW>=720&&leafW<=3000;
      out.size.textContent=(w||'—')+' × '+(h||'—')+' мм';out.layout.textContent='HS · '+ref.label;out.opening.textContent='≈ '+Math.round(ref.open*100)+'%';out.glass.textContent=glassButtons.find(b=>b.dataset.glass===glass)?.querySelector('strong,b')?.textContent||glass;renderPreview(layout);
      if(!valid){out.price.textContent='По расчёту';out.note.textContent='Для этих размеров нужна индивидуальная инженерная проверка: подтвердим количество секций, массу стекла и узел монтажа.';return}
      const area=w*h/1e6,refArea=ref.w*ref.h/1e6;
      let price=ref.price*(area/refArea)*glassFactor*colorFactor;
      addonInputs.filter(i=>i.checked).forEach(i=>price+=Number(i.dataset.price)||0);
      out.price.textContent='≈ '+money(round1000(price));
      out.note.textContent='Предварительная оценка по выбранной геометрии и комплектации. Точную цену подтверждаем после проверки стеклопакета, схемы и монтажного узла.';
    };

    layoutButtons.forEach(btn=>btn.addEventListener('click',()=>{layout=Number(btn.dataset.layout);select(layoutButtons,'layout',layout);calculate()}));
    glassButtons.forEach(btn=>btn.addEventListener('click',()=>{glass=btn.dataset.glass;glassFactor=Number(btn.dataset.factor)||1;select(glassButtons,'glass',glass);calculate()}));
    colorButtons.forEach(btn=>btn.addEventListener('click',()=>{color=btn.dataset.color;colorFactor=Number(btn.dataset.factor)||1;select(colorButtons,'color',color);calculate()}));
    addonInputs.forEach(i=>i.addEventListener('change',calculate));
    [widthInput,heightInput].forEach(i=>i.addEventListener('input',calculate));
    calculate();
  }

  /* Project form */
  const form=document.querySelector('#contactForm');
  if(form){
    const status=document.querySelector('#formStatus');
    const fileInput=form.querySelector('input[type="file"]');
    const fileName=form.querySelector('[data-file-name]');
    fileInput?.addEventListener('change',()=>{fileName.textContent=fileInput.files?.[0]?.name||'Выбрать файл'});
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      status.textContent='Отправляем…';
      const btn=form.querySelector('button[type="submit"]');btn.disabled=true;
      try{
        const fd=new FormData(form);
        const res=await fetch(form.dataset.endpoint,{method:'POST',body:fd,headers:{'X-Requested-With':'XMLHttpRequest'}});
        const data=await res.json().catch(()=>({ok:false,message:'Не удалось отправить проект.'}));
        if(!res.ok||!data.ok)throw new Error(data.message||'Не удалось отправить проект.');
        status.textContent='Проект отправлен. Свяжемся с вами после проверки.';
        form.reset();if(fileName)fileName.textContent='Выбрать файл';
      }catch(err){status.textContent=err.message||'Ошибка отправки.'}
      finally{btn.disabled=false}
    });
  }
})();