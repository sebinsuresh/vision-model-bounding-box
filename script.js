const MODEL_ID_KEY = "model_id";
const SYSTEM_PROMPT_KEY = "system_prompt";
const USER_PROMPT_KEY = "user_prompt";
const TEMPERATURE_KEY = "temperature";

async function loadModels(baseURL) {
    const modelSelect = document.getElementById('modelSelect');

    try {
        const response = await fetch(`${baseURL.replace(/\/$/, '')}/models`);
        if (!response.ok) throw new Error('Failed to fetch models');

        const data = await response.json();
        modelSelect.innerHTML = '';

        const models = data.data || [];
        let selectedModel = null;

        const defaultModelId = localStorage.getItem(MODEL_ID_KEY) ?? "gemma-4-31b-it";
        const visionModel = models.find(m => m.id === defaultModelId);
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

function storeInputsToLocalStorage() {
    const model = document.getElementById('modelInput').value || document.getElementById('modelSelect').value;
    localStorage.setItem(MODEL_ID_KEY, model);

    const systemPrompt = document.getElementById('systemPrompt').value;
    localStorage.setItem(SYSTEM_PROMPT_KEY, systemPrompt);

    const userPrompt = document.getElementById('userPrompt').value;
    localStorage.setItem(USER_PROMPT_KEY, userPrompt);

    const temperature = parseFloat(document.getElementById('temperature').value) || 0.3;
    localStorage.setItem(TEMPERATURE_KEY, temperature);
}

async function generateBoundingBoxes() {
    const baseUrl = document.getElementById('baseUrl').value.replace(/\/$/, '');
    const model = document.getElementById('modelInput').value || document.getElementById('modelSelect').value;
    const systemPrompt = document.getElementById('systemPrompt').value;
    const userPrompt = document.getElementById('userPrompt').value;
    const temperature = parseFloat(document.getElementById('temperature').value) || 0.3;

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
        const reasoningContent = data.choices?.[0].message?.reasoning_content;

        if (!content) {
            throw new Error('No content in response');
        }

        const bboxes = parseBoundingBoxes(content);

        if (bboxes.length === 0) {
            console.log("no bboxes");
            console.log(reasoningContent);
            showStatus('No bounding boxes detected. Try refining your prompt.\n' + reasoningContent, 'error');
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
        const [ymin, xmin, ymax, xmax] = bbox.box;
        const X1 = xmin / size * w;
        const Y1 = ymin / size * h;
        const X2 = xmax / size * w;
        const Y2 = ymax / size * h;

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
    const userPrompt = document.getElementById('userPrompt');
    const temperature = document.getElementById('temperature');

    const defaultSystemPrompt = localStorage.getItem(SYSTEM_PROMPT_KEY) ?? `You are a high-precision visual analysis agent specializing in object detection and spatial localization. Your sole purpose is to identify requested objects in an image and provide their exact locations using normalized coordinates (0-1000).

**Strict Operational Rules:**
1. **Coordinate System:** Use a scale of 0 to 1000 for both axes. [0,0] is the top-left corner; [1000,1000] is the bottom-right corner.
2. **Format:** Output ONLY a valid JSON list of objects. Do not include markdown formatting (like \`\`\`json), preamble text, or post-analysis commentary.
3. **Box Definition:** Each object must contain "label" and "box_2d". The coordinates must be in the format \`[ymin, xmin, ymax, xmax]\`.
4. **Precision:** Ensure boxes are tight around the target object without including unnecessary padding or cutting off edges.
5. **Hallucination Control:** If an object is not clearly visible, partially occluded to the point of ambiguity, or not present in the image, do NOT create a box for it. It is better to omit an item than to guess its location.
6. **Consistency:** For UI elements (folders, buttons, icons), ensure the box encompasses the entire interactive area including the label text below the icon.
`;
    systemPrompt.value = defaultSystemPrompt;

    const defaultUserPrompt = localStorage.getItem(USER_PROMPT_KEY) ?? `Detect all instances of: **[INSERT TARGET OBJECTS HERE, e.g., "folder icons", "text input fields", "people"]**.
Return the results as a JSON list of objects with labels and bounding boxes. If multiple distinct categories are requested, label each box accordingly.
`;
    userPrompt.value = defaultUserPrompt;

    const defaultTemperature = localStorage.getItem(TEMPERATURE_KEY) ?? 0.3;
    temperature.value = defaultTemperature;

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

    generateBtn.addEventListener('click', storeInputsToLocalStorage);
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
        // Only place demo boxes on initial page load, not when user uploads new image
        if (currentImageData === null) {
            const container = document.getElementById("container");
            placeBoxes(windows);
            placeBoxes(closeButtons);
            placeBoxes(restoreButtons);
        }
    });

    container.querySelectorAll('.bbox, .bbox-label').forEach(n => n.remove());
    placeBoxes(windows);
    placeBoxes(closeButtons);
    placeBoxes(restoreButtons);
});
