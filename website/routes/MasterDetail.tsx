import { useState } from 'react';
import { faker } from '@faker-js/faker';
import { createFileRoute } from '@tanstack/react-router';
import { css } from 'ecij';

import { DataGrid, type Column, type Direction } from '../../src';
import { useDirection } from '../directionContext';

export const Route = createFileRoute('/MasterDetail')({
  component: MasterDetail
});

interface DepartmentRow {
  id: number;
  department: string;
  owner: string;
  region: string;
  status: string;
  budget: string;
  metric01: string;
  metric02: string;
  metric03: string;
  metric04: string;
  metric05: string;
  metric06: string;
  metric07: string;
  metric08: string;
  metric09: string;
  metric10: string;
  metric11: string;
  metric12: string;
  metric13: string;
  metric14: string;
  metric15: string;
  action: string;
}

interface ProductRow {
  id: number;
  product: string;
  description: string;
  price: string;
}

function createDepartments(): readonly DepartmentRow[] {
  const departments: DepartmentRow[] = [];
  for (let i = 1; i < 30; i++) {
    departments.push({
      id: i,
      department: faker.commerce.department(),
      owner: faker.person.fullName(),
      region: faker.location.country(),
      status: faker.helpers.arrayElement(['Planning', 'Active', 'Review']),
      budget: faker.finance.amount({ min: 50_000, max: 500_000, dec: 0, symbol: '$' }),
      metric01: faker.number.int({ min: 10, max: 99 }).toString(),
      metric02: faker.number.int({ min: 10, max: 99 }).toString(),
      metric03: faker.number.int({ min: 10, max: 99 }).toString(),
      metric04: faker.number.int({ min: 10, max: 99 }).toString(),
      metric05: faker.number.int({ min: 10, max: 99 }).toString(),
      metric06: faker.number.int({ min: 10, max: 99 }).toString(),
      metric07: faker.number.int({ min: 10, max: 99 }).toString(),
      metric08: faker.number.int({ min: 10, max: 99 }).toString(),
      metric09: faker.number.int({ min: 10, max: 99 }).toString(),
      metric10: faker.number.int({ min: 10, max: 99 }).toString(),
      metric11: faker.number.int({ min: 10, max: 99 }).toString(),
      metric12: faker.number.int({ min: 10, max: 99 }).toString(),
      metric13: faker.number.int({ min: 10, max: 99 }).toString(),
      metric14: faker.number.int({ min: 10, max: 99 }).toString(),
      metric15: faker.number.int({ min: 10, max: 99 }).toString(),
      action: 'Review'
    });
  }
  return departments;
}

const productsMap = new Map<number, readonly ProductRow[]>();

function getProducts(parentId: number): readonly ProductRow[] {
  if (productsMap.has(parentId)) return productsMap.get(parentId)!;
  const products: ProductRow[] = [];
  for (let i = 0; i < 20; i++) {
    products.push({
      id: i,
      product: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      price: faker.commerce.price()
    });
  }
  productsMap.set(parentId, products);
  return products;
}

const productColumns: readonly Column<ProductRow>[] = [
  { key: 'id', name: 'ID', width: 35 },
  { key: 'product', name: 'Product' },
  { key: 'description', name: 'Description' },
  { key: 'price', name: 'Price' }
];

function MasterDetail() {
  const direction = useDirection();
  const [expandedRowKeys, setExpandedRowKeys] = useState((): ReadonlySet<number> => new Set());

  const columns: readonly Column<DepartmentRow>[] = [
    { key: 'id', name: 'ID', frozen: true, width: 80 },
    { key: 'department', name: 'Department', width: 220 },
    { key: 'owner', name: 'Owner', width: 240 },
    { key: 'region', name: 'Region', width: 220 },
    { key: 'status', name: 'Status', width: 160 },
    { key: 'budget', name: 'Budget', width: 160 },
    { key: 'metric01', name: 'Metric 01', width: 140 },
    { key: 'metric02', name: 'Metric 02', width: 140 },
    { key: 'metric03', name: 'Metric 03', width: 140 },
    { key: 'metric04', name: 'Metric 04', width: 140 },
    { key: 'metric05', name: 'Metric 05', width: 140 },
    { key: 'metric06', name: 'Metric 06', width: 140 },
    { key: 'metric07', name: 'Metric 07', width: 140 },
    { key: 'metric08', name: 'Metric 08', width: 140 },
    { key: 'metric09', name: 'Metric 09', width: 140 },
    { key: 'metric10', name: 'Metric 10', width: 140 },
    { key: 'metric11', name: 'Metric 11', width: 140 },
    { key: 'metric12', name: 'Metric 12', width: 140 },
    { key: 'metric13', name: 'Metric 13', width: 140 },
    { key: 'metric14', name: 'Metric 14', width: 140 },
    { key: 'metric15', name: 'Metric 15', width: 140 },
    { key: 'action', name: 'Action', frozenRight: true, width: 120 }
  ];
  const [rows, setRows] = useState(createDepartments);

  return (
    <DataGrid
      aria-label="Master Detail Example"
      rowKeyGetter={rowKeyGetter}
      columns={columns}
      rows={rows}
      onRowsChange={setRows}
      headerRowHeight={45}
      rowHeight={45}
      expandable={{
        expandedRowKeys,
        onExpandedRowsChange: setExpandedRowKeys,
        expandedRowRender({ row }) {
          return (
            <div
              className={css`
                block-size: 100%;
                padding: 24px;
              `}
            >
              <ProductGrid parentId={row.id} direction={direction} />
            </div>
          );
        },
        expandedRowHeight: 300
      }}
      className="fill-grid"
      direction={direction}
      onCellKeyDown={(_, event) => {
        if (event.isDefaultPrevented()) {
          // skip parent grid keyboard navigation if nested grid handled it
          event.preventGridDefault();
        }
      }}
    />
  );
}

function ProductGrid({ parentId, direction }: { parentId: number; direction: Direction }) {
  const products = getProducts(parentId);

  return (
    <DataGrid
      rows={products}
      columns={productColumns}
      rowKeyGetter={rowKeyGetter}
      style={{ blockSize: 250 }}
      direction={direction}
    />
  );
}

function rowKeyGetter(row: DepartmentRow | ProductRow) {
  return row.id;
}
