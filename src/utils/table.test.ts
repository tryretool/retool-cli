import { describe, expect, test } from "@jest/globals";

import { parseDBData } from "./table";

describe("parseDBData", () => {
  test("should transform data into expected format", () => {
    const input = `["col_1","col_2","col_3"]\n["val_1","val_2","val_3"]`;
    const expectedOutput = [["col_1","col_2","col_3"],["val_1","val_2","val_3"]];
    expect(parseDBData(input)).toStrictEqual(expectedOutput);
  });

  test("should preserve brackets and \" in data", () => {
    const input = `["col[]_1","col"_2",""col_3]"]`;
    const expectedOutput = [["col[]_1",`col"_2`,`"col_3]`]];
    expect(parseDBData(input)).toStrictEqual(expectedOutput);
  });
});
