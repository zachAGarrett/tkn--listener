import { UUID } from "crypto";
import { log, RunningStats } from "../../util/index.js";
import chalk from "chalk";
import { Socket } from "net";

const sessionComplete = (sessionId: UUID, throughputStats: RunningStats) => {
  log(sessionId, undefined, "Stream ended. All tokens pushed.", "success");
  log(
    sessionId,
    undefined,
    `${[
      `${throughputStats.getMin()?.toFixed(2)} ${chalk.gray("min")}`,
      `${throughputStats.getStandardDeviation()!.toFixed(2)} ${chalk.gray(
        "std"
      )}`,
      `${throughputStats.getMax()?.toFixed(2)} ${chalk.gray("max")}`,
      `${throughputStats.getWeightedAverage()?.toFixed(2)} ${chalk.gray(
        "mean"
      )}`,
    ].join(chalk.redBright(" | "))} ${chalk.gray("MB/s")}`,
    "info"
  );
};

const newUser = (sessionId: UUID, socket: Socket) =>
  log(
    sessionId,
    undefined,
    `New user connected from: ${socket.remoteAddress}`,
    "info"
  );

const taskThroughputStats = (sessionId: UUID, throughput: number) =>
  log(
    sessionId,
    undefined,
    `${throughput.toFixed(2)} ${chalk.gray("MB/s")}`,
    "info"
  );

const logs = { newUser, sessionComplete, taskThroughputStats };
export default logs;
