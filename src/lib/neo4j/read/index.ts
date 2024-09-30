import { Driver, Session } from "neo4j-driver";

export async function tknExists(
  driver: Driver,
  label: string,
  propertyName: string,
  propertyValue: any
): Promise<boolean> {
  const session: Session = driver.session();

  try {
    const query = `
      MATCH (n:${label} {${propertyName}: $value})
      RETURN COUNT(n) > 0 AS exists
    `;

    const result = await session.run(query, { value: propertyValue });
    return result.records[0].get("exists");
  } finally {
    await session.close();
  }
}
