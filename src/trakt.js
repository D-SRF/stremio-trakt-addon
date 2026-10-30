import { config } from './config.js';
import { getUser, putUser } from './store.js';
const BASE='https://api.trakt.tv';
export class TraktError extends Error { constructor(status,message){super(message);this.status=status;} }
async function request(path,{method='GET',token,body}={}) {
  const r=await fetch(`${BASE}${path}`,{method,headers:{'Content-Type':'application/json','trakt-api-version':'2','trakt-api-key':config.clientId,...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  if(r.status===204) return null;
  if(!r.ok) throw new TraktError(r.status,`Trakt API ${r.status} at ${path}`);
  return r.json();
}
export async function exchangeCode(code) { return request('/oauth/token',{method:'POST',body:{code,client_id:config.clientId,client_secret:config.clientSecret,redirect_uri:`${config.publicUrl}/auth/callback`,grant_type:'authorization_code'}}); }
const refreshInFlight=new Map();
export async function accessToken(id) {
  const user=getUser(id); if(!user) throw new TraktError(401,'Account disconnected');
  if(user.token.created_at*1000+user.token.expires_in*1000 > Date.now()+60000) return user.token.access_token;
  if(!refreshInFlight.has(id)) refreshInFlight.set(id,(async()=>{
    const fresh=await request('/oauth/token',{method:'POST',body:{refresh_token:user.token.refresh_token,client_id:config.clientId,client_secret:config.clientSecret,redirect_uri:`${config.publicUrl}/auth/callback`,grant_type:'refresh_token'}});
    putUser(id,fresh); return fresh.access_token;
  })().finally(()=>refreshInFlight.delete(id)));
  return refreshInFlight.get(id);
}
export async function trakt(id,path,opts={}) { return request(path,{...opts,token:await accessToken(id)}); }
export async function profile(token) { return request('/users/settings',{token}); }
