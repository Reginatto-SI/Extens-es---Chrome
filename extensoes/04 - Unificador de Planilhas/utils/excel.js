function ensureXlsxLoaded() {
  // Validação explícita de disponibilidade da biblioteca XLSX local.
  if (!window.XLSX) {
    throw new Error("Biblioteca XLSX não carregada corretamente. Verifique se vendor/xlsx.full.min.js existe e está sendo carregado antes de utils/excel.js.");
  }
}

window.ExcelUtils = {
  async readFilesAsRows(files, onProgress) {
    ensureXlsxLoaded();
    const allRows = [];

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const data = await this.readFileAsArrayBuffer(file);
      const workbook = XLSX.read(data, {
        type: "array",
        cellDates: false
      });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: false,
        defval: ""
      });
      allRows.push(...rows);

      // Progresso simples baseado na quantidade de arquivos concluídos.
      if (onProgress) {
        const percent = Math.round(((i + 1) / files.length) * 100);
        onProgress({ current: i + 1, total: files.length, percent, fileName: file.name, rowsCount: rows.length });
      }
    }

    return allRows;
  },

  readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = () => reject(new Error(`Falha ao ler o arquivo: ${file.name}`));
      reader.readAsArrayBuffer(file);
    });
  },

  generateWorkbookFromRows(rows) {
    ensureXlsxLoaded();
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Unificado");
    return workbook;
  },

  downloadWorkbook(workbook, filename) {
    ensureXlsxLoaded();
    XLSX.writeFile(workbook, filename);
  }
};
