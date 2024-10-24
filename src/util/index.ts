import chalk from "chalk";

export type Tkn = string;

// Function to parse numerical data from a buffer (assuming 32-bit integers)
export function parseChunk(chunk: Buffer): number[] {
  const numbers: number[] = [];
  for (let i = 0; i < chunk.length; i += 4) {
    const num = chunk.readUint8(i);
    numbers.push(num);
  }
  return numbers;
}

export function encode(arr: number[]): Tkn {
  const buffer = Buffer.alloc(arr.length * 4); // 4 bytes for each integer
  for (let i = 0; i < arr.length; i++) {
    buffer.writeInt32LE(arr[i], i * 4); // Store each number as a 32-bit integer
  }
  return buffer.toString("base64"); // Convert the buffer to a base64 string
}

export function decode(encodedString: Tkn): number[] {
  const buffer = Buffer.from(encodedString, "base64");
  const numbers: number[] = [];
  for (let i = 0; i < buffer.length; i += 4) {
    numbers.push(buffer.readInt32LE(i)); // Read each number back
  }
  return numbers;
}

export function log(
  sessionId: string,
  opId: string | undefined,
  message: string,
  level: "info" | "success" | "error"
) {
  if (process.env.VERBOSE?.toLowerCase() !== "true") return;
  const colors = {
    info: chalk.blueBright,
    success: chalk.greenBright,
    error: chalk.redBright,
  };
  console.log(
    chalk.gray(
      `[${chalk.yellowBright(sessionId)}]${
        opId ? `[${chalk.magentaBright(opId)}]` : ""
      }: ${colors[level](message)}`
    )
  );
}

export function bpiToMbps(bytes: number, intervalMs: number): number {
  const kilobytes = bytes / 1_048_576;
  const intervalsPerSecond = 1000 / intervalMs;
  return kilobytes * intervalsPerSecond;
}

export class RunningStats {
  private totalWeightedSum: number = 0;
  private totalWeight: number = 0;
  private count: number = 0;
  private mean: number = 0;
  private m2: number = 0; // For standard deviation calculation
  private minValue: number | null = null;
  private maxValue: number | null = null;

  // Add a new data point with its weight
  add(value: number, weight: number): void {
    if (weight <= 0) {
      throw new Error("Weight must be positive");
    }

    // Update weighted sum and total weight
    this.totalWeightedSum += value * weight;
    this.totalWeight += weight;

    // Update count
    this.count++;

    // Update max and min
    if (this.minValue === null || value < this.minValue) {
      this.minValue = value;
    }

    if (this.maxValue === null || value > this.maxValue) {
      this.maxValue = value;
    }

    // Welford's algorithm for standard deviation
    const delta = value - this.mean;
    this.mean += delta / this.count;
    const delta2 = value - this.mean;
    this.m2 += delta * delta2; // M2 tracks variance sum
  }

  // Get current weighted average
  getWeightedAverage(): number | null {
    if (this.totalWeight === 0) {
      return null;
    }
    return this.totalWeightedSum / this.totalWeight;
  }

  // Get current max value
  getMax(): number | null {
    return this.maxValue;
  }

  // Get current min value
  getMin(): number | null {
    return this.minValue;
  }

  // Get current standard deviation
  getStandardDeviation(): number {
    if (this.count < 2) {
      return 0; // Standard deviation is zero for one or no data points
    }
    return Math.sqrt(this.m2 / (this.count - 1));
  }

  // Reset all stats
  reset(): void {
    this.totalWeightedSum = 0;
    this.totalWeight = 0;
    this.count = 0;
    this.mean = 0;
    this.m2 = 0;
    this.minValue = null;
    this.maxValue = null;
  }
}
