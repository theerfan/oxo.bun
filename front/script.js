// Global variables
let pdfDoc = null;

async function renderPDF(pdfBytes) {
    // Convert the byte array to a Uint8Array
    const typedArray = new Uint8Array(pdfBytes);

    // Load the PDF file using pdf.js
    pdfjsLib.getDocument({ data: typedArray }).promise.then(pdf => {
        document.getElementById('pdf-container').innerHTML = ''; // Clear existing content

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const pageContainer = document.createElement('div');
            pageContainer.className = 'page-container';
            document.getElementById('pdf-container').appendChild(pageContainer);

            // Add the page number element
            const pageNumberElement = document.createElement('div');
            pageNumberElement.className = 'page-number';
            pageNumberElement.innerText = `Page ${pageNum}`;
            pageContainer.appendChild(pageNumberElement);

            pdf.getPage(pageNum).then(page => {
                const scale = 1.5;
                const viewport = page.getViewport({ scale: scale });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.id = `page-${pageNum}`;
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                // Center canvas
                canvas.style.marginLeft = 'auto';
                canvas.style.marginRight = 'auto';
                canvas.style.display = 'block';

                pageContainer.appendChild(canvas);

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };
                page.render(renderContext);
            });
        }

        pdf.getOutline().then(outline => {
            const bookmarksContainer = document.getElementById('bookmarks-container');
            bookmarksContainer.innerHTML = ''; // Clear previous bookmarks
            renderBookmarks(outline, bookmarksContainer, pdf);
        });
    });
}

document.getElementById('file-input').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file.type !== 'application/pdf') {
        console.error(file.name, 'is not a pdf file.');
        return;
    }

    const arrayBuffer = await file.arrayBuffer();
    pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
    const pdfBytes = await pdfDoc.save();
    renderPDF(pdfBytes);
});

document.getElementById('delete-page').addEventListener('click', async () => {
    const pageNumber = parseInt(document.getElementById('page-number').value);
    if (pageNumber > 0 && pageNumber <= pdfDoc.getPageCount()) {
        pdfDoc.removePage(pageNumber - 1);
        const pdfBytes = await pdfDoc.save();

        renderPDF(pdfBytes);

        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const downloadLink = document.getElementById('download-link');
        downloadLink.href = url;
        downloadLink.download = 'modified_document.pdf';
        downloadLink.style.display = 'block';
        downloadLink.textContent = 'Download Modified PDF';
    } else {
        alert('Invalid page number');
    }
});

document.getElementById('insert-blank-page').addEventListener('click', async () => {
    const insertAt = parseInt(document.getElementById('insert-page-number').value);
    if (insertAt > 0 && insertAt <= pdfDoc.getPageCount() + 1) {
        // Create a blank page. You can set the size as needed (default is A4)
        const blankPage = pdfDoc.insertPage(insertAt - 1, PDFLib.PageSizes.Letter);
        const pdfBytes = await pdfDoc.save();

        renderPDF(pdfBytes);

        // Update download link
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const downloadLink = document.getElementById('download-link');
        downloadLink.href = url;
        downloadLink.download = 'modified_document.pdf';
        downloadLink.style.display = 'block';
        downloadLink.textContent = 'Download Modified PDF';
    } else {
        alert('Invalid page number for insertion');
    }
});

document.getElementById('rotate-page').addEventListener('click', async () => {
    const rotationDegrees = parseInt(document.getElementById('rotation-degree').value);
    const currentPageNumber = getCurrentPageinView();
    console.log(currentPageNumber);

    if (currentPageNumber > 0 && currentPageNumber <= pdfDoc.getPageCount()) {
        const page = pdfDoc.getPage(currentPageNumber - 1);
        const currentRotation = page.getRotation().angle;
        page.setRotation(PDFLib.degrees(currentRotation + rotationDegrees));

        const pdfBytes = await pdfDoc.save();
        renderPDF(pdfBytes);

        // Update download link
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const downloadLink = document.getElementById('download-link');
        downloadLink.href = url;
        downloadLink.download = 'modified_document.pdf';
        downloadLink.style.display = 'block';
        downloadLink.textContent = 'Download Modified PDF';
    } else {
        alert('Invalid page number for rotation');
    }
});


function getCurrentPageinView() {
    console.log("here");
    const container = document.getElementById('pdf-container');
    const children = container.children;
    let maxVisibleHeight = 0;
    let mostVisiblePage = 0;

    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const rect = child.getBoundingClientRect();

        // Calculate the visible height of the page
        const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);

        // Update the most visible page
        if (visibleHeight > maxVisibleHeight) {
            mostVisiblePage = i + 1
        }
    }
    return mostVisiblePage;
}


function renderBookmarks(bookmarks, container, pdfDoc, level = 0) {
    if (!bookmarks || bookmarks.length === 0) {
        return;
    }

    const list = document.createElement('ul');
    list.style.paddingLeft = `${level * 20}px`; // Indentation for nested bookmarks
    container.appendChild(list);

    bookmarks.forEach(bookmark => {
        const item = document.createElement('li');
        item.textContent = bookmark.title;
        list.appendChild(item);

        // Make the bookmark item clickable
        item.style.cursor = 'pointer';
        item.onclick = async () => {
            if (bookmark.dest) {
                const pageRef = bookmark.dest[0];
                // Resolve the destination and navigate to the specific page
                // const destination = await pdfDoc.getDestination(dest);
                const pageIndex = await pdfDoc.getPageIndex(pageRef);
                document.getElementById('page-' + (pageIndex + 1)).scrollIntoView({ behavior: 'smooth' });
            }
        };

        // Render any child bookmarks
        if (bookmark.items && bookmark.items.length > 0) {
            renderBookmarks(bookmark.items, container, pdfDoc, level + 1);
        }
    });
}

// Function to crop a page in a PDF
// pageToCrop: the 0-indexed page number to crop
// cropRect: { x, y, width, height } defines the crop rectangle
// pdfDoc: an instance of PDFDocument from pdf-lib

async function cropPage(pageToCrop, cropRect, pdfDoc) {
    // Get the page
    const page = pdfDoc.getPages()[pageToCrop];

    // Calculate the new crop box
    const cropBox = [
        cropRect.x,
        page.getHeight() - cropRect.y - cropRect.height,
        cropRect.x + cropRect.width,
        page.getHeight() - cropRect.y
    ];

    // Set the crop box
    page.setCropBox(cropBox[0], cropBox[1], cropBox[2], cropBox[3]);

    // Serialize the PDFDocument to bytes (a Uint8Array)
    return await pdfDoc.save();
}


document.getElementById('crop-page').addEventListener('click', async () => {
    // Retrieve values from form
    const pageNumber = parseInt(document.getElementById('crop-page-number').value, 10) - 1; // Convert to 0-index
    const x = parseFloat(document.getElementById('crop-x').value);
    const y = parseFloat(document.getElementById('crop-y').value);
    const width = parseFloat(document.getElementById('crop-width').value);
    const height = parseFloat(document.getElementById('crop-height').value);

    // Ensure valid inputs
    if (pageNumber >= 0 && x >= 0 && y >= 0 && width > 0 && height > 0) {
        // Call the cropPage function (assuming pdfDoc is your loaded PDFDocument instance)
        try {
            const croppedPdfBytes = await cropPage(pageNumber, { x, y, width, height }, pdfDoc);

            // Do something with the cropped PDF, e.g., display or download it
            // For example, to download the cropped PDF:
            const blob = new Blob([croppedPdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'cropped_document.pdf';
            link.click();
        } catch (error) {
            console.error('Error cropping page:', error);
        }
    } else {
        alert('Please enter valid crop dimensions.');
    }
});
