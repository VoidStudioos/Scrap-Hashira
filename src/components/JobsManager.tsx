import React, { useEffect, useState } from 'react';
import {
  Layers,
  Play,
  Pause,
  StopCircle,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { useScraperStore } from '../store/useScraperStore';
import { I18nManager } from '../localization/i18n';
import { StorageService } from '../storage/storageService';
import { ResumeEngine } from '../engines/resume/resumeEngine';
import type { ScrapingJob } from '../types';

export const JobsManager: React.FC = () => {
  const { jobs, loadJobs, pauseJob, resumeJob, stopJob } = useScraperStore();
  const [selectedJob, setSelectedJob] = useState<ScrapingJob | null>(null);

  useEffect(() => {
    loadJobs();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('Delete this scraping job and all its extracted records from local storage?')) {
      await StorageService.deleteJob(id);
      await loadJobs();
      if (selectedJob?.id === id) {
        setSelectedJob(null);
      }
    }
  };

  const handleResumeInterrupted = async (id: string) => {
    const res = await ResumeEngine.resumeJob(id);
    alert(res.message);
    await loadJobs();
  };

  const getStateBadgeClass = (state: ScrapingJob['state']) => {
    switch (state) {
      case 'RUNNING':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'PAUSED':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'INTERRUPTED':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      case 'COMPLETED':
        return 'bg-teal-500/20 text-teal-400 border-teal-500/40';
      case 'FAILED':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      default:
        return 'bg-slate-700/50 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2 rtl:space-x-reverse">
            <Layers className="w-5 h-5 text-orange-400" />
            <span>{I18nManager.t('jobsManager')}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Durable background jobs manager with crash-proof recovery and checkpoint restoration.
          </p>
        </div>

        <button
          onClick={loadJobs}
          className="flex items-center space-x-1.5 rtl:space-x-reverse bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs border border-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{I18nManager.t('refresh')}</span>
        </button>
      </div>

      {/* Jobs List */}
      <div className="space-y-3">
        {jobs.length === 0 ? (
          <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-xl p-12 text-center text-xs text-slate-400">
            No scraping jobs have been run yet. Start an extraction from the Dashboard or One-Click Scraper.
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-600 transition"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStateBadgeClass(job.state)}`}>
                    {job.state}
                  </span>
                  <h3 className="font-semibold text-sm text-white">{job.name}</h3>
                </div>

                <p className="text-xs text-slate-400 font-mono truncate max-w-lg">{job.startingUrl}</p>

                {/* Telemetry chips */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300 pt-1">
                  <span>
                    Pages: <strong className="text-white">{job.stats.pagesProcessed}</strong> / {job.stats.pagesDiscovered}
                  </span>
                  <span>•</span>
                  <span>
                    Products: <strong className="text-teal-400">{job.stats.recordsExtracted}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Images: <strong className="text-rose-400">{job.stats.imagesDownloaded}</strong> / {job.stats.imagesDiscovered}
                  </span>
                  {job.stats.downloadFailures > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-rose-400">Failures: {job.stats.downloadFailures}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Job Action Buttons */}
              <div className="flex items-center space-x-2 rtl:space-x-reverse flex-shrink-0">
                {job.state === 'RUNNING' && (
                  <button
                    onClick={() => pauseJob(job.id)}
                    className="p-1.5 bg-amber-600/30 text-amber-300 hover:bg-amber-600/50 rounded-lg text-xs"
                    title="Pause Job"
                  >
                    <Pause className="w-4 h-4" />
                  </button>
                )}

                {job.state === 'PAUSED' && (
                  <button
                    onClick={() => resumeJob(job.id)}
                    className="p-1.5 bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/50 rounded-lg text-xs"
                    title="Resume Job"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                )}

                {job.state === 'INTERRUPTED' && (
                  <button
                    onClick={() => handleResumeInterrupted(job.id)}
                    className="flex items-center space-x-1 bg-rose-600/30 text-rose-300 hover:bg-rose-600/50 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                    title="Resume Interrupted Work"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Recover</span>
                  </button>
                )}

                {(job.state === 'RUNNING' || job.state === 'PAUSED') && (
                  <button
                    onClick={() => stopJob(job.id)}
                    className="p-1.5 bg-rose-600/30 text-rose-300 hover:bg-rose-600/50 rounded-lg text-xs"
                    title="Stop Job"
                  >
                    <StopCircle className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => handleDelete(job.id)}
                  className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg text-xs"
                  title="Delete Job"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
