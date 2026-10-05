// The Telltale look: banded toon light, screen-space hatching in the darks, ink edges from depth+normals, soft bloom, film grade.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';

let gradient = null;
export function toonGradient() {
  if (gradient) return gradient;
  // 4 light bands: deep shadow, shadow, mid, lit
  gradient = new THREE.DataTexture(new Uint8Array([24, 24, 24, 255, 84, 84, 84, 255, 160, 160, 160, 255, 255, 255, 255, 255]), 4, 1, THREE.RGBAFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

function addHatching(material, px) {
  const p = px.toFixed(1);
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      float hLum = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
      float hA = abs(fract((gl_FragCoord.x + gl_FragCoord.y) / ${p}) - 0.5);
      float hB = abs(fract((gl_FragCoord.x - gl_FragCoord.y) / ${p}) - 0.5);
      float lineA = 1.0 - smoothstep(0.07, 0.15, hA);
      float lineB = 1.0 - smoothstep(0.07, 0.15, hB);
      float hatch = 1.0 - lineA * (1.0 - smoothstep(0.02, 0.07, hLum)) * 0.5
                        - lineB * (1.0 - smoothstep(0.005, 0.025, hLum)) * 0.45;
      outgoingLight *= clamp(hatch, 0.0, 1.0);
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `hatch-${p}`;
}

export function toonify(root, { hatchPx = 5 } = {}) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const src = o.material;
    const m = new THREE.MeshToonMaterial({
      color: src.color?.clone() ?? new THREE.Color(1, 1, 1),
      map: src.map ?? null,
      gradientMap: toonGradient(),
      vertexColors: Boolean(o.geometry.attributes.color), // baked AO
      emissive: src.emissive?.clone() ?? new THREE.Color(0),
      emissiveIntensity: src.emissiveIntensity ?? 1,
    });
    addHatching(m, hatchPx);
    o.material = m;
    o.castShadow = true;
    o.receiveShadow = true;
    src.dispose();
  });
}

const fullscreenVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const InkShader = {
  uniforms: {
    tDiffuse: { value: null }, tNormal: { value: null }, tDepth: { value: null },
    uTexel: { value: new THREE.Vector2(1, 1) }, cameraNear: { value: 0.02 }, cameraFar: { value: 60 },
    uInk: { value: new THREE.Color(0x0a0710) }, uStrength: { value: 1.0 },
  },
  vertexShader: fullscreenVert,
  fragmentShader: `
    #include <packing>
    uniform sampler2D tDiffuse, tNormal, tDepth;
    uniform vec2 uTexel; uniform float cameraNear, cameraFar; uniform vec3 uInk; uniform float uStrength;
    varying vec2 vUv;
    float linDepth(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar); }
    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      float dc = linDepth(vUv);
      vec3 nc = texture2D(tNormal, vUv).xyz;
      float t = mix(2.2, 1.0, smoothstep(0.5, 3.0, dc)); // thicker ink up close, thinner far away
      vec2 offs[4] = vec2[](vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0));
      float de = 0.0, ne = 0.0, dmin = dc;
      for (int i = 0; i < 4; i++) {
        vec2 uv = vUv + offs[i] * uTexel * t;
        float d = linDepth(uv);
        de += abs(d - dc);
        dmin = min(dmin, d);
        ne += distance(texture2D(tNormal, uv).xyz, nc);
      }
      float edge = max(smoothstep(0.02, 0.06, de / dc), smoothstep(0.25, 0.6, ne));
      edge *= 1.0 - smoothstep(20.0, 27.0, dmin); // the ink dissolves into the fog past the monorail
      gl_FragColor = vec4(mix(base.rgb, uInk, edge * uStrength), base.a);
    }`,
};

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uDrain: { value: 0 } },
  vertexShader: fullscreenVert,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uDrain; varying vec2 vUv;
    void main() {
      vec2 uv = vUv; // no gate weave: shifting the frame would slide the 3D image out from under the CSS3D desktop
      vec2 d = uv - 0.5;
      float ca = 0.01 * dot(d, d);                                                          // stronger at the edges
      vec3 c = vec3(texture2D(tDiffuse, uv + d * ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d * ca).b);
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(c * vec3(0.78, 0.9, 1.14), c * vec3(1.0, 1.0, 1.03), smoothstep(0.12, 0.7, l)); // cyan-blue shadows, neutral highlights
      c = mix(c, vec3(l), uDrain);
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const normalMat = new THREE.MeshNormalMaterial();
  const normalTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  normalTarget.depthTexture = new THREE.DepthTexture(1, 1);
  const ink = new ShaderPass(InkShader);
  ink.uniforms.tNormal.value = normalTarget.texture;
  ink.uniforms.tDepth.value = normalTarget.depthTexture;
  ink.uniforms.cameraNear.value = camera.near;
  ink.uniforms.cameraFar.value = camera.far;
  composer.addPass(ink);
  // Depth of field, after the ink so blurred things lose their outlines too. Off except where a shot asks for it.
  const bokeh = new BokehPass(scene, camera, { focus: 1, aperture: 0.02, maxblur: 0.012 });
  bokeh.enabled = false;
  composer.addPass(bokeh);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.55, 0.85);
  composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  const hidden = [];
  return {
    ink, bloom, grade, bokeh,
    render(dt) {
      scene.traverse((o) => { if (o.userData.noInk && o.visible) { o.visible = false; hidden.push(o); } });
      scene.overrideMaterial = normalMat;
      const shadows = renderer.shadowMap.autoUpdate;
      renderer.shadowMap.autoUpdate = false; // normals don't need shadows: re-rendering every shadow map here doubled the frame's draw calls
      renderer.setRenderTarget(normalTarget);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.shadowMap.autoUpdate = shadows;
      scene.overrideMaterial = null;
      while (hidden.length) hidden.pop().visible = true;
      grade.uniforms.uTime.value += dt;
      composer.render(dt);
    },
    setSize(w, h) {
      const pr = renderer.getPixelRatio();
      composer.setSize(w, h);
      normalTarget.setSize(w * pr, h * pr);
      ink.uniforms.uTexel.value.set(1 / (w * pr), 1 / (h * pr));
    },
  };
}
