const inquirer = require("inquirer");

export async function collectTableName(): Promise<string> {
  const { tableName } = await inquirer.prompt([
    {
      name: "tableName",
      message: "Table name?",
      type: "input",
    },
  ]);

  if (tableName.length === 0) {
    console.log("Error: Table name cannot be blank.");
    process.exit(1);
  }

  // Remove spaces from table name.
  return tableName.replace(/\s/g, "_");
}

export async function collectColumnNames(): Promise<string[]> {
  const columnNames: string[] = [];
  let columnName = await collectColumnName();
  while (columnName.length > 0) {
    columnNames.push(columnName);
    columnName = await collectColumnName();
  }
  return columnNames;
}

async function collectColumnName(): Promise<string> {
  const { columnName } = await inquirer.prompt([
    {
      name: "columnName",
      message: "Column name? Leave blank to finish.",
      type: "input",
    },
  ]);

  // Remove spaces from column name.
  return columnName.replace(/\s/g, "_");
}
