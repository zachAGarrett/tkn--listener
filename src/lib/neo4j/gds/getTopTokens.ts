import { writeFileSync } from "fs";
import { Driver } from "neo4j-driver";
import { decode } from "../../parse.js";

export async function getTopTkns(driver: Driver, topPct: number) {
  const session = driver.session();

  // Start a transaction
  const tx = session.beginTransaction();
  try {
    // Step 1: Project the graph
    await tx.run(`
      MATCH (source:Tkn)-[r:D1]->(target:Tkn)
      RETURN gds.graph.project(
        'tkns',
        source,
        target,
        { relationshipProperties: r { .idx } }
      )
    `);

    // Step 2: Estimate memory requirements for PageRank
    // await tx.run(`
    //   CALL gds.pageRank.write.estimate('tkns', {
    //     writeProperty: 'pageRank',
    //     maxIterations: 20,
    //     dampingFactor: 0.85
    //   })
    //   YIELD nodeCount, relationshipCount, bytesMin, bytesMax, requiredMemory
    //   RETURN *
    // `);

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
    const topTkns: string[] = topTokensResult.records[0].get("topTkns") || [];

    // Step 4: Drop the graph
    await tx.run(`CALL gds.graph.drop('tkns')`);

    // Commit the transaction
    await tx.commit();

    // Optionally output the list
    if (topTkns && process.env.OUTPUTTKNS?.toLowerCase() === "true") {
      writeFileSync(
        "./output/topTokens.json",
        JSON.stringify(
          topTkns.flatMap((tkn) =>
            decode(tkn)
              .map((cp) => String.fromCodePoint(cp))
              .join("")
          ),
          undefined,
          2
        )
      );
    }

    // Return the top tokens
    return topTkns;
  } catch (error) {
    await tx.rollback();
    throw error; // Rethrow the error after rollback for further handling if needed
  } finally {
    await session.close();
  }
}
