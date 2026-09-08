// 氣浪與光束的世界座標由地景著色及天氣幾何共用，光照落點不隨鏡頭滑動。
export const weatherFields = `
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
varying float fade, turn, variant;
${weatherFields}
void main(){
 vec3 p=position; float t=time;
 float rate=mode==2. ? .85 : mode==10. ? 1.8 : .1;
 float life=fract(seed.x+t*rate);
 fade=sin(life*3.14159); turn=seed.y*6.28+t*(.65+seed.z); variant=seed.z;
 if(mode==2.) {
   p.y=seed.w+(23.-seed.w)*(1.-life);
   // 地面落點固定，風斜偏移隨高度漸減，終點仍是此 seed 的屋頂／地面。
   p.x+=(p.y-seed.w)*.18; p.z+=(p.y-seed.w)*.08; fade=.85;
 } else if(mode==10.) {
   p.y=seed.w+.04+sin(life*3.14159)*(.15+seed.z*.28);
   p.x+=cos(turn)*life*.32;p.z+=sin(turn)*life*.32;fade=1.-life;
 } else if(mode==0. || mode==6. || mode==7.) {
   float gust=sin(t*.85+position.z*.14);
   p.x+=sin(t*.65+seed.y*9.)*1.8+life*5.+gust*.8;
   p.z+=sin(t*.45+seed.x*8.)*1.3;
   p.y+=(1.-life)*5.5+sin(t+seed.y*9.)*.45;
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
 gl_PointSize=min(220.,size*viewport/max(1.,-view.z))*(.7+seed.z*.6);
 fade*=smoothstep(.5,3.,-view.z)*(1.-smoothstep(55.,110.,-view.z));
}`

export const particleFragment = `
uniform vec3 color; uniform float opacity, mode; varying float fade,turn,variant;
void main(){
 vec2 p=gl_PointCoord-.5; float c=cos(turn),s=sin(turn);p=mat2(c,-s,s,c)*p;
 float a=0.; vec3 tint=color;
 if(mode==2.) {
   p=gl_PointCoord-.5;float line=p.x+p.y*.2;
   a=(1.-smoothstep(.025,.065,abs(line)))*(1.-smoothstep(.3,.5,abs(p.y)));
 } else if(mode==0.) {
   a=1.-smoothstep(.75,1.,length(p*vec2(2.7,4.)));
   tint*=.7+.3*step(0.,p.x);tint+=vec3(.12,.2,.03)*(1.-smoothstep(.008,.025,abs(p.y)));
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
   p=gl_PointCoord-.5;
   float jets=min(abs(p.x-p.y*.4),abs(p.x+p.y*.4));
   a=(1.-smoothstep(.018,.052,jets))*(1.-smoothstep(.2,.44,abs(p.y)));
   a+=exp(-dot(p-vec2(.22,-.26),p-vec2(.22,-.26))*400.)*.6;
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
