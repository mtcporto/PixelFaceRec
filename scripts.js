import('https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/js/bootstrap.bundle.min.js');

const MODELS_PATH = './models/';
let FACE_MATCH_THRESHOLD = 0.6; // Now let instead of const so we can modify it in settings
const MESSAGE_TIMEOUT = 3000; // 3 segundos para mensagens temporárias

// Elementos do DOM
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const video = document.getElementById('video');
const imageUpload = document.getElementById('imageUpload');
const personNameInput = document.getElementById('personName');
const registerFaceButton = document.getElementById('registerFace');
const faceList = document.getElementById('faceList');
const startRecognitionButton = document.getElementById('startRecognition');
const stopRecognitionButton = document.getElementById('stopRecognition');
const systemStatusElement = document.getElementById('systemStatus');
const cadastroStatusElement = document.getElementById('cadastroStatus');
const recognitionStatusElement = document.getElementById('recognitionStatus');
const recognitionMessageElement = document.getElementById('recognitionMessage');

// --- NOVO: Cadastro múltiplo de usuários ---
const multiUserForm = document.getElementById('multiUserForm');
const multiUserInputs = document.getElementById('multiUserInputs');
const addUserFieldButton = document.getElementById('addUserField');

function createUserInput(index) {
    return `
    <div class="row mb-2 user-input-row" data-index="${index}">
        <div class="col-5">
            <input type="text" class="form-control user-name" placeholder="Nome do usuário" required>
        </div>
        <div class="col-5">
            <input type="file" class="form-control user-image" accept="image/*" required>
        </div>
        <div class="col-2 d-flex align-items-center">
            <button type="button" class="btn btn-danger btn-sm remove-user-field">Remover</button>
        </div>
    </div>`;
}

function addUserField() {
    const count = multiUserInputs.querySelectorAll('.user-input-row').length;
    if (count >= 3) return;
    multiUserInputs.insertAdjacentHTML('beforeend', createUserInput(count));
}

// Inicializa com 3 campos ao abrir o modal
function resetCadastroForm() {
    multiUserInputs.innerHTML = '';
    for (let i = 0; i < 3; i++) addUserField();
    cadastroStatusElement.style.display = 'none';
}

// Ao abrir o modal, reseta os campos
const cadastroModal = document.getElementById('cadastroModal');
const openCadastroBtn = document.getElementById('openCadastroBtn');
openCadastroBtn.addEventListener('click', function() {
    resetCadastroForm();
    const modal = new bootstrap.Modal(cadastroModal);
    modal.show();
    // Se o modal de configurações estiver aberto, feche-o
    const settingsModal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
    if (settingsModal) {
        settingsModal.hide();
    }
});

function removeUserField(e) {
    if (e.target.classList.contains('remove-user-field')) {
        e.target.closest('.user-input-row').remove();
    }
}

addUserFieldButton.addEventListener('click', addUserField);
multiUserInputs.addEventListener('click', removeUserField);

multiUserForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!faceApiReady) {
        alert('Os modelos de reconhecimento facial ainda não foram carregados.');
        return;
    }
    const userRows = multiUserInputs.querySelectorAll('.user-input-row');
    let successCount = 0;
    for (const row of userRows) {
        const name = row.querySelector('.user-name').value.trim();
        const file = row.querySelector('.user-image').files[0];
        if (!name || !file) continue;
        showCadastroStatus(`Processando ${name}...`, 0);
        try {
            const img = await faceapi.bufferToImage(file);
            const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptors();
            if (detections.length > 0) {
                const descriptor = detections[0].descriptor;
                const existingIndex = labeledFaceDescriptors.findIndex(fd => fd.label === name);
                if (existingIndex >= 0) {
                    labeledFaceDescriptors[existingIndex] = new faceapi.LabeledFaceDescriptors(name, [descriptor]);
                    Array.from(faceList.children).forEach(item => {
                        if (item.querySelector('span').textContent === name) {
                            item.remove();
                        }
                    });
                } else {
                    labeledFaceDescriptors.push(new faceapi.LabeledFaceDescriptors(name, [descriptor]));
                }
                // Adiciona à lista visual
                const faceItem = document.createElement('div');
                faceItem.className = 'face-item';
                faceItem.innerHTML = `
                    <span>${name}</span>
                    <button class="btn btn-danger btn-sm" onclick="removeFace('${name}', this.parentElement)">Remover</button>
                `;
                faceList.appendChild(faceItem);
                successCount++;
            } else {
                showCadastroStatus(`Nenhuma face detectada para ${name}.`, 2000);
            }
        } catch (error) {
            showCadastroStatus(`Erro ao processar ${name}.`, 2000);
        }
    }
    updateFaceMatcher();
    if (successCount > 0) {
        showCadastroStatus(`${successCount} usuário(s) cadastrados com sucesso!`);
        // Limpa os campos
        multiUserInputs.innerHTML = '';
        for (let i = 0; i < 3; i++) addUserField();
        // Fecha o modal após cadastro
        const modal = bootstrap.Modal.getInstance(cadastroModal);
        modal.hide();
    }
});
// --- FIM NOVO ---

// Estado da aplicação
let currentStream = null;
let faceApiReady = false;
let isProcessing = false;
let isRecognitionActive = false;
let labeledFaceDescriptors = [];
let faceMatcher = null;
let recognitionTimer = null;
let statusTimer = null;

let livenessRequired = true;
let livenessPassed = false;
let smileDetected = false;
let showFaceBox = true; // Controle para caixa de reconhecimento facial
let showNameInBox = true; // Controle para exibição do nome na caixa de reconhecimento

// Funções de controle de mensagens de status
function showSystemStatus(message) {
    systemStatusElement.textContent = message;
    systemStatusElement.style.display = 'block';
}

function hideSystemStatus() {
    systemStatusElement.style.display = 'none';
}

function showCadastroStatus(message, duration = MESSAGE_TIMEOUT) {
    cadastroStatusElement.textContent = message;
    cadastroStatusElement.style.display = 'block';
    
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
        cadastroStatusElement.style.display = 'none';
    }, duration);
}

function showRecognitionStatus(message, duration = MESSAGE_TIMEOUT) {
    recognitionStatusElement.textContent = message;
    recognitionStatusElement.style.display = 'block';
    
    if (duration !== 0) {
        clearTimeout(statusTimer);
        statusTimer = setTimeout(() => {
            recognitionStatusElement.style.display = 'none';
        }, duration);
    }
}

function showRecognitionMessage(message, isRecognized) {
    // Se não tem mensagem, esconde o elemento
    if (!message) {
        recognitionMessageElement.style.display = 'none';
        return;
    }
    
    recognitionMessageElement.textContent = message;
    recognitionMessageElement.classList.remove('recognized', 'not-recognized');
    recognitionMessageElement.style.display = 'block';
    
    if (isRecognized === true) {
        recognitionMessageElement.classList.add('recognized');
    } else if (isRecognized === false) {
        recognitionMessageElement.classList.add('not-recognized');
    }
    
    // Limpar temporizador anterior se existir
    if (recognitionTimer) {
        clearTimeout(recognitionTimer);
    }
}

function showLivenessInstruction() {
    showRecognitionStatus('Por favor, sorria para autenticação (detecção de vivacidade).', 0);
}

// Gerenciamento de faces cadastradas
function updateFaceMatcher() {
    if (labeledFaceDescriptors.length > 0) {
        faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, FACE_MATCH_THRESHOLD);
        if (window.suppressLogs) return;
        console.log("Face matcher atualizado com:", labeledFaceDescriptors.map(ld => ld.label));
    } else {
        faceMatcher = null;
    }
    saveUsersToLocalStorage();
}

function removeFace(name, element) {
    labeledFaceDescriptors = labeledFaceDescriptors.filter(fd => fd.label !== name);
    updateFaceMatcher();
    element.remove();
    showCadastroStatus(`Usuário ${name} removido com sucesso!`);
}

// Funções utilitárias para salvar e carregar usuários no localStorage
function saveUsersToLocalStorage() {
    // Salva apenas nome e array descriptor (como array simples)
    const data = labeledFaceDescriptors.map(fd => ({
        label: fd.label,
        descriptor: Array.from(fd.descriptors[0])
    }));
    localStorage.setItem('faceUsers', JSON.stringify(data));
}

function loadUsersFromLocalStorage() {
    const data = localStorage.getItem('faceUsers');
    if (!data) return;
    try {
        const arr = JSON.parse(data);
        labeledFaceDescriptors = arr.map(u => new faceapi.LabeledFaceDescriptors(
            u.label,
            [new Float32Array(u.descriptor)]
        ));
        updateFaceMatcher();
        // Atualiza lista visual
        faceList.innerHTML = '';
        labeledFaceDescriptors.forEach(fd => {
            const faceItem = document.createElement('div');
            faceItem.className = 'face-item';
            faceItem.innerHTML = `
                <span>${fd.label}</span>
                <button class="btn btn-danger btn-sm" onclick="removeFace('${fd.label}', this.parentElement)">Remover</button>
            `;
            faceList.appendChild(faceItem);
        });
    } catch { /* warning suprimido */ }
}

// Spinner overlay helpers
function showLoading(show = true) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.toggle('active', show);
    return () => showLoading(false); // Return function to hide loading for promise chaining
}

// Inicialização de modelos e câmera
async function loadFaceApiModels() {
    showLoading(true);
    showSystemStatus('Carregando modelos de reconhecimento facial...');
    try {
        window.removeFace = removeFace;

        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_PATH),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_PATH),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_PATH),
            faceapi.nets.faceExpressionNet.loadFromUri(MODELS_PATH) // <-- Adicionado para corrigir erro
        ]);

        faceApiReady = true;
        if (window.suppressLogs) return;
        console.log('Modelos Face-API carregados!');
        hideSystemStatus();
        showLoading(false);
    } catch (error) {
        if (window.suppressLogs) return;
        console.error('Erro ao carregar modelos Face-API:', error);
        showSystemStatus(`Erro ao carregar modelos faciais: ${error.message}`);
        alert(`Erro ao carregar modelos faciais: ${error.message}. Verifique se os modelos estão na pasta: ${MODELS_PATH}`);
        showLoading(false);
        throw error;
    }
}

async function startCamera() {
    showLoading(true);
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }

    try {
        const constraints = {
            video: {
                facingMode: "user",
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        currentStream = stream;

        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                if (window.suppressLogs) return;
                console.log(`Canvas dimensionado para: ${canvas.width}x${canvas.height}`);
                showLoading(false);
                resolve();
            };
        });
    } catch (err) {
        if (window.suppressLogs) return;
        console.error("Erro ao acessar a webcam: ", err);
        showRecognitionStatus('Erro ao acessar a câmera. Verifique as permissões.', 0);
        showLoading(false);
        throw err;
    }
}

async function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    
    // Limpar o canvas quando a câmera for desligada
    context.clearRect(0, 0, canvas.width, canvas.height);
}

// Cadastro e detecção de faces
async function registerFaceFromImage() {
    if (!faceApiReady) {
        alert('Os modelos de reconhecimento facial ainda não foram carregados.');
        return;
    }

    const name = personNameInput.value.trim();
    if (!name) {
        showCadastroStatus('Por favor, digite um nome para o usuário');
        return;
    }

    const file = imageUpload.files[0];
    if (!file) {
        showCadastroStatus('Por favor, selecione uma imagem para cadastro');
        return;
    }

    showCadastroStatus('Processando imagem...', 0);

    try {
        const img = await faceapi.bufferToImage(file);
        const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();

        if (detections.length > 0) {
            const descriptor = detections[0].descriptor;

            const existingIndex = labeledFaceDescriptors.findIndex(fd => fd.label === name);
            if (existingIndex >= 0) {
                labeledFaceDescriptors[existingIndex] = new faceapi.LabeledFaceDescriptors(name, [descriptor]);
                Array.from(faceList.children).forEach(item => {
                    if (item.querySelector('span').textContent === name) {
                        item.remove();
                    }
                });
                showCadastroStatus(`Cadastro de ${name} atualizado com sucesso!`);
            } else {
                labeledFaceDescriptors.push(new faceapi.LabeledFaceDescriptors(name, [descriptor]));
                showCadastroStatus(`Usuário ${name} cadastrado com sucesso!`);
            }

            updateFaceMatcher();

            const faceItem = document.createElement('div');
            faceItem.className = 'face-item';
            faceItem.innerHTML = `
                <span>${name}</span>
                <button class="btn btn-danger btn-sm" onclick="removeFace('${name}', this.parentElement)">Remover</button>
            `;
            faceList.appendChild(faceItem);
            personNameInput.value = '';
            imageUpload.value = '';
        } else {
            showCadastroStatus('Nenhuma face detectada na imagem. Tente outra.');
        }
    } catch (error) {
        if (window.suppressLogs) return;
        console.error('Erro ao processar imagem:', error);
        showCadastroStatus('Erro ao processar imagem. Tente novamente.');
    }
}

let lastRecognizedName = null;
let lastRecognitionTime = null;

async function detectFaces() {
    if (!isRecognitionActive) return;
    
    if (!faceApiReady || isProcessing) {
        requestAnimationFrame(detectFaces);
        return;
    }

    isProcessing = true;

    try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const detections = await faceapi.detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors()
            .withFaceExpressions();

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        if (detections.length > 0) {
            const detection = detections[0];
            // --- LIVENESS CHECK: Sorriso ---
            if (livenessRequired) {
                const expressions = detection.expressions;
                if (expressions && expressions.happy > 0.7) {
                    smileDetected = true;
                    livenessPassed = true;
                    livenessRequired = false;
                    showRecognitionStatus('Vivacidade confirmada! Prosseguindo com reconhecimento...', 2000);
                }
                if (!livenessPassed) {
                    showLivenessInstruction();
                    isProcessing = false;
                    requestAnimationFrame(detectFaces);
                    return;
                }
            }
            // --- FIM LIVENESS ---
            detections.forEach(detection => {
                const box = detection.detection.box;
                
                if (faceMatcher) {
                    const match = faceMatcher.findBestMatch(detection.descriptor);
                    const label = match.label;
                    const now = new Date();
                    
                    if (label === 'unknown') {
                        // Se o usuário é desconhecido ou diferente do último reconhecido
                        if (lastRecognizedName !== 'unknown') {
                            const timestamp = now.toLocaleString();
                            showRecognitionMessage(`Usuário não reconhecido em ${timestamp}`, false);
                            
                            // Mostrar indicador no rosto se configurado
                            if (showFaceBox) {
                                // Adiciona o indicador "Não reconhecido" na testa
                                addFaceStatusIndicator(box, 'Não reconhecido', 'unknown');
                            }
                            
                            lastRecognizedName = 'unknown';
                            lastRecognitionTime = now;
                        }
                    } else {
                        // Verifica se o nome é diferente do último reconhecido ou se passaram mais de 3 segundos
                        const shouldUpdate = 
                            label !== lastRecognizedName || 
                            !lastRecognitionTime || 
                            (now - lastRecognitionTime) > 3000;
                            
                        if (shouldUpdate) {
                            const timestamp = now.toLocaleString();
                            showRecognitionMessage(`Usuário ${label} reconhecido em ${timestamp}`, true);
                            
                            // Mostrar indicador no rosto se configurado
                            if (showFaceBox) {
                                // Adiciona o nome do usuário na testa
                                addFaceStatusIndicator(box, label, 'recognized');
                            }
                            
                            lastRecognizedName = label;
                            lastRecognitionTime = now;
                        }
                    }
                    
                    // Desenha a caixa apenas se a configuração estiver ativada
                    if (showFaceBox) {
                        const drawOptions = { 
                            label: '', // Removemos o label da caixa (será exibido pelo addFaceStatusIndicator)
                            boxColor: label === 'unknown' ? 'red' : 'green',
                            lineWidth: 2  // Espessura da linha da caixa mais fina
                        };
                        
                        const drawBox = new faceapi.draw.DrawBox(box, drawOptions);
                        drawBox.draw(canvas);
                    }} else {
                    // Se não há faces cadastradas, apenas mostra a detecção se configurado
                    if (showFaceBox) {
                        const drawBox = new faceapi.draw.DrawBox(box, { 
                            label: '', // Removemos o label da caixa
                            boxColor: 'blue',
                            lineWidth: 2
                        });
                        drawBox.draw(canvas);
                        
                        // Adiciona "Rosto detectado" na testa
                        addFaceStatusIndicator(box, 'Rosto detectado', 'unknown');
                    }
                    showRecognitionMessage('Nenhum usuário cadastrado para comparação', null);
                }
            });
        } else {
            // Se não há detecção por um tempo, limpar o último reconhecimento
            if (lastRecognizedName) {
                const now = new Date();
                // Se passaram mais de 2 segundos sem rosto detectado
                if (!lastRecognitionTime || (now - lastRecognitionTime) > 2000) {
                    lastRecognizedName = null;
                    lastRecognitionTime = null;
                    showRecognitionMessage('', null);
                }
            }
        }

    } catch (error) {
        if (window.suppressLogs) return;
        console.error("Erro na detecção:", error);
    }

    isProcessing = false;
    if (isRecognitionActive) {
        requestAnimationFrame(detectFaces);
    }
}

// Função utilitária para detectar olho aberto/fechado
function isEyeOpen(eyePoints) {
    // Cálculo mais robusto: Eye Aspect Ratio (EAR)
    // EAR = (|p2-p6| + |p3-p5|) / (2*|p1-p4|)
    // p1=0, p2=1, p3=2, p4=3, p5=4, p6=5
    const vertical1 = distance(eyePoints[1], eyePoints[5]);
    const vertical2 = distance(eyePoints[2], eyePoints[4]);
    const horizontal = distance(eyePoints[0], eyePoints[3]);
    const EAR = (vertical1 + vertical2) / (2.0 * horizontal);
    return EAR > 0.23; // threshold ajustável, pode testar 0.20~0.25
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

// Adiciona indicador de status acima da caixa de reconhecimento facial
function addFaceStatusIndicator(box, text, status) {
    // Remove indicadores anteriores se existirem
    removeAllFaceStatusIndicators();
    
    // Mostrar o nome apenas se a configuração estiver ativada
    if (!showNameInBox) {
        return;
    }
    
    // Cria um novo elemento de indicador
    const indicator = document.createElement('div');
    indicator.className = `face-status-indicator face-status-${status}`;
    indicator.textContent = text;
    
    // Posiciona ACIMA da caixa de reconhecimento, não sobre a face
    indicator.style.top = `${box.top - 30}px`;
    
    // Centraliza horizontalmente
    indicator.style.left = `${box.left + (box.width / 2) - (indicator.offsetWidth / 2 || 50)}px`;
    indicator.style.width = `${Math.min(box.width * 0.9, 150)}px`;
    
    // Adiciona ao container do canvas
    const canvasContainer = document.querySelector('.canvas-container');
    canvasContainer.appendChild(indicator);
    
    // Ajusta a posição após renderização (para centralizar corretamente)
    setTimeout(() => {
        indicator.style.left = `${box.left + (box.width / 2) - (indicator.offsetWidth / 2)}px`;
    }, 10);
}

function removeAllFaceStatusIndicators() {
    const indicators = document.querySelectorAll('.face-status-indicator');
    indicators.forEach(indicator => indicator.remove());
}

// Funções de controle de interface
async function startRecognition() {
    livenessRequired = true;
    livenessPassed = false;
    smileDetected = false;

    if (!faceApiReady) {
        alert('Os modelos de reconhecimento facial ainda não foram carregados.');
        return;
    }

    try {
        showRecognitionStatus('Iniciando câmera e reconhecimento...', 0);
        startRecognitionButton.style.display = 'none';
        stopRecognitionButton.style.display = 'inline-block';
        
        await startCamera();
        isRecognitionActive = true;
        detectFaces();
        showRecognitionStatus('Reconhecimento facial ativo. Posicione-se em frente à câmera.');
    } catch (error) {
        showRecognitionStatus('Erro ao iniciar reconhecimento: ' + error.message, 0);
        startRecognitionButton.style.display = 'inline-block';
        stopRecognitionButton.style.display = 'none';
    }
}

function stopRecognition() {
    isRecognitionActive = false;
    
    // Mostra a mensagem final de reconhecimento baseada no último usuário reconhecido
    if (lastRecognizedName) {
        const now = new Date();
        const formattedDate = now.toLocaleDateString();
        const formattedTime = now.toLocaleTimeString();
        const formattedDateTime = `${formattedDate}, ${formattedTime}`;
        
        if (lastRecognizedName === 'unknown') {
            showRecognitionMessage(`Usuário não reconhecido em ${formattedDateTime}`, false);
        } else {
            showRecognitionMessage(`Usuário ${lastRecognizedName} reconhecido em ${formattedDateTime}`, true);
        }
    }
    
    showRecognitionStatus('Reconhecimento facial interrompido.');
    stopCamera();
    removeAllFaceStatusIndicators();  // Limpa quaisquer indicadores faciais
    startRecognitionButton.style.display = 'inline-block';
    stopRecognitionButton.style.display = 'none';
}

// Inicialização da aplicação
async function init() {
    try {
        await loadFaceApiModels();
    } catch (error) {
        if (window.suppressLogs) return;
        console.error("Erro na inicialização:", error);
    }
}

// Event Listeners
startRecognitionButton.addEventListener('click', startRecognition);
stopRecognitionButton.addEventListener('click', stopRecognition);

// Gerenciamento de configurações
function initSettings() {
    const thresholdSlider = document.getElementById('matchThreshold');
    const thresholdValueDisplay = document.getElementById('thresholdValue');
    const livenessCheckbox = document.getElementById('livenessCheck');
    const showFaceBoxCheckbox = document.getElementById('showFaceBoxCheck');
    const showNameCheckbox = document.getElementById('showNameCheck');
    const saveSettingsBtn = document.getElementById('saveSettings');
    
    // Carrega configurações do localStorage
    loadSettings();
    
    // Exibe valores iniciais
    thresholdSlider.value = FACE_MATCH_THRESHOLD;
    thresholdValueDisplay.textContent = FACE_MATCH_THRESHOLD;
    livenessCheckbox.checked = livenessRequired;
    showFaceBoxCheckbox.checked = showFaceBox;
    showNameCheckbox.checked = showNameInBox;
    
    // Event listeners
    thresholdSlider.addEventListener('input', function() {
        thresholdValueDisplay.textContent = this.value;
    });
    
    saveSettingsBtn.addEventListener('click', function() {
        FACE_MATCH_THRESHOLD = parseFloat(thresholdSlider.value);
        livenessRequired = livenessCheckbox.checked;
        showFaceBox = showFaceBoxCheckbox.checked;
        showNameInBox = showNameCheckbox.checked;
        
        // Atualiza o matcher com o novo threshold
        if (labeledFaceDescriptors.length > 0) {
            faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, FACE_MATCH_THRESHOLD);
        }
        
        // Salva no localStorage
        saveSettings();
        
        // Feedback visual
        const modalEl = document.getElementById('settingsModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();
        
        showSystemStatus('Configurações salvas com sucesso!');
        setTimeout(hideSystemStatus, 2000);
    });
}

function saveSettings() {
    const settings = {
        faceMatchThreshold: FACE_MATCH_THRESHOLD,
        livenessRequired: livenessRequired,
        showFaceBox: showFaceBox,
        showNameInBox: showNameInBox
    };
    localStorage.setItem('faceRecSettings', JSON.stringify(settings));
}

function loadSettings() {
    try {
        const settings = JSON.parse(localStorage.getItem('faceRecSettings'));
        if (settings) {
            FACE_MATCH_THRESHOLD = settings.faceMatchThreshold || 0.6;
            livenessRequired = settings.livenessRequired !== undefined ? settings.livenessRequired : true;
            showFaceBox = settings.showFaceBox !== undefined ? settings.showFaceBox : true;
            showNameInBox = settings.showNameInBox !== undefined ? settings.showNameInBox : true;
        }
    } catch (e) {
        console.error('Erro ao carregar configurações:', e);
    }
}

// Inicializar o sistema quando a página for carregada
document.addEventListener('DOMContentLoaded', () => {
    init();
    initSettings();
    loadUsersFromLocalStorage();
});