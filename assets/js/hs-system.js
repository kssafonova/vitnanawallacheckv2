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
        g.addColorStop(0,'rgba(250,252,252,.78)');
        g.addColorStop(.48,'rgba(190,205,206,.22)');
        g.addColorStop(1,'rgba(248,249,246,.68)');
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

        ctx.strokeStyle='rgba(17,17,17,.22)';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(left,bottom+9);ctx.lineTo(right,bottom+9);ctx.stroke();

        const wheelY=bottom-2;
        ctx.fillStyle='#f4f2ec';ctx.strokeStyle='#252625';ctx.lineWidth=1.4;
        [ax+aw*.27,ax+aw*.73].forEach(x=>{ctx.beginPath();ctx.arc(x,wheelY,5,0,Math.PI*2);ctx.fill();ctx.stroke()});

        state.textContent=p<.02?'Закрыто':p>.98?'Открыто':Math.round(p*100)+'%';
        toggle.textContent=p>.5?'Закрыть':'Открыть';
      };

      const resize=()=>{
        const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
        canvas.width=Math.max(1,Math.round(r.width*dpr));
        canvas.height=Math.max(1,Math.round(r.height*dpr));
        ctx.setTransform(dpr,0,0,dpr,0,0);draw();
      };

      const animate=()=>{
        cancelAnimationFrame(raf);
        if(reduce){p=target;draw();return}
        const step=()=>{
          p+=(target-p)*.105;
          if(Math.abs(target-p)<.002){p=target;draw();return}
          draw();raf=requestAnimationFrame(step);
        };
        step();
      };

      toggle.addEventListener('click',()=>{target=p>.5?0:1;animate()});
      stage.addEventListener('pointerdown',e=>{
        if(e.pointerType==='mouse'&&e.button!==0)return;
        drag=true;stage.setPointerCapture?.(e.pointerId);cancelAnimationFrame(raf);
      });
      stage.addEventListener('pointermove',e=>{
        if(!drag)return;
        const r=stage.getBoundingClientRect();
        p=clamp((e.clientX-r.left)/r.width);target=p;draw();
      });
      const finish=e=>{
        if(!drag)return;drag=false;target=p>.45?1:0;animate();
        try{stage.releasePointerCapture?.(e.pointerId)}catch(_){}
      };
      stage.addEventListener('pointerup',finish);
      stage.addEventListener('pointercancel',finish);
      if('ResizeObserver'in window)new ResizeObserver(resize).observe(canvas);
      else addEventListener('resize',resize,{passive:true});
      resize();
    }
  }

  /* Available opening schemes canvas */
  const schemeRoot=document.querySelector('[data-scheme-ui]');
  if(schemeRoot){
    const canvas=schemeRoot.querySelector('#hsSchemeCanvas');
    const ctx=canvas?.getContext('2d',{alpha:true});
    const buttons=[...schemeRoot.querySelectorAll('[data-scheme]')];
    const nameEl=schemeRoot.querySelector('[data-scheme-name]');
    const sizeEl=schemeRoot.querySelector('[data-scheme-size]');
    const sectionsEl=schemeRoot.querySelector('[data-scheme-sections]');
    const activeEl=schemeRoot.querySelector('[data-scheme-active]');
    const openingEl=schemeRoot.querySelector('[data-scheme-opening]');
    const passageEl=schemeRoot.querySelector('[data-scheme-passage]');

    const schemes={
      'hs30-left':{name:'HS / 30 · активная слева',size:'3000 × 2300 мм',sections:2,active:1,opening:'вправо',passage:'≈ 50%',fixed:[1],moving:[0],dirs:[1]},
      'hs30-right':{name:'HS / 30 · активная справа',size:'3000 × 2300 мм',sections:2,active:1,opening:'влево',passage:'≈ 50%',fixed:[0],moving:[1],dirs:[-1]},
      'hs36':{name:'HS / 36 · две активные',size:'3600 × 2300 мм',sections:3,active:2,opening:'каскадно',passage:'по расчёту',fixed:[2],moving:[0,1],dirs:[1,1]},
      'hs48':{name:'HS / 48 · от центра',size:'4800 × 2300 мм',sections:4,active:2,opening:'от центра',passage:'≈ 50%',fixed:[0,3],moving:[1,2],dirs:[-1,1]}
    };

    let current='hs30-left',transition=1,raf=0;

    const arrow=(x1,y,x2)=>{
      ctx.strokeStyle='#151615';ctx.fillStyle='#151615';ctx.lineWidth=1.3;
      ctx.beginPath();ctx.moveTo(x1,y);ctx.lineTo(x2,y);ctx.stroke();
      const dir=Math.sign(x2-x1)||1;
      ctx.beginPath();ctx.moveTo(x2,y);ctx.lineTo(x2-dir*7,y-5);ctx.lineTo(x2-dir*7,y+5);ctx.closePath();ctx.fill();
    };

    const draw=()=>{
      if(!ctx||!canvas)return;
      const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
      const s=schemes[current];
      ctx.clearRect(0,0,w,h);
      ctx.fillStyle='#e9e6de';ctx.fillRect(0,0,w,h);

      const pad=w<640?w*.07:w*.095;
      const left=pad,right=w-pad,top=h*.14,bottom=h*.72;
      const frameW=right-left,frameH=bottom-top;
      const gap=Math.max(5,frameW*.012);
      const paneW=(frameW-gap*(s.sections-1))/s.sections;

      ctx.strokeStyle='#202120';ctx.lineWidth=w<640?5:7;
      ctx.strokeRect(left,top,frameW,frameH);

      for(let i=0;i<s.sections;i++){
        const x=left+i*(paneW+gap);
        const isMoving=s.moving.includes(i);
        const t=ease(transition);
        let shift=0;
        if(isMoving){
          const mi=s.moving.indexOf(i),dir=s.dirs[mi]||1;
          shift=dir*Math.min(paneW*.17,w*.035)*t;
        }

        const gx=x+4+shift,gy=top+4,gw=paneW-8,gh=frameH-8;
        const grad=ctx.createLinearGradient(gx,gy,gx+gw,gy+gh);
        grad.addColorStop(0,isMoving?'rgba(244,249,248,.92)':'rgba(218,226,225,.62)');
        grad.addColorStop(1,isMoving?'rgba(180,199,201,.42)':'rgba(238,239,235,.62)');
        ctx.fillStyle=grad;ctx.fillRect(gx,gy,gw,gh);
        ctx.strokeStyle=isMoving?'#151615':'#626661';ctx.lineWidth=isMoving?2:1.2;ctx.strokeRect(gx,gy,gw,gh);

        if(isMoving){
          const dir=s.dirs[s.moving.indexOf(i)]||1;
          const y=gy+gh*.62;
          const ax1=dir>0?gx+gw*.24:gx+gw*.76;
          const ax2=dir>0?gx+gw*.72:gx+gw*.28;
          arrow(ax1,y,ax2);
          ctx.fillStyle='#161716';
          const handleX=dir>0?gx+gw*.12:gx+gw*.88-2;
          ctx.fillRect(handleX,gy+gh*.43,2,Math.max(22,gh*.13));
        }else{
          ctx.fillStyle='rgba(17,17,15,.56)';
          ctx.font=(w<640?'8px':'9px')+' Arial';
          ctx.textAlign='center';
          ctx.fillText('FIX',gx+gw/2,gy+gh*.5);
        }
      }

      ctx.strokeStyle='rgba(17,17,17,.25)';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(left-10,bottom+13);ctx.lineTo(right+10,bottom+13);ctx.stroke();

      ctx.fillStyle='#77736a';
      ctx.font=(w<640?'8px':'9px')+' Arial';
      ctx.textAlign='left';
      ctx.fillText('СХЕМА ДВИЖЕНИЯ',left,top-18);

      ctx.textAlign='right';
      ctx.fillText(s.sections+' СЕКЦИИ',right,top-18);
    };

    const resize=()=>{
      if(!canvas||!ctx)return;
      const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
      canvas.width=Math.max(1,Math.round(r.width*dpr));
      canvas.height=Math.max(1,Math.round(r.height*dpr));
      ctx.setTransform(dpr,0,0,dpr,0,0);draw();
    };

    const updateMeta=s=>{
      nameEl.textContent=s.name;sizeEl.textContent=s.size;
      sectionsEl.textContent=s.sections;activeEl.textContent=s.active;
      openingEl.textContent=s.opening;passageEl.textContent=s.passage;
    };

    const animateIn=()=>{
      cancelAnimationFrame(raf);
      if(reduce){transition=1;draw();return}
      transition=0;
      const start=performance.now();
      const step=now=>{
        transition=clamp((now-start)/520);draw();
        if(transition<1)raf=requestAnimationFrame(step);
      };
      raf=requestAnimationFrame(step);
    };

    buttons.forEach(btn=>btn.addEventListener('click',()=>{
      const key=btn.dataset.scheme;if(!schemes[key]||key===current)return;
      current=key;
      buttons.forEach(b=>{const on=b===btn;b.classList.toggle('is-active',on);b.setAttribute('aria-selected',String(on))});
      updateMeta(schemes[current]);animateIn();
    }));

    updateMeta(schemes[current]);
    if('ResizeObserver'in window)new ResizeObserver(resize).observe(canvas);
    else addEventListener('resize',resize,{passive:true});
    resize();
  }
})();