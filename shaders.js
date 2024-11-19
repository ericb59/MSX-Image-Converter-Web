// Shader implementations for MSX image filters
export const shaders = {
  sharpen: {
    name: "Sharpen",
    apply: (imageData, strength = 0.15) => {
      const kernel = [
        0, -1, 0,
        -1, 5, -1,
        0, -1, 0
      ];
      return applyConvolution(imageData, kernel, strength);
    },
    minValue: 0.0,
    maxValue: 2.0,
    defaultValue: 0.15
  },

  contrast: {
    name: "Contrast",
    apply: (imageData, value = 1.0) => {
      const factor = (259 * (value * 255 + 255)) / (255 * (259 - value * 255));
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = truncate(factor * (data[i] - 128) + 128);
        data[i + 1] = truncate(factor * (data[i + 1] - 128) + 128);
        data[i + 2] = truncate(factor * (data[i + 2] - 128) + 128);
      }
      
      return imageData;
    },
    minValue: -3.0,
    maxValue: 3.0,
    defaultValue: 1.0
  },

  gamma: {
    name: "Gamma",
    apply: (imageData, gamma = 1.0) => {
      const data = imageData.data;
      const invGamma = 1 / gamma;
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = truncate(255 * Math.pow(data[i] / 255, invGamma));
        data[i + 1] = truncate(255 * Math.pow(data[i + 1] / 255, invGamma));
        data[i + 2] = truncate(255 * Math.pow(data[i + 2] / 255, invGamma));
      }
      
      return imageData;
    },
    minValue: 0.0,
    maxValue: 4.0,
    defaultValue: 1.0
  },

  saturation: {
    name: "Saturation",
    apply: (imageData, value = 1.0) => {
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.2989 * data[i] + 0.5870 * data[i + 1] + 0.1140 * data[i + 2];
        data[i] = truncate(gray + (data[i] - gray) * value);
        data[i + 1] = truncate(gray + (data[i + 1] - gray) * value);
        data[i + 2] = truncate(gray + (data[i + 2] - gray) * value);
      }
      
      return imageData;
    },
    minValue: -4.0,
    maxValue: 4.0,
    defaultValue: 1.0
  },

  temperature: {
    name: "Temperature",
    apply: (imageData, value = 1.0) => {
      const data = imageData.data;
      const temp = value * 0.1;
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = truncate(data[i] * (1 + temp));
        data[i + 2] = truncate(data[i + 2] * (1 - temp));
      }
      
      return imageData;
    },
    minValue: 0.1539,
    maxValue: 3.0,
    defaultValue: 1.0
  }
};

// Helper functions
function truncate(value) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function applyConvolution(imageData, kernel, strength) {
  const side = Math.round(Math.sqrt(kernel.length));
  const halfSide = Math.floor(side / 2);
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const output = new ImageData(width, height);
  const outData = output.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = (y * width + x) * 4;
      let r = 0, g = 0, b = 0;

      for (let cy = 0; cy < side; cy++) {
        for (let cx = 0; cx < side; cx++) {
          const scy = y + cy - halfSide;
          const scx = x + cx - halfSide;

          if (scy >= 0 && scy < height && scx >= 0 && scx < width) {
            const srcPx = (scy * width + scx) * 4;
            const kernelValue = kernel[cy * side + cx];
            r += data[srcPx] * kernelValue;
            g += data[srcPx + 1] * kernelValue;
            b += data[srcPx + 2] * kernelValue;
          }
        }
      }

      outData[px] = truncate(data[px] + (r - data[px]) * strength);
      outData[px + 1] = truncate(data[px + 1] + (g - data[px + 1]) * strength);
      outData[px + 2] = truncate(data[px + 2] + (b - data[px + 2]) * strength);
      outData[px + 3] = data[px + 3];
    }
  }

  return output;
}