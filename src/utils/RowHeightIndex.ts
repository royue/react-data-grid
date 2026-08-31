export class RowHeightIndex {
  readonly #size: number;
  readonly #uniformHeight: number | undefined;
  #heights: number[] | undefined;
  #tree: Float64Array | undefined;

  constructor(heights: readonly number[]);
  constructor(size: number, uniformHeight: number);
  constructor(heightsOrSize: readonly number[] | number, uniformHeight?: number) {
    if (typeof heightsOrSize === 'number') {
      this.#size = heightsOrSize;
      this.#uniformHeight = uniformHeight!;
      return;
    }

    this.#size = heightsOrSize.length;
    this.#uniformHeight = undefined;
    this.#heights = [...heightsOrSize];
    this.#tree = buildTree(this.#heights);
  }

  get size(): number {
    return this.#size;
  }

  getHeight(index: number): number {
    return this.#heights?.[index] ?? this.#uniformHeight!;
  }

  getTop(index: number): number {
    if (this.#tree === undefined) return index * this.#uniformHeight!;

    let total = 0;
    for (let treeIndex = index; treeIndex > 0; treeIndex -= treeIndex & -treeIndex) {
      total += this.#tree[treeIndex];
    }
    return total;
  }

  getTotalHeight(): number {
    return this.getTop(this.size);
  }

  update(index: number, height: number): boolean {
    const previousHeight = this.getHeight(index);
    if (previousHeight === height) return false;

    this.#materializeUniformHeights();
    this.#heights![index] = height;
    this.#add(index, height - previousHeight);
    return true;
  }

  findIndex(offset: number): number {
    if (this.size === 0 || offset <= 0) return 0;

    if (this.#tree === undefined) {
      return Math.min(Math.floor(offset / this.#uniformHeight!), this.size - 1);
    }

    let index = 0;
    let currentOffset = 0;
    let step = 1;

    while (step < this.#tree.length) {
      step <<= 1;
    }

    for (step >>= 1; step > 0; step >>= 1) {
      const nextIndex = index + step;
      if (nextIndex < this.#tree.length && currentOffset + this.#tree[nextIndex] <= offset) {
        index = nextIndex;
        currentOffset += this.#tree[nextIndex];
      }
    }

    return Math.min(index, this.size - 1);
  }

  #materializeUniformHeights() {
    if (this.#heights !== undefined) return;

    this.#heights = Array.from({ length: this.size }, () => this.#uniformHeight!);
    this.#tree = buildTree(this.#heights);
  }

  #add(index: number, delta: number) {
    for (
      let treeIndex = index + 1;
      treeIndex < this.#tree!.length;
      treeIndex += treeIndex & -treeIndex
    ) {
      this.#tree![treeIndex] += delta;
    }
  }
}

function buildTree(heights: readonly number[]): Float64Array {
  const tree = new Float64Array(heights.length + 1);

  for (let treeIndex = 1; treeIndex < tree.length; treeIndex++) {
    tree[treeIndex] += heights[treeIndex - 1];
    const parentIndex = treeIndex + (treeIndex & -treeIndex);
    if (parentIndex < tree.length) {
      tree[parentIndex] += tree[treeIndex];
    }
  }

  return tree;
}
