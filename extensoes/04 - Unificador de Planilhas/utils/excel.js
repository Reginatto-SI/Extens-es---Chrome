function ensureXlsxLoaded() {
  // Validação explícita de disponibilidade da biblioteca XLSX local.
  if (!window.XLSX) {
    throw new Error("Biblioteca XLSX não carregada corretamente. Verifique se vendor/xlsx.full.min.js existe e está sendo carregado antes de utils/excel.js.");
  }
}

function normalizeHeaderCell(value) {
  return String(value ?? "").trim();
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

  getHeaderRowFromWorksheet(worksheet, headerRowIndex) {
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      defval: ""
    });
    const headerRow = rows[headerRowIndex] || [];
    return headerRow.map(normalizeHeaderCell);
  },

  compareHeaders(referenceHeader, currentHeader) {
    const expectedColumns = referenceHeader.length;
    const foundColumns = currentHeader.length;
    const maxLength = Math.max(expectedColumns, foundColumns);
    const differences = [];

    for (let i = 0; i < maxLength; i += 1) {
      const expected = referenceHeader[i] ?? "";
      const found = currentHeader[i] ?? "";

      if (i >= expectedColumns && found) {
        differences.push({ index: i, expected: "", found, type: "extra" });
      } else if (i >= foundColumns && expected) {
        differences.push({ index: i, expected, found: "", type: "missing" });
      } else if (expected !== found) {
        differences.push({ index: i, expected, found, type: "different" });
      }
    }

    return {
      valid: differences.length === 0,
      expectedColumns,
      foundColumns,
      differences
    };
  },

  async validateFilesHeaders(files, headerRowNumber, onLog) {
    ensureXlsxLoaded();
    const headerRowIndex = headerRowNumber - 1;
    const invalidFiles = [];
    let referenceHeader = [];

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const data = await this.readFileAsArrayBuffer(file);
      const workbook = XLSX.read(data, { type: "array", cellDates: false });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const currentHeader = this.getHeaderRowFromWorksheet(worksheet, headerRowIndex);

      if (i === 0) {
        referenceHeader = currentHeader;
        onLog?.(`Arquivo referência: ${file.name}`);
        onLog?.(`Linha de cabeçalho configurada: ${headerRowNumber}`);
        onLog?.(`Quantidade de colunas do arquivo referência: ${referenceHeader.length}`);
        continue;
      }

      const comparison = this.compareHeaders(referenceHeader, currentHeader);
      if (comparison.valid) {
        onLog?.(`${file.name} validado com sucesso.`, "success");
      } else {
        const firstDifference = comparison.differences[0];
        const position = firstDifference ? firstDifference.index + 1 : 0;
        onLog?.(`${file.name} fora do padrão: divergência na coluna ${position}.`, "error");
        comparison.differences.forEach((difference) => {
          const columnPosition = difference.index + 1;
          if (difference.type === "different") {
            onLog?.(`Divergência na coluna ${columnPosition}: esperado "${difference.expected}" e encontrado "${difference.found}".`);
          } else if (difference.type === "extra") {
            onLog?.(`Coluna extra encontrada na posição ${columnPosition}: ${difference.found}.`);
          } else {
            onLog?.(`Coluna ausente na posição ${columnPosition}. Esperado: ${difference.expected}.`);
          }
        });

        invalidFiles.push({
          fileName: file.name,
          result: comparison
        });
      }
    }

    return {
      valid: invalidFiles.length === 0,
      invalidFiles,
      headerRowNumber
    };
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
