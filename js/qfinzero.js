/* Preserve the author-supplied BibTeX as an original artifact. */
(function(){
  const root=document.getElementById('qfz-citation');
  let failed=false;
  fetch('data/citations/qfinzero.bib').then(response=>{if(!response.ok)throw new Error('Unavailable citation');return response.text();}).then(text=>{root.textContent=text;}).catch(()=>{failed=true;root.textContent=window.LOI18n.t('qfz.citationError');});
  window.addEventListener('lo:languagechange',()=>{if(failed)root.textContent=window.LOI18n.t('qfz.citationError');});
})();
