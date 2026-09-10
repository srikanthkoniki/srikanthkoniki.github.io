const menu=document.querySelector('.menu'), links=document.querySelector('.navlinks');
menu?.addEventListener('click',()=>links.classList.toggle('open'));
document.querySelectorAll('.navlinks a').forEach(a=>a.addEventListener('click',()=>links.classList.remove('open')));
const sections=[...document.querySelectorAll('main section')];
const nav=[...document.querySelectorAll('.navlinks a')];
const obs=new IntersectionObserver(entries=>{
  entries.forEach(e=>{if(e.isIntersecting){nav.forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+e.target.id));}});
},{rootMargin:'-40% 0px -50% 0px'});
sections.forEach(s=>obs.observe(s));
