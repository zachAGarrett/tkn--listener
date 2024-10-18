import chalk from "chalk";
import { randomUUID } from "crypto";
import { convert } from "html-to-text";

export async function getWikipediaArticle(
  title: string,
  runId: string = randomUUID()
): Promise<{ runId: string; content: string }> {
  const baseUrl = "https://en.wikipedia.org/w/api.php";
  const sectionsUrl = `${baseUrl}?action=parse&page=${encodeURIComponent(
    title
  )}&format=json&prop=sections`;
  const logBase =
    chalk.yellowBright("[PARSING]") + chalk.blueBright(`[${runId}]`);
  const retrievalLog = logBase + chalk.magentaBright("[RETRIEVED SOURCE]");
  const fetchStartLog = logBase + chalk.magentaBright("[FETCHING SOURCE]");

  process.env.VERBOSE?.toLowerCase() === "true" && console.log(fetchStartLog);
  process.env.VERBOSE?.toLowerCase() === "true" && console.time(retrievalLog);

  try {
    const sectionsResponse = await fetch(sectionsUrl);

    if (!sectionsResponse.ok) {
      throw new Error(
        `Error fetching sections: ${sectionsResponse.statusText}`
      );
    }

    const sectionsData = await sectionsResponse.json();

    // Check if the 'parse' property is present
    if (!sectionsData.parse || !sectionsData.parse.sections) {
      throw new Error("No sections found for this article.");
    }

    // Fetch content for each section
    const sections = sectionsData.parse.sections;
    const allSectionsContent: string[] = [];

    for (const section of sections) {
      const sectionTitle = section.line;
      const sectionIndex = section.index;

      // Fetch content for the specific section
      const contentUrl = `${baseUrl}?action=parse&page=${encodeURIComponent(
        title
      )}&format=json&prop=text&section=${sectionIndex}`;

      const contentResponse = await fetch(contentUrl);
      if (!contentResponse.ok) {
        throw new Error(
          `Error fetching section ${sectionTitle}: ${contentResponse.statusText}`
        );
      }

      const contentData = await contentResponse.json();
      if (
        !contentData.parse ||
        !contentData.parse.text ||
        !contentData.parse.text["*"]
      ) {
        throw new Error(`Content for section ${sectionTitle} not available.`);
      }

      // Convert HTML to plain text and add to the array
      const htmlContent = contentData.parse.text["*"];
      const plainText = convert(htmlContent);
      allSectionsContent.push(`${sectionTitle}:\n${plainText}\n`);
    }

    process.env.VERBOSE?.toLowerCase() === "true" &&
      console.timeEnd(retrievalLog);
    // Join all sections content with double line breaks
    return { runId, content: allSectionsContent.join("\n\n") };
  } catch (error) {
    process.env.VERBOSE?.toLowerCase() === "true" &&
      console.timeEnd(retrievalLog);
    console.error(
      logBase +
        chalk.redBright(
          `[Failed to fetch Wikipedia article]\n${(error as any).message}`
        )
    );
    throw error;
  }
}
