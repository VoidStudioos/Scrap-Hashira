import React, { useState } from 'react';
import {
  Table as TableIcon,
  Download,
  Search,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { useScraperStore } from '../store/useScraperStore';
import { I18nManager } from '../localization/i18n';
import { ExportManager } from '../exports/exportManager';

export const TableExtractor: React.FC = () => {
  const { detectedTables, scanActiveTab, isScanning } = useScraperStore();
  const [selectedTableIdx, setSelectedTableIdx] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const activeTable = detectedTables[selectedTableIdx] || detectedTables[0];

  const handleExportCsv = () => {
    if (!activeTable) return;
    const records = activeTable.rows.map((row) => {
      const obj: Record<string, any> = {};
      activeTable.headers.forEach((h, i) => {
        obj[h] = row[i] || '';
      });
      return obj;
    });

    const csvStr = ExportManager.toCsv(records);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    ExportManager.triggerFileDownload(blob, `table-${activeTable.tableIndex + 1}.csv`);
  };

  const handleExportXlsx = () => {
    if (!activeTable) return;
    const records = activeTable.rows.map((row) => {
      const obj: Record<string, any> = {};
      activeTable.headers.forEach((h, i) => {
        obj[h] = row[i] || '';
      });
      return obj;
    });

    const buffer = ExportManager.toXlsx(records, activeTable.title || 'Table');
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    ExportManager.triggerFileDownload(blob, `table-${activeTable.tableIndex + 1}.xlsx`);
  };

  const filteredRows = activeTable
    ? activeTable.rows.filter((row) =>
        row.some((cell) => String(cell).toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2 rtl:space-x-reverse">
            <TableIcon className="w-5 h-5 text-blue-400" />
            <span>{I18nManager.t('tableExtractor')}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Extract tabular structures, nested tables, row/column spans with one-click Excel & CSV exports.
          </p>
        </div>

        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <button
            onClick={scanActiveTab}
            disabled={isScanning}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-xs transition shadow disabled:opacity-50"
          >
            {isScanning ? 'Scanning Tables...' : 'Detect Tables on Page'}
          </button>
        </div>
      </div>

      {detectedTables.length === 0 ? (
        <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-xl p-12 text-center text-xs text-slate-400 space-y-2">
          <TableIcon className="w-8 h-8 text-slate-500 mx-auto" />
          <p>No tables detected yet. Click "Detect Tables on Page" to scan the active page.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Table Tabs */}
          <div className="flex items-center space-x-2 rtl:space-x-reverse overflow-x-auto pb-1">
            {detectedTables.map((t, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedTableIdx(idx)}
                className={`flex items-center space-x-2 rtl:space-x-reverse px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap transition ${
                  idx === selectedTableIdx
                    ? 'bg-blue-900/50 border-blue-500 text-blue-200'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <span>{t.title || `Table #${idx + 1}`}</span>
                <span className="text-[10px] bg-blue-950 px-1.5 py-0.5 rounded font-mono text-blue-300">
                  {t.rows.length} rows
                </span>
                {t.hasNestedTables && (
                  <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1 rounded">Nested</span>
                )}
              </button>
            ))}
          </div>

          {activeTable && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-4">
              {/* Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-3">
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 rtl:left-auto rtl:right-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search table rows..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 rtl:pl-3 rtl:pr-8 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <button
                    onClick={handleExportCsv}
                    className="flex items-center space-x-1.5 rtl:space-x-reverse bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-xs transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>

                  <button
                    onClick={handleExportXlsx}
                    className="flex items-center space-x-1.5 rtl:space-x-reverse bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-lg text-xs transition shadow"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Export Excel (XLSX)</span>
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto border border-slate-700 rounded-lg max-h-96">
                <table className="w-full text-xs text-left rtl:text-right text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] sticky top-0 border-b border-slate-700">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      {activeTable.headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-700/20 font-mono">
                        <td className="px-3 py-2 text-slate-500 text-[10px]">{rIdx + 1}</td>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-3 py-2 whitespace-nowrap">
                            {String(cell || '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
