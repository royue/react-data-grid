import { createFileRoute } from '@tanstack/react-router';
import { css } from 'ecij';

import { DataGrid, type Column } from '../../src';
import { useDirection } from '../directionContext';

export const Route = createFileRoute('/RightFrozenColumns')({
  component: RightFrozenColumns
});

interface Row {
  id: number;
  company: string;
  region: string;
  segment: string;
  pipeline: readonly number[];
  score: number;
  status: 'At risk' | 'On track' | 'Review';
  owner: string;
}

const currencyFormatter = new Intl.NumberFormat(navigator.language, {
  style: 'currency',
  currency: 'usd',
  maximumFractionDigits: 0
});

const statusClassname = css`
  display: inline-flex;
  align-items: center;
  block-size: 20px;
  padding-inline: 8px;
  border-radius: 999px;
  color: white;
  font-size: 12px;
  font-weight: 600;
`;

const statusColors = {
  'At risk': 'hsl(0deg 70% 45%)',
  'On track': 'hsl(145deg 65% 32%)',
  Review: 'hsl(35deg 90% 38%)'
} satisfies Record<Row['status'], string>;

const actionClassname = css`
  inline-size: 100%;
`;

const companies = [
  'Acme Analytics',
  'Northwind Energy',
  'Contoso Retail',
  'Fabrikam Health',
  'Adventure Works',
  'Blue Yonder',
  'Wide World Importers',
  'Tailspin Toys'
] as const;

const regions = ['Americas', 'EMEA', 'APAC', 'LATAM'] as const;
const segments = ['Enterprise', 'Mid-market', 'Strategic', 'Public sector'] as const;
const owners = ['Lee', 'Patel', 'Garcia', 'Chen', 'Wilson', 'Nguyen'] as const;
const statuses: readonly Row['status'][] = ['On track', 'Review', 'At risk'];

const rows: readonly Row[] = Array.from({ length: 200 }, (_, index) => ({
  id: 10_000 + index,
  company: companies[index % companies.length],
  region: regions[index % regions.length],
  segment: segments[index % segments.length],
  pipeline: Array.from({ length: 18 }, (_, quarter) => 35_000 + index * 730 + quarter * 4250),
  score: 54 + ((index * 7) % 45),
  status: statuses[index % statuses.length],
  owner: owners[index % owners.length]
}));

const columns: readonly Column<Row>[] = [
  {
    key: 'id',
    name: 'ID',
    width: 90,
    frozen: true,
    resizable: true
  },
  {
    key: 'company',
    name: 'Company',
    width: 180,
    frozen: true,
    resizable: true
  },
  {
    key: 'region',
    name: 'Region',
    width: 120,
    resizable: true
  },
  {
    key: 'segment',
    name: 'Segment',
    width: 150,
    resizable: true
  },
  ...Array.from({ length: 18 }, (_, index): Column<Row> => {
    const quarter = index + 1;
    return {
      key: `quarter${quarter}`,
      name: `Q${quarter}`,
      width: 110,
      resizable: true,
      renderCell({ row }) {
        return currencyFormatter.format(row.pipeline[index]);
      }
    };
  }),
  {
    key: 'score',
    name: 'Score',
    width: 90,
    frozenRight: true,
    renderCell({ row }) {
      return `${row.score}%`;
    }
  },
  {
    key: 'status',
    name: 'Status',
    width: 120,
    frozenRight: true,
    renderCell({ row }) {
      return (
        <span className={statusClassname} style={{ backgroundColor: statusColors[row.status] }}>
          {row.status}
        </span>
      );
    }
  },
  {
    key: 'owner',
    name: 'Owner',
    width: 110,
    frozenRight: true
  },
  {
    key: 'action',
    name: 'Action',
    width: 100,
    frozenRight: true,
    renderCell() {
      return (
        <button type="button" className={actionClassname}>
          Review
        </button>
      );
    }
  }
];

function RightFrozenColumns() {
  const direction = useDirection();

  return (
    <DataGrid
      aria-label="Right Frozen Columns Example"
      columns={columns}
      rows={rows}
      className="fill-grid"
      direction={direction}
    />
  );
}
