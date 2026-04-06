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

        // const response = await fetch(`${baseUrl}/chat/completions`, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({
        //         model: model,
        //         messages: [
        //             ...(systemPrompt.trim() ? [{ role: 'system', content: systemPrompt }] : []),
        //             { role: 'user', content: userContent }
        //         ],
        //         temperature: temperature,
        //         max_tokens: 4096
        //     })
        // });

        // if (!response.ok) {
        //     const errorData = await response.json().catch(() => ({}));
        //     throw new Error(errorData.error?.message || `API Error: ${response.status} ${response.statusText}`);
        // }

        // const data = await response.json();
        // const data = {
        //     "choices": [
        //         {
        //             "finish_reason": "stop",
        //             "index": 0,
        //             "message": {
        //                 "role": "assistant",
        //                 "content": "```json\n[\n  {\"box_2d\": [426, 462, 487, 516], \"label\": \"the astronaut's limbs\"},\n  {\"box_2d\": [446, 395, 478, 448], \"label\": \"the astronaut's limbs\"},\n  {\"box_2d\": [466, 401, 504, 454], \"label\": \"the astronaut's limbs\"},\n  {\"box_2d\": [436, 440, 474, 466], \"label\": \"the astronaut's limbs\"}\n]\n```",
        //                 "reasoning_content": "The user wants me to detect all instances of \"the astronaut's limbs\" in the provided image.\n\n1.  **Analyze the image:** The image shows an astronaut floating in space above the Earth.\n2.  **Identify limbs:**\n    *   **Right arm:** Extended slightly, visible near the torso.\n    *   **Left arm:** Extended, visible.\n    *   **Right leg:** Bent, visible.\n    *   **Left leg:** Bent, visible.\n3.  **Determine bounding boxes:**\n    *   Right arm: Roughly from the shoulder to the hand.\n    *   Left arm: Roughly from the shoulder to the hand.\n    *   Right leg: From the hip to the foot.\n    *   Left leg: From the hip to the foot.\n    *   Wait, looking closer at the astronaut:\n        *   The astronaut is in a curled position.\n        *   Left arm is visible, extended towards the right of the image.\n        *   Right arm is tucked in, harder to distinguish from the torso.\n        *   Left leg is bent, extending towards the left.\n        *   Right leg is bent, also extending towards the left, slightly behind the other.\n4.  **Refine boxes for \"limbs\":**\n    *   Left arm: [425, 461, 487, 512]\n    *   Right arm: [435, 439, 475, 465] (very small part visible)\n    *   Left leg: [445, 395, 485, 445]\n    *   Right leg: [455, 400, 498, 450]\n    Actually, it's easier to just group them as \"limbs\".\n    Let's re-examine.\n    - Left arm: extends from body towards the right.\n    - Left leg: extends from body towards the left.\n    - Right leg: extends from body towards the left, below the left leg.\n    - Right arm: seems to be near the chest.\n\n    Let's try to be precise.\n    Astronaut overall box: [414, 394, 504, 517]\n    Left arm: [428, 465, 486, 517]\n    Left leg: [447, 394, 477, 448]\n    Right leg: [465, 400, 504, 455]\n    Right arm: [438, 440, 470, 468] (tucked in)\n\n    Let's re-evaluate. The astronaut's body is a white suit.\n    - Arm 1 (extending right): [425, 461, 488, 517]\n    - Leg 1 (upper left): [445, 394, 479, 450]\n    - Leg 2 (lower left): [464, 401, 504, 455]\n    - Arm 2 (tucked): [435, 438, 475, 465]\n\n    Actually, looking at the pose:\n    The astronaut is floating sideways.\n    - The arm extending to the right is the left arm.\n    - The legs extending to the left: the top one is the right leg, bottom one is the left leg.\n    - The arm near the chest is the right arm.\n\n    Let's just label them all as \"the astronaut's limbs\".\n    - Left arm: [425, 461, 488, 517]\n    - Right leg: [445, 394, 479, 450]\n    - Left leg: [464, 401, 504, 455]\n    - Right arm: [435, 438, 475, 465]\n\n    Let's double check coordinates.\n    Top: ~414\n    Bottom: ~504\n    Left: ~394\n    Right: ~517\n\n    Arm right: y [425, 488], x [461, 517]\n    Leg top: y [445, 479], x [394, 450]\n    Leg bottom: y [464, 504], x [401, 455]\n    Arm tucked: y [435, 475], x [438, 465]\n\n    Wait, \"the astronaut's limbs\" can be treated as a single category.\n    Let's refine.\n    Leg 1: [446, 395, 478, 448]\n    Leg 2: [466, 401, 504, 454]\n    Arm 1: [426, 462, 487, 516]\n    Arm 2: [436, 440, 474, 466]\n\n    Final check.\n    Right leg (top): [446, 395, 478, 448]\n    Left leg (bottom): [466, 401, 504, 454]\n    Left arm (extended): [426, 462, 487, 516]\n    Right arm (tucked): [436, 440, 474, 466]"
        //             }
        //         }
        //     ],
        //     "created": 1775435968,
        //     "model": "gemma-4-31B-it-Q4_K_M.gguf",
        //     "system_fingerprint": "b8665-b8635075f",
        //     "object": "chat.completion",
        //     "usage": {
        //         "completion_tokens": 1502,
        //         "prompt_tokens": 617,
        //         "total_tokens": 2119,
        //         "prompt_tokens_details": {
        //             "cached_tokens": 0
        //         }
        //     },
        //     "id": "chatcmpl-HzdIe0oi74YIkoA240jpdFNqdWlhtO2C",
        //     "timings": {
        //         "cache_n": 0,
        //         "prompt_n": 617,
        //         "prompt_ms": 652.336,
        //         "prompt_per_token_ms": 1.0572706645056726,
        //         "prompt_per_second": 945.8315959873439,
        //         "predicted_n": 1502,
        //         "predicted_ms": 38796.934,
        //         "predicted_per_token_ms": 25.83018242343542,
        //         "predicted_per_second": 38.714399441976525
        //     }
        // };

        //         const data = {
        //             choices: [
        //                 {
        //                     message: {
        //                         content: `[
        //   {"box_2d": [530, 381, 613, 466], "label": "astronaut's left arm"},
        //   {"box_2d": [526, 441, 614, 514], "label": "astronaut's right arm"},
        //   {"box_2d": [595, 381, 662, 456], "label": "astronaut's left leg"},
        //   {"box_2d": [595, 458, 661, 520], "label": "astronaut's right leg"}
        // ]`,
        //                         reasoning_content: 'mocking',
        //                     }
        //                 }
        //             ],
        //         };

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
                item && Array.isArray(item.box_2d) && item.box_2d.length >= 4
            );
        }

        if (typeof parsed === 'object' && parsed.box_2d && Array.isArray(parsed.box_2d)) {
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
    labelDiv.textContent = bbox.label;
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
        const [ymin, xmin, ymax, xmax] = bbox.box_2d;
        const X1 = xmin / size * w;
        const Y1 = ymin / size * h;
        const X2 = xmax / size * w;
        const Y2 = ymax / size * h;

        const box = createBoundingBox(X1, Y1, X2, Y2);

        // create label element and position it above the box
        const labelDiv = createBoundingBoxLabel(bbox, X1, Y1);

        // Add label and box to the container
        box.title = bbox.label;
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

    const defaultSystemPrompt = localStorage.getItem(SYSTEM_PROMPT_KEY) ?? `You are a high-precision visual analysis agent. Your sole purpose is to identify requested objects in an image and provide their exact locations using normalized coordinates (0-1000).

**Strict Output Format:**
Return ONLY a raw JSON array of objects. Do not include markdown formatting, backticks (\`\`\`json), preamble, or any conversational text.

**JSON Schema:**
[
  {
    "label": "object_name",
    "box": [ymin, xmin, ymax, xmax]
  }
]

**One-Shot Example:**
User: "Detect the search bar"
Assistant: [{"label": "search bar", "box": [420, 150, 460, 850]}]

**Operational Rules:**
1. **Coordinate System:** Use a scale of 0 to 1000. [0,0] is top-left; [1000,1000] is bottom-right.
2. **Box Order:** The "box" array must strictly follow the order: [ymin, xmin, ymax, xmax].
3. **Precision:** Ensure boxes are tight around the target object.
4. **Hallucination Control:** If an object is not clearly visible or present, do not include it in the list.
5. **Consistency:** For UI elements, encompass the entire interactive area including associated labels.
`;
    systemPrompt.value = defaultSystemPrompt;
    const defaultUserPrompt = localStorage.getItem(USER_PROMPT_KEY) ?? `Detect all instances of: **[INSERT TARGET OBJECTS HERE, e.g., "folder icons", "text input fields", "people"]**.
Return the results as a JSON list of objects with names and bounding boxes. If multiple distinct categories are requested, label each box accordingly.
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
