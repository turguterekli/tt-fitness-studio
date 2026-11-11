(function(){
  const store = window.__fakeStore = JSON.parse(sessionStorage.getItem('__fakeStore')||'{}');
  window.__writes = [];
  const persist = () => sessionStorage.setItem('__fakeStore', JSON.stringify(store));
  const clone = v => v===undefined?undefined:JSON.parse(JSON.stringify(v));
  let idc = 0;
  function checkFS(v, path, inArr){
    if(Array.isArray(v)){ if(inArr) throw new Error('Nested arrays not supported at '+path); v.forEach((x,i)=>checkFS(x,path+'['+i+']',true)); }
    else if(v && typeof v==='object'){ Object.keys(v).forEach(k=>checkFS(v[k],path+'.'+k,false)); }
    else if(v===undefined) throw new Error('Unsupported field value: undefined at '+path);
    else if(typeof v==='number' && Number.isNaN(v)) {/* firestore allows NaN */}
  }
  function docRef(path){
    const parts = path.split('/'); const id = parts[parts.length-1];
    return { id, path,
      get: async () => ({ exists: path in store, id, data: () => clone(store[path]) }),
      set: async (data, opts) => { checkFS(data,path,false); const s = JSON.stringify(data); if(s.length>1048576) throw new Error('Document too large: '+path+' '+s.length);
        store[path] = (opts&&opts.merge) ? Object.assign({}, store[path]||{}, clone(data)) : clone(data); window.__writes.push(path); persist(); },
    };
  }
  function coll(name){ return {
    doc: id => docRef(name+'/'+(id||('auto'+(++idc)+'_'+Date.now()))),
    get: async () => { const docs = Object.keys(store).filter(k=>k.startsWith(name+'/') && k.split('/').length===2).map(k=>({id:k.split('/')[1], data:()=>clone(store[k])}));
      return { empty: !docs.length, size: docs.length, docs, forEach: f => docs.forEach(f) }; }
  };}
  const db = { collection: coll, doc: docRef,
    batch(){ const ops=[]; return { set:(r,d,o)=>ops.push([r,d,o]), delete:()=>{}, commit: async()=>{ for(const [r,d,o] of ops) await r.set(d,o); } }; } };
  window.firebase = {
    initializeApp(){ return {}; },
    firestore: () => db,
    auth: () => ({ signInAnonymously: async () => ({ user: { uid: 'anon' } }), currentUser: { uid: 'anon' } }),
    storage: () => ({ ref: () => ({ child: p => ({ putString: async () => {}, getDownloadURL: async () => 'https://example.invalid/'+p }) }) }),
  };
})();
