const { Client } = require("pg");

export type PostgresTable = {
  name: string;
  columns: string[];
  data: string[][];
};
export type PostresData = PostgresTable[];

export async function getDataFromPostgres(
  connectionString: string
): Promise<PostresData | undefined> {
  // Create a new PostgreSQL client
  const client = new Client({
    connectionString: connectionString,
  });
  const output = [];

  try {
    // Connect to the PostgreSQL database
    await client.connect();

    // Query to get all table names in the current schema
    const tableQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE';
    `;

    // Fetch all table names
    const tableResult = await client.query(tableQuery);
    const tables = tableResult.rows.map((row: any) => row.table_name);

    // Loop through each table
    for (const tableName of tables) {
      const selectQuery = `SELECT * FROM ${tableName};`;

      // Fetch data from the table
      const dataResult = await client.query(selectQuery);
      const tableData = dataResult.rows;
      output.push({
        name: tableName,
        columns: Object.keys(tableData[0]),
        data: tableData.map((row: any) => Object.values(row)),
      });
    }

    // Disconnect from the database
    await client.end();
    return output;
  } catch (error) {
    console.error("Error:", error);
    await client.end();
  }
}
