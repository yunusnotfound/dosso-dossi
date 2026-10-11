from pathlib import Path
import sys, json, math, subprocess, argparse, concurrent.futures
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tooling/python'))
import imageio_ffmpeg
FFMPEG=imageio_ffmpeg.get_ffmpeg_exe()
W,H=1920,1080
BG='#F5F1E9'; INK='#241F1A'; ORANGE='#ED602A'; MUTED='#756D63'; LINE='#DDD4C8'
FONTS=ROOT/'fonts'
def font(size,weight='Regular'):
    return ImageFont.truetype(str(FONTS/f'Poppins-{weight}.ttf'),size)
def wrap(text,f,width):
    d=ImageDraw.Draw(Image.new('RGB',(1,1)))
    lines=[]; line=''
    for word in text.split():
        nxt=(line+' '+word).strip()
        if line and d.textlength(nxt,font=f)>width:
            lines.append(line); line=word
        else: line=nxt
    if line: lines.append(line)
    return lines

def textblock(d,text,xy,width,size=32,weight='Regular',fill=INK,spacing=1.42):
    f=font(size,weight); lines=wrap(text,f,width); x,y=xy
    for l in lines:
        d.text((x,y),l,font=f,fill=fill)
        y+=round(size*spacing)
    return y

def rounded_image(canvas,im,box,radius=28):
    x,y,w,h=map(int,box)
    im=im.convert('RGB').resize((w,h),Image.Resampling.LANCZOS)
    mask=Image.new('L',(w,h)); ImageDraw.Draw(mask).rounded_rectangle((0,0,w-1,h-1),radius,fill=255)
    canvas.paste(im,(x,y),mask)

def shadow(canvas,box,radius):
    layer=Image.new('RGBA',canvas.size)
    d=ImageDraw.Draw(layer); x,y,w,h=box
    d.rounded_rectangle((x,y+14,x+w,y+h+14),radius,fill=(36,31,26,24))
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(19)))

def chrome(d,scene,index,total):
    d.rounded_rectangle((64,40,72,68),4,fill=ORANGE)
    d.text((90,35),'DOSSO DOSSI COFFEE',font=font(21,'SemiBold'),fill=INK)
    d.text((1450,39),'UYGULAMA TANITIMI',font=font(18,'Medium'),fill=MUTED)
    d.line((64,100,1856,100),fill=LINE,width=1)
    d.text((64,1026),scene['chapter'],font=font(19,'Medium'),fill=MUTED)
    d.text((1270,1028),'Tanıtım hesabı · Örnek veriler',font=font(16),fill=MUTED)
    d.text((1793,1026),f'{index:02d}/{total:02d}',font=font(19,'Medium'),fill=MUTED)

def phone(canvas,path):
    im=Image.open(path).convert('RGB')
    sh=866; sw=round(sh*im.width/im.height)
    x=360-sw//2; y=129
    d=ImageDraw.Draw(canvas)
    d.rounded_rectangle((76,122,646,1007),42,fill='#EBE3D7')
    # Fine concentric contour echoes the app's round cards without covering UI.
    d.arc((63,328,660,925),65,260,fill='#DDCFC0',width=2)
    shadow(canvas,(x-8,y-8,sw+16,sh+16),47)
    d=ImageDraw.Draw(canvas)
    d.rounded_rectangle((x-8,y-8,x+sw+8,y+sh+8),45,fill='#29251F')
    rounded_image(canvas,im,(x,y,sw,sh),38)

def bullet_rows(d,scene,x,y,width,size=32,gap=29):
    for i,b in enumerate(scene['bullets']):
        d.ellipse((x,y+5,x+36,y+41),fill='#FBE1D0')
        d.text((x+11,y+9),str(i+1),font=font(16,'SemiBold'),fill='#B6491B')
        end=textblock(d,b,(x+60,y),width-60,size=size,spacing=1.38)
        y=end+gap
    return y

def render_scene(scene,index,total):
    canvas=Image.new('RGBA',(W,H),BG); d=ImageDraw.Draw(canvas)
    chrome(d,scene,index,total)
    layout=scene.get('layout','phone')
    key=scene.get('screenKey')
    mapping=json.loads((ROOT/'screen-map.json').read_text()) if (ROOT/'screen-map.json').exists() else {}
    path=ROOT/mapping[key] if key in mapping else None
    if path is not None and not path.exists(): raise FileNotFoundError(path)
    if layout=='phone' and path:
        phone(canvas,path); d=ImageDraw.Draw(canvas)
        x=747; width=1060
        d.text((x,145),scene.get('eyebrow','KULLANIM AKIŞI'),font=font(21,'SemiBold'),fill=ORANGE)
        y=textblock(d,scene['title'],(x,199),width,54,'SemiBold',spacing=1.24)+45
        end=bullet_rows(d,scene,x,y,width,32,34)
        if scene.get('note'):
            ny=max(end+7,848)
            if ny>925: raise ValueError(f'Overflow note {scene["id"]}: {ny}')
            d.line((x,ny-15,x+width,ny-15),fill=LINE,width=2)
            end=textblock(d,scene['note'],(x,ny),width,24,fill=MUTED,spacing=1.4)
            if end>999: raise ValueError(f'Overflow {scene["id"]}: {end}')
    elif layout=='admin' and path:
        d.text((66,126),scene.get('eyebrow','YÖNETİM PANELİ'),font=font(19,'SemiBold'),fill=ORANGE)
        textblock(d,scene['title'],(64,162),1730,45,'SemiBold',spacing=1.18)
        im=Image.open(path); sw=1200; sh=round(sw*im.height/im.width)
        sy=253
        shadow(canvas,(64,sy,sw,sh),16)
        rounded_image(canvas,im,(64,sy,sw,sh),14)
        d=ImageDraw.Draw(canvas)
        end=bullet_rows(d,scene,1320,278,535,26,34)
        if scene.get('note'):
            ny=max(end+12,840)
            d.line((1320,ny-15,1852,ny-15),fill=LINE,width=2)
            end=textblock(d,scene['note'],(1320,ny),535,22,fill=MUTED,spacing=1.38)
            if end>997: raise ValueError(f'Admin overflow {scene["id"]}: {end}')
    elif layout in ('title','overview','closing'):
        logo=Image.open(ROOT.parents[1]/'dosso-dossi-app/assets/images/logo.png').convert('RGBA')
        logo.thumbnail((160,160))
        canvas.alpha_composite(logo,(1600,160)); d=ImageDraw.Draw(canvas)
        d.text((96,170),scene.get('eyebrow','DOSSO DOSSI COFFEE'),font=font(24,'SemiBold'),fill=ORANGE)
        y=textblock(d,scene['title'],(90,232),1440,78,'SemiBold',spacing=1.2)+65
        if len(scene['bullets'])==3:
            for n,b in enumerate(scene['bullets']):
                xx=96+n*584
                d.rounded_rectangle((xx,y,xx+550,y+238),26,fill='#FFFFFF')
                d.text((xx+30,y+21),f'0{n+1}',font=font(26,'SemiBold'),fill=ORANGE)
                textblock(d,b,(xx+30,y+78),486,31,'Medium',spacing=1.4)
        else:
            end=bullet_rows(d,scene,96,y,1550,35,38)
        if scene.get('note'): textblock(d,scene['note'],(96,909),1700,24,fill=MUTED)
    else:
        raise ValueError(f'Unknown/missing screen {scene["id"]}: {key}, {layout}')
    path=ROOT/'frames'/f'{index:03d}_{scene["id"]}.png'
    canvas.convert('RGB').save(path,optimize=True)
    return path

def encode_scene(args):
    scene,index,total=args
    png=ROOT/'frames'/f'{index:03d}_{scene["id"]}.png'
    out=ROOT/'output/segments'/f'{index:03d}.mp4'
    duration=scene['duration']; fadeout=duration-.32
    vf=f"fade=t=in:st=0:d=0.32:color=0xF5F1E9,fade=t=out:st={fadeout}:d=0.32:color=0xF5F1E9,format=yuv420p"
    cmd=[FFMPEG,'-hide_banner','-loglevel','error','-y','-loop','1','-framerate','24','-i',str(png),'-t',str(duration),'-vf',vf,'-c:v','libx264','-preset','veryfast','-tune','stillimage','-crf','21','-r','24','-threads','2','-pix_fmt','yuv420p','-an','-movflags','+faststart',str(out)]
    subprocess.run(cmd,check=True)
    return index

def metadata(story):
    lines=[';FFMETADATA1','title=Dosso Dossi Coffee | Uygulama ve Yönetim Tanıtımı','artist=Dosso Dossi Coffee','comment=Türkçe yazılı anlatım. Gerçek uygulama ekranları ve kurgusal tanıtım verileri. Ses kanalı içermez.']
    t=0;chapter=None;groups=[]
    for s in story:
        if s['chapter']!=chapter:
            if groups: groups[-1]['end']=t
            groups.append(dict(title=s['chapter'],start=t));chapter=s['chapter']
        t+=s['duration']
    groups[-1]['end']=t
    for g in groups:
        lines += ['[CHAPTER]','TIMEBASE=1/1000',f'START={g["start"]*1000}',f'END={g["end"]*1000}',f'title={g["title"]}']
    (ROOT/'output/chapters.ffmeta').write_text('\n'.join(lines)+'\n')
    timeline=[];t=0
    for i,s in enumerate(story,1):
        timeline.append({**s,'number':i,'start':t,'end':t+s['duration']});t+=s['duration']
    (ROOT/'output/timeline.json').write_text(json.dumps(timeline,ensure_ascii=False,indent=2))
    def stamp(t): return f'{t//60:02d}:{t%60:02d}'
    (ROOT/'output/Bolumler.txt').write_text('DOSSO DOSSI COFFEE — YÖNETİM TANITIMI\n1920 × 1080 · 24 fps · Yazılı anlatım · Sessiz\n\n'+'\n'.join(f'{stamp(g["start"])}  {g["title"]}' for g in groups)+'\n\nToplam süre: '+stamp(t)+'\n\nEkranlar mevcut uygulamadan alınmıştır. Hesaplar, sayısal değerler ve işlem örnekleri tanıtım verileridir. Gerçek banka/SMS/POS teslimatı gösterilmez.\n')
    return t

def main():
    p=argparse.ArgumentParser(); p.add_argument('--render',action='store_true');p.add_argument('--encode',action='store_true');p.add_argument('--assemble',action='store_true');p.add_argument('--ids');p.add_argument('--jobs',type=int,default=3);a=p.parse_args()
    story=json.loads((ROOT/'storyboard.json').read_text());total=len(story)
    chosen=[(s,i,total) for i,s in enumerate(story,1) if not a.ids or s['id'] in a.ids.split(',')]
    if a.render:
        for s,i,t in chosen:
            print(render_scene(s,i,t),flush=True)
    if a.encode:
        (ROOT/'output/segments').mkdir(exist_ok=True)
        with concurrent.futures.ThreadPoolExecutor(a.jobs) as ex:
            for n in ex.map(encode_scene,chosen):print('Encoded',n,flush=True)
    duration=metadata(story)
    if a.assemble:
        parts=[ROOT/'output/segments'/f'{i:03d}.mp4' for i in range(1,total+1)]
        if any(not f.exists() for f in parts):raise Exception('Missing encoded scene')
        concat=ROOT/'output/segments.txt';concat.write_text(''.join(f"file '{f}'\n" for f in parts))
        out=ROOT/'output/Dosso-Dossi-Uygulama-Tanitim.mp4'
        subprocess.run([FFMPEG,'-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(concat),'-i',str(ROOT/'output/chapters.ffmeta'),'-map','0:v','-map_metadata','1','-map_chapters','1','-c','copy','-an','-movflags','+faststart',str(out)],check=True)
        print('FINAL',out,'DURATION',duration,flush=True)
if __name__=='__main__':main()
