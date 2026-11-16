import {handleApi,readState,renderPage,jsonResponse,trustedAdminHosting,isProtectedPath} from '../cms/content.mjs';
import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

const worker = {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    const url=new URL(request.url);
    // Sites dispatch authenticates and injects identity. Do not trust these
    // headers on a new production host until its own auth adapter is installed.
    if(isProtectedPath(url.pathname)&&!trustedAdminHosting(request,env,import.meta.env.DEV)){
      return new Response('Admin authentication must be configured for this hosting environment.',{status:503,headers:{'Cache-Control':'no-store'}});
    }
    if(url.pathname.startsWith('/api/cms'))return handleApi(request,env.DB);
    const route=url.pathname.endsWith('/')?url.pathname:url.pathname+'/';
    const original=renderPage(route,{contacts:{phone:'+968 9696 7420',email:'info@adoxglobal.om',location:'Muscat, Oman',indiaUrl:'https://www.adoxglobal.com/',uaeUrl:'https://www.adoxglobal.com/ae'},overrides:{}});
    if(original){
      if(!['GET','HEAD'].includes(request.method))return jsonResponse({error:'Method not allowed'},405);
      try{
        if(!env.DB)return new Response('Website content storage is unavailable.',{status:503,headers:{'Cache-Control':'no-store'}});
        const state=await readState(env.DB);
        const html=renderPage(route,state.content);
        return new Response(request.method==='HEAD'?null:html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'SAMEORIGIN'}});
      }catch{ return new Response('Website content is temporarily unavailable. Please try again later.',{status:503,headers:{'Cache-Control':'no-store'}}); }
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    const response=await runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
    if(url.pathname.startsWith('/admin')){const result=new Response(response.body,response);result.headers.set('Cache-Control','no-store, max-age=0');result.headers.set('X-Content-Type-Options','nosniff');result.headers.set('X-Frame-Options','SAMEORIGIN');return result;}
    return response;
  },
};

export default worker;
