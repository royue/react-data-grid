import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { css } from 'ecij';

import { DataGrid, SelectColumn, type Column } from '../../src';
import { useDirection } from '../directionContext';

export const Route = createFileRoute('/TreeData')({
  component: TreeData
});

const rootClassname = css`
  display: flex;
  flex-direction: column;
  block-size: 100%;
  gap: 8px;

  > .rdg {
    flex: 1;
  }
`;

const toolbarClassname = css`
  display: flex;
  align-items: center;
  gap: 8px;

  > span {
    margin-inline-end: auto;
    color: light-dark(hsl(0deg 0% 35%), hsl(0deg 0% 75%));
  }
`;

interface Row {
  id: number;
  department: string;
  team: string;
  project: string;
  owner: string;
  status: 'Active' | 'Planning' | 'Review';
  progress: number;
  budget: number;
  children?: readonly Row[];
}

const leafRows: readonly Row[] = [
  {
    id: 1,
    department: 'Engineering',
    team: 'Platform',
    project: 'Billing API',
    owner: 'Alice Chen',
    status: 'Active',
    progress: 72,
    budget: 180_000
  },
  {
    id: 2,
    department: 'Engineering',
    team: 'Platform',
    project: 'Identity Service',
    owner: 'Bob Li',
    status: 'Review',
    progress: 91,
    budget: 125_000
  },
  {
    id: 3,
    department: 'Engineering',
    team: 'Web',
    project: 'Analytics Dashboard',
    owner: 'Clara Wang',
    status: 'Active',
    progress: 64,
    budget: 96_000
  },
  {
    id: 4,
    department: 'Engineering',
    team: 'Web',
    project: 'Design System',
    owner: 'David Xu',
    status: 'Planning',
    progress: 28,
    budget: 82_000
  },
  {
    id: 5,
    department: 'Product',
    team: 'Growth',
    project: 'Onboarding',
    owner: 'Eva Zhang',
    status: 'Active',
    progress: 58,
    budget: 74_000
  },
  {
    id: 6,
    department: 'Product',
    team: 'Growth',
    project: 'Referral Program',
    owner: 'Frank Wu',
    status: 'Planning',
    progress: 20,
    budget: 68_000
  },
  {
    id: 7,
    department: 'Product',
    team: 'Core',
    project: 'Workspace Sharing',
    owner: 'Grace Liu',
    status: 'Review',
    progress: 86,
    budget: 110_000
  },
  {
    id: 8,
    department: 'Operations',
    team: 'Customer Success',
    project: 'Help Center',
    owner: 'Henry Zhao',
    status: 'Active',
    progress: 77,
    budget: 52_000
  },
  {
    id: 9,
    department: 'Operations',
    team: 'Customer Success',
    project: 'Service Health',
    owner: 'Iris Sun',
    status: 'Active',
    progress: 69,
    budget: 61_000
  },
  {
    id: 10,
    department: 'Operations',
    team: 'Finance',
    project: 'Forecast Automation',
    owner: 'Jack Ma',
    status: 'Planning',
    progress: 34,
    budget: 89_000
  }
];

let nextGroupId = -1;
const rows = createTreeRows(leafRows);

function createTreeRows(sourceRows: readonly Row[]): readonly Row[] {
  return Object.entries(Object.groupBy(sourceRows, (row) => row.department)).map(
    ([department, departmentRows]) => {
      const rows = departmentRows!;
      const children = Object.entries(Object.groupBy(rows, (row) => row.team)).map(
        ([team, teamRows]) => createParentRow(teamRows!, `${team} portfolio`, teamRows!)
      );
      return createParentRow(rows, `${department} portfolio`, children);
    }
  );
}

function createParentRow(
  sourceRows: readonly Row[],
  project: string,
  children: readonly Row[]
): Row {
  const id = nextGroupId;
  nextGroupId -= 1;
  return {
    ...sourceRows[0],
    id,
    team: children === sourceRows ? sourceRows[0].team : 'All teams',
    project,
    owner: 'Multiple owners',
    progress: Math.round(
      sourceRows.reduce((total, row) => total + row.progress, 0) / sourceRows.length
    ),
    budget: sourceRows.reduce((total, row) => total + row.budget, 0),
    children
  };
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

const columns: readonly Column<Row>[] = [
  SelectColumn,
  { key: 'department', name: 'Department', width: 180 },
  { key: 'team', name: 'Team', width: 190 },
  {
    key: 'project',
    name: 'Project',
    frozen: true,
    width: 240,
    renderGroupCell({ childRows }) {
      return `${childRows.length} projects`;
    }
  },
  {
    key: 'owner',
    name: 'Owner',
    width: 180,
    renderGroupCell({ childRows }) {
      return `${new Set(childRows.map((row) => row.owner)).size} owners`;
    }
  },
  {
    key: 'region',
    name: 'Region',
    width: 130,
    renderCell({ row }) {
      return getRegion(row);
    },
    renderGroupCell({ childRows }) {
      const regions = new Set(childRows.map(getRegion));
      return regions.size === 1 ? getRegion(childRows[0]) : `${regions.size} regions`;
    }
  },
  {
    key: 'status',
    name: 'Status',
    width: 130,
    renderGroupCell({ childRows }) {
      const activeCount = childRows.filter((row) => row.status === 'Active').length;
      return `${activeCount}/${childRows.length} active`;
    }
  },
  {
    key: 'priority',
    name: 'Priority',
    width: 120,
    renderCell({ row }) {
      return getPriority(row);
    },
    renderGroupCell({ childRows }) {
      const highPriorityCount = childRows.filter((row) => getPriority(row) === 'High').length;
      return `${highPriorityCount} high`;
    }
  },
  {
    key: 'progress',
    name: 'Progress',
    width: 130,
    renderCell({ row }) {
      return `${row.progress}%`;
    },
    renderGroupCell({ childRows }) {
      const average = childRows.reduce((total, row) => total + row.progress, 0) / childRows.length;
      return `${Math.round(average)}% avg`;
    }
  },
  {
    key: 'tasks',
    name: 'Tasks',
    width: 110,
    renderCell({ row }) {
      return getTaskCount(row);
    },
    renderGroupCell({ childRows }) {
      return `${childRows.reduce((total, row) => total + getTaskCount(row), 0)} total`;
    }
  },
  {
    key: 'quarter',
    name: 'Quarter',
    width: 110,
    renderCell({ row }) {
      return getQuarter(row);
    },
    renderGroupCell({ childRows }) {
      return `${new Set(childRows.map(getQuarter)).size} quarters`;
    }
  },
  {
    key: 'timeline',
    name: 'Timeline',
    width: 220,
    renderCell({ row }) {
      return getTimeline(row);
    },
    renderGroupCell({ childRows }) {
      return `${childRows.length} schedules`;
    }
  },
  {
    key: 'risk',
    name: 'Risk',
    width: 120,
    renderCell({ row }) {
      return getRisk(row);
    },
    renderGroupCell({ childRows }) {
      const highRiskCount = childRows.filter((row) => getRisk(row) === 'High').length;
      return `${highRiskCount} high`;
    }
  },
  {
    key: 'budget',
    name: 'Budget',
    frozenRight: true,
    width: 150,
    renderCell({ row }) {
      return currencyFormatter.format(row.budget);
    },
    renderGroupCell({ childRows }) {
      return currencyFormatter.format(childRows.reduce((total, row) => total + row.budget, 0));
    }
  },
  {
    key: 'forecast',
    name: 'Forecast',
    frozenRight: true,
    width: 160,
    renderCell({ row }) {
      return currencyFormatter.format(getForecast(row));
    },
    renderGroupCell({ childRows }) {
      return currencyFormatter.format(
        childRows.reduce((total, row) => total + getForecast(row), 0)
      );
    }
  }
];

const defaultColumnOptions = { resizable: true } as const;

const allGroupIds = new Set<number>();
visitRows(rows);

function visitRows(rows: readonly Row[]) {
  for (const row of rows) {
    if (row.children === undefined) continue;
    allGroupIds.add(row.id);
    visitRows(row.children);
  }
}

function TreeData() {
  const direction = useDirection();
  const [selectedRows, setSelectedRows] = useState<ReadonlySet<number>>(() => new Set());
  const [expandedRowKeys, setExpandedRowKeys] = useState<ReadonlySet<number>>(
    () => new Set([-1, -2, -3])
  );

  return (
    <div className={rootClassname}>
      <div className={toolbarClassname}>
        <span>Scroll horizontally to compare frozen hierarchy and budget columns</span>
        <strong>{selectedRows.size} selected</strong>
        <button
          type="button"
          disabled={selectedRows.size === 0}
          onClick={() => setSelectedRows(new Set())}
        >
          Clear selection
        </button>
        <button type="button" onClick={() => setExpandedRowKeys(new Set(allGroupIds))}>
          Expand all
        </button>
        <button type="button" onClick={() => setExpandedRowKeys(new Set())}>
          Collapse all
        </button>
      </div>
      <DataGrid
        aria-label="Tree Data Example"
        columns={columns}
        rows={rows}
        rowKeyGetter={rowKeyGetter}
        selectedRows={selectedRows}
        onSelectedRowsChange={setSelectedRows}
        expandable={{
          expandedRowKeys,
          onExpandedRowsChange: setExpandedRowKeys
        }}
        defaultColumnOptions={defaultColumnOptions}
        direction={direction}
      />
    </div>
  );
}

function rowKeyGetter(row: Row) {
  return row.id;
}

function getRegion(row: Row) {
  switch (row.department) {
    case 'Engineering':
      return 'APAC';
    case 'Product':
      return 'Americas';
    case 'Operations':
      return row.team === 'Finance' ? 'EMEA' : 'Global';
    default:
      return 'Global';
  }
}

function getPriority(row: Row) {
  if (row.budget >= 150_000 || row.status === 'Review') return 'High';
  if (row.status === 'Active') return 'Medium';
  return 'Low';
}

function getTaskCount(row: Row) {
  return 12 + ((row.id * 7) % 35);
}

function getQuarter(row: Row) {
  return `Q${((row.id - 1) % 4) + 1} 2026`;
}

function getTimeline(row: Row) {
  const startMonth = ((row.id - 1) % 8) + 1;
  const endMonth = startMonth + 3;
  return `2026-${String(startMonth).padStart(2, '0')} → 2026-${String(endMonth).padStart(2, '0')}`;
}

function getRisk(row: Row) {
  if (row.progress < 35) return 'High';
  if (row.progress < 70 || row.status === 'Review') return 'Medium';
  return 'Low';
}

function getForecast(row: Row) {
  return Math.round(row.budget * (0.9 + (row.id % 5) * 0.05));
}
