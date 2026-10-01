#!/usr/bin/env node
/**
 * @file Checks the generated app screens (`vamApp.generated.ts`): every layer file of
 * every option and colour exists under `public/vam/x/`, and the materials of one
 * surface (laminate / clapboard / parquet / MDF / tile / ceiling) share the same
 * outline, so switching material never moves a surface. Run after importVamApp.mjs.
 */
import sharp from 'sharp';
import fs from 'node:fs';
const t=fs.readFileSync('src/pages/Configurator/vamApp.generated.ts','utf8');
const M=JSON.parse(t.slice(t.indexOf('= {')+2,t.lastIndexOf('};')+1));
const cache=new Map();
async function mask(rel){ if(cache.has(rel))return cache.get(rel); const {data}=await sharp('public/vam/x/'+rel).ensureAlpha().raw().toBuffer({resolveWithObject:true}); const m=new Uint8Array(640000); for(let i=0;i<640000;i++)m[i]=data[i*4+3]>128?1:0; cache.set(rel,m); if(cache.size>60)cache.delete(cache.keys().next().value); return m;}
function iou(a,b){let i=0,u=0;for(let k=0;k<640000;k++){if(a[k]&&b[k])i++;if(a[k]||b[k])u++;}return u?i/u:1;}
let missing=0,total=0,bad=[];
for(const [sid,views] of Object.entries(M)) for(const [vi,v] of views.entries()) for(const h of v.hotspots) for(const s of h.slots){
  // files
  for(const o of s.options) for(const c of o.colors) for(const l of o.layers){ total++; if(!fs.existsSync(`public/vam/x/${l.p}${c.k}.webp`)){missing++;console.log('MISSING',sid,h.id,o.id,l.p,c.k);} }
  // geometry: compare layer j of each option (first colour) with the first option's layer j (same view)
  const opts=s.options;
  if(opts.length>1 && ['wall','ceiling','floor'].includes(h.kind)){
    const base=opts[0];
    for(const o of opts.slice(1)){
      for(const [j,l] of o.layers.entries()){
        const bl=base.layers.find(x=>x.v===l.v&&x.p.match(/stena(\d+)/)?.[1]===l.p.match(/stena(\d+)/)?.[1]);
        if(!bl) continue;
        const r=iou(await mask(`${bl.p}${base.colors[0].k}.webp`),await mask(`${l.p}${o.colors[0].k}.webp`));
        if(r<0.985) bad.push(`S${sid} H${h.id} ${base.id} vs ${o.id} ${l.p}: IoU ${r.toFixed(3)}`);
      }
    }
  }
}
console.log('layer files checked',total,'missing',missing);
console.log(bad.length?bad.slice(0,40).join('\n'):'all material variants share identical outlines (IoU>=0.97)');
