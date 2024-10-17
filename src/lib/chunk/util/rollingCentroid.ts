export class RollingCentroid {
  private sumVector: number[]; // Stores the sum of all vectors
  private vectorCount: number; // Number of vectors added so far
  private dimensions: number; // Dimensionality of the vectors

  constructor(dimensions: number) {
    this.sumVector = Array(dimensions).fill(0); // Initialize sum vector with zeros
    this.vectorCount = 0;
    this.dimensions = dimensions;
  }

  // Add a new vector and update the rolling centroid
  addVector(vector: number[]): this {
    if (vector.length !== this.dimensions) {
      throw new Error(
        `Vector dimensionality (${vector.length}) must match ${this.dimensions}`
      );
    }

    // Update the sum of vectors
    for (let i = 0; i < this.dimensions; i++) {
      this.sumVector[i] += vector[i];
    }

    // Increase the count of vectors
    this.vectorCount++;

    return this;
  }

  // Compute the current centroid
  getCentroid(): number[] | undefined {
    if (this.vectorCount === 0) {
      return undefined;
    }

    // Compute the centroid by dividing the sum vector by the number of vectors
    return this.sumVector.map((value) => value / this.vectorCount);
  }
}
