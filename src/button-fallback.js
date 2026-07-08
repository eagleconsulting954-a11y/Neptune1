document.addEventListener('click', function(event) {
  var button = event.target.closest('button');
  if (!button) return;
  var hasAction = button.dataset.page || button.dataset.popup || button.dataset.menu || button.dataset.close || button.dataset.search || button.dataset.toast || button.dataset.drawer || button.type === 'submit';
  if (hasAction) return;
  event.preventDefault();
  var label = (button.getAttribute('aria-label') || button.textContent || 'Neptune action').replace(/\s+/g, ' ').trim();
  var old = document.querySelector('.fallback-backdrop');
  if (old) old.remove();
  var box = document.createElement('div');
  box.className = 'fallback-backdrop';
  box.innerHTML = '<aside class="fallback-panel glass"><button class="fallback-close">×</button><p class="eyebrow">Prototype control</p><h1>' + label + '</h1><p>This control is connected. The production version will open the related Neptune workflow, show the current record, assign an owner, set a due date, and save the action history.</p><div class="fallback-grid"><label>Control<input value="' + label + '" /></label><label>Status<input value="Ready" /></label><label>Module<input value="Neptune" /></label><label>Next step<input value="Backend connection" /></label></div><button class="fallback-ok primary small">Save action</button></aside>';
  document.body.appendChild(box);
  box.addEventListener('click', function(e) {
    if (e.target === box || e.target.classList.contains('fallback-close') || e.target.classList.contains('fallback-ok')) box.remove();
  });
});
