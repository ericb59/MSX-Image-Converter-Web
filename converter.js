// MSX color palettes and constants
const MSX_PALETTES = {
  MSX1: [
    0x000000, 0x000000, 0x60A060, 0x80C080, 0x6040E0, 0x8060E0, 0xA06040, 0x60A0C0,
    0xC06040, 0xC08060, 0xC0C060, 0xC0C080, 0x408020, 0xA060A0, 0xA0A0A0, 0xE0E0E0
  ],
  MSX2: [
    0x000000, 0x000000, 0x20C020, 0x60E060, 0x2020E0, 0x4060E0, 0xA02020, 0x40C0E0,
    0xE02020, 0xE06060, 0xC0C020, 0xC0C080, 0x208020, 0xC040A0, 0xA0A0A0, 0xE0E0E0
  ]
};

let outputFiles = {};

// Find closest color in palette
function findClosestColor(r, g, b, palette, x, y, dithering = false) {
  let minDistance = Infinity;
  let closestIndex = 0;

  for (let i = 0; i < palette.length; i++) {
    const pr = (palette[i] >> 16) & 0xFF;
    const pg = (palette[i] >> 8) & 0xFF;
    const pb = palette[i] & 0xFF;

    const dr = r - pr;
    const dg = g - pg;
    const db = b - pb;

    const distance = dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;

    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = i;
    }
  }

  return closestIndex;
}

// Convert RGB to YJK color space
function rgbToYJK(r, g, b) {
  const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  const j = Math.round(-0.169 * r - 0.331 * g + 0.5 * b);
  const k = Math.round(0.5 * r - 0.419 * g - 0.081 * b);
  
  return {
    y: Math.min(31, Math.max(0, Math.round(y / 8))),
    j: Math.min(15, Math.max(-16, j)),
    k: Math.min(15, Math.max(-16, k))
  };
}

// Convert YJK back to RGB
function yjkToRGB(y, j, k) {
  y = y * 8;

  const r = Math.max(0, Math.min(255, y + k));
  const g = Math.max(0, Math.min(255, y - (j + k)/2));
  const b = Math.max(0, Math.min(255, y + j));

  return { r, g, b };
}

// Convert RGB to Screen 8 color
function rgbToScreen8(r, g, b) {
  const gr = Math.min(7, Math.floor(r / 32));
  const gg = Math.min(7, Math.floor(g / 32));
  const gb = Math.min(3, Math.floor(b / 64));
  
  // Pack bits in GRB format
  return (gg << 5) | (gr << 2) | gb;
}

// Convert Screen 8 color to RGB
function screen8ToRGB(color) {
  // Unpack GRB format
  const g = ((color >> 5) & 0x07) * 32;
  const r = ((color >> 2) & 0x07) * 32;
  const b = (color & 0x03) * 64;
  return { r, g, b };
}

// Convert to Screen 5 mode
function convertToScreen5(canvas, options) {
  const outWidth = 256;
  const outHeight = 212;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = outWidth;
  tempCanvas.height = outHeight;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(canvas, 0, 0, outWidth, outHeight);
  
  const imageData = tempCtx.getImageData(0, 0, outWidth, outHeight);
  const outputImageData = new ImageData(outWidth, outHeight);
  
  const optimizedPalette = buildOptimizedPalette(imageData);
  
  const buffer = new Uint8Array(outWidth * outHeight / 2 + 7);
  let offset = 7;

  const header = [0xFE, 0x00, 0x00, 0x00, 0xD4, 0x00, 0x00];
  buffer.set(header);

  for (let y = 0; y < outHeight; y++) {
    for (let x = 0; x < outWidth; x += 2) {
      const i1 = (y * outWidth + x) * 4;
      const i2 = i1 + 4;

      const c1 = findClosestColor(
        imageData.data[i1],
        imageData.data[i1 + 1],
        imageData.data[i1 + 2],
        optimizedPalette,
        x, y,
        options.dithering
      );

      const c2 = findClosestColor(
        imageData.data[i2],
        imageData.data[i2 + 1],
        imageData.data[i2 + 2],
        optimizedPalette,
        x + 1, y,
        options.dithering
      );

      buffer[offset++] = (c1 << 4) | c2;

      const color1 = optimizedPalette[c1];
      const color2 = optimizedPalette[c2];

      outputImageData.data[i1] = (color1 >> 16) & 0xFF;
      outputImageData.data[i1 + 1] = (color1 >> 8) & 0xFF;
      outputImageData.data[i1 + 2] = color1 & 0xFF;
      outputImageData.data[i1 + 3] = 255;

      outputImageData.data[i2] = (color2 >> 16) & 0xFF;
      outputImageData.data[i2 + 1] = (color2 >> 8) & 0xFF;
      outputImageData.data[i2 + 2] = color2 & 0xFF;
      outputImageData.data[i2 + 3] = 255;
    }
  }

  // Create palette file with correct header
  const paletteBuffer = new Uint8Array(32 + 7);
  const palHeader = [0xFE, 0x00, 0x00, 0x80, 0x1B, 0x00, 0x00];
  paletteBuffer.set(palHeader);
  let palOffset = 7;
  
  for (let i = 0; i < 16; i++) {
    const color = optimizedPalette[i];
    paletteBuffer[palOffset++] = ((color >> 17) & 0x70) | ((color >> 5) & 0x07);
    paletteBuffer[palOffset++] = (color >> 13) & 0x07;
  }

  outputFiles = {
    's50': buffer,
    'pal': paletteBuffer
  };

  return outputImageData;
}

// Convert to Screen 7 mode
function convertToScreen7(canvas, options) {
  const outWidth = 512;
  const outHeight = 212;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = outWidth;
  tempCanvas.height = outHeight;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(canvas, 0, 0, outWidth, outHeight);
  
  const imageData = tempCtx.getImageData(0, 0, outWidth, outHeight);
  const outputImageData = new ImageData(outWidth, outHeight);
  
  const optimizedPalette = buildOptimizedPalette(imageData);
  
  const buffer0 = new Uint8Array(outWidth * outHeight / 2 + 7);
  const buffer1 = new Uint8Array(outWidth * outHeight / 2 + 7);
  let offset0 = 7, offset1 = 7;

  const header = [0xFE, 0x00, 0x00, 0x00, 0xD4, 0x00, 0x00];
  buffer0.set(header);
  buffer1.set(header);

  for (let y = 0; y < outHeight; y++) {
    for (let x = 0; x < outWidth; x += 2) {
      const i1 = (y * outWidth + x) * 4;
      const i2 = i1 + 4;

      const c1 = findClosestColor(
        imageData.data[i1],
        imageData.data[i1 + 1],
        imageData.data[i1 + 2],
        optimizedPalette,
        x, y,
        options.dithering
      );

      const c2 = findClosestColor(
        imageData.data[i2],
        imageData.data[i2 + 1],
        imageData.data[i2 + 2],
        optimizedPalette,
        x + 1, y,
        options.dithering
      );

      if (y < outHeight / 2) {
        buffer0[offset0++] = (c1 << 4) | c2;
      } else {
        buffer1[offset1++] = (c1 << 4) | c2;
      }

      const color1 = optimizedPalette[c1];
      const color2 = optimizedPalette[c2];

      outputImageData.data[i1] = (color1 >> 16) & 0xFF;
      outputImageData.data[i1 + 1] = (color1 >> 8) & 0xFF;
      outputImageData.data[i1 + 2] = color1 & 0xFF;
      outputImageData.data[i1 + 3] = 255;

      outputImageData.data[i2] = (color2 >> 16) & 0xFF;
      outputImageData.data[i2 + 1] = (color2 >> 8) & 0xFF;
      outputImageData.data[i2 + 2] = color2 & 0xFF;
      outputImageData.data[i2 + 3] = 255;
    }
  }

  // Create palette file with correct header
  const paletteBuffer = new Uint8Array(32 + 7);
  const palHeader = [0xFE, 0x00, 0x00, 0x80, 0x1B, 0x00, 0x00];
  paletteBuffer.set(palHeader);
  let palOffset = 7;
  
  for (let i = 0; i < 16; i++) {
    const color = optimizedPalette[i];
    paletteBuffer[palOffset++] = ((color >> 17) & 0x70) | ((color >> 5) & 0x07);
    paletteBuffer[palOffset++] = (color >> 13) & 0x07;
  }

  outputFiles = {
    's70': buffer0,
    's71': buffer1,
    'pal': paletteBuffer
  };

  return outputImageData;
}

// Convert to Screen 8 mode
function convertToScreen8(canvas, options) {
  const outWidth = 256;
  const outHeight = 212;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = outWidth;
  tempCanvas.height = outHeight;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(canvas, 0, 0, outWidth, outHeight);
  
  const imageData = tempCtx.getImageData(0, 0, outWidth, outHeight);
  const outputImageData = new ImageData(outWidth, outHeight);
  
  const buffer = new Uint8Array(outWidth * outHeight + 7);
  let offset = 7;

  const header = [0xFE, 0x00, 0x00, 0x00, 0xD4, 0x00, 0x00];
  buffer.set(header);

  for (let y = 0; y < outHeight; y++) {
    for (let x = 0; x < outWidth; x++) {
      const i = (y * outWidth + x) * 4;
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];

      const color = rgbToScreen8(r, g, b);
      buffer[offset++] = color;

      const rgb = screen8ToRGB(color);
      outputImageData.data[i] = rgb.r;
      outputImageData.data[i + 1] = rgb.g;
      outputImageData.data[i + 2] = rgb.b;
      outputImageData.data[i + 3] = 255;
    }
  }

  outputFiles = {
    'sc8': buffer
  };

  return outputImageData;
}

// Convert to Screen 12 mode (YJK)
function convertToScreen12(canvas, options) {
  const outWidth = 256;
  const outHeight = 212;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = outWidth;
  tempCanvas.height = outHeight;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(canvas, 0, 0, outWidth, outHeight);
  
  const imageData = tempCtx.getImageData(0, 0, outWidth, outHeight);
  const outputImageData = new ImageData(outWidth, outHeight);
  
  const buffer = new Uint8Array(outWidth * outHeight + 7);
  let offset = 7;

  const header = [0xFE, 0x00, 0x00, 0x00, 0xD4, 0x00, 0x00];
  buffer.set(header);

  for (let y = 0; y < outHeight; y++) {
    for (let x = 0; x < outWidth; x += 4) {
      const yjkValues = [];
      
      // Process 4 pixels at a time
      for (let p = 0; p < 4; p++) {
        const i = (y * outWidth + x + p) * 4;
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        
        yjkValues.push(rgbToYJK(r, g, b));
      }
      
      // Calculate average J and K values
      const avgJ = Math.round(yjkValues.reduce((sum, v) => sum + v.j, 0) / 4);
      const avgK = Math.round(yjkValues.reduce((sum, v) => sum + v.k, 0) / 4);
      
      // Store Y values
      for (let p = 0; p < 4; p++) {
        buffer[offset++] = yjkValues[p].y;
        
        // Update preview image
        const i = (y * outWidth + x + p) * 4;
        const rgb = yjkToRGB(yjkValues[p].y, avgJ, avgK);
        
        outputImageData.data[i] = rgb.r;
        outputImageData.data[i + 1] = rgb.g;
        outputImageData.data[i + 2] = rgb.b;
        outputImageData.data[i + 3] = 255;
      }
      
      // Store J and K values
      buffer[offset++] = ((avgJ & 0x1F) << 3) | (avgK & 0x07);
    }
  }

  outputFiles = {
    'sc12': buffer
  };

  return outputImageData;
}

// Build optimized palette
function buildOptimizedPalette(imageData) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  
  const colorValues = new Array(256).fill(0);
  const colorCounts = new Array(256).fill(0);
  let paletteSize = 0;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const color = (data[i] & 0xE0) << 16 | (data[i + 1] & 0xE0) << 8 | (data[i + 2] & 0xE0);
      
      let found = false;
      for (let j = 0; j < paletteSize; j++) {
        if (colorValues[j] === color) {
          colorCounts[j]++;
          found = true;
          break;
        }
      }
      
      if (!found && paletteSize < 256) {
        colorValues[paletteSize] = color;
        colorCounts[paletteSize] = 1;
        paletteSize++;
      }
    }
  }

  const palette = new Array(16).fill(0);
  for (let i = 0; i < 16; i++) {
    let maxCount = 0;
    let maxIndex = 0;
    
    for (let j = 0; j < paletteSize; j++) {
      if (colorCounts[j] > maxCount) {
        maxCount = colorCounts[j];
        maxIndex = j;
      }
    }
    
    palette[i] = colorValues[maxIndex];
    colorCounts[maxIndex] = 0;
  }

  return palette.sort((a, b) => {
    const brightA = ((a >> 16) & 0xFF) + ((a >> 8) & 0xFF) + (a & 0xFF);
    const brightB = ((b >> 16) & 0xFF) + ((b >> 8) & 0xFF) + (b & 0xFF);
    return brightA - brightB;
  });
}

// Export MSX converter
export const MSXConverter = {
  convert: (canvas, options) => {
    switch (options.mode) {
      case 'screen5':
        return convertToScreen5(canvas, options);
      case 'screen7':
        return convertToScreen7(canvas, options);
      case 'screen8':
        return convertToScreen8(canvas, options);
      case 'screen12':
        return convertToScreen12(canvas, options);
      default:
        throw new Error(`Unsupported mode: ${options.mode}`);
    }
  },
  getOutputFiles: () => outputFiles
};