// Single-pass WebGL2 finishing: bloom, zoom blur, chromatic aberration,
// vignette, filmic grain, flash. The 2D scene canvas is uploaded per frame.

const VS = `#version 300 es
in vec2 p; out vec2 vUv;
void main(){ vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D uScene, uBloom;
uniform vec2 uRes, uZoomC;
uniform float uSeed, uGrain, uVig, uCA, uZoom, uBloomAmt, uBloomThr, uFlash, uLift;
uniform vec3 uFlashCol;
in vec2 vUv; out vec4 o;

float h(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }

vec3 samp(vec2 uv){
  if (uCA <= 0.0) return texture(uScene, uv).rgb;
  vec2 d = (uv - 0.5) * vec2(1.0, uRes.y / uRes.x);
  vec2 off = normalize(d + 1e-5) * length(d) * uCA / uRes.x;
  off.y *= uRes.x / uRes.y;
  return vec3(texture(uScene, uv + off).r, texture(uScene, uv).g, texture(uScene, uv - off).b);
}

void main(){
  vec2 uv = vUv;
  vec3 col = vec3(0.0);
  if (uZoom > 0.001) {
    float tot = 0.0;
    float j = h(gl_FragCoord.xy + uSeed);
    for (int i = 0; i < 20; i++) {
      float f = (float(i) + j) / 20.0;
      float w = 1.0 - f * 0.6;
      col += samp(mix(uv, uZoomC, f * uZoom)) * w; tot += w;
    }
    col /= tot;
  } else {
    col = samp(uv);
  }
  vec3 b = texture(uBloom, uv).rgb;
  col += max(b - uBloomThr, 0.0) * uBloomAmt;

  vec2 vc = (uv - 0.5) * vec2(1.0, 1.35);
  float v = smoothstep(1.05, 0.25, length(vc));
  col *= mix(1.0, v, uVig);

  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float n = (h(gl_FragCoord.xy + uSeed * 91.7) + h(gl_FragCoord.xy * 1.31 + uSeed * 37.3)) - 1.0;
  col += n * uGrain * (0.45 + 0.55 * (1.0 - abs(lum - 0.5) * 2.0));
  col = col + uLift;
  col = mix(col, uFlashCol, clamp(uFlash, 0.0, 1.0));
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export function createPost(canvas, w, h) {
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
  if (!gl) throw new Error('webgl2 unavailable');
  const sh = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const mkTex = (unit) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const texScene = mkTex(0), texBloom = mkTex(1);
  const U = (n) => gl.getUniformLocation(prog, n);
  gl.uniform1i(U('uScene'), 0);
  gl.uniform1i(U('uBloom'), 1);
  gl.uniform2f(U('uRes'), w, h);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.viewport(0, 0, w, h);

  const bloomCanvas = document.createElement('canvas');
  bloomCanvas.width = w / 4; bloomCanvas.height = h / 4;
  const bctx = bloomCanvas.getContext('2d', { willReadFrequently: true });

  return function apply(src, p) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texScene);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    if (p.bloom > 0) {
      bctx.filter = `blur(${p.bloomRadius ?? 7}px)`;
      bctx.clearRect(0, 0, bloomCanvas.width, bloomCanvas.height);
      bctx.drawImage(src, 0, 0, bloomCanvas.width, bloomCanvas.height);
      bctx.filter = 'none';
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, texBloom);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bloomCanvas);
    }
    gl.uniform1f(U('uSeed'), p.seed || 0);
    gl.uniform1f(U('uGrain'), p.grain ?? 0.04);
    gl.uniform1f(U('uVig'), p.vignette ?? 0.0);
    gl.uniform1f(U('uCA'), p.ca ?? 0);
    gl.uniform1f(U('uZoom'), p.zoom ?? 0);
    gl.uniform2f(U('uZoomC'), p.zoomC ? p.zoomC[0] : 0.5, p.zoomC ? 1 - p.zoomC[1] : 0.5);
    gl.uniform1f(U('uBloomAmt'), p.bloom ?? 0);
    gl.uniform1f(U('uBloomThr'), p.bloomThr ?? 0.2);
    gl.uniform1f(U('uFlash'), p.flash ?? 0);
    gl.uniform3fv(U('uFlashCol'), p.flashCol || [0.925, 0.898, 0.839]);
    gl.uniform1f(U('uLift'), p.lift ?? 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
}
