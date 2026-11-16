import {headers} from 'next/headers';
import {env} from 'cloudflare:workers';
import {ownerFromHeaders,editorState,CmsError} from '../../cms/content.mjs';
import ContentEditor from './editor';
import {chatGPTSignInPath,chatGPTSignOutPath} from '../chatgpt-auth';
export const dynamic='force-dynamic';
export default async function AdminPage(){
 if(!import.meta.env.DEV&&env.CMS_AUTH_MODE!=='sites-dispatch')return <main><h1>Admin authentication is not configured</h1><p>Website editing is disabled on this hosting environment.</p></main>;
 let owner;
 try{owner=ownerFromHeaders(await headers());}
 catch(error){const e=error as InstanceType<typeof CmsError>;return <main style={{maxWidth:620,margin:'12vh auto',padding:32,fontFamily:'Arial,sans-serif',lineHeight:1.7}}><p style={{color:'#c8202a',fontWeight:700}}>ADOX GLOBAL VENTURES</p><h1>Website content admin</h1><p>{e.status===403?'This account does not have website editing access. Sign in with the website owner’s ChatGPT account.':'Sign in with the website owner’s ChatGPT account to edit the website.'}</p>{e.status===403?<a href={chatGPTSignOutPath('/admin/')} target="_top">Sign out and switch account</a>:<a href={chatGPTSignInPath('/admin/')} target="_top">Sign in with ChatGPT</a>}<p><a href="/">Back to website</a></p></main>}
 if(!env.DB)return <main><h1>Content storage is unavailable</h1><p>No changes have been saved. Please try again later.</p></main>;
 const data=await editorState(env.DB,owner);
 return <ContentEditor initialData={data}/>;
}
