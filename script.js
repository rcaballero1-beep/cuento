pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const pdfUrl = './cuento.pdf';
const zoomLevels = [0.85, 1, 1.2, 1.4];
const bookContainer = document.getElementById('flip-book');
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
let pageFlip = null;
let currentPage = 1;
let zoomIndex = 1;
let pageTexts = [];
let audioContext = null;
let isReading = false;

// Anuncio exclusivo para lectores de pantalla
function announceScreenReader(message) {
    srStatus.textContent = '';
    setTimeout(() => {
        srStatus.textContent = message;
    }, 50);
}

// Reproducción del efecto de sonido de página
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
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(150, audioContext.currentTime + 0.12);

        gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.12);

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.12);
    } catch (error) {
        console.warn('Efecto de sonido no disponible:', error);
    }
}

function updatePageStatus() {
    if (!pdfDoc) return;
    pageStatus.textContent = `Página ${currentPage} de ${pdfDoc.numPages}`;
}

async function renderPdfPages() {
    if (!pdfDoc) return;

    bookContainer.innerHTML = '';
    pageTexts = [];

    const baseWidth = 450;
    const baseHeight = 600;

    // Procesar cada página individualmente del PDF
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Guardar el texto de CADA página en su posición exacta
        const text = textContent.items.map((item) => item.str).join(' ').trim();
        pageTexts[pageNum - 1] = text;

        const viewport = page.getViewport({ scale: 1.4 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport }).promise;

        const pageDiv = document.createElement('div');
        pageDiv.className = 'page';
        pageDiv.setAttribute('aria-label', `Página ${pageNum}`);
        pageDiv.appendChild(canvas);
        bookContainer.appendChild(pageDiv);
    }

    const pageElements = Array.from(bookContainer.querySelectorAll('.page'));

    if (pageFlip) {
        pageFlip.destroy();
        pageFlip = null;
    }

    // Configuración clave: modo de una sola página ("single") para pasar de 1 en 1
    pageFlip = new St.PageFlip(bookContainer, {
        width: baseWidth,
        height: baseHeight,
        size: 'fixed',
        minWidth: 300,
        maxWidth: 600,
        minHeight: 400,
        maxHeight: 800,
        showCover: false,
        usePortrait: true,
        startPage: 0,
        mode: 'single' // Fuerza el paso de 1 sola página consecutiva a la vez
    });

    pageFlip.loadFromHTML(pageElements);

    // Evento al pasar la página
    pageFlip.on('flip', (event) => {
        const newIndex = typeof event.data === 'number' ? event.data : pageFlip.getCurrentPageIndex();
        currentPage = Number(newIndex) + 1;
        updatePageStatus();
        announceScreenReader(`Página ${currentPage} de ${pdfDoc.numPages}`);
        
        if (currentPage === pdfDoc.numPages) {
            showIAGDeclaration();
        }
    });

    updatePageStatus();
}

async function loadPdf(url) {
    loading.style.display = 'block';
    bookContainer.classList.remove('visible');

    try {
        pdfDoc = await pdfjsLib.getDocument(url).promise;
        await renderPdfPages();

        bookContainer.classList.add('visible');
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
    announceScreenReader('Declaración de uso de Inteligencia Artificial Generativa disponible al final del documento.');
}

function stopReading() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    isReading = false;
    voiceBtn.textContent = '🔊 Leer en voz alta';
}

// Lectura en voz alta de la página actual
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

    // Se obtiene el texto exclusivo de la página activa (1 en 1)
    const fullText = pageTexts[currentPage - 1];
    
    // División en oraciones por puntos o signos para realizar pausas adaptadas
    const sentences = fullText.match(/[^.!?]+[.!?]+/g) || [fullText];

    isReading = true;
    voiceBtn.textContent = '⏹️ Detener lectura';
    announceScreenReader(`Leyendo la página ${currentPage}.`);

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
        utterance.rate = 0.88; // Velocidad pausada para alumnos con baja visión
        utterance.pitch = 1.0;

        utterance.onend = () => {
            index++;
            // Pausa breve de 400ms tras cada oración
            setTimeout(() => {
                if (isReading) speakNextSentence();
            }, 400);
        };

        utterance.onerror = () => {
            stopReading();
        };

        window.speechSynthesis.speak(utterance);
    }

    window.speechSynthesis.cancel();
    speakNextSentence();
}

// Zoom adaptado para baja visión
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

// Navegación individual por cada página
function navigatePage(direction) {
    if (!pageFlip || !pdfDoc) return;

    if (isReading) stopReading();
    playPageTurnSound();

    if (direction === 'next' && currentPage < pdfDoc.numPages) {
        pageFlip.flipNext();
    } else if (direction === 'prev' && currentPage > 1) {
        pageFlip.flipPrev();
    }
}

// Event Listeners
voiceBtn.addEventListener('click', readCurrentPage);
zoomInBtn.addEventListener('click', () => adjustTextZoom('in'));
zoomOutBtn.addEventListener('click', () => adjustTextZoom('out'));
nextPageBtn.addEventListener('click', () => navigatePage('next'));
prevPageBtn.addEventListener('click', () => navigatePage('prev'));

// Cargar el PDF alojado en el repositorio
loadPdf(pdfUrl);