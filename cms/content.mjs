import schema from './schema.json' with {type:'json'};
import templates from './templates.json' with {type:'json'};
export {schema};
export const OWNER_EMAIL='shinoypallath16@gmail.com';
export const MAX_BODY=180000;
export function isProtectedPath(path){
 try{const p=decodeURIComponent(path).replace(/\/+/g,'/');return p.startsWith('/admin')||p.startsWith('/api/cms');}catch{return true;}
}
export function trustedAdminHosting(request,env,development=false){
 if(development)return true;
 return env?.CMS_AUTH_MODE==='sites-dispatch'&&new URL(request.url).origin==='https://adox-global-ventures-oman.modernmorel8.chatgpt.site';
}
const encoder=new TextEncoder();
export class CmsError extends Error {constructor(message,status=400){super(message);this.status=status;}}
export function ownerFromHeaders(headers){
 const userId=headers.get('oai-authenticated-user-id');
 const email=headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
 if(!userId||!email)throw new CmsError('Sign in with the website owner’s ChatGPT account.',401);
 if(email!==OWNER_EMAIL)throw new CmsError('This account does not have website editing access.',403);
 return {userId,email};
}
export function requireSameOrigin(request){
 const origin=request.headers.get('origin');
 if(!origin||origin!==new URL(request.url).origin)throw new CmsError('This change must come from the website editor.',403);
 const site=request.headers.get('sec-fetch-site');
 if(site&&site!=='same-origin'&&site!=='none')throw new CmsError('Cross-site changes are not allowed.',403);
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new CmsError('Use a JSON request.',415);
}
export function emptyContent(){return {contacts:{...schema.contacts},overrides:{}};}
function object(value){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;}
function text(value,max,label){if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw new CmsError(`Check ${label}: a nonempty value up to ${max} characters is required.`);return value;}
export function validateContent(input){
 if(!object(input)||Object.keys(input).some(k=>!['contacts','overrides'].includes(k))||!object(input.contacts)||!object(input.overrides))throw new CmsError('The content format is invalid.');
 const contactKeys=Object.keys(schema.contacts);
 if(Object.keys(input.contacts).length!==contactKeys.length||Object.keys(input.contacts).some(k=>!contactKeys.includes(k)))throw new CmsError('All contact fields are required.');
 const contacts={};
 for(const k of contactKeys)contacts[k]=text(input.contacts[k],k==='location'?140:k.endsWith('Url')?500:120,k).trim();
 if(!/^\+[1-9][0-9 ]{6,21}$/.test(contacts.phone)||contacts.phone.replace(/\D/g,'').length>15)throw new CmsError('Use an international phone number, for example +968 9696 7420.');
 if(!/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(contacts.email))throw new CmsError('Enter a valid email address.');
 for(const key of ['indiaUrl','uaeUrl']){let u;try{u=new URL(contacts[key]);}catch{throw new CmsError('Country links must be complete HTTPS URLs.');}if(u.protocol!=='https:'||u.username||u.password||/[\r\n\\]/.test(contacts[key]))throw new CmsError('Country links must use HTTPS without credentials.');}
 if(Object.keys(input.overrides).length>Object.keys(schema.fields).length)throw new CmsError('Too many content fields.');
 const overrides={};
 for(const [key,value] of Object.entries(input.overrides)){
  if(!Object.hasOwn(schema.fields,key))throw new CmsError('An unknown content field was supplied. Reload the editor.');
  const field=schema.fields[key];const v=text(value,field.maxLength,field.label);
  if(v!==field.value)overrides[key]=v;
 }
 const clean={contacts,overrides};
 if(encoder.encode(JSON.stringify(clean)).length>MAX_BODY-1000)throw new CmsError('The content is too large.');
 return clean;
}
export async function readBody(request){
 const advertised=Number(request.headers.get('content-length')||0);if(advertised>MAX_BODY)throw new CmsError('Request is too large.',413);
 const reader=request.body?.getReader();if(!reader)throw new CmsError('A request body is required.');
 const chunks=[];let total=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BODY){await reader.cancel();throw new CmsError('Request is too large.',413);}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new CmsError('The request is not valid JSON.');}
}
export function revision(value){if(!Number.isSafeInteger(value)||value<0)throw new CmsError('A valid content revision is required.');return value;}
export function escapeHTML(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function renderPage(route,content){
 const template=templates[route];if(!template)return null;
 const c=content.contacts,phone=c.phone.replace(/\D/g,'');
 const replacements={
  'https://wa.me/96896967420':'https://wa.me/'+phone,'tel:+96896967420':'tel:+'+phone,
  '+968 9696 7420':c.phone,'mailto:info@adoxglobal.om':'mailto:'+encodeURIComponent(c.email),'info@adoxglobal.om':c.email,'Muscat, Oman':c.location,
  'https://www.adoxglobal.com/ae':c.uaeUrl,'https://www.adoxglobal.com/':c.indiaUrl
 };
 const pattern=Object.keys(replacements).sort((a,b)=>b.length-a.length).map(v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
 const replaceContacts=html=>html.replace(new RegExp(pattern,'g'),match=>escapeHTML(replacements[match]));
let html=template.replace(new RegExp('%%CMS:([a-z0-9.]+)%%|'+pattern,'g'),(match,key)=>{
  if(!key)return escapeHTML(replacements[match]);
  const field=schema.fields[key];if(!field)throw new Error('Missing content field');
  if(!Object.hasOwn(content.overrides,key))return replaceContacts(field.html);
  const escaped=escapeHTML(content.overrides[key]);return field.kind==='text'?escaped.replace(/\r?\n/g,'<br>'):escaped;
 });
 const config=JSON.stringify({email:c.email,indiaUrl:c.indiaUrl,uaeUrl:c.uaeUrl}).replace(/</g,'\\u003c');
 html=html.replace('</head>','<script id="site-config" type="application/json">'+config+'</script></head>');
 html=html.replace('</footer>','<div class="container admin-footer-link"><a href="/admin/">Website admin</a></div></footer>');
 return html;
}
export async function readState(db){
 const row=await db.prepare('SELECT revision, content, updated_at FROM cms_state WHERE id = ?').bind('main').first();
 return row?{revision:row.revision,content:JSON.parse(row.content),updatedAt:row.updated_at}:{revision:0,content:emptyContent(),updatedAt:null};
}
export async function history(db){const r=await db.prepare('SELECT revision, updated_at FROM cms_history ORDER BY revision DESC LIMIT 20').all();return r.results.map(r=>({revision:r.revision,updatedAt:r.updated_at}));}
export async function editorState(db,owner){const [state,entries]=await Promise.all([readState(db),history(db)]);return {...state,owner:{email:owner.email},schema,history:entries};}
export async function saveContent(db,content,expectedRevision,owner,operation='save'){
 const clean=validateContent(content),expected=revision(expectedRevision),json=JSON.stringify(clean),at=new Date().toISOString(),changeId=crypto.randomUUID();
 const results=await db.batch([
  db.prepare('UPDATE cms_state SET revision = revision + 1, content = ?, updated_at = ?, updated_by = ?, change_id = ? WHERE id = ? AND revision = ?').bind(json,at,owner.userId,changeId,'main',expected),
  db.prepare('INSERT OR IGNORE INTO cms_state (id,revision,content,updated_at,updated_by,change_id) SELECT ?,1,?,?,?,? WHERE ? = 0').bind('main',json,at,owner.userId,changeId,expected),
  db.prepare('INSERT INTO cms_history (revision,content,updated_at,updated_by,operation) SELECT revision,content,updated_at,updated_by,? FROM cms_state WHERE id = ? AND change_id = ?').bind(operation,'main',changeId)
 ]);
 if(!results[2]?.meta?.changes)throw new CmsError('Someone saved a newer version. Your edits have not been overwritten. Reload the latest content before saving again.',409);
 return editorState(db,owner);
}
const baseHeaders={'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'SAMEORIGIN'};
export function jsonResponse(value,status=200,extra={}){return new Response(JSON.stringify(value),{status,headers:{...baseHeaders,'Content-Type':'application/json; charset=utf-8',...extra}});}
export async function handleApi(request,db){
 try{
  const owner=ownerFromHeaders(request.headers);if(!db)throw new CmsError('Content storage is unavailable. No changes were saved.',503);
  const path=new URL(request.url).pathname.replace(/\/$/,'');
  if(request.method==='GET'&&path==='/api/cms')return jsonResponse(await editorState(db,owner));
  if(request.method==='GET'&&path==='/api/cms/export'){const state=await readState(db);return jsonResponse({format:'adox-cms-content-v1',exportedAt:new Date().toISOString(),...state},200,{'Content-Disposition':'attachment; filename="adox-website-content.json"'});}
  if(request.method==='PATCH'&&path==='/api/cms'){
   requireSameOrigin(request);const body=await readBody(request);
   if(!object(body)||Object.keys(body).some(k=>!['expectedRevision','content'].includes(k)))throw new CmsError('Invalid save request.');
   return jsonResponse(await saveContent(db,body.content,body.expectedRevision,owner));
  }
  if(request.method==='POST'&&path==='/api/cms/restore'){
   requireSameOrigin(request);const body=await readBody(request);
   if(!object(body)||Object.keys(body).some(k=>!['expectedRevision','targetRevision'].includes(k)))throw new CmsError('Invalid restore request.');
   const target=revision(body.targetRevision);revision(body.expectedRevision);
   const row=await db.prepare('SELECT content FROM cms_history WHERE revision = ?').bind(target).first();
   if(!row)throw new CmsError('That saved version was not found.',404);
   return jsonResponse(await saveContent(db,JSON.parse(row.content),body.expectedRevision,owner,'restore:'+target));
  }
  return jsonResponse({error:'This operation is not supported.'},405,{'Allow':'GET, PATCH, POST'});
 }catch(error){if(error instanceof CmsError)return jsonResponse({error:error.message},error.status);console.error('CMS operation failed',error?.name||'Error');return jsonResponse({error:'The server could not complete this action. No success has been reported. Reload to check the latest version before retrying.'},500);}
}
