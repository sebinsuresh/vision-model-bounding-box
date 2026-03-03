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
    const container = document.getElementById("container");
    container.querySelectorAll('.bbox, .bbox-label').forEach(n => n.remove());
    placeBoxes(windows);
    placeBoxes(closeButtons);
    placeBoxes(restoreButtons);
});
