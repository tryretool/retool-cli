const fs = require("fs");

const csvParser = require("csv-parser");

export type ParseResult =
  | {
      success: true;
      headers: string[];
      rows: string[][];
    }
  | { success: false; error: string };

export async function parseCSV(csvFile: string): Promise<ParseResult> {
  return new Promise<ParseResult>((resolve) => {
    const rows: string[][] = [];
    let headers: string[] = [];
    let firstRow = true;

    fs.createReadStream(csvFile)
      .pipe(
        csvParser({
          skipEmptyLines: true, // Doesn't seem to work
        })
      )
      .on("error", (error: Error) => {
        resolve({ success: false, error: error.message });
      })
      .on("data", (row: any) => {
        if (Object.keys(row).length > 0) {
          if (firstRow) {
            headers = Object.keys(row);
            firstRow = false;
          }
          rows.push(Object.values(row));
        }
      })
      .on("end", () => {
        resolve({ success: true, headers, rows });
      });
  });
}
