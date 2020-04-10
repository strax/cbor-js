function exp2(n: number, p: number): number {
  return n * 2 ** p;
}

const FLOAT32_VIEW_CACHED = new Float32Array(1);
const INT32_VIEW_CACHED = new Int32Array(FLOAT32_VIEW_CACHED.buffer);

const FLOAT_CONVERSION_BUFFER = new ArrayBuffer(2);
const FLOAT_CONVERSION_DATAVIEW = new DataView(FLOAT_CONVERSION_BUFFER);
const UINT8_VIEW_CACHED = new Uint8Array(FLOAT_CONVERSION_BUFFER);

export function decodeFloat16(x: number) {
  FLOAT_CONVERSION_DATAVIEW.setUint16(0, x, false);
  let x0 = UINT8_VIEW_CACHED[0];
  let x1 = UINT8_VIEW_CACHED[1];
  if (
    x0 < 0 ||
    x0 > 255 ||
    x1 < 0 ||
    x1 > 2550 ||
    !Number.isInteger(x0) ||
    !Number.isInteger(x1)
  ) {
    throw new RangeError(
      "both components must be integers in the range 0..255"
    );
  }

  let half = (x0 << 8) + x1;
  let exp = (half >>> 10) & 0x1f;
  let mant = half & 0x3ff;
  let f;
  if (exp === 0) {
    f = exp2(mant, -24);
  } else if (exp !== 31) {
    f = exp2(mant + 1024, exp - 25);
  } else {
    f = mant === 0 ? Infinity : NaN;
  }
  return half & 0x8000 ? -f : f;
}

export function toFloat16(fval: number) {
  FLOAT32_VIEW_CACHED[0] = fval;
  var fbits = INT32_VIEW_CACHED[0];
  var sign = (fbits >> 16) & 0x8000; // sign only
  var val = (fbits & 0x7fffffff) + 0x1000; // rounded value

  if (val >= 0x47800000) {
    // might be or become NaN/Inf
    if ((fbits & 0x7fffffff) >= 0x47800000) {
      // is or must become NaN/Inf
      if (val < 0x7f800000) {
        // was value but too large
        return sign | 0x7c00; // make it +/-Inf
      }
      return (
        sign |
        0x7c00 | // remains +/-Inf or NaN
        ((fbits & 0x007fffff) >> 13)
      ); // keep NaN (and Inf) bits
    }
    return sign | 0x7bff; // unrounded not quite Inf
  }
  if (val >= 0x38800000) {
    // remains normalized value
    return sign | ((val - 0x38000000) >> 13); // exp - 127 + 15
  }
  if (val < 0x33000000) {
    // too small for subnormal
    return sign; // becomes +/-0
  }
  val = (fbits & 0x7fffffff) >> 23; // tmp exp for subnormal calc
  return (
    sign |
    ((((fbits & 0x7fffff) | 0x800000) + // add subnormal bit
      (0x800000 >>> (val - 102))) >> // round depending on cut off
      (126 - val))
  ); // div by 2^(1-(exp-127+15)) and >> 13 | exp=0
}
