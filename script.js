async function loadModels(baseURL) {
    const modelSelect = document.getElementById('modelSelect');
    
    try {
        const response = await fetch(`${baseURL.replace(/\/$/, '')}/models`);
        if (!response.ok) throw new Error('Failed to fetch models');
        
        const data = await response.json();
        modelSelect.innerHTML = '';
        
        const models = data.data || [];
        let selectedModel = null;
        
        // Check for vision model first
        const visionModel = models.find(m => m.id === 'qwen/qwen3-vl-4b');
        if (visionModel) {
            selectedModel = visionModel.id;
        } else if (models.length > 0) {
            selectedModel = models[0].id;
        }
        
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.id;
            modelSelect.appendChild(option);
        });
        
        if (selectedModel) {
            modelSelect.value = selectedModel;
        }
    } catch (error) {
        console.warn('Could not load models from API:', error.message);
        showStatus('Warning: Could not load models from API. Please check your connection.', 'error');
    }
}

let currentImageData = null;

function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = type;
    if (type !== 'loading') {
        setTimeout(() => { status.className = ''; status.style.display = 'none'; }, 5000);
    }
}

async function generateBoundingBoxes() {
    const baseUrl = document.getElementById('baseUrl').value.replace(/\/$/, '');
    const model = document.getElementById('modelInput').value || document.getElementById('modelSelect').value;
    const systemPrompt = document.getElementById('systemPrompt').value;
    const temperature = parseFloat(document.getElementById('temperature').value) || 0.3;
    const userPrompt = document.getElementById('userPrompt').value;
    
    if (!userPrompt.trim()) {
        showStatus('Please enter a prompt describing what to detect', 'error');
        return;
    }
    
    if (!currentImageData) {
        showStatus('Please upload an image first', 'error');
        return;
    }
    
    const generateBtn = document.getElementById('generateBtn');
    generateBtn.disabled = true;
    showStatus('Generating bounding boxes...', 'loading');
    
    try {
        const userContent = [
            {
                type: "image_url",
                image_url: {
                    url: currentImageData
                }
            },
            {
                type: "text",
                text: userPrompt
            }
        ];
        
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                messages: [
                    ...(systemPrompt.trim() ? [{ role: 'system', content: systemPrompt }] : []),
                    { role: 'user', content: userContent }
                ],
                temperature: temperature,
                max_tokens: 4096
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API Error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        
        if (!content) {
            throw new Error('No content in response');
        }
        
        const bboxes = parseBoundingBoxes(content);
        
        if (bboxes.length === 0) {
            showStatus('No bounding boxes detected. Try refining your prompt.', 'error');
            generateBtn.disabled = false;
            return;
        }
        
        clearExistingBoxes();
        placeBoxes(bboxes);
        showStatus(`Successfully generated ${bboxes.length} bounding boxes`, 'success');
    } catch (error) {
        console.error('Error generating bounding boxes:', error);
        showStatus(`Error: ${error.message}`, 'error');
    } finally {
        generateBtn.disabled = false;
    }
}

function parseBoundingBoxes(content) {
    try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        const jsonStr = jsonMatch ? jsonMatch[0] : content;
        const parsed = JSON.parse(jsonStr);
        
        if (Array.isArray(parsed)) {
            return parsed.filter(item => 
                item && Array.isArray(item.box) && item.box.length >= 4
            );
        }
        
        if (typeof parsed === 'object' && parsed.box && Array.isArray(parsed.box)) {
            return [parsed];
        }
        
        return [];
    } catch (e) {
        console.warn('Failed to parse JSON from response:', e.message);
        return [];
    }
}

function clearExistingBoxes() {
    const container = document.getElementById("container");
    container.querySelectorAll('.bbox, .bbox-label').forEach(el => el.remove());
}

function createBoundingBox(X1, Y1, X2, Y2) {
    const box = document.createElement('div');
    box.className = 'bbox';
    box.style.position = 'absolute';
    box.style.left = `${X1}px`;
    box.style.top = `${Y1}px`;
    box.style.width = `${X2 - X1}px`;
    box.style.height = `${Y2 - Y1}px`;
    box.style.border = '1px solid red';
    box.style.zIndex = 10;
    box.style.pointerEvents = 'none';
    return box;
}

function createBoundingBoxLabel(bbox, X1, Y1) {
    const labelDiv = document.createElement('div');
    labelDiv.className = 'bbox-label';
    labelDiv.textContent = bbox.name;
    labelDiv.style.position = 'absolute';
    labelDiv.style.left = `${X1}px`;
    const labelTop = Math.max(0, Y1 - 20);
    labelDiv.style.top = `${labelTop}px`;
    labelDiv.style.background = 'rgba(255,255,255,0.85)';
    labelDiv.style.padding = '2px 6px';
    labelDiv.style.fontSize = '12px';
    labelDiv.style.border = '1px solid rgba(0,0,0,0.15)';
    labelDiv.style.borderRadius = '3px';
    labelDiv.style.zIndex = 20;
    labelDiv.style.pointerEvents = 'none';
    return labelDiv;
}

function addBoxes(bboxes, container, w, h) {
    bboxes.forEach(bbox => {
        const size = 1000;
        const [x1, y1, x2, y2] = bbox.box;
        const X1 = x1 / size * w;
        const Y1 = y1 / size * h;
        const X2 = x2 / size * w;
        const Y2 = y2 / size * h;

        const box = createBoundingBox(X1, Y1, X2, Y2);

        // create label element and position it above the box
        const labelDiv = createBoundingBoxLabel(bbox, X1, Y1);

        // Add label and box to the container
        box.title = bbox.name;
        container.appendChild(labelDiv);
        container.appendChild(box);
    });
}

function placeBoxes(data) {
    const container = document.getElementById("container");
    const image = container.querySelector('img');

    const w = image.clientWidth || image.width;
    const h = image.clientHeight || image.height;
    addBoxes(data, container, w, h);
}

document.addEventListener("DOMContentLoaded", () => {
    const baseUrlInput = document.getElementById('baseUrl');
    const modelSelect = document.getElementById('modelSelect');
    const modelInput = document.getElementById('modelInput');
    const generateBtn = document.getElementById('generateBtn');
    const systemPrompt = document.getElementById('systemPrompt');
    
    const defaultSystemPrompt = `Analyze the given image and detect the specified UI elements. Return ONLY a JSON array with the format:
[{"name": "short element description", "box": [x1, y1, x2, y2]}]
Coordinates should be in a 1000x1000 normalized space.`;
    
    systemPrompt.value = defaultSystemPrompt;
    
    loadModels(baseUrlInput.value);
    
    baseUrlInput.addEventListener('change', () => {
        loadModels(baseUrlInput.value);
    });
    
    modelSelect.addEventListener('change', () => {
        if (modelSelect.value) {
            modelInput.value = '';
        }
    });
    
    modelInput.addEventListener('input', () => {
        if (modelInput.value) {
            modelSelect.value = '';
        }
    });
    
    generateBtn.addEventListener('click', generateBoundingBoxes);
    
    const container = document.getElementById("container");
    const imageUpload = document.getElementById("imageUpload");
    const img = container.querySelector('img');

    imageUpload.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                img.src = event.target.result;
                currentImageData = event.target.result;
                clearExistingBoxes();
            };
            reader.readAsDataURL(file);
        }
    });

    img.addEventListener("load", () => {
        const container = document.getElementById("container");
        container.querySelectorAll('.bbox, .bbox-label').forEach(n => n.remove());
        placeBoxes(windows);
        placeBoxes(closeButtons);
        placeBoxes(restoreButtons);
    });

    container.querySelectorAll('.bbox, .bbox-label').forEach(n => n.remove());
    placeBoxes(windows);
    placeBoxes(closeButtons);
    placeBoxes(restoreButtons);
});
