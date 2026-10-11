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

// 龍的俯視剪影（地面龍影）：q 以世界單位計、+y 為飛行方向，翼展約 22；
// flap 為拍翅相位（弧度），翅膀收放、尾巴跟著擺動。回傳 0 至 1，邊緣柔化約 0.45 單位。
export const dragonField = `
float dragonShape(vec2 q, float flap) {
  float soft = .45, wing = 0.;
  float x = abs(q.x) / (.8 + .2 * cos(flap));
  if (x > .8 && x < 11.) {
    // 前緣從肩膀斜向翼尖；後緣在三根翼指之間內凹成扇形。
    float lead = 3. + (x - 1.) * .16;
    float trail = -1.6 + (x - 1.) * .58 + 1.3 * sin(fract((x - 1.) / 3.33) * 3.14159);
    wing = smoothstep(-soft, soft, min(min(lead - q.y, q.y - trail), 11. - x));
  }
  float body = 1. - smoothstep(.85, 1.15, length((q - vec2(0., 1.)) / vec2(1.3, 3.8)));
  float neck = 1. - smoothstep(.8, 1.2, length((q - vec2(0., 5.2)) / vec2(.55, 2.2)));
  float head = 1. - smoothstep(.8, 1.2, length((q - vec2(0., 7.7)) / vec2(.85, 1.25)));
  float ty = clamp(-q.y, 0., 13.);
  float tw = .95 * (1. - ty / 13.) + .12;
  float tail = (1. - smoothstep(tw - soft * .5, tw + soft * .5, abs(q.x - sin(ty * .32 - flap * .5) * ty * .09)))
    * step(-13., q.y) * step(q.y, 0.);
  return max(max(wing, body), max(max(neck, head), tail));
}
`

// 氣浪的世界座標由地景著色及天氣幾何共用，光照落點不隨鏡頭滑動。
export const weatherFields = `${breezeField}${dragonField}
// 不用 sin 的雜湊（Dave Hoskins）：sin 型雜湊在 Metal 後端遇到 0 附近的整數格子會全部得到 0，雲影整欄消失。
float weatherHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float weatherNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 u = fract(p);
  u = u * u * (3. - 2. * u);
  float a = weatherHash(cell), b = weatherHash(cell + vec2(1., 0.));
  float c = weatherHash(cell + vec2(0., 1.)), d = weatherHash(cell + vec2(1., 1.));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
/**
 * 無色的雲影：一團團約 4–8 單位的影子，順著微風往東北飄。近處可見地面只有約 30 單位見方，
 * 雲團太大時常整片落空；此比例下任一站、任一時刻至少約一成地面在雲影裡，平均四成。
 */
float weatherCloudShade(vec2 p, float t) {
  vec2 q = (p - vec2(t * 1.6, -t * .6)) * .13 + vec2(17.3, 41.9);
  return smoothstep(.46, .6, weatherNoise(q) * .65 + weatherNoise(q * 2.3 + 4.1) * .35);
}
float weatherPulse(vec2 p, float t) {
  float index = clamp(floor((14.-p.y)/11.+.5),0.,17.);
  vec2 center = vec2(sin(index*3.)*3.,14.-index*11.);
  float phase = fract(t*.42+index*.618);
  return exp(-abs(length(p-center)-phase*7.5)*4.)*(1.-phase);
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
 } else if(mode==7.) {
   // 羽毛：像鐘擺左右盪著慢慢落下，盪到兩端時微微上揚、朝擺動方向傾斜，並順著風往東飄。
   float swing=t*(1.1+seed.z*.5)+seed.y*9.;
   p.x+=sin(swing)*1.1+life*3.;
   p.z+=sin(t*.4+seed.x*8.)*.8;
   p.y+=(1.-life)*6.+sin(swing)*sin(swing)*.35;
   turn=(seed.y-.5)*.6+cos(swing)*.7;
   flip=.45+.55*abs(cos(t*.7+seed.x*7.));
 } else if(mode==15.) {
   // 鋼的反光星芒：各自依時間閃一下；鏡頭移動時，視角對上的點也會亮起。
   vec3 toCamera=normalize(cameraPosition-(modelMatrix*vec4(p,1.)).xyz);
   float facing=pow(max(0.,sin(dot(toCamera,vec3(seed.y-.5,.5,seed.z-.5))*30.+seed.x*6.28)),16.);
   float blink=pow(max(0.,sin(t*(1.1+seed.z*1.2)+seed.x*50.)),14.);
   fade=max(blink,facing*.6); grow=.35+fade*.9; turn=.785*step(.7,seed.y);
 } else if(mode==0. || mode==6.) {
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
   // 像素羽毛：12 格見方、格子對齊螢幕；羽軸微彎，兩側羽片不對稱並有一道裂口，根部只剩羽軸。
   // 背光那側羽片偏灰藍，邊緣一格加深，翻到側面時變窄。
   vec2 cell=(floor(gl_PointCoord*12.)+.5)/12.-.5;
   vec2 q=mat2(c,-s,s,c)*cell; q.x/=flip;
   float u=q.y/.44, dx=q.x-(.05*u*u-.02);
   float w=.16*sqrt(max(0.,1.-u*u))*(1.-.25*u)*(dx<0. ? .72 : 1.)*(.9+variant*.2);
   float vane=step(abs(dx),w)*step(-.62,u)*step(u,1.);
   vane*=1.-step(.3*w,dx)*step(abs(u-dx*1.6-.12),.11);
   float shaft=step(abs(dx),.045)*step(-1.,u)*step(u,.9);
   a=max(vane,shaft)*.95;
   tint=dx<0. ? color*vec3(.84,.89,.97) : color;
   tint*=1.-.2*vane*step(w-.09,abs(dx));
   tint=mix(tint,color*vec3(.86,.84,.8),shaft*(1.-vane*.5));
 } else if(mode==15.) {
   float r=length(p);
   a=exp(-r*r*90.)+(exp(-abs(p.x)*55.-abs(p.y)*6.)+exp(-abs(p.y)*55.-abs(p.x)*6.))*.9;
   a*=1.-smoothstep(.3,.5,r);
   tint=mix(color,vec3(1.),exp(-r*r*160.));
 } else if(mode==12.) {
   a=1.-smoothstep(.19,.25,abs(p.x)+abs(p.y)*.8);
   tint*=.7+variant*.3;
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
