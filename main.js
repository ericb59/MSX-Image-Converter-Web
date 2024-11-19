import './style.css';
import { MSXConverter } from './converter.js';
import { shaders } from './shaders.js';
import { PaletteOptimizer } from './palette-optimizer.js';

// Get DOM elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadButton = document.getElementById('uploadButton');
const convertButton = document.getElementById('convertButton');
const originalPreview = document.getElementById('originalPreview');
const convertedPreview = document.getElementById('convertedPreview');
const downloadButtons = document.getElementById('downloadButtons');

let originalImageData = null;

// Add filter controls to UI
const filterControls = document.createElement('div');
filterControls.className = 'filter-controls';
filterControls.innerHTML = `
  <h4>Filtres</h4>
  <select id="filterType">
    <option value="">Aucun</option>
    ${Object.entries(shaders).map(([key, filter]) => 
      `<option value="${key}">${filter.name}</option>`
    ).join('')}
  </select>
  <div id="filterStrength" style="display: none">
    <label>Force: <span id="filterValue">1.0</span></label>
    <input type="range" id="filterSlider" min="0" max="100" value="50">
  </div>
`;

document.querySelector('.controls').insertBefore(
  filterControls,
  convertButton
);

// Calculate scaled dimensions maintaining aspect ratio
function calculateScaledDimensions(width, height) {
  const maxWidth = 800;
  const maxHeight = 600;
  
  let newWidth = width;
  let newHeight = height;

  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    newWidth = Math.floor(width * ratio);
    newHeight = Math.floor(height * ratio);
  } else {
    const minSize = 256;
    if (width < minSize || height < minSize) {
      const ratio = Math.max(minSize / width, minSize / height);
      newWidth = Math.floor(width * ratio);
      newHeight = Math.floor(height * ratio);
    }
  }

  return { width: newWidth, height: newHeight };
}

// Handle file upload
function handleFileSelect(file) {
  if (!file || !file.type.startsWith('image/')) {
    alert('Veuillez sélectionner une image.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      document.querySelector('.preview-zone').style.display = 'flex';
      
      const scaled = calculateScaledDimensions(img.width, img.height);

      originalPreview.width = scaled.width;
      originalPreview.height = scaled.height;
      convertedPreview.width = scaled.width;
      convertedPreview.height = scaled.height;

      const ctx = originalPreview.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, scaled.width, scaled.height);

      originalImageData = ctx.getImageData(0, 0, scaled.width, scaled.height);

      convertButton.disabled = false;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Setup file upload handlers
uploadButton.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  handleFileSelect(e.target.files[0]);
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFileSelect(e.dataTransfer.files[0]);
});

// Handle conversion
convertButton.addEventListener('click', () => {
  const mode = document.getElementById('conversionMode').value;
  const dithering = document.getElementById('dithering').checked;
  const aspectRatio = document.getElementById('aspectRatio').checked;
  const filterType = document.getElementById('filterType').value;
  const filterStrength = document.getElementById('filterSlider').value / 50;

  const processedImageData = new ImageData(
    new Uint8ClampedArray(originalImageData.data),
    originalImageData.width,
    originalImageData.height
  );

  if (filterType) {
    const filtered = shaders[filterType].apply(processedImageData, filterStrength);
    convertedPreview.getContext('2d').putImageData(filtered, 0, 0);
  } else {
    convertedPreview.getContext('2d').putImageData(processedImageData, 0, 0);
  }

  const convertedImageData = MSXConverter.convert(convertedPreview, {
    mode,
    dithering,
    aspectRatio
  });

  const ctx = convertedPreview.getContext('2d');
  ctx.putImageData(convertedImageData, 0, 0);

  const files = MSXConverter.getOutputFiles();
  downloadButtons.innerHTML = '';
  
  Object.entries(files).forEach(([ext, data]) => {
    const button = document.createElement('button');
    button.textContent = `Download .${ext}`;
    button.addEventListener('click', () => {
      const blob = new Blob([data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `output.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    });
    downloadButtons.appendChild(button);
  });
});

// Handle filter controls
document.getElementById('filterType').addEventListener('change', (e) => {
  const strengthControls = document.getElementById('filterStrength');
  strengthControls.style.display = e.target.value ? 'block' : 'none';
});

document.getElementById('filterSlider').addEventListener('input', (e) => {
  document.getElementById('filterValue').textContent = (e.target.value / 50).toFixed(2);
});