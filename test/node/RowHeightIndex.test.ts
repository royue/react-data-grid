import { RowHeightIndex } from '../../src/utils/RowHeightIndex';

test('calculates row positions and total height', () => {
  const index = new RowHeightIndex([20, 30, 40]);

  expect(index.getTop(0)).toBe(0);
  expect(index.getTop(1)).toBe(20);
  expect(index.getTop(2)).toBe(50);
  expect(index.getTop(3)).toBe(90);
  expect(index.getTotalHeight()).toBe(90);
});

test('updates row positions', () => {
  const index = new RowHeightIndex([20, 30, 40]);

  expect(index.update(1, 60)).toBe(true);
  expect(index.update(1, 60)).toBe(false);
  expect(index.getHeight(1)).toBe(60);
  expect(index.getTop(2)).toBe(80);
  expect(index.getTotalHeight()).toBe(120);
});

test('supports a lazily materialized uniform height', () => {
  const index = new RowHeightIndex(3, 20);

  expect(index.getTop(2)).toBe(40);
  expect(index.getTotalHeight()).toBe(60);
  expect(index.findIndex(20)).toBe(1);
  expect(index.update(1, 50)).toBe(true);
  expect(index.getTop(2)).toBe(70);
  expect(index.getTotalHeight()).toBe(90);
});

test.each([
  [-1, 0],
  [0, 0],
  [19, 0],
  [20, 1],
  [49, 1],
  [50, 2],
  [89, 2],
  [90, 2]
])('finds the row at offset %s', (offset, expectedIndex) => {
  const index = new RowHeightIndex([20, 30, 40]);

  expect(index.findIndex(offset)).toBe(expectedIndex);
});
