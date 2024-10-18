import { Driver } from "neo4j-driver";

export async function getTopTkns(driver: Driver, topPct: number) {
  const session = driver.session();

  // Start a transaction
  const tx = session.beginTransaction();
  try {
    // Step 1: Project the graph
    await tx.run(`
      MATCH (source:Tkn)-[r:PRECEDES]->(target:Tkn)
      RETURN gds.graph.project(
        'tkns',
        source,
        target,
        { relationshipProperties: r { .idx } }
      )
    `);

    // Step 2: Estimate memory requirements for PageRank
    await tx.run(`
      CALL gds.pageRank.write.estimate('tkns', {
        writeProperty: 'pageRank',
        maxIterations: 20,
        dampingFactor: 0.85
      })
      YIELD nodeCount, relationshipCount, bytesMin, bytesMax, requiredMemory
      RETURN *
    `);

    // Step 3: Execute the PageRank algorithm and return top percentage tokens
    const topTokensResult = await tx.run(
      `
      CALL gds.pageRank.stream('tkns', {
        scaler: "MEAN"
      })
      YIELD nodeId, score
      WITH gds.util.asNode(nodeId).value AS tkn, score
      ORDER BY score DESC
      WITH COLLECT(tkn) AS tokens, COUNT(*) AS total
      RETURN tokens[0..TOINTEGER(CEIL(total * $topPct))] AS topTkns
    `,
      { topPct }
    );

    // Get the top tokens from the result
    const topTkns: { tkn: string; score: number }[] =
      topTokensResult.records[0].get("topTkns") || [];

    // Step 4: Drop the graph
    await tx.run(`CALL gds.graph.drop('tkns')`);

    // Commit the transaction
    await tx.commit();

    // Return the top tokens
    return topTkns;
  } catch (error) {
    console.error("Transaction failed and will be rolled back:", error);
    await tx.rollback();
    throw error; // Rethrow the error after rollback for further handling if needed
  } finally {
    await session.close();
  }
}
