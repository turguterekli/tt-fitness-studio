// Testler için sahte (tarayıcı içinde çalışan) Firebase. Veriler localStorage'da tutulur ve aynı
// tarayıcı bağlamındaki sayfalar arasında paylaşılır — böylece "iki cihaz aynı anda açık"
// senaryosu da (canlı eşitleme, onSnapshot) test edilebilir. Gerçek veritabanına dokunmaz.
(function(){
  // Her belge localStorage'da AYRI bir anahtarda tutulur ('__fs:' + yol). Tek büyük kayıt kullanılsaydı,
  // iki sayfa ("iki cihaz") aynı anda farklı belgelere yazdığında biri diğerinin yazdığını ezebilirdi.
  const PREFIX = '__fs:';
  const SEED_KEY = '__fakeStore'; // testlerin başlangıç verisi (tek seferde belgelere dağıtılır)
  (function importSeed(){
    const seed = localStorage.getItem(SEED_KEY);
    if(!seed) return;
    const docs = JSON.parse(seed);
    Object.keys(docs).forEach(p => { if(localStorage.getItem(PREFIX + p) === null) localStorage.setItem(PREFIX + p, JSON.stringify(docs[p])); });
    localStorage.removeItem(SEED_KEY);
  })();
  const readDoc = (path) => { const raw = localStorage.getItem(PREFIX + path); return raw === null ? undefined : JSON.parse(raw); };
  const load = () => {
    const out = {};
    for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if(k && k.startsWith(PREFIX)) out[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k)); }
    return out;
  };
  window.__fakeDump = load; // testler veritabanının tamamını buradan okur
  const chan = new BroadcastChannel('__fakeFirestore');
  window.__writes = [];
  const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  const isFV = v => v && typeof v === 'object' && v.__fv;
  let idc = 0;
  // "Kısıtlı kurallar" modu: localStorage.__fakeRules === 'legacy' ise app_data altında yalnızca
  // eski belgelere (appState, memberPackages) izin verilir, toplu okuma da reddedilir.
  const restricted = () => localStorage.getItem('__fakeRules') === 'legacy';
  const denied = path => restricted() && path.startsWith('app_data/') && !['app_data/appState', 'app_data/memberPackages'].includes(path);
  const guard = path => { if(denied(path)) throw new Error('permission-denied: ' + path); };

  class FieldPath { constructor(...segs){ if(segs.some(s => typeof s !== 'string' || !s)) throw new Error('Invalid FieldPath segment'); this.segs = segs; } }
  const FieldValue = { delete: () => ({ __fv: 'delete' }), increment: n => ({ __fv: 'inc', n }) };

  function validate(v, path, inArr){
    if(isFV(v)) return;
    if(Array.isArray(v)){ if(inArr) throw new Error('Nested arrays are not supported: ' + path); v.forEach((x,i) => validate(x, path+'['+i+']', true)); }
    else if(v && typeof v === 'object'){ Object.keys(v).forEach(k => validate(v[k], path+'.'+k, false)); }
    else if(v === undefined) throw new Error('Unsupported field value: undefined at ' + path);
  }
  function resolveFV(v, prev){
    if(isFV(v)) return v.__fv === 'inc' ? (typeof prev === 'number' ? prev : 0) + v.n : undefined;
    return clone(v);
  }
  function deepMerge(target, src){
    Object.keys(src).forEach(k => {
      const v = src[k];
      if(isFV(v)){ const r = resolveFV(v, target[k]); if(r === undefined) delete target[k]; else target[k] = r; }
      else if(v && typeof v === 'object' && !Array.isArray(v)){
        if(!target[k] || typeof target[k] !== 'object' || Array.isArray(target[k])) target[k] = {};
        deepMerge(target[k], v);
      } else target[k] = clone(v);
    });
    return target;
  }
  function applySet(store, path, data, opts){
    validate(data, path, false);
    store[path] = (opts && opts.merge) ? deepMerge(clone(store[path] || {}), data) : deepMerge({}, data);
  }
  function applyUpdate(store, path, args){
    if(!(path in store)) throw new Error('No document to update: ' + path);
    const doc = clone(store[path]);
    const pairs = [];
    if(args.length === 1 && !(args[0] instanceof FieldPath)) Object.keys(args[0]).forEach(k => pairs.push([k.split('.'), args[0][k]]));
    else for(let i = 0; i < args.length; i += 2) pairs.push([args[i] instanceof FieldPath ? args[i].segs : String(args[i]).split('.'), args[i+1]]);
    pairs.forEach(([segs, v]) => {
      validate(v, path + '/' + segs.join('.'), false);
      let o = doc;
      for(let i = 0; i < segs.length - 1; i++){ if(!o[segs[i]] || typeof o[segs[i]] !== 'object') o[segs[i]] = {}; o = o[segs[i]]; }
      const last = segs[segs.length - 1];
      const r = resolveFV(v, o[last]);
      if(r === undefined) delete o[last]; else o[last] = r;
    });
    store[path] = doc;
  }
  function commit(mutate, paths){
    paths.forEach(guard);
    // Yalnızca ilgili belgeler taze okunur, değiştirilir ve geri yazılır
    const store = {};
    paths.forEach(p => { const d = readDoc(p); if(d !== undefined) store[p] = d; });
    mutate(store);
    paths.forEach(p => { const size = JSON.stringify(store[p] || {}).length; if(size > 1048576) throw new Error('Document exceeds 1MB: ' + p + ' (' + size + ')'); });
    paths.forEach(p => { if(p in store) localStorage.setItem(PREFIX + p, JSON.stringify(store[p])); else localStorage.removeItem(PREFIX + p); });
    paths.forEach(p => window.__writes.push(p));
    notify();
    chan.postMessage('changed');
  }

  // ---- Dinleyiciler (onSnapshot) ----
  const listeners = [];
  function collDocs(store, name){ return Object.keys(store).filter(k => k.startsWith(name + '/') && k.split('/').length === 2); }
  function makeDocSnap(path, data){ return { id: path.split('/').pop(), exists: data !== undefined, data: () => clone(data) }; }
  function fire(l){
    const store = load();
    if(l.kind === 'collection'){
      const now = {}; collDocs(store, l.name).forEach(p => { now[p] = JSON.stringify(store[p]); });
      const changes = [];
      Object.keys(now).forEach(p => { if(!(p in l.seen)) changes.push({ type: 'added', doc: makeDocSnap(p, store[p]) }); else if(l.seen[p] !== now[p]) changes.push({ type: 'modified', doc: makeDocSnap(p, store[p]) }); });
      Object.keys(l.seen).forEach(p => { if(!(p in now)) changes.push({ type: 'removed', doc: makeDocSnap(p, JSON.parse(l.seen[p])) }); });
      const first = !l.fired; l.fired = true; l.seen = now;
      if(first || changes.length){
        const docs = Object.keys(now).map(p => makeDocSnap(p, store[p]));
        l.cb({ empty: !docs.length, size: docs.length, docs, forEach: f => docs.forEach(f), docChanges: () => changes });
      }
    } else {
      const json = JSON.stringify(store[l.path]);
      if(l.fired && json === l.seen) return;
      l.fired = true; l.seen = json;
      l.cb(makeDocSnap(l.path, store[l.path]));
    }
  }
  function notify(){ listeners.slice().forEach(l => Promise.resolve().then(() => fire(l))); }
  chan.onmessage = () => notify();
  function addListener(l){ listeners.push(l); Promise.resolve().then(() => fire(l)); return () => { const i = listeners.indexOf(l); if(i !== -1) listeners.splice(i, 1); }; }

  function docRef(path){
    return { id: path.split('/').pop(), path,
      get: async () => { guard(path); return makeDocSnap(path, readDoc(path)); },
      set: async (data, opts) => commit(s => applySet(s, path, data, opts), [path]),
      update: async (...args) => commit(s => applyUpdate(s, path, args), [path]),
      delete: async () => commit(s => { delete s[path]; }, [path]),
      onSnapshot: (cb) => addListener({ kind: 'doc', path, cb, seen: undefined, fired: false }),
    };
  }
  function coll(name){ return {
    doc: id => docRef(name + '/' + (id || ('auto' + (++idc) + '_' + Math.random().toString(36).slice(2, 8)))),
    get: async () => { if(restricted() && name === 'app_data') throw new Error('permission-denied: list app_data'); const store = load(); const docs = collDocs(store, name).map(p => makeDocSnap(p, store[p])); return { empty: !docs.length, size: docs.length, docs, forEach: f => docs.forEach(f) }; },
    onSnapshot: (cb) => addListener({ kind: 'collection', name, cb, seen: {}, fired: false }),
  };}
  const db = { collection: coll, doc: docRef,
    batch(){
      const ops = [], paths = [];
      return {
        set: (r, d, o) => { ops.push(s => applySet(s, r.path, d, o)); paths.push(r.path); },
        update: (r, ...a) => { ops.push(s => applyUpdate(s, r.path, a)); paths.push(r.path); },
        commit: async () => commit(s => ops.forEach(op => op(s)), paths),
      };
    },
    async runTransaction(fn){
      const ops = [], paths = [];
      const tx = {
        get: async r => { guard(r.path); return makeDocSnap(r.path, readDoc(r.path)); },
        set: (r, d, o) => { ops.push(s => applySet(s, r.path, d, o)); paths.push(r.path); },
        update: (r, ...a) => { ops.push(s => applyUpdate(s, r.path, a)); paths.push(r.path); },
      };
      const result = await fn(tx);
      if(ops.length) commit(s => ops.forEach(op => op(s)), paths);
      return result;
    },
  };
  const firestore = () => db;
  firestore.FieldPath = FieldPath; firestore.FieldValue = FieldValue;
  window.firebase = {
    initializeApp(){ return {}; },
    firestore,
    auth: () => ({ signInAnonymously: async () => ({ user: { uid: 'anon' } }), currentUser: { uid: 'anon' } }),
    storage: () => ({ refFromURL: u => ({ delete: async () => { (window.__deletedFiles ||= []).push(u); } }), ref: () => ({ child: p => ({ putString: async () => {}, getDownloadURL: async () => 'https://firebasestorage.googleapis.com/v0/b/test/o/' + p }) }) }),
  };
})();
