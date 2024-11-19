// Palette optimization for MSX modes
export class PaletteOptimizer {
  constructor() {
    this.colorClusters = new Array(16).fill(null).map(() => ({
      r: 0, g: 0, b: 0,
      count: 0
    }));
  }

  // Convert RGB to MSX color format
  rgbToMSX(r, g, b) {
    return {
      r: Math.round(r / 36.4285714) & 7,
      g: Math.round(g / 36.4285714) & 7,
      b: Math.round(b / 36.4285714) & 7
    };
  }

  // Convert MSX color format to RGB
  msxToRGB(r, g, b) {
    return {
      r: Math.round(r * 36.4285714),
      g: Math.round(g * 36.4285714),
      b: Math.round(b * 36.4285714)
    };
  }

  // Optimize palette for the image
  optimizePalette(imageData) {
    const pixels = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // Reset clusters
    this.colorClusters.forEach(cluster => {
      cluster.r = 0;
      cluster.g = 0;
      cluster.b = 0;
      cluster.count = 0;
    });

    // First pass: collect color statistics
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      
      // Find closest cluster
      let minDist = Infinity;
      let closestCluster = 0;
      
      for (let j = 0; j < this.colorClusters.length; j++) {
        const cluster = this.colorClusters[j];
        if (cluster.count === 0) {
          closestCluster = j;
          break;
        }
        
        const dr = cluster.r / cluster.count - r;
        const dg = cluster.g / cluster.count - g;
        const db = cluster.b / cluster.count - b;
        const dist = dr * dr + dg * dg + db * db;
        
        if (dist < minDist) {
          minDist = dist;
          closestCluster = j;
        }
      }
      
      // Add to cluster
      const cluster = this.colorClusters[closestCluster];
      cluster.r += r;
      cluster.g += g;
      cluster.b += b;
      cluster.count++;
    }

    // Convert clusters to MSX palette
    const palette = this.colorClusters.map(cluster => {
      if (cluster.count === 0) return 0;
      
      const r = Math.round(cluster.r / cluster.count);
      const g = Math.round(cluster.g / cluster.count);
      const b = Math.round(cluster.b / cluster.count);
      
      const msxColor = this.rgbToMSX(r, g, b);
      const rgb = this.msxToRGB(msxColor.r, msxColor.g, msxColor.b);
      
      return (rgb.r << 16) | (rgb.g << 8) | rgb.b;
    });

    // Sort palette by luminance
    return palette.sort((a, b) => {
      const lumA = ((a >> 16) & 0xFF) * 0.299 + ((a >> 8) & 0xFF) * 0.587 + (a & 0xFF) * 0.114;
      const lumB = ((b >> 16) & 0xFF) * 0.299 + ((b >> 8) & 0xFF) * 0.587 + (b & 0xFF) * 0.114;
      return lumA - lumB;
    });
  }

  // Create MSX palette file
  createPaletteFile(palette) {
    const buffer = new Uint8Array(32 + 7);
    const header = [0xFE, 0x00, 0x00, 0x80, 0xFA, 0x00, 0x00];
    buffer.set(header);
    
    let offset = 7;
    for (let i = 0; i < 16; i++) {
      const color = palette[i];
      buffer[offset++] = ((color >> 17) & 0x70) | ((color >> 5) & 0x07);
      buffer[offset++] = (color >> 13) & 0x07;
    }
    
    return buffer;
  }
}