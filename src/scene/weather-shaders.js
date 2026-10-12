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

// 格鬥的震地衝擊（2026-10-12）：impact = (x, z, 經過秒數, 強度)，由 weather.js 每幀算出；地景、看板與粒子共用同一個排列。
// 衝擊波以每秒 7 單位往外推，波前經過後草木朝外伏倒，再以阻尼振動回彈，約 7 單位外不受影響。
// 回傳朝外的傾倒量（回彈時為負）；呼叫端先以 impact.w 的 uniform 分支略過沒有衝擊的時候。
export const impactField = `
float weatherImpactBend(vec2 p, vec4 impact) {
  float d = length(p - impact.xy), since = impact.z - d / 7.;
  if (since < 0. || d > 7.) return 0.;
  return (1. - exp(-since * 25.)) * exp(-since * 2.6) * cos(since * 9.) * (1. - smoothstep(2.5, 7., d)) * impact.w;
}
`

// 氣浪的世界座標由地景著色及天氣幾何共用，光照落點不隨鏡頭滑動。
export const weatherFields = `${breezeField}${dragonField}${impactField}
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
/** 超能力的貼地薄紫霧：一片片約 5–10 單位的霧緩慢飄移，回傳 0 至 1。 */
float weatherPsychicMist(vec2 p, float t) {
  vec2 q = p * .1 + vec2(t * .05, t * .02);
  return smoothstep(.38, .78, weatherNoise(q) * .6 + weatherNoise(q * 2.6 + vec2(-t * .07, 3.3)) * .4);
}
/**
 * 惡的地面暗影：細長的墨色觸手沿地面緩慢爬行，粗細隨時間脹縮；大範圍的雜訊決定哪幾片地面有觸手。
 * 回傳 (觸手, 含外圍一圈的範圍)，外圍那圈在夜晚發出紫光。
 */
vec2 weatherTendrils(vec2 p, float t) {
  float coverage = smoothstep(.3, .55, weatherNoise(p * .06 + vec2(5.1 - t * .02, 2.7)));
  if (coverage <= 0.) return vec2(0.);
  vec2 q = p * .26 + vec2(t * .04, -t * .06);
  vec2 warp = vec2(weatherNoise(q * .6 + 3.1), weatherNoise(q * .6 + 9.4)) - .5;
  float n = weatherNoise(q + warp * 2.6);
  float ridge = 1. - abs(n * 2. - 1.);
  // 粗細沿觸手變化（一段粗、一段細到尖），整體隨時間脹縮。
  float edge = .66 + .2 * weatherNoise(q * 1.9 + 7.7) - .06 * sin(t * .45 + n * 5.);
  return vec2(smoothstep(edge, edge + .06, ridge), smoothstep(edge - .14, edge, ridge)) * coverage;
}
/**
 * 格鬥衝擊點的放射狀裂痕：9 道沿半徑鋸齒彎折的裂縫，0.1 秒內裂到約 4 單位，2.6 秒內淡掉。
 * 每一擊的裂紋走向依衝擊點座標而不同。回傳裂縫濃度。
 */
float weatherCracks(vec2 p, vec4 impact) {
  vec2 o = p - impact.xy;
  float d = length(o), reach = min(1., impact.z * 10.) * 4.;
  if (d > reach || d < .2) return 0.;
  float k = atan(o.y, o.x) / 6.2832 * 9. + 4.5, i = floor(k);
  float jag = (weatherNoise(vec2(d * 1.8, i * 7.3 + impact.x)) - .5) * .5;
  float center = i + .5 + (weatherHash(vec2(i, floor(impact.x * 3.1 + impact.y * 1.7))) - .5) * .5 + jag;
  float off = abs(k - center) / 9. * 6.2832 * d, width = .07 * (1. - d / 4.) + .025;
  return (1. - smoothstep(width * .5, width, off)) * (1. - smoothstep(1.4, 2.6, impact.z));
}
`

export const particleVertex = `
attribute vec4 seed;
uniform float time, mode, viewport, size;
// 格鬥的衝擊 (x, z, 經過秒數, 強度) 與衝擊點的地面高度，只有沙塵與碎石讀取。
uniform vec4 impact;
uniform float impactGround;
// 雷的落雷點 (x, z, 經過秒數, 強度) 與地面高度，只有電花讀取。
uniform vec4 strike;
uniform float strikeGround;
// 火的火焰漩渦 (x, z, 經過秒數, 強度) 與地面高度：漩渦粒子與被捲進去的火星讀取。
uniform vec4 spin;
uniform float spinGround;
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
   // 落地漣漪：貼在屋頂／地面，由小擴大並淡出。2026-10-13 改為像素漣漪：看板大小固定、環在片段著色器裡擴大
   // （flip 為經過比例），像素格不會跟著變大。
   p.y=seed.w+.03; flip=life; fade=(1.-life)*(1.-life*.5);
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
 } else if(mode==16.) {
   // 念力浮石：每 12 秒一輪，各自錯開被抬起，在半空緩慢自轉、上下浮動，最後幾乎同時落回地面。flip 為被抬起的程度。
   float cycle=fract(t/12.);
   float lift=smoothstep(.03+seed.x*.2,.13+seed.x*.2,cycle);
   float fall=clamp((cycle-.86-seed.z*.02)/.03,0.,1.);
   p.y+=lift*(.7+seed.y*2.+sin(t*1.3+seed.y*20.)*.15)*(1.-fall*fall);
   turn=seed.y*6.28+sin(t*.4+seed.x*9.)*1.4*lift;
   flip=lift*(1.-fall); fade=1.;
 } else if(mode==17.) {
   // 衝擊揚起的沙塵：從衝擊點往外推開、稍微升起後淡出。
   float age=impact.z, ang=seed.y*6.2832, r=(1.-exp(-age*3.))*(2.+seed.z*3.)+seed.x*.5;
   p=vec3(impact.x+cos(ang)*r,impactGround+.2+age*(.25+seed.x*.5),impact.y+sin(ang)*r);
   fade=smoothstep(0.,.06,age)*(1.-smoothstep(.5,1.9,age))*step(.001,impact.w); grow=.7+age*.7;
 } else if(mode==18.) {
   // 彈跳碎石：沿拋物線往外飛，落地後再小跳一次，接著停在地上淡出。
   float age=impact.z, ang=seed.y*6.2832, speed=1.4+seed.z*2.2, up=3.+seed.x*2.6, g=16.;
   float t1=2.*up/g, up2=up*.35, t2=2.*up2/g, a2=max(0.,age-t1);
   float h=age<t1 ? up*age-.5*g*age*age : (a2<t2 ? up2*a2-.5*g*a2*a2 : 0.);
   float travel=speed*min(age,t1)+speed*.45*min(a2,t2)+.3;
   p=vec3(impact.x+cos(ang)*travel,impactGround+.1+h,impact.y+sin(ang)*travel);
   turn=seed.x*6.28+min(age,t1+t2)*(5.+seed.z*6.)*(seed.y<.5 ? -1. : 1.);
   fade=(1.-smoothstep(2.,2.6,age))*step(.001,impact.w); flip=0.;
 } else if(mode==19.) {
   // 暗處的眼睛：每對各自 7–12 秒一輪，只睜開前 2.6 秒，期間眨兩下。flip 為眼皮張開的比例。
   float period=7.+seed.y*5., age=fract(t/period+seed.x)*period;
   fade=smoothstep(0.,.3,age)*(1.-smoothstep(2.3,2.6,age));
   flip=clamp(min(abs(age-.95),abs(age-1.7))/.09,0.,1.); turn=0.;
 } else if(mode==20.) {
   // 落雷炸開的電花：從落雷點往外、往上飛，0.6 秒內落回地面並熄滅。
   float age=strike.z, ang=seed.y*6.2832, speed=2.5+seed.z*4.;
   p=vec3(strike.x+cos(ang)*speed*age,strikeGround+.15+(2.+seed.x*3.)*age-6.*age*age,strike.y+sin(ang)*speed*age);
   p.y=max(p.y,strikeGround+.05);
   fade=(1.-smoothstep(.3,.6,age))*step(.001,strike.w);
 } else if(mode==21.) {
   // 竄流電弧：每個錨點各自 2.5–5.5 秒一輪，亮 0.35 秒；flip 每 1/16 秒換一次，電弧折角跟著變，看起來劈啪作響。
   float period=2.5+seed.y*3., age=fract(t/period+seed.x)*period;
   fade=smoothstep(0.,.03,age)*(1.-smoothstep(.28,.35,age));
   flip=floor(t*16.)+floor(seed.z*97.); turn=seed.y*3.1416;
 } else if(mode==0. || mode==6.) {
   float gust=sin(t*.85+position.z*.14);
   p.x+=sin(t*.65+seed.y*9.)*1.8+life*5.+gust*.8;
   p.z+=sin(t*.45+seed.x*8.)*1.3;
   p.y+=(1.-life)*5.5+sin(t+seed.y*9.)*.45;
   if(mode==0.) {
     // 2026-10-12：像素葉片隨風打轉（一半順時針、一半逆時針），並前後翻轉（翻到側面時變窄）。
     turn=seed.y*6.28+t*(.8+seed.z*.9)*(seed.x<.5 ? -1. : 1.);
     flip=.3+.7*abs(cos(t*(1.1+seed.z)+seed.x*7.));
   }
 } else if(mode==1.) {
   p.y+=life*6.;p.x+=sin(t*1.5+seed.y*8.)*(.5+life);p.z+=cos(t+seed.z*9.)*.45;
   // 2026-10-12：像素火粉忽明忽暗；火焰漩渦經過時，5 單位內的火星被捲著繞圈、往中心收。
   fade=sin(life*3.14159)*(.55+.45*step(.4,fract(t*6.+seed.y*7.)));
   if(spin.w>.001&&spin.z<3.) {
     vec2 d=p.xz-spin.xy; float r=length(d);
     if(r<5.) {
       float pull=(1.-r/5.)*smoothstep(0.,.5,spin.z)*(1.-smoothstep(2.4,3.,spin.z));
       float a=pull*spin.z*3.; vec2 q=mat2(cos(a),-sin(a),sin(a),cos(a))*d*(1.-pull*.4);
       p.xz=spin.xy+q; p.y+=pull*1.2;
     }
   }
 } else if(mode==22.) {
   // 火焰漩渦：0.5 秒內從地面捲起到約 3.6 高，旋轉約 2 秒，最後 0.6 秒往外散成火星。variant 為粒子在火柱裡的高度比例。
   float age=spin.z, h=seed.x, rise=smoothstep(0.,.5,age), burst=smoothstep(2.4,3.,age);
   float radius=(.35+h*.9)*(1.+burst*2.5)+seed.z*.15, ang=seed.y*6.2832+age*(6.+(1.-h)*4.)-h*2.;
   p=vec3(spin.x+cos(ang)*radius,spinGround+.1+h*3.6*rise+burst*h*.8,spin.y+sin(ang)*radius);
   fade=step(.001,spin.w)*smoothstep(0.,.15,age)*(1.-smoothstep(2.6,3.,age)); variant=h; turn=0.;
 } else if(mode==23.) {
   // 屋簷滴水：每個錨點各自 0.8–1.4 秒一滴，自由落下到地面（seed.w 為屋簷到地面的落差）後消失。
   float period=.8+seed.y*.6, age=fract(t/period+seed.x)*period, drop=4.9*age*age;
   p.y-=min(drop,seed.w); fade=step(drop,seed.w)*smoothstep(0.,.05,age); turn=0.;
 } else if(mode==24.) {
   // 孢子螢光：從草叢與花圃緩慢升起、左右飄，約 9 秒一輪；像螢火蟲一樣緩慢明滅。
   float rise=fract(seed.x+t*.11);
   p.y+=rise*3.2; p.x+=sin(t*.5+seed.y*9.)*.6; p.z+=cos(t*.4+seed.z*7.)*.5;
   fade=sin(rise*3.14159)*(.35+.65*pow(.5+.5*sin(t*(1.3+seed.z)+seed.y*20.),3.)); turn=0.;
 } else if(mode==25.) {
   // 藤蔓攀爬：固定在圍欄柱與牆角，長度由天氣權重（opacity）決定，見片段著色器；不隨時間移動。
   fade=1.; turn=0.;
 } else if(mode==4.) {
   p.x+=sin(t*.25+seed.y*8.)*3.;p.z+=cos(t*.2+seed.x*8.)*1.5;fade=.7;
 } else {p.y+=life*1.2;p.x+=sin(t*.6+seed.y*8.)*1.2;}
 vec4 view=modelViewMatrix*vec4(p,1.);
 gl_Position=projectionMatrix*view;
 // 2026-10-12：雨絲最大 48 像素、鏡頭前 3–8 單位內淡出，近景不再有粗長白線擋住畫面。
 gl_PointSize=min(mode==2. ? 48. : 220.,size*viewport/max(1.,-view.z))*(.7+seed.z*.6)*grow;
 fade*=smoothstep(.5,3.,-view.z)*(1.-smoothstep(55.,110.,-view.z));
 if(mode==2.) fade*=smoothstep(3.,8.,-view.z);
}`

export const particleFragment = `
uniform vec3 color; uniform float opacity, mode; varying float fade,turn,variant,flip;
void main(){
 vec2 p=gl_PointCoord-.5; float c=cos(turn),s=sin(turn);p=mat2(c,-s,s,c)*p;
 float a=0.; vec3 tint=color;
 if(mode==2.) {
   // 2026-10-12：像素雨絲：10 格見方裡一條由右上往左下斜的短線（約 1 格寬），格子對齊螢幕。
   vec2 g=floor(gl_PointCoord*10.);
   a=step(abs(g.x-(4.5-(g.y-4.5)*.22)),.6)*step(1.,g.y)*step(g.y,8.)*.9;
 } else if(mode==0.) {
   // 2026-10-12：像素葉片：10 格見方、格子對齊螢幕；一端尖、一端接短葉柄，中肋與邊緣一格加深，
   // 中肋兩側明暗不同，部分偏黃綠；翻到側面時變窄。
   vec2 cell=(floor(gl_PointCoord*10.)+.5)/10.-.5;
   vec2 q=mat2(c,-s,s,c)*cell; q.y/=flip;
   float u=(q.x-.05)/.38, v=q.y;
   float w=.19*pow(max(0.,1.-u),.5)*pow(max(0.,1.+u),.85)*(.85+variant*.3);
   float blade=step(abs(v),w)*step(abs(u),1.);
   a=max(blade,step(abs(v),.05)*step(-1.4,u)*step(u,-.9));
   tint=mix(color,color*vec3(1.12,1.,.55),variant*.45);
   tint*=.75+.25*step(0.,v);
   tint=mix(tint,tint*.62,step(abs(v),.05)*blade);
   tint=mix(tint,tint*.72,blade*step(w-.08,abs(v)));
 } else if(mode==1.) {
   // 2026-10-12：像素火粉：8 格見方，上方 2×2 的亮方塊，下方拖 3 格漸淡的尾巴（往上飄，尾巴在下）。
   vec2 g=floor(gl_PointCoord*8.);
   float head=step(abs(g.x-3.5),.6)*step(abs(g.y-1.5),.6);
   float tail=step(abs(g.x-4.),.1)*step(3.,g.y)*step(g.y,5.)*(1.-(g.y-2.)*.25);
   a=max(head,tail*.8);
   tint=head>0. ? mix(color,vec3(1.,.9,.6),.5) : color*.85;
 } else if(mode==22.) {
   // 漩渦火焰：6 格見方裡 4×4 的像素火塊，底部黃白、往上轉橘再轉紅。
   vec2 g=abs(floor(gl_PointCoord*6.)-2.5);
   a=step(max(g.x,g.y),2.);
   tint=mix(mix(vec3(1.,.93,.55),vec3(1.,.55,.12),smoothstep(0.,.5,variant)),vec3(.9,.18,.06),smoothstep(.5,1.,variant));
 } else if(mode==23.) {
   // 像素水滴：8 格見方，上面一格、下面 2×3 的水滴，左上一格亮點。
   vec2 g=floor(gl_PointCoord*8.);
   float body=step(abs(g.x-3.5),.6)*step(2.,g.y)*step(g.y,5.);
   a=body*.85;
   tint=mix(color,vec3(1.),step(abs(g.x-3.),.1)*step(abs(g.y-3.),.1));
 } else if(mode==24.) {
   // 孢子：中央 2×2 亮格加一圈柔光。
   vec2 g=abs(floor(gl_PointCoord*8.)-3.5);
   float core=step(max(g.x,g.y),.6), r=length(gl_PointCoord-.5);
   a=max(core,exp(-r*r*30.)*.5);
   tint=mix(color,vec3(1.,1.,.85),core);
 } else if(mode==25.) {
   // 像素藤蔓：16 格見方，莖由底部往上爬、葉片左右交錯，長滿時頂端開一朵粉紅小花；長度依天氣權重（opacity）。
   vec2 g=floor(gl_PointCoord*16.);
   float row=15.-g.y, grown=opacity*16.;
   float stemX=7.5+floor(sin(row*.7+variant*9.)*1.5+.5);
   float stem=step(abs(g.x-stemX),.6)*step(row,grown-1.);
   float side=mod(row,4.)<1. ? 1. : mod(row+2.,4.)<1. ? -1. : 0.;
   float leaf=side!=0. ? step(abs(g.x-(stemX+side*1.5)),1.)*step(row,grown-2.) : 0.;
   float tip=step(15.5,grown)*step(abs(g.x-stemX),.6)*step(13.,row);
   a=max(max(stem,leaf),tip);
   tint=tip>0. ? (abs(row-14.)<.1 ? vec3(1.,.95,.6) : vec3(1.,.62,.78)) : stem>0. ? color*.7 : color;
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
 } else if(mode==16.||mode==18.) {
   // 像素碎石：10 格見方、格子對齊螢幕；岩塊輪廓不規則，左上亮、右下暗，邊緣一格加深。
   // 浮石（16）約四分之一是落葉；被念力抬起時（flip）外圍多一圈粉紫光。
   vec2 cell=(floor(gl_PointCoord*10.)+.5)/10.-.5;
   vec2 q=mat2(c,-s,s,c)*cell;
   float r=length(q), outside;
   bool leaf=mode==16.&&variant>.75;
   if(leaf) {
     float u=q.x/.4;
     outside=abs(q.y+.05*u*u)-.17*sqrt(max(0.,1.-u*u))+max(0.,abs(u)-1.);
     // 落葉色以岩石底色換算（橄欖綠到橘黃），夜晚跟著 setLook 一起變暗。
     tint=color*mix(vec3(1.,1.25,.2),vec3(2.3,.86,.12),fract(variant*7.));
   } else {
     float ang=atan(q.y,q.x);
     outside=r-(.27+.05*sin(ang*3.+variant*21.)+.035*sin(ang*5.+variant*43.));
     tint=color*(.86+.14*fract(variant*13.));
   }
   float body=step(outside,0.);
   // 明暗依螢幕方向（gl_PointCoord 的 y 往下），岩塊轉動時光仍從左上來。
   tint*=(1.+.18*dot(cell,vec2(-.7,-.7))/max(length(cell),.05))*(1.-.3*body*step(-.09,outside));
   float halo=(1.-body)*step(outside,.11)*flip;
   tint=mix(tint,vec3(.92,.62,1.),halo);
   a=max(body,halo*.8);
 } else if(mode==20.) {
   // 像素電花：6 格見方的十字，中心一格白、其餘黃。
   vec2 g=abs(floor(gl_PointCoord*6.)-2.5);
   a=step(min(g.x,g.y),.6);
   tint=mix(color,vec3(1.,1.,.9),step(max(g.x,g.y),.6));
 } else if(mode==21.) {
   // 像素電弧：14 格見方，一條四段的鋸齒折線橫過中央，核心白黃、外圍約一格黃光；折角依 flip 以不含 sin 的雜湊挑選。
   vec2 cell=(floor(gl_PointCoord*14.)+.5)/14.-.5;
   vec2 q=mat2(c,-s,s,c)*cell, from=vec2(-.42,0.);
   float best=1.;
   for(int i=1;i<=4;i++) {
     float k=fract((flip+float(i)*7.13)*.1031); k*=k+33.33; k=fract((k+k)*k);
     vec2 to=vec2(-.42+float(i)*.21,i==4 ? 0. : (k-.5)*.5), ab=to-from;
     float h=clamp(dot(q-from,ab)/dot(ab,ab),0.,1.);
     best=min(best,length(q-from-ab*h));
     from=to;
   }
   float core=step(best,.045);
   a=max(core,step(best,.11)*.55);
   tint=mix(color,vec3(1.,1.,.92),core);
 } else if(mode==19.) {
   // 一對像素眼睛：16 格寬，杏仁形、往鼻樑斜下的紅眼，中央一格黃色瞳光，外圍淡淡紅光；眼皮依 flip 闔成一條線。
   vec2 g=floor(gl_PointCoord*16.);
   float row=g.y-7., ex=g.x<8. ? g.x-2. : 13.-g.x;
   float eye=row==0. ? step(0.,ex)*step(ex,4.) : row==-1. ? step(0.,ex)*step(ex,2.) : row==1. ? step(2.,ex)*step(ex,4.) : 0.;
   eye*=flip>.4||row==0. ? 1. : 0.;
   eye*=step(.15,flip);
   float pupil=step(abs(ex-2.),.1)*step(abs(row),.1);
   tint=mix(color,vec3(1.,.88,.45),pupil);
   vec2 o=vec2(abs(gl_PointCoord.x-.5)-.25,gl_PointCoord.y-.47);
   a=max(eye,exp(-dot(o,o)*90.)*.32);
 } else if(mode==10.) {
   // 2026-10-13：像素漣漪。16 格見方、格子對齊螢幕；以 20° 俯角看地面圓圈，縱向壓成 1/2.9 的橢圓環，
   // 由小擴大（flip 為經過比例）、環寬約一格，剛落下時中心一格水光；不隨 turn 旋轉。
   vec2 cell=(floor(gl_PointCoord*16.)+.5)/16.-.5; float r=length(cell*vec2(1.,2.9));
   a=max(step(abs(r-(.08+flip*.3)),.045),step(r,.1)*(1.-flip)*.5);
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
