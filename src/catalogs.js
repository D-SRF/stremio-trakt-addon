import { trakt } from './trakt.js';
export const catalogDefs=[
  {type:'movie',id:'trakt_watchlist_movies',name:'Trakt · Watchlist películas'},
  {type:'series',id:'trakt_watchlist_shows',name:'Trakt · Watchlist series'},
  {type:'movie',id:'trakt_watched_movies',name:'Trakt · Películas vistas'},
  {type:'series',id:'trakt_progress_shows',name:'Trakt · Series vistas (historial)'},
  {type:'movie',id:'trakt_collection_movies',name:'Trakt · Colección películas'},
  {type:'series',id:'trakt_collection_shows',name:'Trakt · Colección series'}
];
export function toMeta(item,type) {
  const obj=item[type==='movie'?'movie':'show'] || item;
  const ids=obj?.ids || {}; const id=ids.imdb || (ids.tmdb?`tmdb:${ids.tmdb}`:null);
  if(!id) return null;
  return {id,type,name:obj.title || 'Sin título', ...(obj.year?{releaseInfo:String(obj.year)}:{})};
}
export async function catalog(userId,type,id,skip=0) {
  const kind=type==='movie'?'movies':'shows'; let rows=[];
  if(id==='trakt_watchlist_movies'||id==='trakt_watchlist_shows') rows=await trakt(userId,`/sync/watchlist/${kind}?extended=full`);
  else if(id==='trakt_collection_movies'||id==='trakt_collection_shows') rows=await trakt(userId,`/sync/collection/${kind}?extended=full`);
  else if(id==='trakt_watched_movies') rows=await trakt(userId,'/sync/watched/movies?extended=full');
  else if(id==='trakt_progress_shows') {
    const watched=await trakt(userId,'/sync/watched/shows?extended=full');
    // Stremio series catalog represents shows, not individual next episodes.
    rows=watched.filter(x=>x.show).map(x=>({show:x.show}));
  } else return null;
  return {metas:rows.map(x=>toMeta(x,type)).filter(Boolean).slice(skip,skip+100)};
}
