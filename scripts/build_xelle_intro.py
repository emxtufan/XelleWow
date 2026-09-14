"""Replace only the embedded 3D intro lettering in copies of both scene GLBs.

All existing node indices, transforms, animation tracks and binary data remain
unchanged. New per-letter planes become the children of the original font group,
so the original bPe animation still reveals individual letters in two lines.
"""
from pathlib import Path
import io
import json
import struct
from PIL import Image, ImageDraw
from build_xelle_models import GLB, font, ROOT, ASSETS, MODELS

INTRO = ASSETS / "intro"


def subtitle_atlas():
    phrase = "EXTRAIT DE PARFUM"
    ft = font("arial.ttf", 130)
    dummy=ImageDraw.Draw(Image.new("RGBA",(1,1)))
    spacing=29
    advances=[dummy.textlength(ch,font=ft) for ch in phrase]
    width=round(sum(advances)+spacing*(len(phrase)-1))+4
    image=Image.new("RGBA",(width,180),(255,255,255,0))
    draw=ImageDraw.Draw(image)
    x=0
    regions=[]
    for character,advance in zip(phrase,advances):
        if character != " ":
            draw.text((x,1),character,font=ft,fill=(255,255,255,255))
            regions.append((character,x,x+advance))
        x+=advance+spacing
    return image,regions


def add_letter(glb,material,name,region,image_size,world_width,world_height,y,z):
    _,px0,px1=region
    iw,ih=image_size
    left=(px0/iw-.5)*world_width
    right=(px1/iw-.5)*world_width
    # Parent font group has 180-degree Y rotation. Mirror local X/UV together so
    # the existing camera sees the official wordmark in its proper orientation.
    center_x=-(left+right)/2
    half=(right-left)/2
    positions=[(-half,-world_height/2,0),(half,-world_height/2,0),
               (half,world_height/2,0),(-half,world_height/2,0)]
    normals=[(0,0,-1)]*4
    tangents=[(-1,0,0,1)]*4
    uv=[(px1/iw,1),(px0/iw,1),(px0/iw,0),(px1/iw,0)]
    glb.mesh(name,positions,normals,tangents,uv,[0,2,1,0,3,2],material)
    index=len(glb.doc["nodes"])-1
    glb.doc["nodes"][index]["translation"]=[center_x,y,z]
    glb.doc["nodes"][index]["extras"]={"no_mirror":True,"sceneIndex":0,"xelleIntro":True}
    return index


def replace_scene(filename,title,title_regions,subtitle,subtitle_regions):
    original=ROOT/"public"/"webgl"/"models"/filename
    data=original.read_bytes()
    json_size=struct.unpack_from("<I",data,12)[0]
    doc=json.loads(data[20:20+json_size])
    bin_start=20+json_size
    bin_size,bin_type=struct.unpack_from("<II",data,bin_start)
    assert bin_type == 0x004E4942
    glb=GLB("intro","Xellé / Extrait de Parfum")
    glb.doc=doc
    glb.binary=bytearray(data[bin_start+8:bin_start+8+bin_size])
    target=next(i for i,n in enumerate(doc["nodes"]) if n.get("name")=="font")
    source_children=doc["nodes"][target]["children"][:]
    # GLB.mesh normally appends to node0's children; preserve that unrelated node.
    zero_children=doc["nodes"][0].get("children")
    had_zero_children="children" in doc["nodes"][0]
    doc["nodes"][0]["children"]=[]
    new_nodes=[]
    for image,regions,line,y,z,width in [(title,title_regions,"wordmark",4.027,.123,8.2),
                                        (subtitle,subtitle_regions,"subtitle",2.341,.414,8.5)]:
        png=io.BytesIO();image.save(png,"PNG",optimize=True)
        tex=glb.texture(png.getvalue())
        mat=glb.material("MT_Font_Xelle_"+line,(1,1,1),1,0,1,tex)
        doc["materials"][mat].update({"alphaMode":"BLEND","doubleSided":True})
        height=width*image.height/image.width
        for i,region in enumerate(regions):
            index=add_letter(glb,mat,f"Xelle_intro_{line}_{i:02}",region,image.size,width,height,y,z)
            new_nodes.append(index)
    doc["nodes"][target]["children"]=new_nodes
    if had_zero_children:
        doc["nodes"][0]["children"]=zero_children
    else:
        del doc["nodes"][0]["children"]
    for child in source_children:
        # Detach the old lettering; keep indices stable for unrelated animations.
        doc["nodes"][child].setdefault("extras",{})["xelleReplacedIntro"]=True
    output=MODELS/filename
    result=glb.finish(output)
    assert doc["animations"] == json.loads(data[20:20+json_size])["animations"]
    print(json.dumps({"file":str(output),"bytes":result["bytes"],"introLetters":len(new_nodes),
                      "originalAnimationPreserved":True}))


def main():
    INTRO.mkdir(exist_ok=True,parents=True)
    MODELS.mkdir(exist_ok=True,parents=True)
    title=Image.open(ASSETS/"xelle-wordmark.png").convert("RGBA")
    title_regions=[("X",0,141),("E",171,249),("L",300,367),("L",421,489),("É",542,621)]
    subtitle,subtitle_regions=subtitle_atlas()
    title.save(INTRO/"xelle-wordmark.png",optimize=True)
    subtitle.save(INTRO/"extrait-de-parfum.png",optimize=True)
    for filename in ("mainScene.glb","mainSceneMobile.glb"):
        replace_scene(filename,title,title_regions,subtitle,subtitle_regions)


if __name__ == "__main__":
    main()
