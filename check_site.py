from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import json,sys
root=Path(__file__).parent/'legacy-site'
class Parser(HTMLParser):
 def __init__(self): super().__init__(); self.tags=[]
 def handle_starttag(self,tag,attrs): self.tags.append((tag,dict(attrs)))
issues=[]; pages=list(root.rglob('index.html'))
for file in pages:
 p=Parser();p.feed(file.read_text()); ids=[a['id'] for _,a in p.tags if 'id' in a]
 if len(ids)!=len(set(ids)):issues.append(f'{file}: duplicate ids')
 for tag,a in p.tags:
  for key in ['src','href']:
   url=a.get(key,''); u=urlsplit(url)
   if not url or u.scheme or u.netloc:continue
   target=root/unquote(u.path).lstrip('/') if u.path.startswith('/') else file.parent/unquote(u.path)
   if not u.path:target=file
   if target.is_dir():target/='index.html'
   if not target.exists():issues.append(f'{file}: missing {url}')
  if tag=='form':
   if not any(t=='fieldset' and 'disabled' in at for t,at in p.tags):issues.append(f'{file}: missing disabled form fallback')
 wa=[a for t,a in p.tags if t=='a' and a.get('class')=='whatsapp-link']
 if len(wa)!=1 or wa[0].get('href')!='https://wa.me/96896967420' or wa[0].get('target')!='_blank' or not wa[0].get('aria-label'):issues.append(f'{file}: WhatsApp link invalid')
 if not any(t=='html' and a.get('lang')=='en' for t,a in p.tags):issues.append(f'{file}: missing language')
 if not any(t=='meta' and a.get('name')=='viewport' for t,a in p.tags):issues.append(f'{file}: missing viewport')
text=' '.join(f.read_text() for f in pages).lower()
for phrase in ['temporary website','coming soon','lorem ipsum','+91','building 130','guaranteed results','100% client','testimonials','careers','courses']:
 if phrase in text:issues.append('Unexpected claim/content: '+phrase)
assert len(pages)==16
assert not (root/'__qa.html').exists()
import hashlib
assert hashlib.sha256((root/'assets/adox-global-ventures-original.jpg').read_bytes()).hexdigest()=='1a702661e8cca94f59585c5018ad1b1c348c9706d0d033b36ddee15a1a6fa1e9'
print(json.dumps({'pages':len(pages),'issues':issues,'original_logo_unchanged':True},indent=2))
sys.exit(bool(issues))
