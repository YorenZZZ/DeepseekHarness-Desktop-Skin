;(async function(){
  const video=document.getElementById('intro');
  let timing,loaded=false,leaving=false,started=false;
  const post=value=>parent.postMessage({yorenAnimations:value},location.origin);
  const leave=()=>{if(leaving)return;leaving=true;DeepSeekSplash.leave(document);post('leave');};
  window.webkit={messageHandlers:{splash:{postMessage(message){if(message==='skip')leave();}}}};
  window.addEventListener('message',event=>{if(event.source!==parent||event.origin!==location.origin)return;if(event.data?.yorenAnimations==='loaded'){loaded=true;if(started)DeepSeekSplash.loaded(document);if(timing&&video.currentTime>=timing.mainEnd)leave();}});
  document.getElementById('skip').onclick=leave;
  document.addEventListener('keydown',event=>{if(event.key==='Escape')leave();});
  video.addEventListener('error',leave);
  try{
    timing=await fetch('../media/intro.json').then(r=>{if(!r.ok)throw new Error('timeline missing');return r.json();});
    document.body.style.background='rgb('+timing.edge.map(v=>Math.round(v*255)).join(',')+')';
    await DeepSeekSplash.prepare();
    video.src='../media/intro.mp4';
    await video.play();started=true;DeepSeekSplash.play(document,timing);if(loaded)DeepSeekSplash.loaded(document);post('playing');post('ready');
    video.addEventListener('timeupdate',()=>{if(loaded&&video.currentTime>=timing.mainEnd)leave();else if(video.currentTime>=timing.duration-.05)video.currentTime=timing.mainEnd;});
    video.addEventListener('ended',()=>{if(loaded)leave();else{video.currentTime=timing.mainEnd;video.play().catch(leave);}});
  }catch(error){console.warn('Entrance unavailable',error);leave();}
})();
