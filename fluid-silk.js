(() => {
  const canvas = document.getElementById("silk-fluid");
  const gl = canvas.getContext("webgl", {
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
  });

  if (!gl) {
    document.documentElement.style.background =
      "radial-gradient(circle at 72% 20%, #b8dafa 0, #77a9d6 28%, transparent 54%), radial-gradient(circle at 22% 86%, #071522 0, #0a2237 38%, #8ab9df 100%)";
    return;
  }

  const vertexSource = `
    attribute vec2 a_position;

    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision highp float;

    uniform vec2 u_resolution;
    uniform vec2 u_pointer;
    uniform vec2 u_velocity;
    uniform vec2 u_momentum;
    uniform float u_time;
    uniform float u_pixelRatio;

    #define PI 3.141592653589793

    mat2 rotate2d(float a) {
      float s = sin(a);
      float c = cos(a);
      return mat2(c, -s, s, c);
    }

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);

      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));

      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;
      mat2 basis = mat2(1.62, 1.18, -1.18, 1.62);

      for (int i = 0; i < 5; i++) {
        value += amplitude * noise(p);
        p = basis * p + vec2(7.13, 2.41);
        amplitude *= 0.52;
      }

      return value;
    }

    float ellipse(vec2 uv, vec2 center, vec2 radius, float angle) {
      vec2 q = uv - center;
      q = rotate2d(angle) * q;
      q /= radius;
      return exp(-dot(q, q));
    }

    vec3 palette(float t) {
      vec3 ink = vec3(0.010, 0.045, 0.080);
      vec3 deepBlue = vec3(0.026, 0.135, 0.245);
      vec3 river = vec3(0.115, 0.365, 0.590);
      vec3 sky = vec3(0.590, 0.790, 0.945);
      vec3 milk = vec3(0.870, 0.950, 1.000);

      vec3 color = mix(ink, deepBlue, smoothstep(0.04, 0.34, t));
      color = mix(color, river, smoothstep(0.28, 0.62, t));
      color = mix(color, sky, smoothstep(0.48, 0.82, t));
      color = mix(color, milk, smoothstep(0.78, 1.0, t));
      return color;
    }

    void main() {
      vec2 frag = gl_FragCoord.xy;
      vec2 uv = frag / u_resolution.xy;
      vec2 st = uv;
      st.x *= u_resolution.x / u_resolution.y;

      vec2 pointer = u_pointer;
      pointer.y = 1.0 - pointer.y;
      vec2 p = uv - pointer;
      p.x *= u_resolution.x / u_resolution.y;

      float pointerFalloff = exp(-dot(p, p) * 3.6);
      float rippleFalloff = exp(-dot(p, p) * 7.2);
      vec2 velocity = u_velocity * vec2(1.0, -1.0);
      vec2 momentum = u_momentum * vec2(1.0, -1.0);
      float speed = clamp(length(momentum) * 5.4 + length(velocity) * 2.4, 0.0, 2.35);

      vec2 flow = vec2(
        fbm(st * 1.15 + vec2(u_time * 0.210, -u_time * 0.135)),
        fbm(st * 1.10 + vec2(-u_time * 0.155, u_time * 0.190))
      ) - 0.5;

      vec2 silkUv = st;
      silkUv += flow * 0.155;
      silkUv += momentum * pointerFalloff * 0.92;
      silkUv += normalize(p + 0.0001) * rippleFalloff * speed * 0.078;
      silkUv = rotate2d(-0.075 + 0.052 * sin(u_time * 0.58)) * silkUv;

      float longFold = sin((silkUv.x * 1.75 - silkUv.y * 1.10) * PI + u_time * 1.12);
      float crossFold = sin((silkUv.x * 0.62 + silkUv.y * 2.08) * PI - u_time * 0.82);
      float smallCrease = sin((silkUv.x * 5.6 - silkUv.y * 3.2) * PI + fbm(silkUv * 2.2) * 3.1);
      float folds = longFold * 0.54 + crossFold * 0.28 + smallCrease * 0.13;

      float waveA = uv.y - (0.28 + 0.30 * uv.x + 0.17 * sin((uv.x + 0.08) * PI * 1.18));
      float waveB = uv.y - (0.44 + 0.17 * uv.x + 0.12 * sin((uv.x - 0.18) * PI * 1.72));
      float waveC = uv.y - (0.78 - 0.16 * uv.x + 0.08 * sin((uv.x + 0.28) * PI * 1.32));
      float ribbonA = exp(-waveA * waveA * 12.0);
      float ribbonB = exp(-waveB * waveB * 30.0);
      float upperSheet = smoothstep(-0.16, 0.34, waveC);
      float lowerSheet = 1.0 - smoothstep(-0.18, 0.24, waveA);

      float sheetDark = ellipse(uv, vec2(0.08, 0.22), vec2(0.48, 0.20), -0.40);
      float sheetMid = ellipse(uv, vec2(0.60, 0.42), vec2(0.56, 0.16), -0.28);
      float sheetLight = ellipse(uv, vec2(0.88, 0.78), vec2(0.50, 0.34), -0.18);
      float sheetTop = ellipse(uv, vec2(0.44, 0.88), vec2(0.94, 0.28), 0.03);
      float leftShade = ellipse(uv, vec2(-0.12, 0.58), vec2(0.42, 0.60), -0.10);

      float field = uv.x * 0.58 + uv.y * 0.32 + 0.12;
      field += fbm(silkUv * 0.64 + vec2(-0.26, 0.18)) * 0.34;
      field += folds * 0.34;
      field += upperSheet * 0.24;
      field -= lowerSheet * 0.10;
      field -= ribbonA * 0.18;
      field += ribbonB * 0.18;
      field -= sheetDark * 0.34;
      field -= sheetMid * 0.20;
      field += sheetLight * 0.38;
      field += sheetTop * 0.14;
      field -= leftShade * 0.12;
      field += pointerFalloff * speed * 0.19;

      vec3 color = palette(clamp(field, 0.0, 1.0));

      color = mix(color, vec3(0.006, 0.033, 0.064), sheetDark * 0.60);
      color = mix(color, vec3(0.014, 0.070, 0.125), sheetMid * 0.34);
      color = mix(color, vec3(0.022, 0.095, 0.165), leftShade * 0.24);

      float ribbonShadow = ribbonA * smoothstep(0.02, 0.94, uv.x);
      color = mix(color, vec3(0.009, 0.050, 0.095), ribbonShadow * 0.50);

      float brightRidge = exp(-waveB * waveB * 58.0) * smoothstep(0.14, 0.84, uv.x);
      color = mix(color, vec3(0.610, 0.825, 0.985), brightRidge * 0.46);

      vec2 shadowAnchor = uv - vec2(0.76, 0.26);
      shadowAnchor.x *= u_resolution.x / u_resolution.y;
      float silkShadow = exp(-dot(shadowAnchor, shadowAnchor) * 1.65);
      color = mix(color, vec3(0.014, 0.065, 0.112), silkShadow * 0.40);

      color = mix(color, vec3(0.820, 0.940, 1.000), sheetLight * 0.76);
      color = mix(color, vec3(0.675, 0.845, 0.980), sheetTop * 0.28);

      float sheen = pow(abs(longFold * 0.5 + 0.5), 4.0) * 0.17;
      sheen += pow(abs(crossFold * 0.5 + 0.5), 7.0) * 0.10;
      color += vec3(0.50, 0.72, 0.92) * sheen * (0.55 + upperSheet * 0.72);

      float pointerSheen = rippleFalloff * speed * (0.30 + 0.24 * sin(length(p) * 24.0 - u_time * 11.0));
      color += vec3(0.52, 0.82, 1.00) * pointerSheen;

      float grain = hash(frag / max(u_pixelRatio, 1.0) + u_time) - 0.5;
      color += grain * 0.018;

      color = clamp((color - vec3(0.40, 0.48, 0.56)) * 1.16 + vec3(0.40, 0.48, 0.56), 0.0, 1.0);
      color = pow(max(color, 0.0), vec3(0.92));
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const compileShader = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || "Shader compile failed");
    }

    return shader;
  };

  const createProgram = () => {
    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "Shader link failed");
    }

    return program;
  };

  const program = createProgram();
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );

  const positionLocation = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {
    resolution: gl.getUniformLocation(program, "u_resolution"),
    pointer: gl.getUniformLocation(program, "u_pointer"),
    velocity: gl.getUniformLocation(program, "u_velocity"),
    momentum: gl.getUniformLocation(program, "u_momentum"),
    time: gl.getUniformLocation(program, "u_time"),
    pixelRatio: gl.getUniformLocation(program, "u_pixelRatio"),
  };

  const pointer = {
    x: 0.72,
    y: 0.35,
    tx: 0.72,
    ty: 0.35,
    px: 0.72,
    py: 0.35,
    vx: 0,
    vy: 0,
    mx: 0,
    my: 0,
    active: false,
    lastMove: performance.now(),
  };

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(window.innerWidth * ratio));
    const height = Math.max(1, Math.floor(window.innerHeight * ratio));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    canvas.style.width = "100vw";
    canvas.style.height = `${window.innerHeight}px`;
  };

  const updatePointer = (clientX, clientY) => {
    const now = performance.now();
    const x = clientX / window.innerWidth;
    const y = clientY / window.innerHeight;
    const dt = Math.max(16, now - pointer.lastMove);

    pointer.tx = x;
    pointer.ty = y;
    pointer.vx = (x - pointer.px) / dt * 16.67;
    pointer.vy = (y - pointer.py) / dt * 16.67;
    pointer.px = x;
    pointer.py = y;
    pointer.active = true;
    pointer.lastMove = now;
  };

  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener(
    "pointermove",
    (event) => updatePointer(event.clientX, event.clientY),
    { passive: true }
  );
  window.addEventListener(
    "pointerleave",
    () => {
      pointer.active = false;
    },
    { passive: true }
  );

  resize();

  let start = performance.now();
  let last = start;

  const render = (now) => {
    const dt = Math.min(48, now - last) / 16.67;
    last = now;

    pointer.x += (pointer.tx - pointer.x) * (0.28 * dt);
    pointer.y += (pointer.ty - pointer.y) * (0.28 * dt);

    pointer.mx += pointer.vx * (0.54 * dt);
    pointer.my += pointer.vy * (0.54 * dt);

    const damping = Math.pow(pointer.active ? 0.905 : 0.948, dt);
    pointer.mx *= damping;
    pointer.my *= damping;
    pointer.vx *= Math.pow(0.72, dt);
    pointer.vy *= Math.pow(0.72, dt);

    const idle = (now - pointer.lastMove) * 0.001;
    if (idle > 1.2) {
      pointer.active = false;
      pointer.tx += (0.62 + Math.sin(now * 0.00030) * 0.10 - pointer.tx) * 0.006 * dt;
      pointer.ty += (0.42 + Math.cos(now * 0.00024) * 0.07 - pointer.ty) * 0.006 * dt;
    }

    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform2f(uniforms.pointer, pointer.x, pointer.y);
    gl.uniform2f(uniforms.velocity, pointer.vx, pointer.vy);
    gl.uniform2f(uniforms.momentum, pointer.mx, pointer.my);
    gl.uniform1f(uniforms.time, (now - start) * 0.001);
    gl.uniform1f(uniforms.pixelRatio, Math.min(window.devicePixelRatio || 1, 2));
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);
})();
