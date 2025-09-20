"use client";

import React from 'react';

interface TableColumn {
  key: string;
  title: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'array';
  width: string;
  sortable: boolean;
  filterable: boolean;
}

interface TableMetadata {
  total_rows: number;
  total_columns: number;
  has_filters: boolean;
  has_sorting: boolean;
  table_type: 'comparison' | 'summary' | 'detailed' | 'analysis' | 'timeline' | 'categorical' | 'other';
}

interface TableData {
  table_title: string;
  table_description: string;
  columns: TableColumn[];
  data: Record<string, any>[];
  metadata: TableMetadata;
  error?: string;
}

interface TableRendererProps {
  tableData: TableData | null;
  isLoading?: boolean;
  error?: string;
}

export function TableRenderer({ tableData, isLoading, error }: TableRendererProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <span className="ml-2 text-gray-600">Generating table...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-red-600">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">Error</div>
          <div className="text-sm">{error}</div>
        </div>
      </div>
    );
  }

  if (!tableData) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">No Table Data</div>
          <div className="text-sm">No table data available to display.</div>
        </div>
      </div>
    );
  }

  if (tableData.error) {
    return (
      <div className="flex items-center justify-center p-8 text-red-600">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">Table Error</div>
          <div className="text-sm">{tableData.error}</div>
        </div>
      </div>
    );
  }

  const { table_title, table_description, columns, data, metadata } = tableData;

  return (
    <div className="w-full h-full flex flex-col">
      {/* Table Header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 mb-2">{table_title}</h2>
        {table_description && (
          <p className="text-sm text-gray-600 mb-2">{table_description}</p>
        )}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{metadata.total_rows} rows</span>
          <span>{metadata.total_columns} columns</span>
          <span className="capitalize">{metadata.table_type} table</span>
          {metadata.has_sorting && <span>Sortable</span>}
          {metadata.has_filters && <span>Filterable</span>}
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto">
        {data.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-gray-500">
            <div className="text-center">
              <div className="text-lg font-semibold mb-2">No Data</div>
              <div className="text-sm">No data rows available.</div>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-200"
                      style={{ width: column.width }}
                    >
                      <div className="flex items-center justify-between">
                        <span>{column.title}</span>
                        {column.sortable && (
                          <span className="text-gray-400 ml-1">↕</span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="hover:bg-gray-50 transition-colors duration-150"
                  >
                    {columns.map((column) => {
                      const value = row[column.key];
                      return (
                        <td
                          key={column.key}
                          className="px-4 py-3 text-sm text-gray-900 border-b border-gray-100"
                        >
                          {renderCellValue(value, column.type)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function renderCellValue(value: any, type: string): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-gray-400 italic">—</span>;
  }

  switch (type) {
    case 'boolean':
      return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {value ? 'Yes' : 'No'}
        </span>
      );
    
    case 'number':
      return (
        <span className="font-mono text-sm">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
      );
    
    case 'date':
      return (
        <span className="text-sm">
          {new Date(value).toLocaleDateString()}
        </span>
      );
    
    case 'array':
      if (Array.isArray(value)) {
        return (
          <div className="flex flex-wrap gap-1">
            {value.map((item, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
              >
                {String(item)}
              </span>
            ))}
          </div>
        );
      }
      return <span className="text-sm">{String(value)}</span>;
    
    case 'string':
    default:
      return <span className="text-sm">{String(value)}</span>;
  }
} 