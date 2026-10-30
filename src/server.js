import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { config, validateConfig, randomToken } from './config.js';
validateConfig();
const { db, hashSecret, getUser, putUser, deleteUser, cleanup } = await import('./store.js');
const { exchangeCode, profile, trakt, TraktError } = await import('./trakt.js');
const { catalogDefs, catalog } = await import('./catalogs.js');
const app=express(); if(process.env.TRUST_PROXY==='1') app.set('trust proxy',1);
app.disable('x-powered-by'); app.use(helmet({contentSecurityPolicy:false})); app.use(express.json({limit:'16kb'}));
app.use(rateLimit({windowMs:60000,limit:120,standardHeaders:'draft-7',legacyHeaders:false}));
const sign=s=>createHmac('sha256',config.sessionSecret).update(s).digest('base64url');
function parseCookie(req,name) { return (req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1); }
function session(req) {
  const raw=parseCookie(req,'trakt_session'); if(!raw) return null;
  const [sid,mac]=raw.split('.'); if(!sid||!mac) return null;
  const expected=Buffer.from(sign(sid)),actual=Buffer.from(mac);
  if(expected.length!==actual.length||!timingSafeEqual(expected,actual)) return null;
  const row=db.prepare('SELECT user_id FROM sessions WHERE sid=? AND expires_at>?').get(hashSecret(sid),Date.now()); return row?.user_id||null;
}
function setSession(res,id) { const sid=randomToken();db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hashSecret(sid),id,Date.now()+30*86400000);res.cookie('trakt_session',`${sid}.${sign(sid)}`,{httpOnly:true,secure:config.publicUrl.startsWith('https:'),sameSite:'lax',maxAge:30*86400000,path:'/'}); }
function requireSession(req,res,next) { req.userId=session(req);if(!req.userId)return res.status(401).json({error:'Sign in with Trakt first'});next(); }
const manifest={id:'community.stremio.trakt.companion',version:'1.0.0',name:'Trakt Companion',description:'Your personal Trakt watchlist, history and collection in Stremio. Playback scrobbling requires a compatible playback integration.',resources:['catalog'],types:['movie','series'],catalogs:catalogDefs,behaviorHints:{configurable:true,configurationRequired:true}};
app.get('/health',(_req,res)=>res.json({ok:true}));
app.get('/',(_req,res)=>res.type('html').send(readFileSync(join(process.cwd(),'public/index.html'),'utf8')));
app.get('/auth/start',(_req,res)=>{
  cleanup(); const state=randomToken();db.prepare('INSERT INTO oauth_states VALUES(?,?)').run(hashSecret(state),Date.now()+600000);
  const p=new URLSearchParams({response_type:'code',client_id:config.clientId,redirect_uri:`${config.publicUrl}/auth/callback`,state});
  res.redirect(`https://trakt.tv/oauth/authorize?${p}`);
});
app.get('/auth/callback',async(req,res,next)=>{
  try {
    const {state,code}=req.query;
    if(typeof state!=='string'||typeof code!=='string') return res.status(400).send('Missing authorization code');
    const result=db.prepare('DELETE FROM oauth_states WHERE state=? AND expires_at>?').run(hashSecret(state),Date.now());
    if(result.changes!==1) return res.status(400).send('Expired or invalid OAuth state');
    const token=await exchangeCode(code); const p=await profile(token.access_token); const username=p?.user?.ids?.slug;
    if(!username) throw Error('Trakt did not return a user slug');
    // Random opaque ID prevents enumeration of usernames in personalized addon URLs.
    const id=randomToken();putUser(id,token);setSession(res,id);res.redirect('/');
  } catch(e){next(e);}
});
app.get('/api/me',requireSession,(req,res)=>res.json({connected:true,installUrl:`${config.publicUrl}/u/${encodeURIComponent(req.userId)}/manifest.json`,stremioUrl:`stremio://${config.publicUrl.replace(/^https?:\/\//,'')}/u/${encodeURIComponent(req.userId)}/manifest.json`}));
app.post('/api/disconnect',requireSession,(req,res)=>{deleteUser(req.userId);res.clearCookie('trakt_session',{path:'/'});res.json({ok:true});});
app.get('/u/:id/manifest.json',(req,res)=>{if(!getUser(req.params.id))return res.status(404).json({error:'Not found'});res.json(manifest);});
app.get(['/u/:id/catalog/:type/:catalogId.json','/u/:id/catalog/:type/:catalogId/:extra.json'],async(req,res,next)=>{
  try {
    const {id,type,catalogId,extra}=req.params;
    if(!getUser(id))return res.status(404).json({metas:[]});
    if(!catalogDefs.some(x=>x.id===catalogId&&x.type===type))return res.status(404).json({metas:[]});
    const skip=Number(new URLSearchParams((extra||'').replace(/\.json$/,'')).get('skip')||0);
    const result=await catalog(id,type,catalogId,Number.isInteger(skip)&&skip>=0?skip:0);
    res.set('Cache-Control','private, max-age=120').json(result);
  } catch(e){next(e);}
});
app.get('/api/progress',requireSession,async(req,res,next)=>{
  try {
    const [playback,movies,shows]=await Promise.all([trakt(req.userId,'/sync/playback?extended=full'),trakt(req.userId,'/sync/watched/movies'),trakt(req.userId,'/sync/watched/shows')]);
    res.set('Cache-Control','no-store').json({playback,moviesWatched:movies.length,showsWatched:shows.length,source:'Trakt',note:'Playback progress reflects data already present in Trakt; this addon does not read Stremio player position.'});
  } catch(e){next(e);}
});
app.use((err,req,res,_next)=>{console.error(err);res.status(err instanceof TraktError&&err.status===401?502:500).json({error:'Service temporarily unavailable'});});
app.listen(config.port,()=>console.log(`Trakt Companion listening on :${config.port}`));
