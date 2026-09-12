const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const CONTENT = path.join(ROOT, 'content', 'articles');
const DOMAIN = 'https://readaiglobally.com';

function esc(s='') { return String(s).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function cleanOut() { fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(OUT,{recursive:true}); }
function copy(src,dest){ fs.cpSync(src,dest,{recursive:true}); }
function dateObj(a){ const d=new Date(`${a.date || '1970-01-01'}T${a.time || '00:00'}:00`); return isNaN(d)?new Date(0):d; }
function fmtShort(date){ const d=new Date(date+'T12:00:00'); return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
function fmtLong(date){ const d=new Date(date+'T12:00:00'); return d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}); }
function articleUrl(a){ return `/articles/${a.slug}.html`; }

function parseScalar(v){
  v=v.trim();
  if((v.startsWith('"')&&v.endsWith('"')) || (v.startsWith("'")&&v.endsWith("'"))){
    try { return v.startsWith('"') ? JSON.parse(v) : v.slice(1,-1).replace(/''/g,"'"); } catch { return v.slice(1,-1); }
  }
  if(v==='true') return true;
  if(v==='false') return false;
  if(v==='null' || v==='~') return null;
  return v;
}
function parseFrontmatter(raw){
  if(!raw.startsWith('---')) return {data:{},content:raw};
  const end=raw.indexOf('\n---',3);
  if(end<0) return {data:{},content:raw};
  const fm=raw.slice(4,end).split(/\r?\n/);
  const data={};
  for(const line of fm){
    if(!line.trim() || /^\s/.test(line)) continue;
    const m=line.match(/^([^:]+):\s*(.*)$/);
    if(m) data[m[1].trim()]=parseScalar(m[2]);
  }
  return {data,content:raw.slice(end+4).replace(/^\r?\n/,'')};
}
function inlineMarkdown(s){
  let x=esc(s);
  x=x.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>');
  x=x.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
  x=x.replace(/__([^_]+)__/g,'<strong>$1</strong>');
  x=x.replace(/\*([^*]+)\*/g,'<em>$1</em>');
  x=x.replace(/`([^`]+)`/g,'<code>$1</code>');
  return x;
}
function renderMarkdown(md){
  const lines=md.replace(/\r/g,'').split('\n');
  let out=[], para=[], inUl=false, inOl=false;
  const flushPara=()=>{ if(para.length){ out.push(`<p>${inlineMarkdown(para.join(' '))}</p>`); para=[]; } };
  const closeLists=()=>{ if(inUl){out.push('</ul>');inUl=false;} if(inOl){out.push('</ol>');inOl=false;} };
  for(const line of lines){
    if(/^###\s+/.test(line)){flushPara();closeLists();out.push(`<h3>${inlineMarkdown(line.replace(/^###\s+/,''))}</h3>`);continue;}
    if(/^##\s+/.test(line)){flushPara();closeLists();out.push(`<h2>${inlineMarkdown(line.replace(/^##\s+/,''))}</h2>`);continue;}
    if(/^#\s+/.test(line)){flushPara();closeLists();out.push(`<h1>${inlineMarkdown(line.replace(/^#\s+/,''))}</h1>`);continue;}
    let m=line.match(/^[-*]\s+(.+)/); if(m){flushPara();if(inOl){out.push('</ol>');inOl=false;}if(!inUl){out.push('<ul>');inUl=true;}out.push(`<li>${inlineMarkdown(m[1])}</li>`);continue;}
    m=line.match(/^\d+\.\s+(.+)/); if(m){flushPara();if(inUl){out.push('</ul>');inUl=false;}if(!inOl){out.push('<ol>');inOl=true;}out.push(`<li>${inlineMarkdown(m[1])}</li>`);continue;}
    if(!line.trim()){flushPara();closeLists();continue;}
    para.push(line.trim());
  }
  flushPara();closeLists();return out.join('\n');
}
function readArticles(){
  return fs.readdirSync(CONTENT).filter(f=>f.endsWith('.md')).map(file=>{
    const raw=fs.readFileSync(path.join(CONTENT,file),'utf8');
    const parsed=parseFrontmatter(raw);
    const slug=path.basename(file,'.md');
    return {...parsed.data, slug, body:parsed.content, html:renderMarkdown(parsed.content)};
  }).sort((a,b)=>dateObj(b)-dateObj(a));
}
const header=(depth='')=>`<header class="site-header"><div class="container header-row"><div><a href="${depth}index.html" class="brand">AI GLOBALLY</a><div class="tagline">News, analysis and context for a more AI-driven world.</div></div><nav class="nav-box" aria-label="Primary"><a href="${depth}index.html#latest">NEWS</a><a href="${depth}index.html#insights">INSIGHTS</a><a href="${depth}index.html#explainers">EXPLAINERS</a><a href="${depth}about.html">ABOUT</a><span class="search-icon">⌕</span><span class="mobile-menu">☰</span></nav></div></header>`;
function pageHead(title, description, canonical, type='website', schema=''){
  const cssPath=canonical.includes('/articles/')?'../styles.css':'styles.css';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}"><link rel="stylesheet" href="${cssPath}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="${type}"><meta property="og:url" content="${canonical}">${schema?`<script type="application/ld+json">${schema}</script>`:''}</head><body>`;
}
function renderHome(articles){
  const popular=articles.filter(a=>a.featured_home===true).slice(0,2);
  const latest=articles.filter(a=>a.type==='News').slice(0,5);
  const insights=articles.filter(a=>a.type==='Insight').slice(0,3);
  const explainers=articles.filter(a=>a.type==='Explainer').slice(0,2);
  const popularHtml=popular.map((a,i)=>`<article class="pop-item searchable${i%2?' reverse':''}"><a class="story-media" href="${articleUrl(a)}"><img src="${a.image||'/assets/agents.svg'}" alt="${esc(a.image_alt||'Abstract technology illustration')}"></a><div class="story-copy"><h2 class="story-title"><a href="${articleUrl(a)}">${esc(a.title)}</a></h2><div class="byline"><div class="avatar">FS</div><div><strong>${esc(a.author||'Fara Sidhik')}</strong><span>${esc(a.type)} · ${fmtShort(a.date)}</span></div></div></div></article>`).join('');
  const latestHtml=latest.map(a=>`<a class="latest-row searchable" href="${articleUrl(a)}"><span class="latest-time">${esc(a.time||fmtShort(a.date))}</span><span class="latest-head">${esc(a.title)}</span><span class="latest-arrow">→</span></a>`).join('');
  const insightHtml=insights.map(a=>`<a class="card searchable" href="${articleUrl(a)}"><img src="${a.image||'/assets/architecture.svg'}" alt="${esc(a.image_alt||'')}" loading="lazy"><h3 class="card-title">${esc(a.title)}</h3><div class="card-meta">${fmtShort(a.date)}</div></a>`).join('');
  const explainerHtml=explainers.map(a=>`<a class="explain-item searchable" href="${articleUrl(a)}"><img src="${a.image||'/assets/waves.svg'}" alt="${esc(a.image_alt||'')}" loading="lazy"><div class="explain-copy"><h3>${esc(a.title)}</h3><p>${esc(a.meta_description||'')}</p><div class="card-meta">${fmtShort(a.date)}</div></div></a>`).join('');
  const schema=JSON.stringify({'@context':'https://schema.org','@type':'NewsMediaOrganization','name':'AI Globally','url':DOMAIN+'/'});
  return `${pageHead('AI Globally | AI News, Insights and Explainers','AI Globally covers the AI developments that matter, with concise news, industry context, insights and explainers.',DOMAIN+'/', 'website', schema)}${header('')}<div class="container discovery-row"><label class="search-box"><span class="search-mark">⌕</span><input id="siteSearch" placeholder="Search articles, topics, companies..." aria-label="Search articles"></label><nav class="category-box" aria-label="Topics"><a href="#" class="active">ALL</a><a href="#">INNOVATION</a><a href="#">POLICY</a><a href="#">BUSINESS</a><a href="#">INFRASTRUCTURE</a><a href="#">PEOPLE</a><a href="#">MORE</a></nav></div><main class="container"><section class="main-grid"><div class="popular"><h1 class="section-title"><span>POPULAR NEWS</span></h1>${popularHtml}</div><aside class="latest" id="latest"><h2 class="section-title"><span>LATEST NEWS</span></h2><div class="latest-list">${latestHtml}</div></aside></section><section class="lower-grid"><div class="insights" id="insights"><h2 class="sub-title">INSIGHTS</h2><div class="insight-grid">${insightHtml}</div></div><div class="explainers" id="explainers"><h2 class="sub-title">EXPLAINERS</h2>${explainerHtml}</div></section></main><footer class="container site-footer"><div><div class="footer-brand">AI GLOBALLY</div><div class="tagline">News, analysis and context for a more AI-driven world.</div></div><div class="footer-links"><a href="about.html">About</a><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Contact</a><span>© 2026 AI Globally</span></div></footer><script>const input=document.getElementById('siteSearch');input?.addEventListener('input',()=>{const q=input.value.toLowerCase().trim();document.querySelectorAll('.searchable').forEach(el=>{el.style.opacity=!q||el.innerText.toLowerCase().includes(q)?'1':'.18';});});</script></body></html>`;
}
function renderArticle(a, articles){
  const news=a.type==='News';
  let related=(news?articles.filter(x=>x.type==='News'):articles.filter(x=>x.type===a.type)).filter(x=>x.slug!==a.slug).slice(0,5);
  if(related.length<5) related=[...related,...articles.filter(x=>x.slug!==a.slug&&!related.some(r=>r.slug===x.slug)).slice(0,5-related.length)];
  const sidebar=related.map((x,i)=>`<a href="${x.slug}.html" class="sidebar-story"><span class="sidebar-number">${String(i+1).padStart(2,'0')}</span><span class="sidebar-headline">${esc(x.title)}</span></a>`).join('');
  const keys=[a.key_point_1,a.key_point_2,a.key_point_3].filter(Boolean).map(k=>`<li>${esc(k)}</li>`).join('');
  const schema=JSON.stringify({'@context':'https://schema.org','@type':news?'NewsArticle':'Article','headline':a.title,'datePublished':a.date,'author':{'@type':'Person','name':a.author||'Fara Sidhik'},'publisher':{'@type':'Organization','name':'AI Globally'}});
  const img=a.image?`<figure class="article-featured"><img src="${a.image}" alt="${esc(a.image_alt||'')}" width="1200" height="675"></figure>`:'';
  const backType=news?'NEWS':a.type==='Insight'?'INSIGHTS':'EXPLAINERS';
  const backHash=news?'latest':a.type==='Insight'?'insights':'explainers';
  return `${pageHead(a.seo_title||a.title+' | AI Globally',a.meta_description||'',`${DOMAIN}${articleUrl(a)}`,'article',schema)}${header('../')}<main class="article-page container"><a href="../index.html#${backHash}" class="article-back">← BACK TO ${backType}</a><div class="article-layout"><article class="article-shell"><div class="kicker">${esc(a.type)}</div><h1>${esc(a.title)}</h1><div class="article-meta">By ${esc(a.author||'Fara Sidhik')} · ${fmtLong(a.date)} · AI Globally</div>${img}<div class="keypoints"><h2>Key Points</h2><ul>${keys}</ul></div>${a.html}</article><aside class="article-sidebar"><h2 class="sidebar-title">${news?'LATEST STORIES':'RELATED STORIES'}</h2><div class="sidebar-list">${sidebar}</div></aside></div></main></body></html>`;
}
function build(){
  cleanOut();
  const articles=readArticles();
  copy(path.join(ROOT,'assets'),path.join(OUT,'assets'));
  copy(path.join(ROOT,'styles.css'),path.join(OUT,'styles.css'));
  if(fs.existsSync(path.join(ROOT,'about.html'))) copy(path.join(ROOT,'about.html'),path.join(OUT,'about.html'));
  fs.writeFileSync(path.join(OUT,'index.html'),renderHome(articles));
  fs.mkdirSync(path.join(OUT,'articles'),{recursive:true});
  for(const a of articles) fs.writeFileSync(path.join(OUT,'articles',`${a.slug}.html`),renderArticle(a,articles));
  const urls=[DOMAIN+'/',DOMAIN+'/about.html',...articles.map(a=>DOMAIN+articleUrl(a))];
  fs.writeFileSync(path.join(OUT,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u=>`  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>`);
  fs.writeFileSync(path.join(OUT,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${DOMAIN}/sitemap.xml\n`);
  console.log(`Built ${articles.length} articles into dist/`);
}
build();
