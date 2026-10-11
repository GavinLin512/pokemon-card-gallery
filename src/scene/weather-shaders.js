// HD-2D 微風，由看板與立體植物共用：兩道陣風波緩慢掃過地面（往東北吹），
// 每株植物再以自己的相位與頻率擺動，風大時整片順著風向傾斜。回傳往 +x 的偏移比例（約 −0.3 至 1.5）。
export const breezeField = `
float breezeSway(vec2 p, float t, float seed, float rate) {
  float gust = sin(dot(p, vec2(.16, -.07)) - t * .9) + .6 * sin(dot(p, vec2(-.05, -.29)) - t * 1.35 + 2.);
  gust = smoothstep(-.4, 1.4, gust);
  float sway = sin(t * rate + seed * 6.2832) * .7 + sin(t * rate * 2.3 + seed * 17.) * .3;
  return gust * .6 + sway * (.4 + .5 * gust);
}
`

// 氣浪與光束的世界座標由地景著色及天氣幾何共用，光照落點不隨鏡頭滑動。
export const weatherFields = `${breezeField}
float weatherPulse(vec2 p, float t) {
  float index = clamp(floor((14.-p.y)/11.+.5),0.,17.);
  vec2 center = vec2(sin(index*3.)*3.,14.-index*11.);
  float phase = fract(t*.42+index*.618);
  return exp(-abs(length(p-center)-phase*7.5)*4.)*(1.-phase);
}
float weatherBeam(vec2 p, float t) {
  float index = clamp(floor((6.-p.y)/12.+.5),0.,17.);
  vec2 center = vec2(sin(index*2.7)*12.,6.-index*12.);
  return exp(-dot(p-center,p-center)*.075)*(.72+.28*sin(t*.35+index*.618));
}
`

export const particleVertex = `
attribute vec4 seed;
uniform float time, mode, viewport, size;
varying float fade, turn, variant, flip;
${weatherFields}
void main(){
 vec3 p=position; float t=time;
 float rate=mode==2. ? .85 : (mode==10.||mode==14.) ? 1.8 : .1;
 float life=fract(seed.x+t*rate); float grow=1.; flip=1.;
 fade=sin(life*3.14159); turn=seed.y*6.28+t*(.65+seed.z); variant=seed.z;
 if(mode==2.) {
   p.y=seed.w+(23.-seed.w)*(1.-life);
   // 地面落點固定，風斜偏移隨高度漸減，終點仍是此 seed 的屋頂／地面。
   p.x+=(p.y-seed.w)*.18; p.z+=(p.y-seed.w)*.08; fade=.85;
 } else if(mode==10.) {
   // 落地漣漪：貼在屋頂／地面，由小擴大並淡出。
   p.y=seed.w+.03; grow=.2+life*.8; fade=(1.-life)*(1.-life*.5);
 } else if(mode==14.) {
   // 彈起的水珠：沿拋物線跳起並向外散開，方向由 seed 固定。
   float dir=seed.y*6.2832, hop=sin(life*3.14159);
   p.y=seed.w+.03+hop*(.16+seed.z*.3);
   p.x+=cos(dir)*life*.3; p.z+=sin(dir)*life*.3; fade=1.-life*life;
 } else if(mode==0. || mode==6. || mode==7.) {
   float gust=sin(t*.85+position.z*.14);
   p.x+=sin(t*.65+seed.y*9.)*1.8+life*5.+gust*.8;
   p.z+=sin(t*.45+seed.x*8.)*1.3;
   p.y+=(1.-life)*5.5+sin(t+seed.y*9.)*.45;
   if(mode==0.) {
     // 葉片左右搖擺而不是整圈旋轉，並前後翻轉（翻到側面時變窄）。
     turn=seed.y*6.28+sin(t*(.9+seed.z*.8)+seed.x*9.)*1.1;
     flip=.3+.7*abs(cos(t*(1.1+seed.z)+seed.x*7.));
   }
 } else if(mode==1.) {
   p.y+=life*6.;p.x+=sin(t*1.5+seed.y*8.)*(.5+life);p.z+=cos(t+seed.z*9.)*.45;
 } else if(mode==3.) {
   p.y+=sin(t*.8+seed.x*9.)*.65;p.x+=sin(t*.45+seed.y*8.)*1.1;
   fade=.65+.3*sin(t*1.1+seed.y*5.);
 } else if(mode==4.) {
   p.x+=sin(t*.25+seed.y*8.)*3.;p.z+=cos(t*.2+seed.x*8.)*1.5;fade=.7;
 } else if(mode==11.) {
   p.x+=cos(t*.65+seed.x*9.)*2.4;p.z+=sin(t*.65+seed.x*9.)*2.4;
   p.y+=sin(t*.8+seed.y*8.)*.65;fade=.65+.25*sin(t+seed.y*8.);
 } else if(mode==12.) {
   float burst=weatherPulse(p.xz,t);p.y+=burst*(.4+seed.z)*1.2;
   p.x+=sin(seed.y*9.)*burst*.4;p.z+=cos(seed.y*9.)*burst*.4;fade=burst;
 } else if(mode==8.) {
   p.y+=(1.-life)*4.;p.x+=sin(t*.8+seed.x*9.)*2.;
 } else if(mode==13.) {
   p.x+=cos(t*.5+seed.x*9.)*3.;p.z+=sin(t*.5+seed.x*9.)*2.;p.y+=life*8.;
 } else {p.y+=life*1.2;p.x+=sin(t*.6+seed.y*8.)*1.2;}
 vec4 view=modelViewMatrix*vec4(p,1.);
 gl_Position=projectionMatrix*view;
 gl_PointSize=min(220.,size*viewport/max(1.,-view.z))*(.7+seed.z*.6)*grow;
 fade*=smoothstep(.5,3.,-view.z)*(1.-smoothstep(55.,110.,-view.z));
}`

export const particleFragment = `
uniform vec3 color; uniform float opacity, mode; varying float fade,turn,variant,flip;
void main(){
 vec2 p=gl_PointCoord-.5; float c=cos(turn),s=sin(turn);p=mat2(c,-s,s,c)*p;
 float a=0.; vec3 tint=color;
 if(mode==2.) {
   // 雨絲：線寬為 2026-10-11 之前的一半。
   p=gl_PointCoord-.5;float line=p.x+p.y*.2;
   a=(1.-smoothstep(.012,.033,abs(line)))*(1.-smoothstep(.3,.5,abs(p.y)));
 } else if(mode==0.) {
   // 葉形：沿 x 為葉長，右端尖、左端圓並接葉柄；中肋兩側明暗分明、帶斜向葉脈，部分偏黃綠；翻轉時變窄。
   float u=(p.x-.05)/.4, v=p.y/flip;
   float w=.2*pow(max(0.,1.-u),.5)*pow(max(0.,1.+u),.85)*(.85+variant*.3);
   float blade=(1.-smoothstep(w-.03,w+.02,abs(v)))*step(abs(u),1.);
   float stem=(1.-smoothstep(.012,.03,abs(v)))*step(-1.35,u)*step(u,-.92);
   a=max(blade,stem*.9);
   tint=mix(color,color*vec3(1.12,1.,.55),variant*.45);
   tint*=.72+.28*step(0.,v);
   tint=mix(tint,tint*.6,(1.-smoothstep(.006,.022,abs(v)))*blade);
   float veins=smoothstep(.8,1.,sin((u*2.2-abs(v)*3.5)*9.))*.5;
   tint=mix(tint,tint*.75,veins*blade);
 } else if(mode==6.) {
   a=1.-smoothstep(.65,1.,length((p+vec2(0.,p.x*p.x))*vec2(2.8,2.8)));
   tint=mix(color,vec3(1.,.38,.57),variant*.45);
 } else if(mode==7.) {
   a=1.-smoothstep(.7,1.,length(p*vec2(5.,2.1)));
   a*=.65+.35*cos(p.y*48.+abs(p.x)*16.);
 } else if(mode==8. || mode==13. || mode==12.) {
   a=1.-smoothstep(.19,.25,abs(p.x)+abs(p.y)*.8);
   tint*=mode==12. ? .7+variant*.3 : .65+.55*pow(abs(sin(turn)),8.);
 } else if(mode==11.) {
   a=(1.-smoothstep(.12,.24,abs(p.x)+abs(p.y)*1.5))*.8;
 } else if(mode==10.) {
   // 以 20° 俯角看地面圓圈：縱向壓成 1/2.9 的橢圓環，中心留一點水光；不隨 turn 旋轉。
   p=gl_PointCoord-.5; float r=length(p*vec2(1.,2.9));
   a=1.-smoothstep(.04,.1,abs(r-.37));
   a+=exp(-r*r*30.)*.22;
 } else if(mode==3.) {
   float r=length(p);a=exp(-r*r*18.);
   tint+=vec3(.45,.3,.6)*exp(-r*r*110.);a*=1.-smoothstep(.38,.5,r);
 } else if(mode==5.) {
   float r=length(p);a=exp(-r*r*35.);
   a+=exp(-abs(p.x)*80.-abs(p.y)*9.)*.35+exp(-abs(p.y)*80.-abs(p.x)*9.)*.35;
 } else {
   a=exp(-dot(p,p)*(mode==4.?12.:28.));a*=1.-smoothstep(.3,.5,length(p));
 }
 if(a*opacity*fade<.003) discard;
 gl_FragColor=vec4(tint,a*opacity*fade);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`

export const effectFragmentEnd = `
 alpha*=1.-smoothstep(45.,110.,vDistance);
 if(alpha*opacity<.003) discard;
 gl_FragColor=vec4(tint,alpha*opacity);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
`
