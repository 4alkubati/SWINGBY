import React, { useState, useMemo } from 'react';
import styles from './DataTable.module.css';

export default function DataTable({ columns, data, pageSize = 10, onRowClick, rowClassName }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(0);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  // Sorting had two independent faults, and together they scrambled the table.
  //
  // 1. IT READ THE WRONG FIELD. `a[sortKey]` only works when a column's key is
  //    literally a property of the row. The Users table's Name column is
  //    key:'name', but a user row carries `first_name`/`last_name` — there is no
  //    `name` property — so `av` was `undefined` for EVERY row. Businesses has
  //    the same shape via a nested `users` object. Columns can now supply
  //    `sortValue(row)`; `row[key]` stays the default for the plain cases.
  //
  // 2. THE COMPARATOR WAS INCONSISTENT. `if (av == null) return 1` returned a
  //    constant 1 for every pair once everything was undefined — never 0, never
  //    -1. A comparator that contradicts itself makes Array.prototype.sort's
  //    result implementation-defined, which is why the rows came back shuffled
  //    rather than merely unsorted. Two equal nulls now compare 0, so ordering
  //    is stable and missing values sort to the end deterministically.
  //
  // Fault 2 is the dangerous one: it would have scrambled ANY column whose
  // values were all null, not just the mis-keyed ones.
  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    const valueOf = (row) =>
      typeof col?.sortValue === 'function' ? col.sortValue(row) : row[sortKey];

    return [...data].sort((a, b) => {
      const av = valueOf(a), bv = valueOf(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;   // missing sorts last, in both directions
      if (bv == null) return -1;
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [columns, data, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} onClick={() => col.sortable !== false && handleSort(col.key)}>
                  {col.label}
                  {sortKey === col.key && (
                    <span className={styles.sortIcon}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr
                key={row.id || i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={rowClassName ? rowClassName(row) : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key}>{col.render ? col.render(row[col.key], row) : row[col.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <span>{sorted.length} results — page {page + 1} of {totalPages}</span>
          <div className={styles.pageButtons}>
            <button className={styles.pageButton} disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
            <button className={styles.pageButton} disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
