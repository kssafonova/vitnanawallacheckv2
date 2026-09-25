(() => {
  const clamp=v=>Math.max(0,Math.min(1,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const ease=t=>1-Math.pow(1-t,3);
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Lift&Slide mechanism canvas */
  const mechanismRoot=document.querySelector('[data-hs-canvas]');
  if(mechanismRoot){
    const canvas=mechanismRoot.querySelector('#hsSystemCanvas');
    const stage=mechanismRoot.querySelector('.hs-canvas-stage');
    const toggle=mechanismRoot.querySelector('[data-hs-toggle]');
    const state=mechanismRoot.querySelector('[data-hs-state]');
    const ctx=canvas?.getContext('2d',{alpha:true});

    if(canvas&&ctx&&stage&&toggle&&state){
      let p=0,target=0,raf=0,drag=false;

      const glass=(x,y,w,h,frame)=>{
        const g=ctx.createLinearGradient(x,y,x+w,y+h);
        g.addColorStop(0,'rgba(250,252,252,.8)');
        g.addColorStop(.48,'rgba(190,205,206,.22)');
        g.addColorStop(1,'rgba(248,249,246,.7)');
        ctx.fillStyle=g;
        ctx.fillRect(x,y,w,h);
        ctx.strokeStyle='#202221';
        ctx.lineWidth=frame;
        ctx.strokeRect(x,y,w,h);
      };

      const draw=()=>{
        const w=canvas.clientWidth,h=canvas.clientHeight;
        if(!w||!h)return;
        ctx.clearRect(0,0,w,h);

        const bg=ctx.createLinearGradient(0,0,0,h);
        bg.addColorStop(0,'#f0eee8');
        bg.addColorStop(1,'#d9d5cb');
        ctx.fillStyle=bg;
        ctx.fillRect(0,0,w,h);

        const mobile=w<640;
        const left=w*.065,right=w-left,top=h*.14,bottom=h*.79;
        const ow=right-left,oh=bottom-top,fw=mobile?5:8;
        ctx.strokeStyle='#1e201f';
        ctx.lineWidth=fw;
        ctx.strokeRect(left,top,ow,oh);

        const leaf=ow*.52,fixed=ow*.48,travel=ow-leaf-fw*.7;
        const lift=Math.min(1,p/.15);
        const slide=p<=.15?0:(p-.15)/.85;
        const liftY=lerp(0,mobile?-5:-8,ease(lift));
        const paneH=oh-(mobile?10:14);
        const fixedX=right-fixed-fw*.35;

        glass(fixedX,top+(mobile?5:7),fixed-(mobile?5:7),paneH,mobile?4:6);
        const ax=left+fw+travel*ease(slide),ay=top+fw+liftY,aw=leaf-fw*.35;
        glass(ax,ay,aw,paneH,mobile?5:7);

        ctx.fillStyle='#151615';
        ctx.fillRect(ax+12,ay+paneH*.45,3,mobile?30:40);

        ctx.strokeStyle='rgba(17,17,17,.22)';
        ctx.lineWidth=1;
        ctx.beginPath();
        ctx.moveTo(left,bottom+9);
        ctx.lineTo(right,bottom+9);
        ctx.stroke();

        const wheelY=bottom-2;
        ctx.fillStyle='#f4f2ec';
        ctx.strokeStyle='#252625';
        ctx.lineWidth=1.4;
        [ax+aw*.27,ax+aw*.73].forEach(x=>{
          ctx.beginPath();
          ctx.arc(x,wheelY,5,0,Math.PI*2);
          ctx.fill();
          ctx.stroke();
        });

        if(p<.08){
          ctx.strokeStyle='#9a8660';
          ctx.lineWidth=2;
          ctx.strokeRect(ax-3,ay-3,aw+6,paneH+6);
        }

        state.textContent=p<.02?'Закрыто':p>.98?'Открыто':Math.round(p*100)+'%';
        toggle.textContent=p>.5?'Закрыть':'Открыть';
      };

      const resize=()=>{
        const r=canvas.getBoundingClientRect();
        const dpr=Math.min(devicePixelRatio||1,2);
        canvas.width=Math.max(1,Math.round(r.width*dpr));
        canvas.height=Math.max(1,Math.round(r.height*dpr));
        ctx.setTransform(dpr,0,0,dpr,0,0);
        draw();
      };

      const animate=()=>{
        cancelAnimationFrame(raf);
        if(reduce){p=target;draw();return}
        const step=()=>{
          p+=(target-p)*.105;
          if(Math.abs(target-p)<.002){p=target;draw();return}
          draw();
          raf=requestAnimationFrame(step);
        };
        step();
      };

      toggle.addEventListener('click',()=>{target=p>.5?0:1;animate()});
      stage.addEventListener('pointerdown',e=>{
        if(e.pointerType==='mouse'&&e.button!==0)return;
        drag=true;
        stage.setPointerCapture?.(e.pointerId);
        cancelAnimationFrame(raf);
      });
      stage.addEventListener('pointermove',e=>{
        if(!drag)return;
        const r=stage.getBoundingClientRect();
        p=clamp((e.clientX-r.left)/r.width);
        target=p;
        draw();
      });
      const finish=e=>{
        if(!drag)return;
        drag=false;
        target=p>.45?1:0;
        animate();
        try{stage.releasePointerCapture?.(e.pointerId)}catch(_){}
      };
      stage.addEventListener('pointerup',finish);
      stage.addEventListener('pointercancel',finish);

      if('ResizeObserver'in window)new ResizeObserver(resize).observe(canvas);
      else addEventListener('resize',resize,{passive:true});
      resize();
    }
  }

  /* Product scheme / facade visualizer */
  const schemeRoot=document.querySelector('[data-scheme-ui]');
  if(schemeRoot){
    const canvas=schemeRoot.querySelector('#hsSchemeCanvas');
    const ctx=canvas?.getContext('2d',{alpha:true});
    const schemeButtons=[...schemeRoot.querySelectorAll('[data-scheme]')];
    const viewButtons=[...schemeRoot.querySelectorAll('[data-scheme-view]')];
    const stateButtons=[...schemeRoot.querySelectorAll('[data-scheme-state]')];
    const sizeButtons=[...schemeRoot.querySelectorAll('[data-size-chip]')];

    const fields={
      name:schemeRoot.querySelector('[data-scheme-name]'),
      status:schemeRoot.querySelector('[data-scheme-status]'),
      size:schemeRoot.querySelector('[data-scheme-size]'),
      passage:schemeRoot.querySelector('[data-scheme-passage]'),
      openPct:schemeRoot.querySelector('[data-scheme-openpct]'),
      width:schemeRoot.querySelector('[data-scheme-width]'),
      height:schemeRoot.querySelector('[data-scheme-height]'),
      sections:schemeRoot.querySelector('[data-scheme-sections]'),
      active:schemeRoot.querySelector('[data-scheme-active]'),
      opening:schemeRoot.querySelector('[data-scheme-opening]'),
      use:schemeRoot.querySelector('[data-scheme-use]'),
      summary:schemeRoot.querySelector('[data-scheme-summary]')
    };

    const schemes={
      'hs30-left':{
        name:'HS / 30 · активная слева',
        width:3000,height:2300,sections:2,active:1,
        moving:[0],fixed:[1],targets:[1],
        opening:'створка → вправо',
        passage:'≈ 1500 мм*',openPct:'около 50% проёма',
        openSlots:[0,1],
        use:'Выход на террасу',
        summary:'Классический двухсекционный портал: одна створка уходит за соседнюю секцию и освобождает примерно половину проёма.'
      },
      'hs30-right':{
        name:'HS / 30 · активная справа',
        width:3000,height:2300,sections:2,active:1,
        moving:[1],fixed:[0],targets:[0],
        opening:'створка ← влево',
        passage:'≈ 1500 мм*',openPct:'около 50% проёма',
        openSlots:[1,2],
        use:'Выход на террасу',
        summary:'Зеркальная схема: проход формируется справа, а активная створка уходит к левой фиксированной секции.'
      },
      'hs36-left':{
        name:'HS / 36 · 2 активные слева',
        width:3600,height:2300,sections:3,active:2,
        moving:[0,1],fixed:[2],targets:[2,2],
        opening:'2 створки → вправо',
        passage:'≈ 2400 мм*',openPct:'около 66% проёма',
        openSlots:[0,2],
        use:'Широкий выход на террасу',
        summary:'Две активные створки расположены слева и при открывании собираются у правой фиксированной секции, освобождая примерно две трети проёма.'
      },
      'hs36-right':{
        name:'HS / 36 · 2 активные справа',
        width:3600,height:2300,sections:3,active:2,
        moving:[1,2],fixed:[0],targets:[0,0],
        opening:'2 створки ← влево',
        passage:'≈ 2400 мм*',openPct:'около 66% проёма',
        openSlots:[1,3],
        use:'Широкий выход на террасу',
        summary:'Две активные створки расположены справа и при открывании собираются у левой фиксированной секции, оставляя широкий свободный проход.'
      },
      'hs48':{
        name:'HS / 48 · открывание от центра',
        width:4800,height:2300,sections:4,active:2,
        moving:[1,2],fixed:[0,3],targets:[0,3],
        opening:'← от центра →',
        passage:'≈ 2400 мм*',openPct:'около 50% проёма',
        openSlots:[1,3],
        use:'Главный панорамный выход',
        summary:'Две центральные створки расходятся к краям и открывают симметричный проход примерно на половину ширины фасада.'
      }
    };

    let current='hs30-left';
    let view='diagram';
    let openProgress=0;
    let openTarget=0;
    let raf=0;

    const line=(x1,y1,x2,y2,color='#77736a',width=1)=>{
      ctx.strokeStyle=color;ctx.lineWidth=width;
      ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
    };

    const arrowHead=(x,y,dir,color='#77736a')=>{
      ctx.fillStyle=color;
      ctx.beginPath();
      if(dir==='left'){ctx.moveTo(x,y);ctx.lineTo(x+6,y-4);ctx.lineTo(x+6,y+4)}
      else if(dir==='right'){ctx.moveTo(x,y);ctx.lineTo(x-6,y-4);ctx.lineTo(x-6,y+4)}
      else if(dir==='up'){ctx.moveTo(x,y);ctx.lineTo(x-4,y+6);ctx.lineTo(x+4,y+6)}
      else{ctx.moveTo(x,y);ctx.lineTo(x-4,y-6);ctx.lineTo(x+4,y-6)}
      ctx.closePath();ctx.fill();
    };

    const dimensionH=(x1,x2,y,label)=>{
      line(x1,y,x2,y,'#756f63',1);
      arrowHead(x1,y,'left','#756f63');
      arrowHead(x2,y,'right','#756f63');
      ctx.fillStyle='#665f55';
      ctx.font='9px Arial';
      ctx.textAlign='center';
      ctx.fillText(label,(x1+x2)/2,y-7);
    };

    const dimensionV=(x,y1,y2,label)=>{
      line(x,y1,x,y2,'#756f63',1);
      arrowHead(x,y1,'up','#756f63');
      arrowHead(x,y2,'down','#756f63');
      ctx.save();
      ctx.translate(x-8,(y1+y2)/2);
      ctx.rotate(-Math.PI/2);
      ctx.fillStyle='#665f55';
      ctx.font='9px Arial';
      ctx.textAlign='center';
      ctx.fillText(label,0,0);
      ctx.restore();
    };

    const glassFill=(x,y,w,h,moving)=>{
      const g=ctx.createLinearGradient(x,y,x+w,y+h);
      g.addColorStop(0,moving?'rgba(245,250,249,.96)':'rgba(220,228,226,.78)');
      g.addColorStop(1,moving?'rgba(166,192,196,.46)':'rgba(241,242,238,.74)');
      ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
    };

    const drawPane=(x,y,w,h,{moving=false,fixed=false,stack=0}={})=>{
      glassFill(x,y,w,h,moving);
      ctx.strokeStyle=moving?'#171816':'#5f625e';
      ctx.lineWidth=moving?2:1.2;
      ctx.strokeRect(x,y,w,h);
      if(stack){
        ctx.strokeStyle='rgba(17,17,15,.24)';
        ctx.strokeRect(x+stack,y+stack,w,h);
      }
      if(fixed&&openProgress<.08){
        ctx.fillStyle='rgba(17,17,15,.45)';
        ctx.font='8px Arial';ctx.textAlign='center';
        ctx.fillText('FIX',x+w/2,y+h*.52);
      }
    };

    const animateOpen=()=>{
      cancelAnimationFrame(raf);
      if(reduce){openProgress=openTarget;draw();return}
      const step=()=>{
        openProgress+=(openTarget-openProgress)*.12;
        if(Math.abs(openTarget-openProgress)<.002){
          openProgress=openTarget;draw();return;
        }
        draw();raf=requestAnimationFrame(step);
      };
      step();
    };

    const geometry=()=>{
      const w=canvas.clientWidth,h=canvas.clientHeight;
      const mobile=w<640;
      const left=mobile?w*.09:w*.12;
      const right=mobile?w*.94:w*.91;
      const top=mobile?h*.19:h*.16;
      const bottom=mobile?h*.70:h*.72;
      return {w,h,mobile,left,right,top,bottom,frameW:right-left,frameH:bottom-top};
    };

    const paneSlots=(s,g)=>{
      const slotW=g.frameW/s.sections;
      return Array.from({length:s.sections},(_,i)=>g.left+i*slotW);
    };

    const openingRect=(s,g)=>{
      const slotW=g.frameW/s.sections;
      return {
        x:g.left+s.openSlots[0]*slotW,
        y:g.top,
        w:(s.openSlots[1]-s.openSlots[0])*slotW,
        h:g.frameH
      };
    };

    const drawPortal=(s,g,{facade=false}={})=>{
      const slots=paneSlots(s,g);
      const slotW=g.frameW/s.sections;
      const inset=facade?3:5;
      const paneW=slotW-inset*2;
      const paneH=g.frameH-inset*2;
      const open=openingRect(s,g);

      if(openProgress>.03){
        ctx.fillStyle=facade?'rgba(201,190,160,.20)':'rgba(169,157,121,.16)';
        ctx.fillRect(open.x+2,open.y+2,open.w-4,open.h-4);
        ctx.strokeStyle=facade?'rgba(142,126,85,.55)':'#9f916e';
        ctx.lineWidth=1.3;ctx.setLineDash([6,5]);
        ctx.strokeRect(open.x+2,open.y+2,open.w-4,open.h-4);
        ctx.setLineDash([]);
      }

      ctx.strokeStyle='#202120';
      ctx.lineWidth=facade?4:(g.mobile?5:7);
      ctx.strokeRect(g.left,g.top,g.frameW,g.frameH);

      // fixed panes first
      for(const fi of s.fixed){
        drawPane(slots[fi]+inset,g.top+inset,paneW,paneH,{fixed:true});
      }

      // moving panes animate all the way to their target slot
      s.moving.forEach((mi,k)=>{
        const targetSlot=s.targets[k];
        const stackOffset=(s.targets.filter(t=>t===targetSlot).length>1)
          ? (k-(s.moving.length-1)/2)*(g.mobile?5:8)
          : 0;
        const from=slots[mi]+inset;
        const to=slots[targetSlot]+inset+stackOffset;
        const x=lerp(from,to,ease(openProgress));
        drawPane(x,g.top+inset,paneW,paneH,{moving:true,stack:openProgress>.85?Math.sign(stackOffset)*2:0});

        if(openProgress<.88){
          const dir=to>from?1:-1;
          const y=g.top+g.frameH*.62;
          const x1=x+paneW*(dir>0?.25:.75);
          const x2=x+paneW*(dir>0?.72:.28);
          line(x1,y,x2,y,'#171816',1.25);
          arrowHead(x2,y,dir>0?'right':'left','#171816');
        }

        ctx.fillStyle='#171816';
        const handleX=x+(to>=from?paneW*.12:paneW*.88-2);
        ctx.fillRect(handleX,g.top+paneH*.44,2,Math.max(20,paneH*.13));
      });

      return open;
    };

    const drawDiagram=()=>{
      const s=schemes[current],g=geometry();
      ctx.fillStyle='#e9e6de';ctx.fillRect(0,0,g.w,g.h);

      const open=drawPortal(s,g);

      // overall opening dimensions
      dimensionH(g.left,g.right,g.top-28,s.width+' мм');
      dimensionV(g.left-24,g.top,g.bottom,s.height+' мм');

      // opening dimension
      const y=g.bottom+28;
      dimensionH(open.x+3,open.x+open.w-3,y,s.passage.replace('*',''));

      ctx.fillStyle='#6e695f';
      ctx.font=(g.mobile?'8px':'9px')+' Arial';
      ctx.textAlign='center';
      ctx.fillText(openProgress>.88?'СВОБОДНАЯ ЗОНА ПРОХОДА':'ОТКРЫВАЕМАЯ ЗОНА',open.x+open.w/2,y+16);

      ctx.textAlign='left';
      ctx.fillText('ГОТОВЫЙ ПРОЁМ',g.left,g.top-43);
      ctx.textAlign='right';
      ctx.fillText(openProgress>.5?'ОТКРЫТО':'ЗАКРЫТО',g.right,g.top-43);
    };

    const drawFacade=()=>{
      const s=schemes[current];
      const g0=geometry();
      const {w,h,mobile}=g0;

      const sky=ctx.createLinearGradient(0,0,0,h);
      sky.addColorStop(0,'#cfd5d2');
      sky.addColorStop(.52,'#ecebe5');
      sky.addColorStop(.53,'#c9c0ae');
      sky.addColorStop(1,'#b3a58f');
      ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);

      const wallX=w*.04,wallY=h*.09,wallW=w*.92,wallH=h*.72;
      ctx.fillStyle='#e1ded4';ctx.fillRect(wallX,wallY,wallW,wallH);
      ctx.fillStyle='#c8bca7';ctx.fillRect(0,h*.81,w,h*.19);

      line(0,h*.81,w,h*.81,'rgba(65,60,53,.28)',1);
      for(let i=1;i<7;i++) line(0,h*.81+i*h*.027,w,h*.81+i*h*.027,'rgba(65,60,53,.13)',1);

      const portalW=wallW*(mobile?.88:.72);
      const portalH=wallH*.62;
      const left=wallX+(wallW-portalW)/2;
      const top=wallY+wallH*.23;
      const g={w,h,mobile,left,right:left+portalW,top,bottom:top+portalH,frameW:portalW,frameH:portalH};

      drawPortal(s,g,{facade:true});

      ctx.fillStyle='#57534c';
      ctx.font=(mobile?'8px':'9px')+' Arial';
      ctx.textAlign='left';
      ctx.fillText(s.width+' × '+s.height+' мм',left,top-14);
      ctx.textAlign='right';
      ctx.fillText(openProgress>.5?'ОТКРЫТО · '+s.openPct.toUpperCase():'ЗАКРЫТО',left+portalW,top-14);

      if(openProgress>.55){
        const op=openingRect(s,g);
        ctx.fillStyle='rgba(255,255,255,.82)';
        ctx.fillRect(op.x+op.w*.08,top+portalH*.42,op.w*.84,32);
        ctx.fillStyle='#282720';
        ctx.font=(mobile?'8px':'10px')+' Arial';
        ctx.textAlign='center';
        ctx.fillText('ПРОХОД '+s.passage.replace('*',''),op.x+op.w/2,top+portalH*.42+20);
      }

      ctx.fillStyle='rgba(17,17,15,.46)';
      ctx.font=(mobile?'8px':'9px')+' Arial';
      ctx.textAlign='right';
      ctx.fillText('УСЛОВНЫЙ ВИД В ФАСАДЕ',wallX+wallW,wallY+16);
    };

    const draw=()=>{
      if(!ctx||!canvas)return;
      const w=canvas.clientWidth,h=canvas.clientHeight;
      if(!w||!h)return;
      ctx.clearRect(0,0,w,h);
      view==='facade'?drawFacade():drawDiagram();
    };

    const resize=()=>{
      if(!canvas||!ctx)return;
      const r=canvas.getBoundingClientRect();
      const dpr=Math.min(devicePixelRatio||1,2);
      canvas.width=Math.max(1,Math.round(r.width*dpr));
      canvas.height=Math.max(1,Math.round(r.height*dpr));
      ctx.setTransform(dpr,0,0,dpr,0,0);
      draw();
    };

    const updateMeta=s=>{
      fields.name.textContent=s.name;
      fields.status.textContent=openTarget>.5?'Открыто':'Закрыто';
      fields.size.textContent=s.width+' × '+s.height+' мм';
      fields.passage.textContent=s.passage;
      fields.openPct.textContent=s.openPct;
      fields.width.textContent=s.width+' мм';
      fields.height.textContent=s.height+' мм';
      fields.sections.textContent=s.sections;
      fields.active.textContent=s.active;
      fields.opening.textContent=s.opening;
      fields.use.textContent=s.use;
      fields.summary.textContent=s.summary;

      sizeButtons.forEach(b=>b.classList.toggle('is-active',Number(b.dataset.sizeChip)===s.width));
    };

    const setState=state=>{
      openTarget=state==='open'?1:0;
      stateButtons.forEach(b=>{
        const on=b.dataset.schemeState===state;
        b.classList.toggle('is-active',on);
        b.setAttribute('aria-pressed',String(on));
      });
      fields.status.textContent=state==='open'?'Открыто':'Закрыто';
      animateOpen();
    };

    const setScheme=key=>{
      if(!schemes[key])return;
      current=key;
      schemeButtons.forEach(b=>{
        const on=b.dataset.scheme===key;
        b.classList.toggle('is-active',on);
        b.setAttribute('aria-selected',String(on));
      });
      updateMeta(schemes[current]);
      draw();
    };

    schemeButtons.forEach(btn=>btn.addEventListener('click',()=>setScheme(btn.dataset.scheme)));

    sizeButtons.forEach(btn=>btn.addEventListener('click',()=>{
      const target=btn.dataset.targetScheme;
      if(target)setScheme(target);
    }));

    viewButtons.forEach(btn=>btn.addEventListener('click',()=>{
      view=btn.dataset.schemeView||'diagram';
      viewButtons.forEach(b=>{
        const on=b===btn;
        b.classList.toggle('is-active',on);
        b.setAttribute('aria-pressed',String(on));
      });
      draw();
    }));

    stateButtons.forEach(btn=>btn.addEventListener('click',()=>setState(btn.dataset.schemeState)));

    updateMeta(schemes[current]);
    if('ResizeObserver'in window)new ResizeObserver(resize).observe(canvas);
    else addEventListener('resize',resize,{passive:true});
    resize();
  }
})();