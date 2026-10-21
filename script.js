pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const pdfUrl = './cuento.pdf';
const zoomLevels = [0.85, 1, 1.2, 1.4];

const canvas = document.getElementById('pdf-canvas');
const ctx = canvas.getContext('2d');
const pageViewer = document.getElementById('page-viewer');

const loading = document.getElementById('loading');
const pageStatus = document.getElementById('page-status');
const srStatus = document.getElementById('sr-status');
const declaration = document.getElementById('declaracion-iag');

const voiceBtn = document.getElementById('voice-btn');
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');

let pdfDoc = null;
let currentPage = 1;
let zoomIndex = 1;
let pageTexts = [];
let audioContext = null;
let isReading = false;

// Anuncio para lectores de pantalla
function announceScreenReader(message) {
    srStatus.textContent = '';
    setTimeout(() => {
        srStatus.textContent = message;
    }, 50);
}

// Reproducción de sonido sutil al cambiar de página
function playPageTurnSound() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        if (!audioContext) {
            audioContext = new AudioCtx();
        }

        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(350, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(180, audioContext.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.06, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
        console.warn('Efecto de sonido no disponible:', error);
    }
}

function updatePageStatus() {
    if (!pdfDoc) return;
    pageStatus.textContent = `Página ${currentPage} de ${pdfDoc.numPages}`;
}

// Renderiza una sola página en el canvas
async function renderPage(pageNum) {
    if (!pdfDoc) return;

    pageViewer.classList.add('fade');

    setTimeout(async () => {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };

        await page.render(renderContext).promise;

        pageViewer.classList.remove('fade');
        updatePageStatus();
        announceScreenReader(`Página ${currentPage} de ${pdfDoc.numPages}`);

        if (currentPage === pdfDoc.numPages) {
            showIAGDeclaration();
        }
    }, 150);
}

// Extrae el texto de todas las páginas para la lectura en voz alta
async function extractAllTexts() {
    pageTexts = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item) => item.str).join(' ').trim();
        pageTexts.push(text);
    }
}

async function loadPdf(url) {
    loading.style.display = 'block';

    try {
        pdfDoc = await pdfjsLib.getDocument(url).promise;
        await extractAllTexts();
        await renderPage(currentPage);

        loading.style.display = 'none';
        announceScreenReader('Cuento "La niña que guardaba los sueños perdidos" cargado correctamente.');
    } catch (error) {
        console.error('Error al cargar el PDF:', error);
        loading.textContent = 'No se encontró el archivo "cuento.pdf" en el repositorio. Asegúrate de colocarlo en la raíz.';
        loading.style.display = 'block';
    }
}

function showIAGDeclaration() {
    declaration.classList.add('visible');
}

function stopReading() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    isReading = false;
    voiceBtn.textContent = '🔊 Leer en voz alta';
}

// Lectura en voz alta oración por oración con pausas
function readCurrentPage() {
    if (!pdfDoc || !pageTexts[currentPage - 1]) {
        announceScreenReader('No hay texto disponible en esta página para leer.');
        return;
    }

    if (!('speechSynthesis' in window)) {
        announceScreenReader('Tu navegador no soporta la función de lectura en voz alta.');
        return;
    }

    if (isReading) {
        stopReading();
        announceScreenReader('Lectura en voz alta detenida.');
        return;
    }

    const fullText = pageTexts[currentPage - 1];
    const sentences = fullText.match(/[^.!?]+[.!?]+/g) || [fullText];

    isReading = true;
    voiceBtn.textContent = '⏹️ Detener lectura';
    announceScreenReader(`Iniciando lectura de la página ${currentPage}.`);

    let index = 0;

    function speakNextSentence() {
        if (!isReading || index >= sentences.length) {
            stopReading();
            if (currentPage >= pdfDoc.numPages) {
                showIAGDeclaration();
            }
            return;
        }

        const sentence = sentences[index].trim();
        if (sentence.length === 0) {
            index++;
            speakNextSentence();
            return;
        }

        const utterance = new SpeechSynthesisUtterance(sentence);
        utterance.lang = 'es-ES';
        utterance.rate = 0.88; // Velocidad pausada para baja visión
        utterance.pitch = 1.0;

        utterance.onend = () => {
            index++;
            setTimeout(() => {
                if (isReading) speakNextSentence();
            }, 400); // Pausa de 400ms por oración
        };

        utterance.onerror = () => {
            stopReading();
        };

        window.speechSynthesis.speak(utterance);
    }

    window.speechSynthesis.cancel();
    speakNextSentence();
}

function adjustTextZoom(direction) {
    if (direction === 'in') {
        zoomIndex = Math.min(zoomLevels.length - 1, zoomIndex + 1);
    } else {
        zoomIndex = Math.max(0, zoomIndex - 1);
    }

    const scale = zoomLevels[zoomIndex];
    document.documentElement.style.setProperty('--text-scale', scale);
    announceScreenReader(`Tamaño de texto ajustado al ${Math.round(scale * 100)}%.`);
}

function navigatePage(direction) {
    if (!pdfDoc) return;

    if (isReading) stopReading();

    if (direction === 'next' && currentPage < pdfDoc.numPages) {
        currentPage++;
        playPageTurnSound();
        renderPage(currentPage);
    } else if (direction === 'prev' && currentPage > 1) {
        currentPage--;
        playPageTurnSound();
        renderPage(currentPage);
    }
}

// Event Listeners
voiceBtn.addEventListener('click', readCurrentPage);
zoomInBtn.addEventListener('click', () => adjustTextZoom('in'));
zoomOutBtn.addEventListener('click', () => adjustTextZoom('out'));
nextPageBtn.addEventListener('click', () => navigatePage('next'));
prevPageBtn.addEventListener('click', () => navigatePage('prev'));

// Cargar cuento local
loadPdf(pdfUrl);