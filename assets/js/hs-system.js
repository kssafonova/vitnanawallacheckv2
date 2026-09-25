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

    const fields={
      name:schemeRoot.querySelector('[data-scheme-name]'),
      size:schemeRoot.querySelector('[data-scheme-size]'),
      sections:schemeRoot.querySelector('[data-scheme-sections]'),
      active:schemeRoot.querySelector('[data-scheme-active]'),
      opening:schemeRoot.querySelector('[data-scheme-opening]'),
      openPct:schemeRoot.querySelector('[data-scheme-openpct]'),
      passage:schemeRoot.querySelector('[data-scheme-passage]'),
      fit:schemeRoot.querySelector('[data-scheme-fit]'),
      use:schemeRoot.querySelector('[data-scheme-use]')
    };

    const schemes={
      'hs30-left':{
        name:'HS / 30 · активная слева',
        size:'3000 × 2300 мм',
        sections:2,active:1,
        opening:'створка → вправо',
        openPct:'до ≈ 50%',
        passage:'до ≈ 1500 мм',
        fit:'3000 × 2300 мм',
        use:'Классический двухсекционный выход на террасу',
        fixed:[1],moving:[0],dirs:[1],
        openingSide:'left'
      },
      'hs30-right':{
        name:'HS / 30 · активная справа',
        size:'3000 × 2300 мм',
        sections:2,active:1,
        opening:'створка ← влево',
        openPct:'до ≈ 50%',
        passage:'до ≈ 1500 мм',
        fit:'3000 × 2300 мм',
        use:'Зеркальный вариант для планировки с проходом справа',
        fixed:[0],moving:[1],dirs:[-1],
        openingSide:'right'
      },
      'hs36-left':{
        name:'HS / 36 · две створки открываются влево',
        size:'3600 × 2300 мм',
        sections:3,active:2,
        opening:'2 створки ← влево',
        openPct:'до ≈ 66%',
        passage:'до ≈ 2400 мм',
        fit:'3600 × 2300 мм',
        use:'Широкий проход; пакет створок собирается у левой стороны',
        fixed:[0],moving:[1,2],dirs:[-1,-1],
        openingSide:'right-wide'
      },
      'hs36-right':{
        name:'HS / 36 · две створки открываются вправо',
        size:'3600 × 2300 мм',
        sections:3,active:2,
        opening:'2 створки → вправо',
        openPct:'до ≈ 66%',
        passage:'до ≈ 2400 мм',
        fit:'3600 × 2300 мм',
        use:'Широкий проход; пакет створок собирается у правой стороны',
        fixed:[2],moving:[0,1],dirs:[1,1],
        openingSide:'left-wide'
      },
      'hs48':{
        name:'HS / 48 · открывание от центра',
        size:'4800 × 2300 мм',
        sections:4,active:2,
        opening:'← от центра →',
        openPct:'до ≈ 50%',
        passage:'до ≈ 2400 мм',
        fit:'4800 × 2300 мм',
        use:'Симметричный центральный выход для большого панорамного фасада',
        fixed:[0,3],moving:[1,2],dirs:[-1,1],
        openingSide:'center'
      }
    };

    let current='hs30-left';
    let view='diagram';
    let transition=1;
    let raf=0;

    const arrow=(x1,y,x2,color='#151615')=>{
      ctx.strokeStyle=color;
      ctx.fillStyle=color;
      ctx.lineWidth=1.35;
      ctx.beginPath();
      ctx.moveTo(x1,y);
      ctx.lineTo(x2,y);
      ctx.stroke();
      const dir=Math.sign(x2-x1)||1;
      ctx.beginPath();
      ctx.moveTo(x2,y);
      ctx.lineTo(x2-dir*7,y-5);
      ctx.lineTo(x2-dir*7,y+5);
      ctx.closePath();
      ctx.fill();
    };

    const drawPane=(x,y,w,h,{moving=false,fixed=false,label=true}={})=>{
      const grad=ctx.createLinearGradient(x,y,x+w,y+h);
      grad.addColorStop(0,moving?'rgba(247,251,250,.96)':'rgba(219,227,226,.74)');
      grad.addColorStop(1,moving?'rgba(175,198,201,.42)':'rgba(241,242,238,.7)');
      ctx.fillStyle=grad;
      ctx.fillRect(x,y,w,h);
      ctx.strokeStyle=moving?'#161716':'#626661';
      ctx.lineWidth=moving?2:1.2;
      ctx.strokeRect(x,y,w,h);
      if(fixed&&label){
        ctx.fillStyle='rgba(17,17,15,.5)';
        ctx.font='8px Arial';
        ctx.textAlign='center';
        ctx.fillText('FIX',x+w/2,y+h*.52);
      }
    };

    const openingRect=(s,left,top,frameW,frameH)=>{
      const pane=frameW/s.sections;
      if(s.openingSide==='left')return {x:left,y:top,w:pane,h:frameH};
      if(s.openingSide==='right')return {x:left+pane,y:top,w:pane,h:frameH};
      if(s.openingSide==='right-wide')return {x:left+pane,y:top,w:pane*2,h:frameH};
      if(s.openingSide==='left-wide')return {x:left,y:top,w:pane*2,h:frameH};
      if(s.openingSide==='center')return {x:left+pane,y:top,w:pane*2,h:frameH};
      return {x:left,y:top,w:0,h:frameH};
    };

    const drawDiagram=()=>{
      const w=canvas.clientWidth,h=canvas.clientHeight;
      const s=schemes[current];
      ctx.fillStyle='#e9e6de';
      ctx.fillRect(0,0,w,h);

      const pad=w<640?w*.065:w*.09;
      const left=pad,right=w-pad,top=h*.14,bottom=h*.69;
      const frameW=right-left,frameH=bottom-top;
      const gap=Math.max(4,frameW*.009);
      const paneW=(frameW-gap*(s.sections-1))/s.sections;
      const t=ease(transition);

      ctx.strokeStyle='#202120';
      ctx.lineWidth=w<640?5:7;
      ctx.strokeRect(left,top,frameW,frameH);

      for(let i=0;i<s.sections;i++){
        const baseX=left+i*(paneW+gap);
        const moving=s.moving.includes(i);
        const mi=s.moving.indexOf(i);
        const dir=moving?(s.dirs[mi]||1):0;
        const shift=moving?dir*Math.min(paneW*.12,w*.025)*t:0;
        const x=baseX+4+shift,y=top+4,pw=paneW-8,ph=frameH-8;

        drawPane(x,y,pw,ph,{moving,fixed:s.fixed.includes(i)});

        if(moving){
          const yy=y+ph*.61;
          arrow(dir>0?x+pw*.22:x+pw*.78,yy,dir>0?x+pw*.75:x+pw*.25);
          ctx.fillStyle='#151615';
          const handleX=dir>0?x+pw*.12:x+pw*.88-2;
          ctx.fillRect(handleX,y+ph*.43,2,Math.max(20,ph*.13));
        }
      }

      const open=openingRect(s,left,top,frameW,frameH);
      ctx.fillStyle='rgba(169,157,121,.13)';
      ctx.fillRect(open.x,open.y,open.w,open.h);
      ctx.strokeStyle='#9f916e';
      ctx.lineWidth=1.4;
      ctx.setLineDash([5,5]);
      ctx.strokeRect(open.x+2,open.y+2,Math.max(0,open.w-4),Math.max(0,open.h-4));
      ctx.setLineDash([]);

      const dimY=bottom+24;
      ctx.strokeStyle='#8a857a';
      ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(open.x,dimY);
      ctx.lineTo(open.x+open.w,dimY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(open.x,dimY-5);ctx.lineTo(open.x,dimY+5);
      ctx.moveTo(open.x+open.w,dimY-5);ctx.lineTo(open.x+open.w,dimY+5);
      ctx.stroke();
      ctx.fillStyle='#6d695f';
      ctx.font=(w<640?'8px':'9px')+' Arial';
      ctx.textAlign='center';
      ctx.fillText('ОРИЕНТИР ОТКРЫТОЙ ЧАСТИ '+s.openPct.replace('до ≈ ',''),open.x+open.w/2,dimY+16);

      ctx.fillStyle='#77736a';
      ctx.font=(w<640?'8px':'9px')+' Arial';
      ctx.textAlign='left';
      ctx.fillText('СХЕМА ДВИЖЕНИЯ',left,top-18);
      ctx.textAlign='right';
      ctx.fillText(s.sections+' СЕКЦ.',right,top-18);
    };

    const drawFacadePortal=(x,y,w,h,s,open)=>{
      ctx.strokeStyle='#1c1d1b';
      ctx.lineWidth=4;
      ctx.strokeRect(x,y,w,h);

      const paneW=w/s.sections;
      if(!open){
        for(let i=0;i<s.sections;i++){
          drawPane(x+i*paneW+3,y+3,paneW-6,h-6,{moving:s.moving.includes(i),fixed:s.fixed.includes(i),label:false});
        }
        return;
      }

      const op=openingRect(s,x,y,w,h);
      ctx.fillStyle='rgba(214,207,188,.28)';
      ctx.fillRect(op.x+3,op.y+3,Math.max(0,op.w-6),Math.max(0,op.h-6));

      for(const fi of s.fixed){
        drawPane(x+fi*paneW+3,y+3,paneW-6,h-6,{fixed:true,label:false});
      }

      if(s.openingSide==='left'){
        drawPane(x+paneW+5,y+7,paneW-10,h-14,{moving:true,label:false});
      }else if(s.openingSide==='right'){
        drawPane(x+5,y+7,paneW-10,h-14,{moving:true,label:false});
      }else if(s.openingSide==='right-wide'){
        drawPane(x+5,y+7,paneW-10,h-14,{moving:true,label:false});
        drawPane(x+9,y+11,paneW-18,h-22,{moving:true,label:false});
      }else if(s.openingSide==='left-wide'){
        drawPane(x+(s.sections-1)*paneW+5,y+7,paneW-10,h-14,{moving:true,label:false});
        drawPane(x+(s.sections-1)*paneW+9,y+11,paneW-18,h-22,{moving:true,label:false});
      }else if(s.openingSide==='center'){
        drawPane(x+5,y+7,paneW-10,h-14,{moving:true,label:false});
        drawPane(x+(s.sections-1)*paneW+5,y+7,paneW-10,h-14,{moving:true,label:false});
      }
    };

    const drawFacade=()=>{
      const w=canvas.clientWidth,h=canvas.clientHeight;
      const s=schemes[current];

      const sky=ctx.createLinearGradient(0,0,0,h);
      sky.addColorStop(0,'#d9ddda');
      sky.addColorStop(.48,'#efeee8');
      sky.addColorStop(.49,'#c8c0ad');
      sky.addColorStop(1,'#b5aa94');
      ctx.fillStyle=sky;
      ctx.fillRect(0,0,w,h);

      const mobile=w<640;
      const wallX=w*.05,wallY=h*.1,wallW=w*.9,wallH=h*.72;
      ctx.fillStyle='#e4e1d8';
      ctx.fillRect(wallX,wallY,wallW,wallH);

      ctx.fillStyle='#cbc3b3';
      ctx.fillRect(0,h*.82,w,h*.18);
      ctx.strokeStyle='rgba(80,74,65,.22)';
      ctx.lineWidth=1;
      for(let i=0;i<7;i++){
        const yy=h*.82+i*h*.025;
        ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(w,yy);ctx.stroke();
      }

      const gap=mobile?w*.035:w*.05;
      const portalY=wallY+wallH*.24;
      const portalH=wallH*.56;

      if(mobile){
        const cardW=(wallW-gap)/2;
        drawFacadePortal(wallX,portalY,cardW,portalH,s,false);
        drawFacadePortal(wallX+cardW+gap,portalY,cardW,portalH,s,true);
        ctx.fillStyle='#5f5b53';
        ctx.font='8px Arial';
        ctx.textAlign='left';
        ctx.fillText('ЗАКРЫТО',wallX,portalY-10);
        ctx.fillText('ОТКРЫТО',wallX+cardW+gap,portalY-10);
      }else{
        const cardW=(wallW-gap)/2;
        drawFacadePortal(wallX,portalY,cardW,portalH,s,false);
        drawFacadePortal(wallX+cardW+gap,portalY,cardW,portalH,s,true);
        ctx.fillStyle='#5f5b53';
        ctx.font='9px Arial';
        ctx.textAlign='left';
        ctx.fillText('ЗАКРЫТО',wallX,portalY-13);
        ctx.fillText('ОТКРЫТО · '+s.openPct.toUpperCase(),wallX+cardW+gap,portalY-13);
      }

      ctx.fillStyle='rgba(17,17,15,.5)';
      ctx.font=(mobile?'8px':'9px')+' Arial';
      ctx.textAlign='right';
      ctx.fillText('УСЛОВНЫЙ ВИД В ФАСАДЕ',wallX+wallW,wallY+16);
    };

    const draw=()=>{
      if(!ctx||!canvas)return;
      const w=canvas.clientWidth,h=canvas.clientHeight;
      if(!w||!h)return;
      ctx.clearRect(0,0,w,h);
      if(view==='facade')drawFacade();
      else drawDiagram();
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
      fields.size.textContent=s.size;
      fields.sections.textContent=s.sections;
      fields.active.textContent=s.active;
      fields.opening.textContent=s.opening;
      fields.openPct.textContent=s.openPct;
      fields.passage.textContent=s.passage;
      fields.fit.textContent=s.fit;
      fields.use.textContent=s.use;
    };

    const animateIn=()=>{
      cancelAnimationFrame(raf);
      if(reduce){transition=1;draw();return}
      transition=0;
      const start=performance.now();
      const step=now=>{
        transition=clamp((now-start)/480);
        draw();
        if(transition<1)raf=requestAnimationFrame(step);
      };
      raf=requestAnimationFrame(step);
    };

    schemeButtons.forEach(btn=>btn.addEventListener('click',()=>{
      const key=btn.dataset.scheme;
      if(!schemes[key]||key===current)return;
      current=key;
      schemeButtons.forEach(b=>{
        const on=b===btn;
        b.classList.toggle('is-active',on);
        b.setAttribute('aria-selected',String(on));
      });
      updateMeta(schemes[current]);
      animateIn();
    }));

    viewButtons.forEach(btn=>btn.addEventListener('click',()=>{
      const next=btn.dataset.schemeView;
      if(!next||next===view)return;
      view=next;
      viewButtons.forEach(b=>{
        const on=b===btn;
        b.classList.toggle('is-active',on);
        b.setAttribute('aria-pressed',String(on));
      });
      animateIn();
    }));

    updateMeta(schemes[current]);
    if('ResizeObserver'in window)new ResizeObserver(resize).observe(canvas);
    else addEventListener('resize',resize,{passive:true});
    resize();
  }
})();