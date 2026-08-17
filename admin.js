(function () {
  if (!window.DevoileCatalog) return;
  var grid = document.querySelector('[data-admin-products]');
  var form = document.querySelector('[data-product-form]');
  var addButton = document.querySelector('[data-admin-add-product]');
  var resetButton = document.querySelector('[data-admin-reset-products]');
  var cancelButton = document.querySelector('[data-admin-cancel-edit]');
  var deleteButton = document.querySelector('[data-admin-delete-product]');
  var imagePreview = document.querySelector('[data-upload-preview]');
  var galleryPreview = document.querySelector('[data-gallery-preview]');
  var imageData = '';
  var galleryData = [];
  var MAX_GALLERY_IMAGES = 8;
  var MAX_UPLOAD_DIMENSION = 1600;
  var UPLOAD_JPEG_QUALITY = 0.85;
  var CARD_ASPECT_RATIO = 1 / 0.84; // must match .product-card.compact-product .product-media in styles.css
  var CROP_OUTPUT_WIDTH = 1200;
  var CROP_MIN_ZOOM = 1;
  var CROP_MAX_ZOOM = 3;
  var escapeHtml = window.DevoileCatalog.escapeHtml || function (value) { return String(value || ''); };
  function slug(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'product-' + Date.now(); }
  function notify(error) { alert(error && error.message ? error.message : String(error)); }
  function fitProductPhoto(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Could not read ' + file.name)); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('Could not read ' + file.name + ' as an image')); };
        img.onload = function () {
          var scale = Math.min(1, MAX_UPLOAD_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
          var width = Math.max(1, Math.round(img.naturalWidth * scale));
          var height = Math.max(1, Math.round(img.naturalHeight * scale));
          var canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', UPLOAD_JPEG_QUALITY));
        };
        img.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });
  }
  function ensureCropModal() {
    if (document.querySelector('[data-crop-modal]')) return;
    var shell = document.createElement('div');
    shell.className = 'crop-modal-shell';
    shell.hidden = true;
    shell.innerHTML = '' +
      '<div class="crop-backdrop" data-crop-close></div>' +
      '<section class="crop-modal" data-crop-modal aria-label="Position cover photo">' +
        '<div class="crop-head"><h2>Position cover photo</h2><button type="button" data-crop-close aria-label="Cancel">&times;</button></div>' +
        '<div class="crop-viewport" data-crop-viewport><img data-crop-image draggable="false" alt="" /></div>' +
        '<label class="crop-zoom">Zoom<input type="range" data-crop-zoom min="' + CROP_MIN_ZOOM + '" max="' + CROP_MAX_ZOOM + '" step="0.01" value="' + CROP_MIN_ZOOM + '" /></label>' +
        '<p class="crop-hint">Drag to reposition — this exact frame is what shoppers see on shop cards.</p>' +
        '<div class="crop-actions"><button type="button" data-crop-cancel>Cancel</button><button type="button" data-crop-apply>Use this photo</button></div>' +
      '</section>';
    document.body.appendChild(shell);
  }

  function cropCoverPhotoFromDataUrl(sourceDataUrl) {
    return new Promise(function (resolve, reject) {
      if (!sourceDataUrl) { reject(new Error('No image to crop')); return; }
      ensureCropModal();
      var shell = document.querySelector('.crop-modal-shell');
      var viewport = document.querySelector('[data-crop-viewport]');
      var imgEl = document.querySelector('[data-crop-image]');
      var zoomInput = document.querySelector('[data-crop-zoom]');
      var applyButton = document.querySelector('[data-crop-apply]');
      var cancelButton = document.querySelector('[data-crop-cancel]');
      var closeButtons = Array.prototype.slice.call(document.querySelectorAll('[data-crop-close]'));

      var naturalW, naturalH, viewportW, viewportH, baseScale, scale, offsetX, offsetY, dragging, dragStartX, dragStartY, startOffsetX, startOffsetY;

      function layout() {
        var rect = viewport.getBoundingClientRect();
        viewportW = rect.width;
        viewportH = rect.height;
        baseScale = Math.max(viewportW / naturalW, viewportH / naturalH);
      }
      function clampOffsets() {
        var w = naturalW * scale;
        var h = naturalH * scale;
        offsetX = Math.min(0, Math.max(viewportW - w, offsetX));
        offsetY = Math.min(0, Math.max(viewportH - h, offsetY));
      }
      function applyTransform() {
        clampOffsets();
        imgEl.style.width = (naturalW * scale) + 'px';
        imgEl.style.height = (naturalH * scale) + 'px';
        imgEl.style.transform = 'translate(' + offsetX + 'px,' + offsetY + 'px)';
      }
      function reset() {
        layout();
        scale = baseScale;
        offsetX = (viewportW - naturalW * scale) / 2;
        offsetY = (viewportH - naturalH * scale) / 2;
        zoomInput.value = String(CROP_MIN_ZOOM);
        applyTransform();
      }
      function onZoomInput() {
        var zoom = Number(zoomInput.value) || CROP_MIN_ZOOM;
        var prevScale = scale;
        scale = baseScale * zoom;
        var cx = viewportW / 2;
        var cy = viewportH / 2;
        offsetX = cx - ((cx - offsetX) / prevScale) * scale;
        offsetY = cy - ((cy - offsetY) / prevScale) * scale;
        applyTransform();
      }
      function pointerDown(event) {
        dragging = true;
        dragStartX = event.clientX;
        dragStartY = event.clientY;
        startOffsetX = offsetX;
        startOffsetY = offsetY;
        try { viewport.setPointerCapture(event.pointerId); } catch (error) {}
        viewport.classList.add('dragging');
      }
      function pointerMove(event) {
        if (!dragging) return;
        offsetX = startOffsetX + (event.clientX - dragStartX);
        offsetY = startOffsetY + (event.clientY - dragStartY);
        applyTransform();
      }
      function pointerUp(event) {
        dragging = false;
        viewport.classList.remove('dragging');
        try { viewport.releasePointerCapture(event.pointerId); } catch (error) {}
      }
      function onResize() { reset(); }

      function cleanup() {
        shell.hidden = true;
        document.body.classList.remove('crop-open');
        viewport.removeEventListener('pointerdown', pointerDown);
        viewport.removeEventListener('pointermove', pointerMove);
        viewport.removeEventListener('pointerup', pointerUp);
        viewport.removeEventListener('pointercancel', pointerUp);
        zoomInput.removeEventListener('input', onZoomInput);
        applyButton.removeEventListener('click', onApply);
        cancelButton.removeEventListener('click', onCancel);
        closeButtons.forEach(function (btn) { btn.removeEventListener('click', onCancel); });
        window.removeEventListener('resize', onResize);
      }
      function onCancel() { cleanup(); resolve(null); }
      function onApply() {
        var outputW = CROP_OUTPUT_WIDTH;
        var outputH = Math.round(outputW / CARD_ASPECT_RATIO);
        var canvas = document.createElement('canvas');
        canvas.width = outputW;
        canvas.height = outputH;
        var ctx = canvas.getContext('2d');
        var srcX = -offsetX / scale;
        var srcY = -offsetY / scale;
        var srcW = viewportW / scale;
        var srcH = viewportH / scale;
        ctx.drawImage(imgEl, srcX, srcY, srcW, srcH, 0, 0, outputW, outputH);
        cleanup();
        resolve(canvas.toDataURL('image/jpeg', UPLOAD_JPEG_QUALITY));
      }

      imgEl.onerror = function () { reject(new Error('Could not read that image')); };
      imgEl.onload = function () {
        naturalW = imgEl.naturalWidth;
        naturalH = imgEl.naturalHeight;
        shell.hidden = false;
        document.body.classList.add('crop-open');
        reset();
        viewport.addEventListener('pointerdown', pointerDown);
        viewport.addEventListener('pointermove', pointerMove);
        viewport.addEventListener('pointerup', pointerUp);
        viewport.addEventListener('pointercancel', pointerUp);
        zoomInput.addEventListener('input', onZoomInput);
        applyButton.addEventListener('click', onApply);
        cancelButton.addEventListener('click', onCancel);
        closeButtons.forEach(function (btn) { btn.addEventListener('click', onCancel); });
        window.addEventListener('resize', onResize);
      };
      imgEl.src = sourceDataUrl;
    });
  }

  function cropCoverPhotoFromFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Could not read ' + file.name)); };
      reader.onload = function () { cropCoverPhotoFromDataUrl(String(reader.result || '')).then(resolve).catch(reject); };
      reader.readAsDataURL(file);
    });
  }

  function stockLabel(product) {
    if (product.status === 'sold_out' || Number(product.stock || 0) <= 0) return 'Sold out / restock needed';
    if (Number(product.stock || 0) <= 6) return 'Low stock / ' + product.stock + ' units';
    return 'In stock / ' + product.stock + ' units';
  }
  function render() {
    var products = window.DevoileCatalog.read();
    if (!grid) return;
    grid.innerHTML = products.length ? products.map(function (product) {
      return '<article data-admin-product-id="' + escapeHtml(product.id) + '">' +
        '<div class="admin-product-thumb">' + window.DevoileCatalog.visualMarkup(product) + '</div>' +
        '<strong>' + escapeHtml(product.name) + '</strong>' +
        '<span>' + window.DevoileCatalog.money(product.price) + (product.status === 'sale' ? ' / sale' : '') + '</span>' +
        '<p>' + escapeHtml(stockLabel(product)) + '</p>' +
        '<div class="admin-product-actions"><button type="button" data-edit-product="' + escapeHtml(product.id) + '">Edit</button><button type="button" data-remove-product="' + escapeHtml(product.id) + '">Remove</button></div>' +
      '</article>';
    }).join('') : '<div class="empty-products"><strong>No products yet.</strong><p>Add the first product and it will publish using the current storefront format.</p></div>';
  }
  function setPreview(src) {
    imageData = src || '';
    if (!imagePreview) return;
    imagePreview.innerHTML = imageData
      ? '<img src="' + imageData + '" alt="Uploaded product preview" /><button type="button" class="adjust-crop-button" data-adjust-crop>Adjust crop</button>'
      : '<span>No image uploaded</span>';
  }
  function renderGalleryPreview() {
    if (!galleryPreview) return;
    galleryPreview.innerHTML = galleryData.length ? galleryData.map(function (src, index) {
      return '<div class="gallery-preview-item"><img src="' + src + '" alt="Gallery photo ' + (index + 1) + '" /><button type="button" data-remove-gallery-image="' + index + '" aria-label="Remove photo ' + (index + 1) + '">&times;</button></div>';
    }).join('') : '<span class="gallery-preview-empty">No additional photos yet</span>';
  }
  function setGallery(images) { galleryData = (images || []).slice(0, MAX_GALLERY_IMAGES); renderGalleryPreview(); }
  function fillForm(product) {
    if (!form) return;
    form.elements.id.value = product.id || '';
    form.elements.name.value = product.name || '';
    form.elements.category.value = product.category || 'Lubricants';
    form.elements.price.value = product.price || '';
    form.elements.compareAt.value = product.compareAt || '';
    form.elements.status.value = product.status || 'in_stock';
    form.elements.stock.value = product.stock || 0;
    form.elements.visual.value = product.visual || 'tall';
    form.elements.tone.value = product.tone || '';
    form.elements.short.value = product.short || '';
    form.elements.description.value = product.description || '';
    setPreview(product.image || '');
    setGallery(product.images || []);
    deleteButton.hidden = !product.id;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function productFromForm() {
    var data = new FormData(form);
    var name = String(data.get('name') || '').trim();
    var id = String(data.get('id') || '').trim() || slug(name);
    return { id: id, name: name, category: String(data.get('category') || 'Lubricants'), price: Number(data.get('price') || 0), compareAt: data.get('compareAt') ? Number(data.get('compareAt')) : null, status: String(data.get('status') || 'in_stock'), stock: Number(data.get('stock') || 0), visual: String(data.get('visual') || 'tall'), tone: String(data.get('tone') || ''), image: imageData, short: String(data.get('short') || ''), description: String(data.get('description') || ''), images: galleryData.slice() };
  }
  function clearForm() { if (!form) return; form.reset(); form.elements.id.value = ''; setPreview(''); setGallery([]); deleteButton.hidden = true; }
  if (addButton) addButton.addEventListener('click', function () { fillForm({ id: '' }); });
  if (cancelButton) cancelButton.addEventListener('click', clearForm);
  if (resetButton) resetButton.addEventListener('click', async function () { if (!confirm('Reset products to seeded defaults?')) return; try { await window.DevoileCatalog.reset(); clearForm(); await render(); } catch (error) { notify(error); } });
  if (form) {
    var upload = form.querySelector('[name="imageUpload"]');
    if (upload) upload.addEventListener('change', function () {
      var file = upload.files && upload.files[0];
      upload.value = '';
      if (!file) return;
      if (!/^image\//.test(file.type)) { notify('Choose an image file.'); return; }
      if (file.size > 15 * 1024 * 1024) { notify('Keep the source photo under 15MB.'); return; }
      cropCoverPhotoFromFile(file).then(function (dataUrl) { if (dataUrl) setPreview(dataUrl); }).catch(notify);
    });
    var galleryUpload = form.querySelector('[name="galleryUpload"]');
    if (galleryUpload) galleryUpload.addEventListener('change', function () {
      var files = Array.prototype.slice.call(galleryUpload.files || []);
      galleryUpload.value = '';
      if (!files.length) return;
      if (galleryData.length >= MAX_GALLERY_IMAGES) { notify('You can add up to ' + MAX_GALLERY_IMAGES + ' additional photos.'); return; }
      files.slice(0, MAX_GALLERY_IMAGES - galleryData.length).forEach(function (file) {
        if (!/^image\//.test(file.type)) { notify('Choose image files only.'); return; }
        if (file.size > 15 * 1024 * 1024) { notify('Keep each source photo under 15MB.'); return; }
        fitProductPhoto(file).then(function (dataUrl) { galleryData.push(dataUrl); renderGalleryPreview(); }).catch(notify);
      });
    });
    form.addEventListener('submit', async function (event) { event.preventDefault(); try { await window.DevoileCatalog.save(productFromForm()); clearForm(); await render(); } catch (error) { notify(error); } });
  }
  document.addEventListener('click', async function (event) {
    var edit = event.target.closest('[data-edit-product]');
    var remove = event.target.closest('[data-remove-product]');
    var removeGalleryImage = event.target.closest('[data-remove-gallery-image]');
    var adjustCrop = event.target.closest('[data-adjust-crop]');
    if (edit) { var product = window.DevoileCatalog.byId(edit.getAttribute('data-edit-product')); if (product) fillForm(product); }
    if (remove) { if (!confirm('Remove this product from the catalog?')) return; try { await window.DevoileCatalog.remove(remove.getAttribute('data-remove-product')); await render(); } catch (error) { notify(error); } }
    if (removeGalleryImage) { galleryData.splice(Number(removeGalleryImage.getAttribute('data-remove-gallery-image')), 1); renderGalleryPreview(); }
    if (adjustCrop) { cropCoverPhotoFromDataUrl(imageData).then(function (dataUrl) { if (dataUrl) setPreview(dataUrl); }).catch(notify); }
  });
  if (deleteButton) deleteButton.addEventListener('click', async function () { var id = form.elements.id.value; if (!id || !confirm('Delete this product?')) return; try { await window.DevoileCatalog.remove(id); clearForm(); await render(); } catch (error) { notify(error); } });
  window.addEventListener('devoile-products-updated', function () { if (grid) render(); });
  render();
})();
