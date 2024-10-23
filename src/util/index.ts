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
    `[${chalk.yellowBright(sessionId)}]${
      opId ? `[${chalk.magentaBright(opId)}]` : ""
    }: ${colors[level](message)}`
  );
}

export function bpiTokbps(bytes: number, intervalMs: number): number {
  const kilobytes = bytes / 1024;
  const intervalsPerSecond = 1000 / intervalMs;
  return kilobytes * intervalsPerSecond;
}
