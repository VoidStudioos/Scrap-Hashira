import { useUI } from '../sidepanel/store';
import { messages } from '../localization';
import { Scope } from './Scope';
export function Images() {
  const { settings, detection, config, set } = useUI();
  const t = messages[settings.language];
  return (
    <section>
      <div className="section-heading">
        <h2>{t.images}</h2>
        <span className="badge">{detection?.images.length || 0}</span>
      </div>
      <p className="muted fine">{t.imageHelp}</p>
      <div className="button-row">
        <button onClick={() => set({ config: { ...config, selectedImageUrls: undefined } })}>
          {settings.language === 'fa' ? 'همه تصاویر' : 'All images'}
        </button>
        <button onClick={() => set({ config: { ...config, selectedImageUrls: [] } })}>
          {settings.language === 'fa' ? 'پاک کردن انتخاب' : 'Clear selection'}
        </button>
      </div>
      {detection && detection.images.length > 300 && (
        <p className="muted fine">
          {settings.language === 'fa'
            ? 'پیش‌نمایش محدود به ۳۰۰ تصویر نخست است؛ انتخاب همه شامل کل تصاویر کشف‌شده است.'
            : 'Preview shows the first 300 images; All images selects all discovered candidates.'}
        </p>
      )}
      <div className="image-grid">
        {detection?.images.slice(0, 300).map((image) => (
          <article className="image-card" key={image.url}>
            <label className="check image-check">
              <input
                type="checkbox"
                checked={!config.selectedImageUrls || config.selectedImageUrls.includes(image.url)}
                onChange={(e) => {
                  const list = config.selectedImageUrls || detection.images.map((i) => i.url);
                  set({
                    config: {
                      ...config,
                      selectedImageUrls: e.target.checked
                        ? [...list, image.url]
                        : list.filter((u) => u !== image.url),
                    },
                  });
                }}
              />
              {settings.language === 'fa' ? 'انتخاب' : 'Select'}
            </label>
            <div className="image-placeholder">
              {image.url.startsWith('data:') ||
              new URL(image.url).origin === new URL(detection.url).origin ? (
                <img src={image.url} alt={image.role} loading="lazy" referrerPolicy="no-referrer" />
              ) : image.role === 'product' ? (
                '◇'
              ) : (
                '▧'
              )}
            </div>
            <span className="image-role">
              {image.role} · {Math.round(image.confidence * 100)}%
            </span>
            <code title={image.url}>
              {image.url.startsWith('data:')
                ? 'Embedded image'
                : new URL(image.url).pathname.split('/').pop() || new URL(image.url).hostname}
            </code>
            <small>
              {image.width || '?'} × {image.height || '?'} · {image.recordIds.length} {t.records}
            </small>
            <small>{image.sources.join(', ')}</small>
          </article>
        ))}
      </div>
      {!detection && <p className="empty">{t.empty}</p>}
      <Scope />
    </section>
  );
}
