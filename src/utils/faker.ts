import { RetoolDBField } from "./table";

const inquirer = require("inquirer");
const TreePrompt = require("inquirer-tree-prompt");

// Generate `rowCount` rows for each field in `fields`.
export async function generateData(
  fields: Array<RetoolDBField>,
  rowCount: number,
  primaryKeyColumnName: string,
  primaryKeyMaxVal: number
): Promise<{
  data: string[][]; // rows
  fields: string[]; // column names
}> {
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
        rows[j].push(
          await generateDataForColumnType(fields[i].generatedColumnType)
        );
      }
    }
  }

  return {
    data: rows,
    fields: column_names,
  };
}

// Each colType string is an option in `promptForDataType()`
async function generateDataForColumnType(
  colType: string | undefined
): Promise<string> {
  // Faker is slow, dynamically import it.
  return import("@faker-js/faker/locale/en_US").then(({ faker }) => {
    if (colType === "First Name") {
      return faker.person.firstName();
    } else if (colType === "Last Name") {
      return faker.person.lastName();
    } else if (colType === "Full Name" || colType === "Person") {
      return faker.person.fullName();
    } else if (colType === "Phone Number") {
      return faker.phone.number();
    } else if (colType === "Email") {
      return faker.internet.email();
    } else if (colType === "Birthdate") {
      return faker.date.birthdate().toString();
    } else if (colType === "Gender") {
      return faker.person.gender();
    } else if (colType === "Street Address" || colType === "Location") {
      return faker.location.streetAddress();
    } else if (colType === "City") {
      return faker.location.city();
    } else if (colType === "State") {
      return faker.location.state();
    } else if (colType === "Zip Code") {
      return faker.location.zipCode();
    } else if (colType === "Country") {
      return faker.location.country();
    } else if (colType === "Country Code") {
      return faker.location.countryCode();
    } else if (colType === "Timezone") {
      return faker.location.timeZone();
    } else if (colType === "Past" || colType === "Date") {
      return faker.date.past().toString();
    } else if (colType === "Future") {
      return faker.date.future().toString();
    } else if (colType === "Month") {
      return faker.date.month();
    } else if (colType === "Weekday") {
      return faker.date.weekday();
    } else if (colType === "Unix Timestamp") {
      return faker.date.past().getTime().toString();
    } else if (colType === "Number" || colType === "Random") {
      return faker.number.int(10000).toString();
    } else if (colType === "String") {
      return faker.string.alpha(5);
    } else if (colType === "Boolean") {
      return faker.datatype.boolean().toString();
    } else if (colType === "Word") {
      return faker.word.words(1);
    } else if (colType === "Lorem Ipsum") {
      return faker.lorem.sentence(5);
    } else if (colType === "Bitcoin Address") {
      return faker.finance.bitcoinAddress();
    } else {
      return faker.string.alpha(5);
    }
  });
}

// Each option should have a corresponding case in `generateDataForColumnType()`
export async function promptForDataType(fieldName: string): Promise<string> {
  inquirer.registerPrompt("tree", TreePrompt);
  const { generatedType } = await inquirer.prompt([
    {
      type: "tree",
      name: "generatedType",
      message: `What type of data to generate for ${fieldName}?`,
      tree: [
        {
          name: "Person",
          children: [
            "First Name",
            "Last Name",
            "Full Name",
            "Phone Number",
            "Email",
            "Birthdate",
            "Gender",
          ],
        },
        {
          value: "Location",
          children: [
            "Street Address",
            "City",
            "State",
            "Zip Code",
            "Country",
            "Country Code",
            "Timezone",
          ],
        },
        {
          value: "Date",
          children: ["Past", "Future", "Month", "Weekday", "Unix Timestamp"],
        },
        {
          value: "Random",
          children: [
            "Number",
            "String",
            "Boolean",
            "Word",
            "Lorem Ipsum",
            "Bitcoin Address",
          ],
        },
      ],
    },
  ]);
  console.log(generatedType);
  return generatedType;
}
