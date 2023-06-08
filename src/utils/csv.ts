const csvParser = require("csv-parser");
const fs = require("fs");

export type ParseResult =
  | {
      success: true;
      headers: string[];
      rows: string[][];
    }
  | { success: false; error: string };

//TODO: Error handling??
export async function parseCSV(csvFile: string): Promise<ParseResult> {
  return new Promise<ParseResult>((resolve) => {
    const rows: string[][] = [];
    let headers: string[] = [];

    fs.createReadStream(csvFile)
      .pipe(
        csvParser({
          skipEmptyLines: true,
        })
      )
      // @ts-ignore
      .on("data", (row) => {
        //TODO: This is dumb, resaving headers every time. Fix this.
        headers = Object.keys(row);
        rows.push(Object.values(row));
      })
      .on("end", () => {
        resolve({ success: true, headers, rows });
      });
  });
}
