import math, re
C=[100,300,500,700,900,1100]; R=[70,180,300,420,540,650]; W=160; H=52
N={}
def node(k,x,y,t,s,cls): N[k]=(x,y,t,s,cls)
node('nursing',400,R[0],'Nursing gap','no conception while nursing','lev')
node('reach',C[5],R[0],'Reach by water','boats, ice, roads','lev plan')
node('late',C[0],R[1],'Late or no marriage','needs a home with means','lev')
node('births',C[1],R[1],'Births','by age, to the married','lev')
node('deaths',C[2],R[1],'Deaths','most before age 15','lev')
node('disease',C[3],R[1],'Disease','not designed yet','lev plan')
node('town',C[4],R[1],'Town and craft share','target 325 of 1,000','prop')
node('elite',C[5],R[1],'Elite share','target 75 of 1,000','prop')
node('outside',C[0],R[2],'The outside world','a fixed trickle in and out','lev plan')
node('pop',C[1],R[2],'Population','target about 1,000','prop')
node('kept',C[2],R[2],'Food kept per head','hunger when low','prop')
node('help',C[3],R[2],'Kin help','gifts in hunger','lev')
node('debt',C[4],R[2],'Debt','loans, default, a case','lev plan')
node('conc',C[5],R[2],'Land concentration','land Gini, tenancy','prop')
node('pull',C[0],R[3],'Wanted goods','worth working for','lev plan')
node('made',C[1],R[3],'Food produced','per farmer; 1.67 or more','prop')
node('taken',C[2],R[3],'Share extracted','rent, tithe, tax, labour','prop')
node('good',C[3],R[3],'Goodwill in circulation','halves in 4 years','prop')
node('patron',C[4],R[3],'Patronage','gifts repaid in work and votes','lev gapn')
node('brakes',C[5],R[3],'Brakes on estates','votes, heirs, tenants, talk','lev plan')
node('idle',C[0],R[4],'Idle hours','55 to 79% today','prop')
node('sold',C[1],R[4],'Sold','for goods, later for silver','lev plan')
node('feast',C[2],R[4],'Feasts and gifts','in good years','lev')
node('tax',C[1],R[5],'Tax asked in silver','the Crown, by ship','lev plan')
out=[]
def X(k): return N[k][0]
def Y(k): return N[k][1]
def ex(p,c,dx,dy,pad):
    hw=W/2+pad; hh=H/2+pad
    tx=math.inf if dx==0 else ((c[0]+hw if dx>0 else c[0]-hw)-p[0])/dx
    ty=math.inf if dy==0 else ((c[1]+hh if dy>0 else c[1]-hh)-p[1])/dy
    t=min(tx,ty); return (p[0]+dx*t,p[1]+dy*t)
def sign(x,y,s,k):
    out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="9" class="sg {k}"/><text x="{x:.0f}" y="{y+4.5:.0f}" text-anchor="middle" class="sgt {k}">{s}</text>')
def slowmark(x,y,ux,uy,k):
    nx,ny=-uy,ux
    for d in (-2.5,2.5):
        cx,cy=x+ux*d,y+uy*d
        out.append(f'<line x1="{cx-nx*6:.1f}" y1="{cy-ny*6:.1f}" x2="{cx+nx*6:.1f}" y2="{cy+ny*6:.1f}" class="tk {k}"/>')
def edge(a,b,s,k,off=0,t=0.5,slow=False):
    ca=(X(a),Y(a)); cb=(X(b),Y(b)); dx=cb[0]-ca[0]; dy=cb[1]-ca[1]; L=math.hypot(dx,dy)
    px=-dy/L*off; py=dx/L*off
    a2=(ca[0]+px,ca[1]+py); b2=(cb[0]+px,cb[1]+py)
    p=ex(a2,ca,dx,dy,0); q=ex(b2,cb,-dx,-dy,4)
    out.append(f'<line x1="{p[0]:.0f}" y1="{p[1]:.0f}" x2="{q[0]:.0f}" y2="{q[1]:.0f}" class="e {k}" marker-end="url(#m{k})"/>')
    l=math.hypot(q[0]-p[0],q[1]-p[1])
    if slow:
        if l<60: sx,tt=0.5,0.5
        tt=0.28 if l>=60 else 0.3
        st=0.62 if l>=60 else 0.72
        slowmark(p[0]+(q[0]-p[0])*tt,p[1]+(q[1]-p[1])*tt,dx/L,dy/L,k); t=st
    sign(p[0]+(q[0]-p[0])*t, p[1]+(q[1]-p[1])*t, s, k)
B='b'; P='p'; G='g'
def flow(a,b,k,lab,lx,ly,anchor='start',to=None):
    ca=(X(a),Y(a)); cb=to or (X(b),Y(b)); dx=cb[0]-ca[0]; dy=cb[1]-ca[1]
    p=ex(ca,ca,dx,dy,0); q=cb if to else ex(cb,cb,-dx,-dy,6)
    out.append(f'<line x1="{p[0]:.0f}" y1="{p[1]:.0f}" x2="{q[0]:.0f}" y2="{q[1]:.0f}" class="f {k}" marker-end="url(#f{k})"/>')
    out.append(f'<text x="{lx}" y="{ly}" text-anchor="{anchor}" class="fl">{lab}</text>')
flow('made','kept',B,'eaten',372,352,'end')
flow('made','taken',P,'taken',400,412,'middle')
flow('made','feast',B,'feasted',438,476,'start')
flow('made','sold',P,'sold',308,484,'start')
flow('made',None,B,'rots',196,522,'end',to=(214,494))
out.append('<circle cx="208" cy="500" r="9" class="sink"/>')
edge('births','pop','+',B); edge('deaths','pop','−',B)
edge('pop','late','+',B,slow=True); edge('late','births','−',B,slow=True)
edge('nursing','births','−',B); edge('deaths','nursing','−',G)
edge('outside','pop','±',P)
edge('kept','deaths','−',B); edge('kept','disease','−',G); edge('disease','deaths','+',P); edge('town','disease','+',P)
edge('reach','town','+',P,slow=True)
edge('pop','made','−',B,slow=True); edge('taken','kept','−',P)
edge('kept','help','−',B,off=-11); edge('help','kept','+',B,off=-11)
edge('help','good','+',B,off=-11); edge('good','help','+',B,off=-11)
edge('help','debt','−',P); edge('help','patron','−',G)
edge('good','patron','+',G); edge('patron','conc','+',G,slow=True)
edge('debt','conc','+',P,slow=True)
edge('conc','brakes','+',P,off=-11); edge('brakes','conc','−',P,off=-11,slow=True)
edge('conc','elite','+',P,slow=True); edge('elite','town','+',P,slow=True)
edge('pull','made','+',P); edge('pull','idle','−',P)
edge('feast','good','+',G)
edge('tax','sold','+',P)
out.append('<path d="M 100 154 L 100 24 L 900 24 L 900 150" class="e p" fill="none" marker-end="url(#mp)"/>'); sign(560,24,'+',P); slowmark(300,24,1,0,P)
out.append('<text x="720" y="42" text-anchor="middle" class="l p">the unmarried and landless leave for town</text>')
out.append('<path d="M 1026 326 L 1000 352 L 1000 484 L 500 484 L 500 452" class="e p" fill="none" marker-end="url(#mp)"/>'); sign(820,484,'+',P); slowmark(1000,420,0,1,P)
out.append('<line x1="800" y1="118" x2="838" y2="150" class="e p" marker-end="url(#mp)"/>'); sign(815,131,'+',P)
out.append('<text x="792" y="112" text-anchor="end" class="l p">food sold</text>')
out.append('<line x1="42" y1="356" x2="66" y2="391" class="e p" marker-end="url(#mp)"/>'); sign(51,369,'+',P)
out.append('<text x="20" y="348" text-anchor="start" class="l p">goods from town and fair</text>')
def badge(x,y,s):
    out.append(f'<circle cx="{x}" cy="{y}" r="13" class="lp{s[0]}"/><text x="{x}" y="{y+4}" text-anchor="middle" class="lpt">{s}</text>')
badge(238,222,'B1'); badge(400,300,'B2'); badge(640,356,'B3'); badge(800,240,'B4'); badge(1150,360,'B5'); badge(640,520,'B6')
badge(760,506,'R1'); badge(200,378,'R2'); badge(232,600,'R3')
for k,(x,y,t,s,c) in N.items():
    out.append(f'<rect x="{x-W/2}" y="{y-H/2}" width="{W}" height="{H}" rx="{26 if "prop" in c else 6}" class="n {c}"/>')
    out.append(f'<text x="{x}" y="{y-3}" text-anchor="middle" class="t">{t}</text><text x="{x}" y="{y+14}" text-anchor="middle" class="s">{s}</text>')
mk=''.join(f'<marker id="m{k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="h{k}"/></marker>' for k in 'bpg')+''.join(f'<marker id="f{k}" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="15" markerHeight="15" orient="auto"><path d="M0 0 L10 5 L0 10 z" class="h{k}"/></marker>' for k in 'bp')
svg=f'<svg id="bm" viewBox="0 0 1200 690" role="img" aria-label="Draft 3 of the balance map: nine balance properties and their levers. Food produced flows five ways: eaten, taken, feasted, sold, or rotted. Food kept per head, when low, raises deaths and asks for help.">\n<defs>{mk}</defs>'+'\n'.join(out)+'</svg>'
t=open('balance.tpl').read()
a=t.index('<main>'); 
open('balance-map.html','w').write(t[:a]+open('body3.html').read().replace('%%SVG%%',svg))
