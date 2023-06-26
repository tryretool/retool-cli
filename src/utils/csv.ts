const csvParser = require("csv-parser");
const fs = require("fs");

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
          skipEmptyLines: true,
        })
      )
      .on("error", (error: Error) => {
        resolve({ success: false, error: error.message });
      })
      .on("data", (row: any) => {
        if (firstRow) {
          headers = Object.keys(row);
          firstRow = false;
        }
        rows.push(Object.values(row));
      })
      .on("end", () => {
        resolve({ success: true, headers, rows });
      });
  });
}
