// ==UserScript==
// @name         NetAcad Answers
// @version      1.6
// @namespace    https://github.com/DracoFire4/
// @description  An alternative to CCNAnswers
// @match        https://www.netacad.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let latestRawData = null;

    // === Create Panel ===
    const panel = document.createElement('div');
    panel.id = 'netacad-question-ui';
    panel.style.cssText = `
        all: unset;
        position: fixed;
        top: 50px;
        left: 50px;
        width: 400px;
        max-height: 90vh;
        overflow: hidden;
        background: white;
        border: 2px solid #444;
        box-shadow: 0 0 10px rgba(0,0,0,0.3);
        z-index: 2147483647;
        font-family: sans-serif;
        font-size: 14px;
        border-radius: 8px;
        display: none;
        pointer-events: auto;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
        background: #444;
        color: white;
        padding: 8px 10px;
        cursor: move;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top-left-radius: 6px;
        border-top-right-radius: 6px;
        user-select: none;
    `;

    header.innerHTML = `
        <span><strong>✅ Netacad Answers</strong></span>
        <button id="minimize-btn" style="background: none; border: none; color: white; font-size: 16px; cursor: pointer;">−</button>
    `;

    const content = document.createElement('div');
    content.id = 'netacad-question-content';
    content.style.cssText = `
        padding: 10px;
        max-height: 75vh;
        overflow-y: auto;
    `;

    panel.appendChild(header);
    panel.appendChild(content);

    // Append to the <html> element to escape any <body> containers
    document.documentElement.appendChild(panel);

    // === Minimize/Expand Toggle ===
    let isMinimized = false;
    const minimizeBtn = header.querySelector('#minimize-btn');

    const floatingButton = document.createElement('div');
    floatingButton.id = 'floating-btn';
    floatingButton.style.cssText = `
        position: fixed;
        top: 50px;
        left: 50px;
        width: 50px;
        height: 50px;
        background: #444;
        color: white;
        border-radius: 50%;
        display: none;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 20px;
        text-align: center;
        box-shadow: 0 0 10px rgba(0,0,0,0.3);
        z-index: 2147483647;
    `;
    floatingButton.innerHTML = '+';

    document.documentElement.appendChild(floatingButton);

    minimizeBtn.addEventListener('click', () => {
        isMinimized = !isMinimized;
        content.style.display = isMinimized ? 'none' : 'block';
        minimizeBtn.textContent = isMinimized ? '+' : '−';
        panel.style.width = isMinimized ? '60px' : '400px';
        panel.style.height = isMinimized ? '60px' : 'auto';
        floatingButton.style.display = isMinimized ? 'flex' : 'none';
        panel.style.display = isMinimized ? 'none' : 'block';
    });

    floatingButton.addEventListener('click', () => {
        isMinimized = !isMinimized;
        content.style.display = isMinimized ? 'none' : 'block';
        minimizeBtn.textContent = isMinimized ? '+' : '−';
        panel.style.width = isMinimized ? '60px' : '400px';
        panel.style.height = isMinimized ? '60px' : 'auto';
        floatingButton.style.display = isMinimized ? 'flex' : 'none';
        panel.style.display = isMinimized ? 'none' : 'block';
    });

    // === Render MCQs ===
    function renderUI(mcqs) {
        if (!mcqs || mcqs.length === 0) return;

        content.innerHTML = ''; // Clear old
        mcqs.forEach((q, index) => {
            const parser = new DOMParser();
            const bodyHTML = parser.parseFromString(q.body || '', 'text/html');
            const questionText = bodyHTML.body.textContent.trim();

            const qDiv = document.createElement('div');
            qDiv.style.marginBottom = '12px';

            qDiv.innerHTML = `
                <strong>Q${index + 1}:</strong> ${questionText}<br>
                <ul style="padding-left: 20px; margin-top: 5px;">
                    ${q._items.map(choice => {
                        const mark = choice._shouldBeSelected ? '✅' : '❌';
                        return `<li>${mark} ${choice.text}</li>`;
                    }).join('')}
                </ul>
            `;

            content.appendChild(qDiv);
        });

        panel.style.display = 'block';
    }

    // === JSON Interception ===
    function isComponentsJson(url) {
        return url.endsWith('components.json');
    }

    const originalFetch = window.fetch;
    window.fetch = function (url, ...args) {
        if (isComponentsJson(url)) {
            return originalFetch.apply(this, [url, ...args])
                .then(response => {
                    const cloned = response.clone();
                    cloned.text().then(text => {
                        try {
                            const data = JSON.parse(text);
                            const mcqs = (Array.isArray(data) ? data : data.children || [])
                                .filter(q => q._component === 'mcq');

                            latestRawData = mcqs;
                            renderUI(mcqs);
                        } catch (e) {
                            console.error('❌ Failed to parse fetch JSON:', e);
                        }
                    });
                    return response;
                });
        }
        return originalFetch.apply(this, [url, ...args]);
    };

    const originalXHR = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...args) {
        if (isComponentsJson(url)) {
            this.addEventListener('load', function () {
                try {
                    const data = JSON.parse(this.responseText);
                    const mcqs = (Array.isArray(data) ? data : data.children || [])
                        .filter(q => q._component === 'mcq');

                    latestRawData = mcqs;
                    renderUI(mcqs);
                } catch (e) {
                    console.error('❌ Failed to parse XHR JSON:', e);
                }
            });
        }
        return originalXHR.apply(this, [method, url, ...args]);
    };

    // === Drag Logic With Viewport Boundaries ===
    let isDragging = false;
    let offsetX = 0, offsetY = 0;

    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - panel.offsetLeft;
        offsetY = e.clientY - panel.offsetTop;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const newX = e.clientX - offsetX;
            const newY = e.clientY - offsetY;

            const maxX = window.innerWidth - panel.offsetWidth;
            const maxY = window.innerHeight - panel.offsetHeight;

            panel.style.left = Math.max(0, Math.min(newX, maxX)) + 'px';
            panel.style.top = Math.max(0, Math.min(newY, maxY)) + 'px';
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // === Ensure Panel Stays in View on Resize ===
    window.addEventListener('resize', () => {
        const maxX = window.innerWidth - panel.offsetWidth;
        const maxY = window.innerHeight - panel.offsetHeight;

        const currentLeft = parseInt(panel.style.left, 10);
        const currentTop = parseInt(panel.style.top, 10);

        panel.style.left = Math.min(currentLeft, maxX) + 'px';
        panel.style.top = Math.min(currentTop, maxY) + 'px';
    });
})();
