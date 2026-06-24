const buildReportHtmlBeforeV22 = window.buildReportHtml;

window.buildReportHtml = async function buildReportHtmlV22() {
  let html = await buildReportHtmlBeforeV22();

  html = html.replace(
    /<figure><img([^>]*)><figcaption>/g,
    '<figure><button class="report-photo-open" type="button" aria-label="Открыть фотографию крупно"><img$1></button><figcaption>'
  );

  const reportOverrides = `
    .report-photo-group{margin:22px 0}
    .report-photo-group>h4{font-size:18px;color:#184f3a;margin:0 0 10px}
    .report-photos{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:18px!important;align-items:start}
    .report-photos figure{margin:0!important;border:1px solid #c9d9d0!important;border-radius:14px!important;overflow:hidden!important;background:#fff!important;box-shadow:0 5px 18px rgba(24,79,58,.08)}
    .report-photo-open{display:block;width:100%;padding:0;border:0;background:#111;cursor:zoom-in;line-height:0}
    .report-photos img{display:block!important;width:100%!important;height:auto!important;max-height:none!important;object-fit:contain!important;background:#111!important}
    .report-photos figcaption{padding:10px 12px!important;font-size:13px!important;color:#52645a!important;min-height:20px}
    .report-photo-hint{margin:6px 0 13px;color:#657168;font-size:13px}
    .report-lightbox{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.94);padding:18px;cursor:zoom-out}
    .report-lightbox.open{display:flex}
    .report-lightbox img{display:block;max-width:96vw;max-height:92vh;width:auto;height:auto;object-fit:contain;touch-action:pinch-zoom;user-select:none}
    .report-lightbox-close{position:fixed;right:16px;top:14px;width:44px;height:44px;border:0;border-radius:50%;background:rgba(255,255,255,.17);color:#fff;font-size:30px;line-height:40px;cursor:pointer}
    @media(max-width:700px){.report-photos{grid-template-columns:1fr!important;gap:14px!important}.report-photos figure{border-radius:12px!important}.report-lightbox{padding:6px}.report-lightbox img{max-width:100vw;max-height:94vh}}
    @media print{.report-photo-hint,.report-lightbox{display:none!important}.report-photos{grid-template-columns:repeat(2,minmax(0,1fr))!important}.report-photo-open{cursor:default}.report-photos img{width:100%!important;height:auto!important;max-height:none!important}}
  `;

  html = html.replace('</style></head>', `${reportOverrides}</style></head>`);
  html = html.replace(/<h3>Фотографии<\/h3>/g, '<h3>Фотографии</h3><p class="report-photo-hint">Нажмите на фотографию, чтобы открыть её в полном размере.</p>');

  const lightbox = `
    <div class="report-lightbox" id="reportLightbox" aria-hidden="true">
      <button class="report-lightbox-close" type="button" aria-label="Закрыть">×</button>
      <img id="reportLightboxImage" alt="Фотография локации в полном размере">
    </div>
    <script>
      (function(){
        var box=document.getElementById('reportLightbox');
        var image=document.getElementById('reportLightboxImage');
        function closeBox(){box.classList.remove('open');box.setAttribute('aria-hidden','true');image.removeAttribute('src');document.body.style.overflow='';}
        document.addEventListener('click',function(event){
          var button=event.target.closest('.report-photo-open');
          if(button){var source=button.querySelector('img');if(source){image.src=source.src;image.alt=source.alt||'Фотография локации';box.classList.add('open');box.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';}return;}
          if(event.target===box||event.target.closest('.report-lightbox-close'))closeBox();
        });
        document.addEventListener('keydown',function(event){if(event.key==='Escape')closeBox();});
      })();
    <\/script>
  `;

  html = html.replace('</main></body>', `</main>${lightbox}</body>`);
  return html;
};
