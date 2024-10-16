import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { writeFileSync } from "fs";

// Function to create a line chart from an array of deltas and save it to a PNG file
export async function createDriftDeltasChart(
  driftDeltas: number[],
  outputPath: string = "drift_deltas_chart.png"
) {
  // Create an instance of ChartJSNodeCanvas with the desired dimensions
  const width = 800; // Width of the chart
  const height = 600; // Height of the chart
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

  // Render the chart to a buffer (PNG image)
  const imageBuffer = await chartJSNodeCanvas.renderToBuffer({
    type: "line",
    data: {
      labels: driftDeltas.map((_, index) => index.toString()), // Use index as x-axis
      datasets: [
        {
          label: "Semantic Drift Deltas",
          data: driftDeltas,
          borderColor: "rgba(75, 192, 192, 1)",
          borderWidth: 2,
          fill: false,
        },
      ],
    },
    options: {
      responsive: false,
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: "Index",
          },
        },
        y: {
          display: true,
          title: {
            display: true,
            text: "Drift Delta",
          },
        },
      },
    },
  });

  // Save the image to the specified path
  writeFileSync(outputPath, imageBuffer);
  console.log(`Chart saved to ${outputPath}`);
}
