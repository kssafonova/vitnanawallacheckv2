const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const frameColor=ral=>ral==='9016'?'#efeee8':ral==='7016'?'#3d4347':ral==='7024'?'#50545a':'#111';
const glassStroke=ral=>ral==='9016'?'#5e5b54':'#eeeae2';

function label(ctx,txt,x,y,align='left',size=10,color='#6d6961'){
  ctx.save();ctx.fillStyle=color;ctx.textAlign=align;ctx.font=`${size}px Inter,Arial,sans-serif`;ctx.fillText(txt,x,y);ctx.restore();
}
function arrow(ctx,x1,y1,x2,y2){
  ctx.save();ctx.strokeStyle='#111';ctx.fillStyle='#111';ctx.lineWidth=1.35;
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  const a=Math.atan2(y2-y1,x2-x1),s=7;
  ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-s*Math.cos(a-Math.PI/6),y2-s*Math.sin(a-Math.PI/6));ctx.lineTo(x2-s*Math.cos(a+Math.PI/6),y2-s*Math.sin(a+Math.PI/6));ctx.closePath();ctx.fill();ctx.restore();
}
function panel(ctx,x,y,w,h,fill,stroke,mark,handle=false,alpha=1){
  ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=1.2;
  ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);ctx.globalAlpha=alpha*.58;ctx.strokeRect(x+7,y+7,w-14,h-14);ctx.globalAlpha=alpha;
  ctx.fillStyle=stroke;ctx.font='9px Inter,Arial,sans-serif';ctx.fillText(mark,x+9,y+14);
  if(handle)ctx.fillRect(x+w-11,y+h/2-9,2,18);ctx.restore();
}
function base(ctx,W,H){
  ctx.clearRect(0,0,W,H);ctx.fillStyle='#f3f1ea';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#c9c4ba';ctx.strokeRect(.5,.5,W-1,H-1);
}
function drawHS(ctx,d,t){
  const W=ctx.canvas.width,H=ctx.canvas.height;base(ctx,W,H);
  const x=25,y=36,fw=W-50,fh=157,by=H-31,seg=fw/d.sections,fill=frameColor(d.ral),st=glassStroke(d.ral),o=ease(t);
  ctx.strokeStyle='#a9a49a';ctx.strokeRect(x,y,fw,fh);
  label(ctx,`${d.model} · ${d.scheme}`,x,18);label(ctx,d.caption,W-25,18,'right');

  if(d.scheme==='A1'){
    panel(ctx,x+seg,y,seg,fh,fill,st,'F');
    panel(ctx,lerp(x,x+seg,o),y+4,seg,fh-8,fill,'#111','A',true);
    arrow(ctx,x+seg*.5,by,x+seg*1.5,by);
  }else if(d.scheme==='B1'){
    panel(ctx,x,y,seg,fh,fill,st,'F');
    panel(ctx,lerp(x+seg,x,o),y+4,seg,fh-8,fill,'#111','A',true);
    arrow(ctx,x+seg*1.5,by,x+seg*.5,by);
  }else if(d.scheme==='D1'){
    // Two active leaves move sequentially to the fixed panel on the right.
    panel(ctx,x+2*seg,y,seg,fh,fill,st,'F');
    panel(ctx,lerp(x+seg,x+2*seg,o),y+4,seg,fh-8,fill,'#111','A',true);
    panel(ctx,lerp(x,x+seg,clamp((o-.16)/.84)),y+8,seg,fh-16,fill,'#111','A');
    arrow(ctx,x+seg*.45,by,x+seg*2.55,by);
  }else if(d.scheme==='A7'){
    panel(ctx,x,y,seg,fh,fill,st,'F');
    panel(ctx,x+3*seg,y,seg,fh,fill,st,'F');
    panel(ctx,lerp(x+seg,x,o),y+4,seg,fh-8,fill,'#111','A',true);
    panel(ctx,lerp(x+2*seg,x+3*seg,o),y+4,seg,fh-8,fill,'#111','A',true);
    arrow(ctx,x+seg*1.5,by,x+seg*.5,by);
    arrow(ctx,x+seg*2.5,by,x+seg*3.5,by);
  }
}
function foldLeaf(ctx,cx,cy,w,h,angle,fill,stroke,mark){
  ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=1.2;
  ctx.fillRect(0,-h,w,h);ctx.strokeRect(0,-h,w,h);ctx.globalAlpha=.55;ctx.strokeRect(6,-h+6,w-12,h-12);ctx.globalAlpha=1;
  ctx.fillStyle=stroke;ctx.font='9px Inter,Arial,sans-serif';ctx.fillText(mark,8,-h+14);ctx.restore();
}
function drawFS(ctx,d,t){
  const W=ctx.canvas.width,H=ctx.canvas.height;base(ctx,W,H);
  const x=25,y=36,fw=W-50,fh=157,by=H-31,seg=fw/d.sections,fill=frameColor(d.ral),st=glassStroke(d.ral),o=ease(t);
  ctx.strokeStyle='#a9a49a';ctx.strokeRect(x,y,fw,fh);
  label(ctx,`${d.model} · ${d.scheme}`,x,18);label(ctx,d.caption,W-25,18,'right');

  // Closed reference behind the moving leaves.
  for(let i=0;i<d.sections;i++) panel(ctx,x+i*seg,y,seg,fh,fill,st,(d.model==='FS4'&&((d.scheme==='431-L'&&i===3)||(d.scheme==='431-R'&&i===0)))?'D':'A',false,.28);

  if(d.scheme.startsWith('330')){
    const left=d.scheme==='330-L', side=left?x:x+fw, dir=left?1:-1, angle=(Math.PI*.46)*o;
    for(let i=0;i<3;i++){
      const cx=side + dir*(8+i*12*o);
      foldLeaf(ctx,cx,by-8,seg*.92,fh-14,(left?1:-1)*(i%2===0?angle:-angle),fill,'#111','A');
    }
    if(left)arrow(ctx,x+fw-22,by,x+22,by); else arrow(ctx,x+22,by,x+fw-22,by);
  }else{
    const left=d.scheme==='431-L';
    // Three-leaf folding group + one opposite-side passage leaf.
    const groupSide=left?x:x+fw, dir=left?1:-1, angle=(Math.PI*.46)*o;
    for(let i=0;i<3;i++){
      const cx=groupSide + dir*(8+i*12*o);
      foldLeaf(ctx,cx,by-8,seg*.9,fh-14,(left?1:-1)*(i%2===0?angle:-angle),fill,'#111','A');
    }
    const doorX=left?x+3*seg:x;
    panel(ctx,doorX,y,seg,fh,fill,'#111','D',true,1);
    if(left)arrow(ctx,x+fw-24,by,x+24,by); else arrow(ctx,x+24,by,x+fw-24,by);
  }
}
function init(){
  document.querySelectorAll('.opening-canvas').forEach(canvas=>{
    const d=JSON.parse(canvas.dataset.opening),ctx=canvas.getContext('2d');
    const draw=v=>d.model.startsWith('HS')?drawHS(ctx,d,v):drawFS(ctx,d,v);
    draw(0);
    const range=canvas.closest('.config-shell')?.querySelector('input[type=range]');
    range?.addEventListener('input',()=>draw(Number(range.value)/100));
  });
}
document.addEventListener('DOMContentLoaded',init);
