from PIL import Image, ImageDraw
from pathlib import Path
root=Path('design/shots/app'); target=root/'contact'; target.mkdir(exist_ok=True)
for tag in ['d','m']:
 files=sorted(root.glob(f'*-{tag}.png'))
 w,h=(360,280) if tag=='d' else (195,450)
 cols,rows=(4,3) if tag=='d' else (6,2)
 for start in range(0,len(files),cols*rows):
  sheet=Image.new('RGB',(cols*w,rows*h),'#d5d5d5');draw=ImageDraw.Draw(sheet)
  for n,p in enumerate(files[start:start+cols*rows]):
   im=Image.open(p).convert('RGB');im.thumbnail((w,h-24));x=(n%cols)*w;y=(n//cols)*h
   sheet.paste(im,(x,y+24));draw.text((x+4,y+4),p.stem,fill='black')
  sheet.save(target/f'{tag}-{start//(cols*rows)+1:02}.jpg',quality=92)
print('contact sheets',len(list(target.glob('*.jpg'))))
