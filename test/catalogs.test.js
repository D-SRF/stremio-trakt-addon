import test from 'node:test';
import assert from 'node:assert/strict';
import { toMeta, catalogDefs } from '../src/catalogs.js';
test('movie IMDb identifiers are preserved',()=>assert.deepEqual(toMeta({movie:{title:'Example',year:2020,ids:{imdb:'tt1234567'}}},'movie'),{id:'tt1234567',type:'movie',name:'Example',releaseInfo:'2020'}));
test('items without supported IDs are omitted',()=>assert.equal(toMeta({show:{title:'No IDs',ids:{}}},'series'),null));
test('catalog identifiers are unique',()=>assert.equal(new Set(catalogDefs.map(x=>x.id)).size,catalogDefs.length));
