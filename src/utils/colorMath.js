export function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
export function rgbToHex(r, g, b) { return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join(''); }
export function mixColors(hexA, hexB, ratio) {
  const a = [parseInt(hexA.slice(1, 3), 16), parseInt(hexA.slice(3, 5), 16), parseInt(hexA.slice(5, 7), 16)];
  const b = [parseInt(hexB.slice(1, 3), 16), parseInt(hexB.slice(3, 5), 16), parseInt(hexB.slice(5, 7), 16)];
  const mixed = a.map((v, i) => Math.round(v * ratio + b[i] * (1 - ratio)));
  return rgbToHex(mixed[0], mixed[1], mixed[2]);
}
export function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
}
export function clamp01(x) { return Math.max(0, Math.min(1, x)); }
export function shadeHex(hex, hueOverride, satCap, lightness) {
  const [h, s] = hexToHsl(hex);
  const [r, g, b] = hslToRgb(hueOverride != null ? hueOverride : h, Math.min(s, satCap), clamp01(lightness));
  return rgbToHex(r, g, b);
}
export function computeThemeFromColor(hex, cardLighter) {
  const [h, , l] = hexToHsl(hex);
  const bg = hex;
  const elevated = shadeHex(hex, h, 1, l + (cardLighter ? 0.07 : -0.07));
  const isDarkBg = l < 0.5;
  const text = shadeHex(hex, h, 0.2, isDarkBg ? 0.94 : 0.14);
  const muted = shadeHex(hex, h, 0.25, isDarkBg ? 0.62 : 0.46);
  const border = shadeHex(hex, h, 0.2, clamp01(l + (isDarkBg ? 0.09 : -0.09)));
  return { bg, elevated, text, muted, border, isDark: isDarkBg };
}

export function relativeLuminance(hex) {
  const chan = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const r = chan(parseInt(hex.slice(1, 3), 16));
  const g = chan(parseInt(hex.slice(3, 5), 16));
  const b = chan(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastText(hex) {
  const lum = relativeLuminance(hex);
  const contrastWithWhite = (1 + 0.05) / (lum + 0.05);
  const contrastWithBlack = (lum + 0.05) / (0 + 0.05);
  return contrastWithBlack > contrastWithWhite ? '#141414' : '#FAFAFA';
}

