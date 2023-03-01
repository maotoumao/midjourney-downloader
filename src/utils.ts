function saveFile(content: Blob, fileName: string) {
    const link = document.createElement('a');
    link.style.display = 'none';
    link.download = fileName;
    link.href = URL.createObjectURL(content);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function getUrlBlob(url: string) {
    try {
        const res = await fetch(url);
        return res.blob();
    } catch {
        return null;
    }
}

export {saveFile, getUrlBlob}