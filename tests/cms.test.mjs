import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ownerFromHeaders,requireSameOrigin,validateContent,emptyContent,renderPage,readState,saveContent,handleApi,schema,OWNER_EMAIL,trustedAdminHosting,isProtectedPath} from '../cms/content.mjs';
const origin='https://adox.example';
const auth={'oai-authenticated-user-id':'owner-test-id','oai-authenticated-user-email':OWNER_EMAIL};
const owner={userId:'owner-test-id',email:OWNER_EMAIL};
function dbAdapter(file=':memory:'){
 const sqlite=new DatabaseSync(file);
 if(!sqlite.prepare("SELECT name FROM sqlite_master WHERE name='cms_state'").get())sqlite.exec(fs.readFileSync(new URL('../drizzle/0000_messy_blazing_skull.sql',import.meta.url),'utf8'));
 const adapter={sqlite,failHistory:false,prepare(sql){return {bind(...args){return {sql,args,async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};}}},async first(){return sqlite.prepare(sql).get()||null;},async all(){return {results:sqlite.prepare(sql).all()};}}},async batch(statements){sqlite.exec('BEGIN');try{const out=statements.map(s=>{if(adapter.failHistory&&s.sql.startsWith('INSERT INTO cms_history'))throw new Error('Test failure');return {meta:{changes:Number(sqlite.prepare(s.sql).run(...s.args).changes)}};});sqlite.exec('COMMIT');return out;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};return adapter;
}
function req(path='/api/cms',method='GET',body,headers=auth){return new Request(origin+path,{method,headers:{...headers,...(body?{'Content-Type':'application/json','Origin':origin,'Sec-Fetch-Site':'same-origin'}:{})},body:body?JSON.stringify(body):undefined});}
test('owner identity requires both injected headers and exact allowlist',()=>{
 assert.deepEqual(ownerFromHeaders(new Headers(auth)),owner);
 for(const h of [{},{'oai-authenticated-user-id':'owner-test-id'},{'oai-authenticated-user-email':OWNER_EMAIL},{...auth,'oai-authenticated-user-email':'other@example.com'}])assert.throws(()=>ownerFromHeaders(new Headers(h)));
});
test('read and write endpoints reject anonymous and nonowner identities',async()=>{
 const db=dbAdapter();
 for(const [headers,expected] of [[{},401],[{...auth,'oai-authenticated-user-email':'other@example.com'},403]])for(const [path,method,body] of [['/api/cms','GET'],['/api/cms/export','GET'],['/api/cms','PATCH',{expectedRevision:0,content:emptyContent(),owner}],['/api/cms/restore','POST',{expectedRevision:0,targetRevision:1}]]){
  const r=await handleApi(req(path,method,body,headers),db);assert.equal(r.status,expected);
 }
 assert.equal((await readState(db)).revision,0);
});
test('CSRF, missing origin, non-JSON and cross-site requests fail closed',()=>{
 for(const h of [{...auth,'content-type':'application/json'},{...auth,origin:'https://evil.example','content-type':'application/json'},{...auth,origin,'content-type':'text/plain'},{...auth,origin,'content-type':'application/json','sec-fetch-site':'cross-site'}])assert.throws(()=>requireSameOrigin(new Request(origin+'/api/cms',{method:'PATCH',headers:h,body:'{}'})));
});
test('strict schema rejects bad protocols, unknown fields and oversized content',()=>{
 for(const change of [c=>c.contacts.indiaUrl='javascript:alert(1)',c=>c.contacts.uaeUrl='http://unsafe.example',c=>c.contacts.email='a@b.com\nBcc:evil@b.com',c=>c.contacts.phone='javascript:123',c=>c.overrides['unknown']='x',c=>c.overrides[Object.keys(schema.fields)[0]]='a'.repeat(10000),c=>c.contacts.extra='ignored',c=>c.overrides=JSON.parse('{"__proto__":"bad"}')]){const c=emptyContent();change(c);assert.throws(()=>validateContent(c));}
});
test('plain-text edits are escaped and country links update independently',()=>{
 const content=emptyContent();const key=Object.values(schema.fields).find(f=>f.group==='/'&&f.kind==='text').id;
 content.overrides[key]='<img src=x onerror=alert(1)> & "hello"';
 content.contacts.indiaUrl='https://india.example/?a=1&b=2';content.contacts.uaeUrl='https://uae.example/';
 const html=renderPage('/',validateContent(content));
 assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;hello&quot;'));
 assert.ok(!html.includes('<img src=x'));
 assert.ok(html.includes('href="https://uae.example/"'));assert.ok(html.includes('href="https://india.example/?a=1&amp;b=2"'));
 assert.ok(!html.includes('%%CMS:'));
});
test('atomic save persists, stale revision conflicts, and history restores as new revision',async()=>{
 const db=dbAdapter();const c=emptyContent();c.contacts.location='Muscat, Oman test';
 let response=await handleApi(req('/api/cms','PATCH',{expectedRevision:0,content:c}),db);assert.equal(response.status,200);let saved=await response.json();assert.equal(saved.revision,1);
 assert.equal((await readState(db)).content.contacts.location,c.contacts.location);
 response=await handleApi(req('/api/cms','PATCH',{expectedRevision:0,content:emptyContent()}),db);assert.equal(response.status,409);assert.equal((await readState(db)).revision,1);
 c.contacts.location='Second test';await saveContent(db,c,1,owner);
 response=await handleApi(req('/api/cms/restore','POST',{expectedRevision:2,targetRevision:1}),db);assert.equal(response.status,200);saved=await response.json();assert.equal(saved.revision,3);assert.equal(saved.content.contacts.location,'Muscat, Oman test');assert.equal(saved.history.length,3);
 response=await handleApi(req('/api/cms/export'),db);assert.equal(response.status,200);assert.ok(response.headers.get('content-disposition').includes('attachment'));assert.equal((await response.json()).revision,3);
});
test('database restart retains content and a failed history write rolls back',async()=>{
 const dir=fs.mkdtempSync(join(tmpdir(),'adox-cms-'));const path=join(dir,'test.sqlite');let db=dbAdapter(path);let c=emptyContent();c.contacts.location='Persisted location';await saveContent(db,c,0,owner);db.sqlite.close();db=dbAdapter(path);assert.equal((await readState(db)).content.contacts.location,'Persisted location');db.failHistory=true;c.contacts.location='Must not save';await assert.rejects(()=>saveContent(db,c,1,owner));assert.equal((await readState(db)).revision,1);assert.equal((await readState(db)).content.contacts.location,'Persisted location');db.sqlite.close();fs.rmSync(dir,{recursive:true});
});
test('oversize stream rejected and GET cannot mutate',async()=>{
 const db=dbAdapter();const r=await handleApi(new Request(origin+'/api/cms',{method:'PATCH',headers:{...auth,origin,'content-type':'application/json'},body:'x'.repeat(180001)}),db);assert.equal(r.status,413);
 const get=await handleApi(req('/api/cms/restore?targetRevision=1'),db);assert.equal(get.status,405);assert.equal((await readState(db)).revision,0);
});
test('all 16 marketing pages render full default content and WhatsApp',()=>{
 for(const p of schema.pages){const html=renderPage(p.route,emptyContent());assert.ok(html.includes('https://wa.me/96896967420'));assert.ok(html.includes('Oman extension of Adox Global, Kochi, India'));assert.ok(html.includes('India · UAE · Oman · Bahrain'));assert.ok(!html.includes('%%CMS:'));}
 assert.equal(schema.pages.length,16);assert.equal(renderPage('/missing/',emptyContent()),null);
});

test('global contact changes do not rewrite explicit saved copy',()=>{const c=emptyContent();const key=Object.values(schema.fields).find(f=>f.group==='/'&&f.kind==='text').id;c.contacts.location='New City';c.overrides[key]='Please keep Muscat, Oman verbatim';const html=renderPage('/',c);assert.ok(html.includes('Please keep Muscat, Oman verbatim'));assert.ok(html.includes('New City'));});

test('rehosting fails closed without runtime trust mode and exact hosted origin',()=>{const hosted=new Request('https://adox-global-ventures-oman.modernmorel8.chatgpt.site/admin/');assert.equal(trustedAdminHosting(hosted,{}),false);assert.equal(trustedAdminHosting(hosted,{CMS_AUTH_MODE:'sites-dispatch'}),true);assert.equal(trustedAdminHosting(new Request('https://other.example/admin/'),{CMS_AUTH_MODE:'sites-dispatch'}),false);assert.equal(trustedAdminHosting(hosted,{CMS_AUTH_MODE:'anything'}),false);});

test('email addresses cannot inject mailto headers',()=>{const c=emptyContent();c.contacts.email='test?subject=bad@example.com';const html=renderPage('/',validateContent(c));assert.ok(html.includes('href="mailto:test%3Fsubject%3Dbad%40example.com"'));assert.ok(!html.includes('href="mailto:test?subject='));});

test('CMS-like markers in owner values remain literal and cannot break rendering',()=>{const c=emptyContent();const key=Object.keys(schema.fields)[0];c.contacts.location='%%CMS:unknown%% and %%CMS:'+key+'%%';c.contacts.indiaUrl='https://example.com/?q=%%CMS:unknown%%';for(const p of schema.pages){const html=renderPage(p.route,validateContent(c));assert.ok(html.includes('%%CMS:unknown%%'));assert.ok(html.includes('%%CMS:'+key+'%%'));}});

test('encoded and duplicate-slash admin paths retain the hosting gate',()=>{for(const path of ['/admin','/admin/','/%61dmin/','//admin/','/api/%63ms/','/admin%2f','/%'])assert.equal(isProtectedPath(path),true,path);assert.equal(isProtectedPath('/services/'),false);});
