const MODELS_PATH = './models/';
const FACE_MATCH_THRESHOLD = 0.6;
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

// Estado da aplicação
let currentStream = null;
let faceApiReady = false;
let isProcessing = false;
let isRecognitionActive = false;
let labeledFaceDescriptors = [];
let faceMatcher = null;
let recognitionTimer = null;
let statusTimer = null;

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
    recognitionMessageElement.textContent = message;
    recognitionMessageElement.classList.remove('recognized', 'not-recognized');
    
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

// Gerenciamento de faces cadastradas
function updateFaceMatcher() {
    if (labeledFaceDescriptors.length > 0) {
        faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, FACE_MATCH_THRESHOLD);
        console.log("Face matcher atualizado com:", labeledFaceDescriptors.map(ld => ld.label));
    } else {
        faceMatcher = null;
    }
}

function removeFace(name, element) {
    labeledFaceDescriptors = labeledFaceDescriptors.filter(fd => fd.label !== name);
    updateFaceMatcher();
    element.remove();
    showCadastroStatus(`Usuário ${name} removido com sucesso!`);
}

// Inicialização de modelos e câmera
async function loadFaceApiModels() {
    showSystemStatus('Carregando modelos de reconhecimento facial...');
    try {
        window.removeFace = removeFace;

        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_PATH),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_PATH),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_PATH)
        ]);

        faceApiReady = true;
        console.log('Modelos Face-API carregados!');
        hideSystemStatus();
    } catch (error) {
        console.error('Erro ao carregar modelos Face-API:', error);
        showSystemStatus(`Erro ao carregar modelos faciais: ${error.message}`);
        alert(`Erro ao carregar modelos faciais: ${error.message}. Verifique se os modelos estão na pasta: ${MODELS_PATH}`);
        throw error;
    }
}

async function startCamera() {
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
                console.log(`Canvas dimensionado para: ${canvas.width}x${canvas.height}`);
                resolve();
            };
        });
    } catch (err) {
        console.error("Erro ao acessar a webcam: ", err);
        showRecognitionStatus('Erro ao acessar a câmera. Verifique as permissões.', 0);
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
            .withFaceDescriptors();

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        if (detections.length > 0) {
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
                            lastRecognizedName = label;
                            lastRecognitionTime = now;
                        }
                    }

                    const drawBox = new faceapi.draw.DrawBox(box, { 
                        label: label,
                        boxColor: label === 'unknown' ? 'red' : 'green'
                    });
                    drawBox.draw(canvas);
                } else {
                    // Se não há faces cadastradas, apenas mostra a detecção
                    const drawBox = new faceapi.draw.DrawBox(box, { 
                        label: 'Rosto detectado',
                        boxColor: 'blue'
                    });
                    drawBox.draw(canvas);
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
        console.error("Erro na detecção:", error);
    }

    isProcessing = false;
    if (isRecognitionActive) {
        requestAnimationFrame(detectFaces);
    }
}

// Funções de controle de interface
async function startRecognition() {
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
    showRecognitionMessage('', null);
    showRecognitionStatus('Reconhecimento facial interrompido.');
    stopCamera();
    startRecognitionButton.style.display = 'inline-block';
    stopRecognitionButton.style.display = 'none';
}

// Inicialização da aplicação
async function init() {
    try {
        await loadFaceApiModels();
    } catch (error) {
        console.error("Erro na inicialização:", error);
    }
}

// Event Listeners
registerFaceButton.addEventListener('click', registerFaceFromImage);
startRecognitionButton.addEventListener('click', startRecognition);
stopRecognitionButton.addEventListener('click', stopRecognition);

// Inicializar o sistema quando a página for carregada
document.addEventListener('DOMContentLoaded', init);