pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const pdfUrl = './cuento.pdf';
const zoomLevels = [0.8, 1, 1.25, 1.5];
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
let currentSpeech = null;
let audioContext = null;

function announceScreenReader(message) {
    srStatus.textContent = message;
}

function playPageTurnSound() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        if (!audioContext) {
            audioContext = new AudioCtx();
        }

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.value = 520;
        gainNode.gain.value = 0.04;

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.08);
    } catch (error) {
        console.warn('No se pudo reproducir el sonido de paginación:', error);
    }
}

function updatePageStatus() {
    if (!pdfDoc) {
        pageStatus.textContent = 'Página 1 de 1';
        return;
    }
    pageStatus.textContent = `Página ${currentPage} de ${pdfDoc.numPages}`;
}

async function renderPdfPages(scaleFactor = zoomLevels[zoomIndex]) {
    if (!pdfDoc) return;

    bookContainer.innerHTML = '';
    pageTexts = [];

    const pageWidth = 420 * scaleFactor;
    const pageHeight = 620 * scaleFactor;

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item) => item.str).join(' ').trim();
        pageTexts[pageNum - 1] = text;

        const viewport = page.getViewport({ scale: 1.35 * scaleFactor });
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

    pageFlip = new St.PageFlip(bookContainer, {
        width: pageWidth,
        height: pageHeight,
        size: 'stretch',
        minWidth: 260,
        maxWidth: pageWidth,
        minHeight: 360,
        maxHeight: pageHeight,
        showCover: true,
        maxShadowOpacity: 0.45,
        usePortrait: true,
        startPage: 0
    });

    pageFlip.loadFromHTML(pageElements);
    pageFlip.on('flip', (event) => {
        const newIndex = typeof event.data === 'number' ? event.data : pageFlip.getCurrentPageIndex();
        currentPage = Number(newIndex) + 1;
        updatePageStatus();
        announceScreenReader(`Página ${currentPage} de ${pdfDoc.numPages}`);
    });

    currentPage = 1;
    updatePageStatus();
}

async function loadPdf(url) {
    loading.style.display = 'block';
    bookContainer.classList.remove('visible');
    bookContainer.style.display = 'none';

    try {
        pdfDoc = await pdfjsLib.getDocument(url).promise;
        await renderPdfPages();

        bookContainer.style.display = 'block';
        bookContainer.classList.add('visible');
        loading.style.display = 'none';
        announceScreenReader('Cuento cargado correctamente.');
    } catch (error) {
        console.error('Error al cargar el PDF:', error);
        loading.textContent = 'No se pudo cargar el cuento. Verifica que el archivo cuento.pdf esté en la raíz del repositorio.';
        loading.style.display = 'block';
    }
}

function showIAGDeclaration() {
    declaration.classList.add('visible');
    announceScreenReader('Declaración de uso de IAG: este cuento fue adaptado con apoyo de inteligencia artificial generativa.');
}

function stopReading() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    currentSpeech = null;
    voiceBtn.textContent = 'Leer en voz alta';
}

function readCurrentPage() {
    if (!pdfDoc || !pageTexts[currentPage - 1]) {
        announceScreenReader('No hay texto disponible para leer en esta página.');
        return;
    }

    if ('speechSynthesis' in window) {
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            currentSpeech = null;
            voiceBtn.textContent = 'Leer en voz alta';
            announceScreenReader('Lectura detenida.');
            return;
        }

        const text = pageTexts[currentPage - 1];
        currentSpeech = new SpeechSynthesisUtterance(text);
        currentSpeech.lang = 'es-ES';
        currentSpeech.rate = 0.95;
        currentSpeech.pitch = 1.1;
        currentSpeech.volume = 1;

        currentSpeech.onend = () => {
            voiceBtn.textContent = 'Leer en voz alta';
            currentSpeech = null;

            if (currentPage >= pdfDoc.numPages) {
                showIAGDeclaration();
            }
        };

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(currentSpeech);
        voiceBtn.textContent = 'Pausar lectura';
        announceScreenReader(`Leyendo la página ${currentPage} en español.`);
    } else {
        announceScreenReader('Tu navegador no admite lectura en voz alta.');
    }
}

async function zoomReader(direction) {
    if (!pdfDoc) return;

    const nextIndex = direction === 'in' ? Math.min(zoomLevels.length - 1, zoomIndex + 1) : Math.max(0, zoomIndex - 1);
    if (nextIndex === zoomIndex) return;

    zoomIndex = nextIndex;
    document.documentElement.style.setProperty('--reader-scale', zoomLevels[zoomIndex]);
    await renderPdfPages(zoomLevels[zoomIndex]);
    bookContainer.classList.add('visible');
    announceScreenReader(`Texto ajustado a ${zoomLevels[zoomIndex].toFixed(2)}x.`);
}

function navigatePage(direction) {
    if (!pageFlip || !pdfDoc) return;

    playPageTurnSound();

    if (direction === 'next' && currentPage < pdfDoc.numPages) {
        pageFlip.flipNext();
        currentPage += 1;
        updatePageStatus();
        announceScreenReader(`Página ${currentPage} de ${pdfDoc.numPages}`);
    }

    if (direction === 'prev' && currentPage > 1) {
        pageFlip.flipPrev();
        currentPage -= 1;
        updatePageStatus();
        announceScreenReader(`Página ${currentPage} de ${pdfDoc.numPages}`);
    }
}

voiceBtn.addEventListener('click', readCurrentPage);
zoomInBtn.addEventListener('click', () => zoomReader('in'));
zoomOutBtn.addEventListener('click', () => zoomReader('out'));
nextPageBtn.addEventListener('click', () => navigatePage('next'));
prevPageBtn.addEventListener('click', () => navigatePage('prev'));

loadPdf(pdfUrl);
