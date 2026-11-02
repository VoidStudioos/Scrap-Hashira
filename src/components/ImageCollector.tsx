import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Download,
  Filter,
  CheckCircle,
  AlertTriangle,
  Play,
  Pause,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useScraperStore } from '../store/useScraperStore';
import { I18nManager } from '../localization/i18n';
import { ImageDownloader } from '../engines/images/imageDownloader';
import type { ExtractedImage } from '../types';

export const ImageCollector: React.FC = () => {
  const { currentImages, activeJob, performanceConfig, setPerformanceConfig, loadJobs } = useScraperStore();
  const [filterType, setFilterType] = useState<string>('all');
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<{ completed: number; failed: number; total: number }>({
    completed: 0,
    failed: 0,
    total: 0,
  });

  const downloader = new ImageDownloader(performanceConfig.maxConcurrentDownloads);

  const filteredImages = currentImages.filter((img) => {
    if (filterType === 'all') return true;
    return img.classification === filterType;
  });

  const handleStartDownloads = async () => {
    if (filteredImages.length === 0) return;

    setIsDownloading(true);
    downloader.setConcurrency(performanceConfig.maxConcurrentDownloads);
    downloader.enqueue(filteredImages);

    downloader.onProgress((completed, failed, total) => {
      setDownloadProgress({ completed, failed, total });
    });

    await downloader.start();
    setIsDownloading(false);
    await loadJobs();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2 rtl:space-x-reverse">
            <ImageIcon className="w-5 h-5 text-rose-400" />
            <span>{I18nManager.t('imageCollector')}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Deep image discovery across srcset, data-attributes, CSS background-image, and SHA-256 deduplicated download queue.
          </p>
        </div>

        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <button
            onClick={handleStartDownloads}
            disabled={isDownloading || filteredImages.length === 0}
            className="flex items-center space-x-2 rtl:space-x-reverse bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition shadow disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isDownloading ? 'Downloading Image Queue...' : I18nManager.t('downloadImages')}</span>
          </button>
        </div>
      </div>

      {/* Download Progress Bar */}
      {isDownloading && (
        <div className="bg-slate-800/80 border border-rose-500/50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-xs text-slate-300">
            <span>Downloading image assets...</span>
            <span className="font-mono text-rose-400">
              {downloadProgress.completed} / {downloadProgress.total} completed ({downloadProgress.failed} failed)
            </span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
            <div
              className="bg-rose-500 h-2 transition-all duration-300"
              style={{
                width: `${downloadProgress.total ? (downloadProgress.completed / downloadProgress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Filter and Concurrency controls */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-slate-300 font-medium">Filter Classification:</span>
          {['all', 'product', 'thumbnail', 'logo', 'banner'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-2.5 py-1 rounded capitalize transition ${
                filterType === t
                  ? 'bg-rose-600 text-white font-semibold'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <span className="text-slate-400">Concurrency: {performanceConfig.maxConcurrentDownloads}</span>
          <input
            type="range"
            min="1"
            max="8"
            value={performanceConfig.maxConcurrentDownloads}
            onChange={(e) => setPerformanceConfig({ maxConcurrentDownloads: parseInt(e.target.value, 10) })}
            className="accent-rose-500 w-24"
          />
        </div>
      </div>

      {/* Image Gallery Grid */}
      {filteredImages.length === 0 ? (
        <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-xl p-12 text-center text-xs text-slate-400 space-y-2">
          <ImageIcon className="w-8 h-8 text-slate-500 mx-auto" />
          <p>No images discovered yet. Run a scrape or scan on a webpage with images.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredImages.map((img, idx) => (
            <div
              key={idx}
              className="bg-slate-800/60 border border-slate-700 rounded-lg overflow-hidden flex flex-col justify-between group hover:border-rose-500/50 transition"
            >
              <div className="h-36 bg-slate-900 flex items-center justify-center overflow-hidden relative">
                <img
                  src={img.resolvedUrl}
                  alt={img.fileName}
                  className="max-h-full max-w-full object-contain group-hover:scale-105 transition"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <span className="absolute top-1.5 right-1.5 bg-slate-950/80 px-1.5 py-0.5 rounded text-[10px] text-slate-300 font-mono">
                  {img.classification}
                </span>
              </div>

              <div className="p-2.5 text-[11px] space-y-1">
                <p className="font-mono text-slate-200 truncate" title={img.fileName}>
                  {img.fileName}
                </p>
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>{img.width && img.height ? `${img.width}x${img.height}` : 'Vector/Dynamic'}</span>
                  <span
                    className={`font-semibold ${
                      img.status === 'completed'
                        ? 'text-emerald-400'
                        : img.status === 'failed'
                        ? 'text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {img.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
