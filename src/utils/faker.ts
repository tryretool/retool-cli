import { faker } from "@faker-js/faker/locale/en_US";

import { RetoolDBField } from "../commands/db";

// Generate `rowCount` rows for each field in `fields`.
export function generateData(
  fields: Array<RetoolDBField>,
  rowCount: number,
  primaryKeyColumnName: string,
  primaryKeyMaxVal: number
): {
  data: string[][]; // rows
  fields: string[]; // column names
} {
  const column_names = fields.map((field) => field.name);
  const rows: string[][] = [];
  // Init rows
  for (let j = 0; j < rowCount; j++) {
    rows.push([]);
  }

  for (let i = 0; i < fields.length; i++) {
    for (let j = 0; j < rowCount; j++) {
      // Handle primary key column.
      if (fields[i].name === primaryKeyColumnName) {
        rows[j].push((primaryKeyMaxVal + j + 1).toString());
      } else {
        rows[j].push(generateDataForColumn(fields[i]));
      }
    }
  }

  return {
    data: rows,
    fields: column_names,
  };
}

function generateDataForColumn(field: RetoolDBField): string {
  switch (field.generatedColumnType) {
    case "name":
      return faker.person.fullName();
    case "address":
      return faker.location.streetAddress();
    case "phone":
      return faker.phone.number();
    case "email":
      return faker.internet.email();
    case "date":
      return faker.date.recent().toString();
    case "lorem":
      return faker.lorem.sentence(5);
    case "randomNumber":
      return faker.number.int(1000).toString();
    default:
      return "";
  }
}
