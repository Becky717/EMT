import json, urllib.request, urllib.parse, re, io, os, time
from PIL import Image
UA={'User-Agent':'RenLabBot/1.0 (educational static game; github.com/Becky717)'}
FILES = {
 'leonardo_flying_machine': ('Design for a Flying Machine.jpg','Leonardo da Vinci','Design for a flying machine (ornithopter)'),
 'leonardo_wings': ('Ailes battantes Luc Viatour.jpg','Leonardo da Vinci','Study of flapping wings'),
 'leonardo_gears': ('Vinci, Leonardo Da - Ingranaggio.jpg','Leonardo da Vinci','Gear mechanism study'),
 'leonardo_flywheel': ('Vinci, Leonardo Da - Volano (meccanica).jpg','Leonardo da Vinci','Flywheel mechanism study'),
 'leonardo_vitruvian': ('Da Vinci Vitruve Luc Viatour.jpg','Leonardo da Vinci','Vitruvian Man (proportion study)'),
 'leonardo_parachute': ('Conical Parachute, 1470s, British Museum Add. MSS 34,113, fol. 200v.jpg','Leonardo da Vinci (attrib. Sienese engineer)','Conical parachute'),
 'leonardo_crossbow': ('Vinci, Leonardo da - Crossbow sketch - 1500.jpg','Leonardo da Vinci','Giant crossbow sketch'),
 'leonardo_crank_boat': ('Leonardo Crank-Drive Boat.png','Leonardo da Vinci','Crank-driven paddle boat'),
 'galileo_moon': ("Galileo's sketches of the moon.png",'Galileo Galilei','Sketches of the Moon, 1609'),
 'galileo_moon_phases': ('Galileo moon phases.jpg','Galileo Galilei','Moon phases, Sidereus Nuncius 1610'),
 'galileo_portrait': ('Justus Sustermans - Portrait of Galileo Galilei, 1636.jpg','Justus Sustermans','Portrait of Galileo Galilei, 1636'),
 'galileo_pendulum_clock': ('Galileo pendulum clock 2.png','Vincenzo Viviani (after Galileo)','Galileo\'s pendulum clock design, 1641'),
 'galileo_bilancetta': ('BilanciaGalilei.png','Galileo Galilei','La Bilancetta - hydrostatic balance'),
 'archimedes_lever': ('Archimedes lever (Small).jpg','Mechanics Magazine, 1824','"Give me a place to stand" - Archimedes lever'),
 'archimedes_fetti': ('Domenico-Fetti Archimedes 1620.jpg','Domenico Fetti','Archimedes Thoughtful, 1620'),
 'archimedes_claw': ('Parigi griffe.jpg','Giulio Parigi','The Claw of Archimedes, c.1600'),
 'hero_aeolipile': ('Aeolipile illustration.png',"Knight's American Mechanical Dictionary, 1876",'Hero\'s aeolipile (steam engine)'),
 'hero_pneumatica': ('Hero - Pneumatica, 1592 - 1434011 F.jpeg','Hero of Alexandria (1592 ed.)','Pneumatica, 1592 edition'),
 'ramelli_bookwheel': ('Le diverse et artificiose machine del Capitano Agostino Ramelli Figure CLXXXVIII.jpg','Agostino Ramelli','The bookwheel, 1588'),
 'ramelli_water': ('Le diverse et artificiose machine del capitano Agostino Ramelli - DPLA - f72dca1da89b6190a6eb63e11b9ab8ae (page 139).jpg','Agostino Ramelli','Water-raising machine, 1588'),
 'agricola_mining': ('De re metallica - mining equipment (125711378).jpg','Georgius Agricola','De re metallica: mining machinery, 1556'),
 'agricola_bloomery': ('Bloomeried de re Metallica Agricola.jpg','Georgius Agricola','De re metallica: bloomery furnace, 1556'),
 'taccola_crane': ('Mariano di jacopo detto il taccola, veduta generale della gru di Brunelleschi, prima metà xv sec, BNCF Ms. Palatino 776, c. 10r.jpg','Mariano Taccola','Brunelleschi\'s crane, drawn by Taccola, 15th c.'),
 'stevin_clootcrans': ('Stevin.Wonder.png','Simon Stevin','Clootcrans (wreath of spheres), inclined-plane proof, 1586'),
 'huygens_clock': ('Huygens clock.png','Christiaan Huygens','Pendulum clock, Horologium Oscillatorium 1673'),
 'torricelli_barometer': ('Page in Lezioni accademiche; with early barometer created by Torricelli LCCN92518515.jpg','Evangelista Torricelli','Early barometer, Lezioni accademiche'),
 'montgolfier_balloon': ('Montgolfier 1783 LA2-Blitz-0246.jpg','Anonymous, 1783','Montgolfier hot-air balloon, 1783'),
 'charles_balloon': ('Jacques Charles and Nicolas-Louis Robert. Hydrogen balloon.jpg','Anonymous, 1783','Charles & Robert hydrogen balloon, 1783'),
 'guericke_magdeburg': ('Magdeburg.jpg','Gaspar Schott / Otto von Guericke, 1672','Magdeburg hemispheres experiment'),
}
def api(params):
    params.update(format='json')
    u='https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(params)
    return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60))
strip=lambda s: re.sub(r'<[^>]+>','',s or '').strip()
out=[]
for key,(fn,who,cap) in FILES.items():
    r=api(dict(action='query',titles='File:'+fn,prop='imageinfo',iiprop='url|extmetadata|size',iiurlwidth=1100))
    p=list(r['query']['pages'].values())[0]
    if 'imageinfo' not in p: print('MISSING',key,fn); continue
    ii=p['imageinfo'][0]; m=ii['extmetadata']
    lic=strip(m.get('LicenseShortName',{}).get('value')); cr=strip(m.get('Copyrighted',{}).get('value'))
    lic_full=strip(m.get('License',{}).get('value'))
    ok = ('public domain' in lic.lower() or lic_full.lower().startswith('pd') or lic.lower()=='cc0') 
    url=ii.get('thumburl') if ii['width']>1100 else ii['url']
    for attempt in range(3):
        try: data=urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=90).read(); break
        except Exception as e: print('retry',key,e); time.sleep(3)
    im=Image.open(io.BytesIO(data))
    if im.mode in ('RGBA','LA','P'):
        im=im.convert('RGBA'); bg=Image.new('RGB',im.size,(236,222,190)); bg.paste(im,mask=im.split()[3]); im=bg
    im=im.convert('RGB'); im.thumbnail((900,900),Image.LANCZOS)
    path=f'assets/img/{key}.jpg'; im.save(path,'JPEG',quality=72,optimize=True,progressive=True)
    out.append(dict(key=key,file=fn,page='https://commons.wikimedia.org/wiki/File:'+urllib.parse.quote(fn.replace(' ','_')),
      license=lic, license_code=lic_full, copyrighted=cr, artist=strip(m.get('Artist',{}).get('value'))[:120], credit_name=who, caption=cap,
      date=strip(m.get('DateTimeOriginal',{}).get('value'))[:60], w=im.size[0], h=im.size[1], bytes=os.path.getsize(path), pd_ok=ok))
    print(key, lic, '|', lic_full, '| copyrighted=',cr, im.size, os.path.getsize(path)//1024,'KB', 'OK' if ok else 'NOT-PD')
    time.sleep(0.5)
json.dump(out,open('assets/credits.json','w'),indent=1)
