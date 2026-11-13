"""Original portfolio hardware. Blender 4.1+: blender -b --python this_file -- --output public/models.
Author in Three.js coordinates (X right, Y up, Z toward visitor); glTF handles axis conversion.
"""
import bpy, math, json, os, sys, argparse
from mathutils import Vector, Matrix, Euler
from pathlib import Path
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
p = argparse.ArgumentParser(); p.add_argument('--output', default='public/models'); p.add_argument('--sources'); p.add_argument('--classic-style', choices=['angular','rounded'], default='angular')
opt = p.parse_args(args); output = Path(opt.output).resolve(); output.mkdir(parents=True, exist_ok=True)
C = Matrix(((1,0,0),(0,0,-1),(0,1,0)))
def v3(v): return C @ Vector(v)
def rot3(v): return (C @ Euler(v, 'XYZ').to_matrix() @ C.transposed()).to_quaternion()
def linear(n): return n / 12.92 if n < .04045 else ((n+.055)/1.055)**2.4
def rgb(h): return tuple(linear(int(h[i:i+2],16)/255) for i in (0,2,4))
def mat(name, color, rough=.45, metal=0, emission=0, alpha=1):
    m=bpy.data.materials.new(name); m.use_nodes=True; q=m.node_tree.nodes.get('Principled BSDF'); c=rgb(color)
    q.inputs['Base Color'].default_value=(*c,alpha); q.inputs['Roughness'].default_value=rough; q.inputs['Metallic'].default_value=metal
    if emission: q.inputs['Emission Color'].default_value=(*c,1); q.inputs['Emission Strength'].default_value=emission
    if alpha<1: q.inputs['Alpha'].default_value=alpha; m.blend_method='BLEND'; m.use_screen_refraction=False; m.show_transparent_back=True
    m.diffuse_color=(*c,alpha); return m
M={}
def reset():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    for mesh in list(bpy.data.meshes):
        if not mesh.users: bpy.data.meshes.remove(mesh)
    global M
    M={n:mat(n,*a) for n,a in {
      'ivory':('d8d0b7',.38,0), 'edge':('bcb397',.42,0), 'cream':('e9e2ce',.38,0),
      'rubber':('22272b',.7,0), 'black':('090d12',.34,.1), 'ink':('3b403b',.6,0),
      'silver':('989fa7',.3,.65), 'aluminum':('bac0c6',.28,.7), 'graphite':('343a42',.28,.65),
      'white':('e1e5e7',.3,.2), 'pcb':('16382f',.6,.1), 'brass':('bd9b5c',.35,.7),
      'teal':('5de8d2',.3,.1,3), 'pink':('f882d7',.3,.1,3), 'violet':('a899ff',.3,.1,3),
      'amber':('e6ad59',.35,0,2), 'label':('c7ceca',.5,0), 'glass':('a1c8d5',.16,.12,0,.12),
    }.items()}
def finish(o,name, material, parent=None, rotation=None):
    o.name=name
    if material: o.data.materials.append(M[material] if isinstance(material,str) else material)
    if rotation: o.rotation_mode='QUATERNION'; o.rotation_quaternion=rot3(rotation)
    if parent: o.parent=parent
    return o
def cube(name, pos, size, material, bevel=.015, parent=None, rotation=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=v3(pos)); o=bpy.context.object; o.dimensions=(size[0],size[2],size[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
      b=o.modifiers.new('Machined radii','BEVEL'); b.width=min(bevel,min(size)*.45); b.segments=3; b.harden_normals=True
      o.modifiers.new('Weighted face normals','WEIGHTED_NORMAL')
    return finish(o,name,material,parent,rotation)
def empty(name, pos=(0,0,0), rotation=None, parent=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=v3(pos)
    if parent:o.parent=parent
    if rotation:o.rotation_mode='QUATERNION';o.rotation_quaternion=rot3(rotation)
    return o
def cyl(name,pos,radius,depth,material,axis='z',parent=None,verts=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=radius,depth=depth,location=v3(pos));o=bpy.context.object
    rotation={'x':(0,math.pi/2,0),'y':(-math.pi/2,0,0),'z':(0,0,0)}[axis]
    # Blender cylinders default along Blender Z, which is Three Y.
    o.rotation_mode='QUATERNION';o.rotation_quaternion=rot3(rotation) @ rot3((math.pi/2,0,0))
    for poly in o.data.polygons:poly.use_smooth=True
    return finish(o,name,material,parent)
def torus(name,pos,radius,tube,material,axis='z',parent=None):
    bpy.ops.mesh.primitive_torus_add(major_segments=36,minor_segments=8,location=v3(pos),major_radius=radius,minor_radius=tube);o=bpy.context.object
    rotation={'x':(0,math.pi/2,0),'y':(-math.pi/2,0,0),'z':(0,0,0)}[axis]
    o.rotation_mode='QUATERNION';o.rotation_quaternion=rot3(rotation) @ rot3((math.pi/2,0,0))
    for poly in o.data.polygons:poly.use_smooth=True
    return finish(o,name,material,parent)
def text(name,body,pos,size,material='ink',parent=None,rotation=None):
    c=bpy.data.curves.new(name,'FONT');c.body=body;c.size=size;c.align_x='CENTER';c.align_y='CENTER';c.extrude=.0004;c.resolution_u=3
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.location=v3(pos)
    # Text local XY becomes Three XY, normal toward visitor.
    o.rotation_mode='QUATERNION';o.rotation_quaternion=rot3(rotation or (0,0,0)) @ rot3((math.pi/2,0,0))
    if parent:o.parent=parent
    c.materials.append(M[material]);return o

def ring(name,pos,w,h,radius,thick,material,depth=.035,parent=None,rotation=None):
    # Smooth rounded rectangular frame with a genuine aperture.
    def outline(width,height,r):
      out=[]
      for x,y,a in [(width/2-r,height/2-r,0),(-width/2+r,height/2-r,90),(-width/2+r,-height/2+r,180),(width/2-r,-height/2+r,270)]:
        for i in range(9):
          t=math.radians(a+i*90/8);out.append((x+r*math.cos(t),y+r*math.sin(t)))
      return out
    outer=outline(w,h,radius);inner=outline(w-2*thick,h-2*thick,max(.005,radius-thick));n=len(outer)
    verts=[v3((x,y,z))[:] for z in (-depth/2,depth/2) for loop in (outer,inner) for x,y in loop];faces=[]
    for i in range(n):
      j=(i+1)%n;faces.extend([(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),(i,2*n+i,2*n+j,j),(n+i,n+j,3*n+j,3*n+i)])
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],[tuple(reversed(face)) for face in faces]);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.location=v3(pos)
    return finish(o,name,material,parent,rotation)
def fan(name,pos,radius,color,axis='z',parent=None):
    g=empty(name,pos,parent=parent,rotation=(0,math.pi/2,0) if axis=='x' else None)
    cyl(name+' housing',(0,0,-.008),radius+.035,.038,'rubber',parent=g)
    torus(name+' diffuser',(0,0,.02),radius,.013,color,parent=g)
    torus(name+' inner trim',(0,0,.026),radius-.035,.004,'silver',parent=g)
    for i in range(7):
      a=i*math.tau/7
      cube(name+' blade '+str(i),(math.cos(a)*radius*.47,math.sin(a)*radius*.47,.022),(radius*.86,radius*.30,.012),'graphite',.012,parent=g,rotation=(0,0,a+.6))
    cyl(name+' hub',(0,0,.034),radius*.22,.028,'silver',parent=g)
    return g

def classic():
    if opt.classic_style == 'rounded':
      body=cube('Macintosh porcelain shell',(0,-.08,-.65),(2.25,2.75,1.65),'ivory',.095)
    else:
      # Broad planar front, tapered back and crisp chamfers echo the original Plus.
      vertices=[(-1.15,-1.42,.19),(1.15,-1.42,.19),(1.15,1.30,.19),(-1.15,1.30,.19),(-1.04,-1.42,-1.48),(1.04,-1.42,-1.48),(.99,1.17,-1.48),(-.99,1.17,-1.48)]
      mesh=bpy.data.meshes.new('Angular Plus shell');mesh.from_pydata([v3(v)[:] for v in vertices],[],[(0,1,2,3),(1,5,6,2),(5,4,7,6),(4,0,3,7),(3,2,6,7),(4,5,1,0)]);mesh.update()
      body=bpy.data.objects.new('Angular Plus shell',mesh);bpy.context.collection.objects.link(body);body.data.materials.append(M['ivory'])
      bevel=body.modifiers.new('Crisp chamfers','BEVEL');bevel.width=.016;bevel.segments=1
      body.modifiers.new('Weighted face normals','WEIGHTED_NORMAL')
    cut=cube('screen pocket cutter',(0,.43,.18),(1.83,1.43,.5),None,.12)
    bpy.context.view_layer.objects.active=cut;bpy.ops.object.modifier_apply(modifier=cut.modifiers[0].name)
    mod=body.modifiers.new('Recessed CRT pocket','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cut
    bpy.context.view_layer.objects.active=body;bpy.ops.object.modifier_move_up(modifier=mod.name);bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
    ring('Deep CRT bezel',(0,.43,.205),1.84,1.44,.15 if opt.classic_style=='rounded' else .065,.09,'edge',.16)
    ring('Black glass seal',(0,.43,.286),1.68,1.28,.09,.025,'rubber',.025)
    cube('CRT dark backing',(0,.43,.274),(1.63,1.23,.018),'black',.006)
    cube('Floppy slot recess',(.35,-.68,.203),(.99,.075,.018),'rubber',.008)
    cube('Floppy upper lip',(.35,-.635,.201),(1.06,.035,.055),'cream',.008)
    cube('Disk eject',(.93,-.68,.203),(.12,.065,.042),'edge',.012)
    text('Disk legend','800K',(.71,-.79,.212),.04)
    cube('Badge surround',(-.78,-.78,.205),(.25,.25,.022),'cream',.006)
    for i,col in enumerate(('teal','violet','pink','amber')):cube('Prismatic badge '+str(i),(-.78,-.704-i*.035,.223),(.15,.031,.01),col,.002)
    text('Case wordmark','storm',(-.61,-1.02,.212),.105)
    text('Case edition','PERSONAL COMPUTER',(.27,-1.045,.212),.039)
    cyl('Power jewel',(-.93,-1.15,.195),.021,.022,'amber')
    for row in range(5):
      for side in (-1,1):
        for j in range(4):cube('Side ventilation', (side*(1.126 if opt.classic_style=='rounded' else 1.151-(.43+j*.16)/1.67*.15),.76-row*.095,-.24-j*.16),(.011,.027,.11),'ink',.004)
    cube('Carry handle inset',(0,1.297 if opt.classic_style=='rounded' else 1.218,-.85),(.88,.013,.32),'rubber',.006)
    cube('Carry handle bridge',(0,1.308 if opt.classic_style=='rounded' else 1.234,-.82),(.94,.028,.10),'ivory',.012)
    for i in range(10):cube('Rear exhaust '+str(i),(-.72+i*.16,.65,-1.48),(.055,.65,.012),'ink',.006)
    cube('Lower plinth',(0,-1.46,-.69),(2.04,.13,1.45),'edge',.035)
    for x in (-.76,.76):
      for z in (-1.16,-.2):cube('Rubber foot',(x,-1.525,z),(.22,.06,.22),'rubber',.025)
    return dict(id='classic',label='Classic Mac',subtitle='Warm ivory · CRT glass · 800K',asset='/models/studio-mac.glb',screen=dict(position=[0,.43,.295],rotation=[0,0,0],width=1.6,height=1.2,cssWidth=800,cssHeight=600,radius=24),framing=dict(target=[.25,-.15,.35],width=4.8,height=3.8,distance=8.6),keyboard=True,mouse=[1.9,-1.54,1.65],bounds=[1.0,2.9,.65,2.4])

def laptop():
    cube('Unibody lower shell',(0,-1.38,.35),(3.85,.17,2.52),'aluminum',.09)
    cube('Polished seam',(0,-1.315,.35),(3.81,.025,2.47),'silver',.011)
    cube('Palm rest',(0,-1.298,.35),(3.80,.032,2.46),'aluminum',.015)
    cube('Keyboard well',(0,-1.272,-.02),(2.91,.025,1.02),'rubber',.012)
    rows=[list('1234567890-='),list('qwertyuiop[]'),list("asdfghjkl;'"),list('zxcvbnm,./')]
    for row,keys in enumerate(rows):
      for i,key in enumerate(keys):
        x=(i-(len(keys)-1)/2)*.225;z=-.37+row*.22
        cap=cube('keycap_'+str(row)+'_'+str(i),(x,-1.247,z),(.202,.045,.187),'black',.018);cap['key']=key
        lab=text('key legend '+str(row)+' '+str(i),key.upper(),(x,-1.221,z),.052,'label',rotation=(-math.pi/2,0,0));lab['key']=key
    for key,x,w in [('Escape',-1.55,.19),('Backspace',1.47,.25),('Enter',1.42,.31)]:
      z=-.37 if key!='Enter' else .07;cap=cube('keycap_'+key,(x,-1.247,z),(w,.045,.187),'black',.016);cap['key']=key
    cap=cube('keycap_space',(0,-1.247,.51),(1.30,.045,.18),'black',.018);cap['key']=' '
    for side in (-1,1):
      for i in range(13):
        cube('Speaker perforation',(side*1.65,-1.271,-.37+i*.065),(.11,.006,.016),'ink',.002)
    cube('Trackpad edge',(0,-1.273,1.03),(1.48,.014,.70),'graphite',.04)
    pad=cube('Haptic trackpad',(0,-1.263,1.03),(1.45,.015,.67),'silver',.035);pad['control']='trackpad'
    cube('Front finger scoop',(0,-1.31,1.61),(.48,.06,.025),'graphite',.015)
    for x in (-1.94,1.94):
      for z in (-.35,.05):cube('USB C port',(x,-1.38,z),(.012,.037,.15),'black',.009)
    cyl('Continuous hinge',(0,-1.24,-.84),.065,3.3,'graphite',axis='x')
    display=empty('Laptop display',(0,-.03,-1.01),rotation=(-.15,0,0))
    cube('Aluminium lid',(0,0,0),(3.86,2.42,.073),'graphite',.035,parent=display)
    cube('Lid back inlay',(0,0,-.043),(3.78,2.34,.016),'silver',.007,parent=display)
    ring('Thin display bezel',(0,0,.045),3.79,2.35,.10,.12,'black',.024,parent=display)
    cube('Display backing',(0,0,.05),(3.46,2.164,.012),'black',.005,parent=display)
    cube('Camera notch',(0,1.102,.067),(.28,.067,.018),'black',.007,parent=display)
    cyl('Camera sapphire',(0,1.106,.079),.012,.009,'teal',parent=display,verts=16)
    text('Rear signature','S',(0,0,-.058),.3,'label',parent=display,rotation=(0,math.pi,0))
    for x in (-1.5,1.5):
      for z in (-.56,1.25):cube('Laptop rubber foot',(x,-1.493,z),(.31,.05,.20),'rubber',.025)
    dz=.066;return dict(id='laptop',label='Studio Laptop',subtitle='Aluminium · backlit keys · 16:10',asset='/models/studio-laptop.glb',screen=dict(position=[0,-.03+math.sin(.15)*dz,-1.01+math.cos(.15)*dz],rotation=[-.15,0,0],width=3.45,height=2.15625,cssWidth=1000,cssHeight=625,radius=18),framing=dict(target=[.3,-.1,.30],width=6,height=3.8,distance=9.2),keyboard=False,mouse=[2.7,-1.54,1.4],bounds=[2.1,3.5,.6,2.2])

def pc():
    # Wide studio display: one real screen shared with the other machines.
    display=empty('Studio monitor',(-.75,.18,-.44))
    cube('Monitor rear shell',(0,0,-.035),(3.68,2.16,.17),'graphite',.065,parent=display)
    ring('Micro bezel',(0,0,.067),3.63,2.11,.085,.065,'black',.035,parent=display)
    cube('IPS screen backing',(0,0,.082),(3.50,1.969,.012),'black',.003,parent=display)
    cyl('Monitor standby',(1.68,-1.025,.09),.012,.009,'teal',parent=display,verts=12)
    text('Monitor lower mark','STORM',(-1.46,-1.025,.09),.038,'label',parent=display)
    cube('Monitor stem',(-.75,-1.13,-.54),(.19,.65,.19),'silver',.04)
    cube('Monitor foot',(-.75,-1.49,-.24),(1.15,.07,.66),'graphite',.035)
    tower=empty('Custom RTX workstation',(2.20,-.20,-.05),rotation=(0,-.25,0))
    # Open structural frame: the right glass panel exposes every component.
    for x in (-.65,.65):
      for z in (-.72,.72):cube('Case upright',(x,0,z),(.075,2.43,.075),'white',.014,parent=tower)
    for y in (-1.18,1.18):
      cube('Case tray',(0,y,0),(1.38,.10,1.52),'white',.025,parent=tower)
      for z in (-.72,.72):cube('Cross member',(0,y,z),(1.38,.09,.075),'white',.015,parent=tower)
    cube('Motherboard wall',(-.60,.05,0),(.04,2.13,1.35),'graphite',.008,parent=tower)
    cube('Motherboard PCB',(-.56,.10,-.05),(.035,1.43,1.10),'pcb',.008,parent=tower)
    cube('PSU shroud',(0,-.91,0),(1.27,.45,1.38),'graphite',.015,parent=tower)
    text('PSU mark','850W',(0,-.9,.707),.12,'label',parent=tower)
    # Front intake fans and tinted window.
    for i,col in enumerate(('teal','violet','pink')):fan('Front RGB '+str(i),(0,.70-i*.68,.739),.265,col,parent=tower)
    cube('Front glass',(0,0,.782),(1.20,2.20,.012),'glass',.005,parent=tower)
    cube('Side glass',(.693,0,0),(.012,2.22,1.34),'glass',.005,parent=tower)
    for y in (-1.02,1.02):
      for z in (-.59,.59):cyl('Glass standoff',(.705,y,z),.022,.014,'silver',axis='x',parent=tower,verts=12)
    # Two vertical triple-slot RTX-style cards facing the side glass, each with an RGB edge.
    for k,(cy,fans,edge) in enumerate(((-.32,'teal','violet'),(.30,'pink','teal'))):
      card='' if k==0 else ' '+str(k+1)
      cube('RTX card backplate'+card,(.24,cy,-.02),(.07,.57,1.20),'black',.018,parent=tower)
      cube('RTX card shroud'+card,(.33,cy,-.02),(.13,.55,1.18),'graphite',.03,parent=tower)
      for i in range(3):fan('RTX GPU fan '+str(k*3+i),(.415,cy,-.40+i*.38),.16,fans,axis='x',parent=tower)
      cube('GPU light bar'+card,(.405,cy+.29,-.02),(.03,.022,1.12),edge,.006,parent=tower)
      cube('GPU end cap'+card,(.33,cy,.585),(.13,.50,.022),edge,.006,parent=tower)
      text('RTX engraving'+card,'GEFORCE RTX',(.405,cy-.255,-.02),.06,'label',parent=tower,rotation=(0,math.pi/2,0))
    cube('GPU bridge',(.27,-.01,-.56),(.09,.07,.30),'graphite',.012,parent=tower)
    cube('GPU bridge light',(.318,-.01,-.56),(.012,.03,.26),'violet',.004,parent=tower)
    # CPU cooling block, two RGB memory sticks, braided coolant tubes.
    cube('CPU coldplate',(-.48,.43,-.05),(.15,.40,.40),'silver',.035,parent=tower)
    fan('CPU pump',(-.375,.43,-.05),.145,'violet',axis='x',parent=tower)
    for z in (.33,.46):
      cube('DDR memory',(-.43,.50,z),(.09,.66,.045),'black',.009,parent=tower)
      cube('DDR diffuser',(-.37,.50,z),(.027,.64,.05),'pink',.008,parent=tower)
    for i in range(2):
      for j in range(8):cube('Braided coolant',(-.25+i*.12,.62+j*.045,-.05-j*.07),(.07,.11,.08),'rubber',.03,parent=tower)
    cube('Front IO',(0,1.246,.38),(.55,.015,.30),'graphite',.008,parent=tower)
    cyl('Power switch',(-.15,1.26,.39),.05,.015,'silver',axis='y',parent=tower)
    for x in (.03,.17):cube('Top USB socket',(x,1.26,.39),(.055,.012,.10),'black',.006,parent=tower)
    for x in (-.45,.45):
      for z in (-.5,.5):cube('Case rubber foot',(x,-1.29,z),(.17,.13,.20),'rubber',.016,parent=tower)
    return dict(id='rgb',label='RTX Workstation',subtitle='Glass side · dual RTX · RGB',asset='/models/studio-pc.glb',screen=dict(position=[-.75,.18,-.337],rotation=[0,0,0],width=3.50,height=1.96875,cssWidth=1120,cssHeight=630,radius=12),framing=dict(target=[.65,-.12,.30],width=7.1,height=4.3,distance=10.2),keyboard=True,mouse=[2.7,-1.54,1.7],bounds=[2.0,3.6,.7,2.4])

profiles=[]
for factory,name in [(classic,'studio-mac'),(laptop,'studio-laptop'),(pc,'studio-pc')]:
    reset(); profile=factory(); profiles.append(profile)
    # Convert labels to meshes; geometry/modifiers remain reproducible in this source.
    for o in list(bpy.context.scene.objects):
      if o.type=='FONT':
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(output/(name+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
    if opt.sources:
      Path(opt.sources).mkdir(parents=True,exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=str(Path(opt.sources)/(name+'.blend')))
    print('EXPORTED',name, (output/(name+'.glb')).stat().st_size, 'bytes',len(bpy.context.scene.objects),'objects')
(output/'hardware-manifest.json').write_text(json.dumps(profiles,indent=2)+'\n')
