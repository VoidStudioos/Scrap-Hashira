import React, { useEffect, useState, useRef } from 'react';
import {
  Brain,
  Download,
  Upload,
  Trash2,
  CheckCircle,
  AlertCircle,
  FileCode,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { useScraperStore } from '../store/useScraperStore';
import { I18nManager } from '../localization/i18n';
import { LearningEngine } from '../engines/learning/learningEngine';
import { StorageService } from '../storage/storageService';
import type { SiteProfile } from '../types';

export const SmartLearning: React.FC = () => {
  const { profiles, loadProfiles } = useScraperStore();
  const [selectedProfile, setSelectedProfile] = useState<SiteProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [validationStatus, setValidationStatus] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  const filteredProfiles = profiles.filter(
    (p) => p.domain.toLowerCase().includes(searchTerm.toLowerCase()) || p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportAll = () => {
    const jsonStr = LearningEngine.exportProfilesAsJson(profiles);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hashira-profiles-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      const res = await LearningEngine.importProfilesFromJson(content);
      await loadProfiles();
      alert(`Imported ${res.importedCount} site profiles.${res.errors.length ? ` Errors: ${res.errors.join(', ')}` : ''}`);
    };
    reader.readAsText(file);
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    if (confirm('Are you sure you want to delete this profile?')) {
      await StorageService.deleteProfile(id);
      await loadProfiles();
      if (selectedProfile?.id === id) {
        setSelectedProfile(null);
      }
    }
  };

  const validateOnCurrentTab = async (profile: SiteProfile) => {
    setValidationStatus({ checking: true });
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]?.id) {
          setValidationStatus({ checking: false, valid: false, message: 'No active tab found' });
          return;
        }

        chrome.tabs.sendMessage(tabs[0].id, { action: 'DETECT_PAGE_DATA' }, () => {
          // Validate
          const res = LearningEngine.validateProfileAgainstDom(profile, document);
          setValidationStatus({
            checking: false,
            valid: res.isValid,
            matchedRecordsCount: res.matchedRecordsCount,
            confidenceScore: res.confidenceScore,
            structuralChange: res.structuralChangeDetected,
          });
        });
      });
    } else {
      setTimeout(() => {
        const res = LearningEngine.validateProfileAgainstDom(profile, document);
        setValidationStatus({
          checking: false,
          valid: res.isValid,
          matchedRecordsCount: res.matchedRecordsCount,
          confidenceScore: res.confidenceScore,
          structuralChange: res.structuralChangeDetected,
        });
      }, 500);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2 rtl:space-x-reverse">
            <Brain className="w-5 h-5 text-purple-400" />
            <span>{I18nManager.t('smartLearning')}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic site profile learning, selector resilience, and DOM drift detection.
          </p>
        </div>

        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileImport}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1.5 rtl:space-x-reverse bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs border border-slate-700 transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Profiles</span>
          </button>

          <button
            onClick={handleExportAll}
            disabled={profiles.length === 0}
            className="flex items-center space-x-1.5 rtl:space-x-reverse bg-purple-600 hover:bg-purple-700 text-white font-medium px-3 py-1.5 rounded-lg text-xs transition shadow disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Profiles</span>
          </button>
        </div>
      </div>

      {/* Profiles Search and List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: List */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 rtl:left-auto rtl:right-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search domain or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-lg pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filteredProfiles.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 bg-slate-800/30 rounded-lg border border-dashed border-slate-700">
                No profiles saved yet. Scraped sites with custom corrections will automatically appear here.
              </div>
            ) : (
              filteredProfiles.map((p) => {
                const isSelected = selectedProfile?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedProfile(p);
                      setValidationStatus(null);
                    }}
                    className={`p-3 rounded-lg border cursor-pointer transition ${
                      isSelected
                        ? 'bg-purple-900/40 border-purple-500 text-white'
                        : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs truncate">{p.name}</span>
                      <span className="text-[10px] font-mono text-purple-300 bg-purple-950/80 px-1.5 py-0.5 rounded">
                        {p.domain}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate font-mono">{p.recordSelector}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Profile Detail */}
        <div className="md:col-span-2">
          {selectedProfile ? (
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white">{selectedProfile.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">{selectedProfile.domain}</p>
                </div>

                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <button
                    onClick={() => validateOnCurrentTab(selectedProfile)}
                    className="flex items-center space-x-1.5 rtl:space-x-reverse bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1.5 rounded-lg transition"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Validate on Tab</span>
                  </button>

                  <button
                    onClick={() => handleDelete(selectedProfile.id)}
                    className="p-1.5 text-rose-400 hover:text-rose-300 rounded hover:bg-rose-950/40 transition"
                    title="Delete Profile"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Validation Status Banner */}
              {validationStatus && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-center space-x-2 rtl:space-x-reverse ${
                    validationStatus.checking
                      ? 'bg-slate-700 text-slate-200'
                      : validationStatus.valid
                      ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300'
                      : 'bg-rose-950/60 border border-rose-500/50 text-rose-300'
                  }`}
                >
                  {validationStatus.checking ? (
                    <span>Validating selectors against live DOM...</span>
                  ) : validationStatus.valid ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>
                        Valid profile! Matched {validationStatus.matchedRecordsCount} records. Confidence:{' '}
                        {Math.round(validationStatus.confidenceScore * 100)}%.
                        {validationStatus.structuralChange && ' (Structural change detected, fallback active)'}
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                      <span>Selectors failed to match live DOM. Re-scan or select manually recommended.</span>
                    </>
                  )}
                </div>
              )}

              {/* Rules Table */}
              <div>
                <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center space-x-1.5 rtl:space-x-reverse">
                  <FileCode className="w-3.5 h-3.5 text-purple-400" />
                  <span>Configured Field Selectors ({selectedProfile.fieldSelectors.length})</span>
                </h4>

                <div className="border border-slate-700 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left rtl:text-right text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 uppercase text-[10px]">
                      <tr>
                        <th className="px-3 py-2">Field</th>
                        <th className="px-3 py-2">CSS Selector</th>
                        <th className="px-3 py-2">XPath Fallback</th>
                        <th className="px-3 py-2">Attribute</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {selectedProfile.fieldSelectors.map((rule, idx) => (
                        <tr key={idx} className="hover:bg-slate-700/20 font-mono">
                          <td className="px-3 py-2 text-purple-300 font-semibold">{rule.field}</td>
                          <td className="px-3 py-2 text-slate-300 truncate max-w-[150px]">{rule.cssSelector}</td>
                          <td className="px-3 py-2 text-slate-400 truncate max-w-[150px]">{rule.xpathFallback || '-'}</td>
                          <td className="px-3 py-2 text-slate-400">{rule.attribute || 'text'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/30 border border-dashed border-slate-700 rounded-xl p-12 text-center text-xs text-slate-400">
              Select a site profile from the list to view its rules, confidence metrics, and test against active page.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
