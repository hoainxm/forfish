// Trục 1 — LỚP WEBGL nền màu MỊN (kiểu Windy) cho MapLibre.
//
// Thay lớp polygon `fill` (còn khối) bằng CUSTOM LAYER WebGL: nạp lưới giá trị
// thành TEXTURE nhỏ (nLon×nLat), để GPU nội suy BILINEAR (LINEAR filtering) khi
// lấy mẫu → gradient MỊN liên tục ở mọi zoom; fragment tra RAMP TEXTURE 1D để
// ra màu. Đây đúng cách Windy/mapbox-gl-wind làm (xem docs/research).
//
// Dùng: tạo layer bằng createScalarFieldLayer(), map.addLayer(layer); đổi dữ
// liệu gọi layer.setField(grid, timeIdx). Data prep thuần ở lib/scalar-gl.ts.

import maplibregl from "maplibre-gl";
import type { ScalarGrid } from "@/lib/scalar-field";
import {
  buildValueTexture,
  buildRampTexture,
  gridBounds,
} from "@/lib/scalar-gl";

const VERT = `
attribute vec2 a_pos;   // toạ độ mercator [0,1]
attribute vec2 a_uv;    // toạ độ texture [0,1]
uniform mat4 u_matrix;
varying vec2 v_uv;
void main() {
  gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
  v_uv = a_uv;
}`;

/*  MÉP MỀM, KHÔNG CẮT VUÔNG (2026-08-03 — chủ dự án: "lớp dòng chảy cảm giác nó
    render thiếu, bị ô ô").

    Bản cũ: `if (val.g < 0.5) discard`. Cờ hợp lệ được GPU nội suy LINEAR rồi cắt
    ở đúng 0,5 — tức cắt theo ĐƯỜNG GIỮA HAI TEXEL, nên mép vùng có số luôn là
    cạnh chữ nhật thẳng băng, không bao giờ bám theo đường đáy biển thật. Trên
    lưới thô (ô ≈190×230 km) với hơn nửa số ô là null ở tầng sâu, kết quả đúng
    như ảnh chụp: bàn cờ ô vuông, ô lẻ đứng một mình mang một mũi tên.

    Nay cờ hợp lệ làm ĐỘ ĐỤC: mờ dần trong khoảng một texel thay vì cắt phựt. Vẫn
    giữ `discard` ở ngưỡng rất thấp cho vùng xa hẳn — nếu không thì vùng đất liền
    ăn một lớp màu mỏng phủ lên, còn tệ hơn.
    ⚠️ ĐỪNG hạ `discard` xuống 0,0: mất `discard` là mất luôn đường thoát cho
    vùng KHÔNG có dữ liệu, cả bản đồ bị nhuộm. */
const FRAG = `
precision mediump float;
uniform sampler2D u_value;  // R=giá trị chuẩn hoá, G=cờ hợp lệ
uniform sampler2D u_ramp;   // thang màu 1D (đã có alpha)
uniform float u_opacity;
varying vec2 v_uv;
void main() {
  vec4 val = texture2D(u_value, v_uv);
  if (val.g < 0.12) discard;                // xa hẳn vùng có số (đất/thiếu)
  float mep = smoothstep(0.12, 0.62, val.g); // mép mờ dần thay vì cắt vuông
  vec4 c = texture2D(u_ramp, vec2(val.r, 0.5));
  gl_FragColor = vec4(c.rgb, c.a * u_opacity * mep);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error("scalar-gl shader: " + gl.getShaderInfoLog(s));
  }
  return s;
}

// Quad phủ vùng RỘNG HƠN data (mở rộng mỗi phía EXT_DEG độ). UV tính theo BBOX
// DATA nên vùng ngoài data có UV <0 / >1 → CLAMP_TO_EDGE lấy màu ô RÌA → field
// tự "bleed" phủ kín màn hình, KHÔNG lộ mép chữ nhật (user 2026-07-28).
const EXT_DEG = 20;

function mercQuad(b: {
  west: number;
  south: number;
  east: number;
  north: number;
}) {
  const dw = b.east - b.west || 1;
  const dh = b.north - b.south || 1;
  const corner = (lon: number, lat: number) => {
    const m = maplibregl.MercatorCoordinate.fromLngLat({ lng: lon, lat });
    return [m.x, m.y, (lon - b.west) / dw, (lat - b.south) / dh];
  };
  const W = b.west - EXT_DEG;
  const E = b.east + EXT_DEG;
  const S = Math.max(-85, b.south - EXT_DEG);
  const N = Math.min(85, b.north + EXT_DEG);
  const nw = corner(W, N);
  const ne = corner(E, N);
  const sw = corner(W, S);
  const se = corner(E, S);
  // 2 tam giác: (nw, ne, sw) + (sw, ne, se)
  return new Float32Array([...nw, ...ne, ...sw, ...sw, ...ne, ...se]);
}

export interface ScalarFieldLayer extends maplibregl.CustomLayerInterface {
  setField: (grid: ScalarGrid, timeIdx: number) => void;
}

export function createScalarFieldLayer(id: string): ScalarFieldLayer {
  let gl: WebGLRenderingContext | null = null;
  let program: WebGLProgram | null = null;
  let posBuf: WebGLBuffer | null = null;
  let valueTex: WebGLTexture | null = null;
  let rampTex: WebGLTexture | null = null;
  let aPos = 0;
  let aUv = 0;
  let uMatrix: WebGLUniformLocation | null = null;
  let uValue: WebGLUniformLocation | null = null;
  let uRamp: WebGLUniformLocation | null = null;
  let uOpacity: WebGLUniformLocation | null = null;
  let ready = false;
  let mapRef: maplibregl.Map | null = null;

  // dữ liệu đang chờ (setField gọi trước khi onAdd) hoặc để cập nhật
  let pending: { grid: ScalarGrid; timeIdx: number } | null = null;
  let rampKind: string | null = null;

  function uploadValue(grid: ScalarGrid, timeIdx: number) {
    if (!gl || !valueTex) return false;
    const tex = buildValueTexture(grid, timeIdx);
    if (!tex) return false;
    gl.bindTexture(gl.TEXTURE_2D, valueTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      tex.nLon,
      tex.nLat,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      tex.data,
    );
    // ramp đổi khi đổi loại lớp
    if (rampKind !== grid.kind && rampTex) {
      const ramp = buildRampTexture(grid.kind);
      gl.bindTexture(gl.TEXTURE_2D, rampTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, ramp);
      rampKind = grid.kind;
    }
    // quad theo bbox của lưới
    const b = gridBounds(grid);
    if (posBuf) {
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, mercQuad(b), gl.STATIC_DRAW);
    }
    return true;
  }

  return {
    id,
    type: "custom",
    renderingMode: "2d",

    onAdd(map, context) {
      mapRef = map;
      gl = context;
      const vs = compile(gl, gl.VERTEX_SHADER, VERT);
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      program = gl.createProgram()!;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      aPos = gl.getAttribLocation(program, "a_pos");
      aUv = gl.getAttribLocation(program, "a_uv");
      uMatrix = gl.getUniformLocation(program, "u_matrix");
      uValue = gl.getUniformLocation(program, "u_value");
      uRamp = gl.getUniformLocation(program, "u_ramp");
      uOpacity = gl.getUniformLocation(program, "u_opacity");

      posBuf = gl.createBuffer();

      const mkTex = () => {
        const t = gl!.createTexture();
        gl!.bindTexture(gl!.TEXTURE_2D, t);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
        return t;
      };
      valueTex = mkTex();
      rampTex = mkTex();
      ready = true;
      if (pending) {
        uploadValue(pending.grid, pending.timeIdx);
        pending = null;
      }
    },

    setField(grid, timeIdx) {
      if (!ready) {
        pending = { grid, timeIdx };
        return;
      }
      uploadValue(grid, timeIdx);
      mapRef?.triggerRepaint();
    },

    render(context, args) {
      if (!ready || !program || !posBuf) return;
      const g = context;
      // maplibre v5: args.defaultProjectionData.mainMatrix; cũ hơn: matrix trực tiếp
      const matrix =
        (args as { defaultProjectionData?: { mainMatrix?: number[] } })
          ?.defaultProjectionData?.mainMatrix ??
        (args as unknown as number[]);
      g.useProgram(program);
      g.uniformMatrix4fv(uMatrix, false, matrix as Iterable<number>);
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D, valueTex);
      g.uniform1i(uValue, 0);
      g.activeTexture(g.TEXTURE1);
      g.bindTexture(g.TEXTURE_2D, rampTex);
      g.uniform1i(uRamp, 1);
      g.uniform1f(uOpacity, 1);

      g.bindBuffer(g.ARRAY_BUFFER, posBuf);
      g.enableVertexAttribArray(aPos);
      g.vertexAttribPointer(aPos, 2, g.FLOAT, false, 16, 0);
      g.enableVertexAttribArray(aUv);
      g.vertexAttribPointer(aUv, 2, g.FLOAT, false, 16, 8);

      g.enable(g.BLEND);
      g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA);
      g.drawArrays(g.TRIANGLES, 0, 6);
    },

    onRemove() {
      if (!gl) return;
      if (program) gl.deleteProgram(program);
      if (posBuf) gl.deleteBuffer(posBuf);
      if (valueTex) gl.deleteTexture(valueTex);
      if (rampTex) gl.deleteTexture(rampTex);
      ready = false;
    },
  };
}
