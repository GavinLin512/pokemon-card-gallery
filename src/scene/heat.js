import { WebGLRenderTarget, Scene, OrthographicCamera, PlaneGeometry, ShaderMaterial, Mesh, LinearFilter } from 'three'
/** 僅對背景 canvas 作折射；DOM 卡牌與文字不經過此通道。 */
export function createHeatPass() {
 const target=new WebGLRenderTarget(1,1,{minFilter:LinearFilter,magFilter:LinearFilter,depthBuffer:true})
 const scene=new Scene(), camera=new OrthographicCamera(-1,1,1,-1,0,1), geometry=new PlaneGeometry(2,2)
 const material=new ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{map:{value:target.texture},time:{value:0},strength:{value:0}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
 fragmentShader:`uniform sampler2D map;uniform float time,strength;varying vec2 vUv;
 void main(){vec2 uv=vUv;float ground=(1.-smoothstep(.4,.68,uv.y))*smoothstep(0.,.15,uv.y);
 uv.x+=sin(uv.y*95.+time*2.4+sin(uv.x*23.+time))*.0018*strength*ground;
 uv.y+=sin(uv.x*45.+time*1.7)*.0006*strength*ground;
 gl_FragColor=texture2D(map,clamp(uv,.001,.999));
 #include <colorspace_fragment>
 }`})
 scene.add(new Mesh(geometry,material))
 return {target,resize(w,h,ratio){target.setSize(Math.round(w*ratio),Math.round(h*ratio))},
 render(renderer,time,strength){material.uniforms.time.value=time;material.uniforms.strength.value=strength;renderer.setRenderTarget(null);renderer.clear();renderer.render(scene,camera)},
 dispose(){target.dispose();geometry.dispose();material.dispose()}}
}
