from html.parser import HTMLParser
from html import unescape
from pathlib import Path
import hashlib,json,re
ROOT=Path(__file__).resolve().parent.parent
class Node:
 def __init__(self,tag,attrs,start,inner_start,parent):self.tag=tag;self.attrs=dict(attrs);self.start=start;self.inner_start=inner_start;self.parent=parent;self.children=[];self.end=None;self.inner_end=None
class Tree(HTMLParser):
 def __init__(self,text):
  super().__init__(convert_charrefs=False);self.text=text;self.lines=[0];self.nodes=[];self.stack=[]
  for m in re.finditer('\n',text):self.lines.append(m.end())
  self.feed(text)
 def pos(self):a,b=self.getpos();return self.lines[a-1]+b
 def handle_starttag(self,tag,attrs):
  n=Node(tag,attrs,self.pos(),self.pos()+len(self.get_starttag_text()),self.stack[-1] if self.stack else None);self.nodes.append(n)
  if n.parent:n.parent.children.append(n)
  if tag not in ['meta','link','img','input','br','hr','source','area','base','wbr']:self.stack.append(n)
  else:n.inner_end=n.end=n.inner_start
 def handle_endtag(self,tag):
  if self.stack and self.stack[-1].tag==tag:
   n=self.stack.pop();n.inner_end=self.pos();n.end=self.text.find('>',self.pos())+1

def plain(html):return unescape(re.sub('<[^>]+>','',re.sub('<br\\s*/?>','\n',html))).strip()
def descendant_tags(n):return [c.tag for c in n.children]+sum([descendant_tags(c) for c in n.children],[])
def ancestor(n,tag):
 while n:
  if n.tag==tag:return True
  n=n.parent
 return False
schema={'version':1,'contacts':{'phone':'+968 9696 7420','email':'info@adoxglobal.om','location':'Muscat, Oman','indiaUrl':'https://www.adoxglobal.com/','uaeUrl':'https://www.adoxglobal.com/ae'},'pages':[],'fields':{}}
templates={}
for file in sorted((ROOT/'legacy-site').rglob('index.html')):
 rel=file.relative_to(ROOT/'legacy-site').as_posix();route='/'+rel.removesuffix('index.html');group=route
 text=file.read_text();tree=Tree(text);edits=[];pageids=[]
 title=next(n for n in tree.nodes if n.tag=='title');pageName=plain(text[title.inner_start:title.inner_end]).split(' | ')[0]
 schema['pages'].append({'route':route,'name':'Home' if route=='/' else pageName})
 def add(key,label,value,default_html,start,end,group,kind='text'):
  schema['fields'].setdefault(key,{'id':key,'group':group,'label':label,'value':value,'html':default_html,'kind':kind,'maxLength':500 if kind=='attribute' else 2500})
  edits.append((start,end,'%%CMS:'+key+'%%'));pageids.append(key)
 add('meta.'+hashlib.sha1(route.encode()).hexdigest()[:10]+'.title','Page title',plain(text[title.inner_start:title.inner_end]),text[title.inner_start:title.inner_end],title.inner_start,title.inner_end,group,'title')
 for n in tree.nodes:
  if n.inner_end is None:continue
  if n.tag=='meta' and n.attrs.get('name')=='description':
   start=n.start;texttag=text[n.start:n.end];m=re.search(r'content="([^"]*)"',texttag)
   if m:add('meta.'+hashlib.sha1(route.encode()).hexdigest()[:10]+'.description','Search description',unescape(m[1]),m[1],start+m.start(1),start+m.end(1),group,'attribute')
  if n.tag not in ['h1','h2','h3','p','li'] or not(ancestor(n,'main') or ancestor(n,'footer')):continue
  if any(t not in ['strong','em','b','br','span'] for t in descendant_tags(n)):continue
  raw=text[n.inner_start:n.inner_end];value=plain(raw)
  if not value or len(value)<3 or '%%CMS' in raw:continue
  if value in ['Muscat, Oman','+968 9696 7420','info@adoxglobal.om']:continue
  if n.attrs.get('class') in ['form-note','form-result','copy-status']:continue
  fieldgroup='Shared footer' if ancestor(n,'footer') else group
  if 'Oman extension of Adox Global' in value:fieldgroup='Company relationship'
  if 'India · UAE · Oman · Bahrain' in value:fieldgroup='Company relationship'
  stable=(fieldgroup+'|'+raw) if fieldgroup in ['Shared footer','Company relationship'] else route+'|'+str(n.start)
  key='copy.'+hashlib.sha1(stable.encode()).hexdigest()[:16]
  label={'h1':'Main heading','h2':'Section heading','h3':'Subheading','p':'Paragraph','li':'List item'}[n.tag]
  add(key,label,value,raw,n.inner_start,n.inner_end,fieldgroup)
 for a,b,v in sorted(edits,reverse=True):text=text[:a]+v+text[b:]
 templates[route]=text
(ROOT/'cms/schema.json').write_text(json.dumps(schema,ensure_ascii=False,indent=2)+'\n')
(ROOT/'cms/templates.json').write_text(json.dumps(templates,ensure_ascii=False)+'\n')
print('CMS templates:',len(templates),'editable fields:',len(schema['fields']))
