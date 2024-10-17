/**
 * Class to maintain running statistics (mean, variance, standard deviation) dynamically.
 */
export class RollingStats {
  private n: number; // Number of elements
  private mean: number; // Mean of elements
  private M2: number; // Sum of squares of differences from the current mean
  private max: number; // Maximum occurences

  constructor() {
    this.n = 0;
    this.mean = 0;
    this.M2 = 0;
    this.max = 0;
  }

  reset() {
    this.n = 0;
    this.mean = 0;
    this.M2 = 0;
    this.max = 0;
  }

  /**
   * Adds a value to the running statistics, updating mean and M2.
   * @param x - The value to add.
   */
  addValue(x: number) {
    this.n += 1;
    const delta = x - this.mean;
    this.mean += delta / this.n;
    const delta2 = x - this.mean;
    this.M2 += delta * delta2;
    if (x > this.max) {
      this.max = x;
    }
  }

  /**
   * Gets the current mean of the values.
   * @returns The mean.
   */
  getMean(): number {
    return this.mean;
  }

  /**
   * Gets the current max of the values.
   * @returns The max.
   */
  getMax(): number {
    return this.max;
  }

  /**
   * Gets the variance of the values.
   * @returns The variance.
   */
  getVariance(): number {
    return this.n > 1 ? this.M2 / (this.n - 1) : 0;
  }

  /**
   * Gets the standard deviation of the values.
   * @returns The standard deviation.
   */
  getStandardDeviation(): number {
    return Math.sqrt(this.getVariance());
  }
}
