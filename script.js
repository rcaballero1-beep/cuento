// Configuramos la ruta del worker de PDF.js (necesario para procesar el PDF)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const uploadInput = document.getElementById('pdf-upload');
const bookContainer = document.getElementById('flip-book');
const loading = document.getElementById('loading');
let pageFlip = null;

uploadInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
        const fileReader = new FileReader();
        
        fileReader.onload = function() {
            const typedarray = new Uint8Array(this.result);
            loadPDF(typedarray); // Llamamos a la función que procesa el PDF
        };
        
        fileReader.readAsArrayBuffer(file);
    }
});

async function loadPDF(pdfData) {
    loading.style.display = 'block';
    bookContainer.style.display = 'none';
    bookContainer.innerHTML = ''; // Limpiar el contenedor si había un libro anterior
    
    // Si ya existe un libro cargado, lo destruimos para crear uno nuevo
    if (pageFlip) {
        pageFlip.destroy();
        pageFlip = null;
    }

    try {
        // Cargar el documento PDF
        const pdf = await pdfjsLib.getDocument(pdfData).promise;
        const totalPages = pdf.numPages;
        
        // Obtenemos el tamaño de la primera página para dimensionar el libro
        const firstPage = await pdf.getPage(1);
        const viewportInfo = firstPage.getViewport({ scale: 1.5 });
        const pageWidth = viewportInfo.width;
        const pageHeight = viewportInfo.height;

        // Bucle para procesar cada página del PDF
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.5 });
            
            // Creamos un canvas donde PDF.js "dibujará" la página
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            // Renderizamos la página y esperamos a que termine
            await page.render(renderContext).promise;
            
            // Creamos el 'div' que representará la hoja de papel y le metemos el canvas
            const pageDiv = document.createElement('div');
            pageDiv.className = 'page';
            pageDiv.appendChild(canvas);
            
            // Agregamos la hoja al contenedor principal
            bookContainer.appendChild(pageDiv);
        }

        // Una vez que están todas las hojas, inicializamos el efecto de Flipbook
        bookContainer.style.display = 'block';
        
        pageFlip = new St.PageFlip(bookContainer, {
            width: pageWidth,
            height: pageHeight,
            size: "stretch", // Para que sea responsivo
            minWidth: 315,
            maxWidth: pageWidth,
            minHeight: 420,
            maxHeight: pageHeight,
            showCover: true,
            maxShadowOpacity: 0.5,
            usePortrait: true // Habilita ver 1 sola página si la pantalla es chica (celulares)
        });

        // Cargamos todas las páginas que acabamos de crear en el HTML
        const pages = document.querySelectorAll('.page');
        pageFlip.loadFromHTML(pages);
        
        loading.style.display = 'none';
        
    } catch (error) {
        console.error('Error al cargar el PDF:', error);
        loading.innerText = 'Error al procesar el PDF. Revisa la consola para más detalles.';
    }
}