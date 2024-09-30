import { Driver, Session, ManagedTransaction } from "neo4j-driver";

export async function insertTkn(
  driver: Driver,
  value: number,
  connectToValues: number[]
): Promise<boolean> {
  const session: Session = driver.session();

  try {
    return await session.executeWrite(async (tx: ManagedTransaction) => {
      const query = `
        MERGE (n:tkn {value: $value})
        WITH n
        UNWIND $connectToValues AS connectValue
        MATCH (m:tkn {value: connectValue})
        MERGE (n)-[:CONNECTED_TO]->(m)
        RETURN n, n.value = $value AS wasCreated
      `;

      const result = await tx.run(query, { value, connectToValues });
      const wasCreated = result.records[0].get("wasCreated");

      console.log(
        `Node with value ${value} ${
          wasCreated ? "created" : "already existed"
        } and connected successfully.`
      );
      return wasCreated;
    });
  } finally {
    await session.close();
  }
}
