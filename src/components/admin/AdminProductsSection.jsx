import React, { useState, useEffect, useRef } from 'react';
import './AdminProductsSection.css';

const DEFAULT_CATEGORIES = [
  'Camisetas',
  'Sudaderas',
  'Pantalones',
  'Chaquetas',
  'Calzado',
  'Accesorios'
];

const PRESET_SIZES_APPAREL = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const PRESET_SIZES_NUMERIC = ['28', '30', '32', '34', '36', '38', '39', '40', '41', '42'];

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function toLocalDatetimeInput(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function fromLocalDatetimeInput(localStr) {
  if (!localStr) return null;
  const d = new Date(localStr);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function calculateLiveDiscountPreview(normalPrice, percent, startAt, endAt, isActive) {
  const price = Math.round(Number(normalPrice) || 0);
  const rawPercent = Math.round(Number(percent) || 0);
  const safePercent = Math.max(0, Math.min(99, rawPercent));
  const active = Boolean(isActive);

  let startDate = null;
  if (startAt) {
    const s = new Date(startAt);
    if (!isNaN(s.getTime())) startDate = s;
  }

  let endDate = null;
  if (endAt) {
    const e = new Date(endAt);
    if (!isNaN(e.getTime())) endDate = e;
  }

  const now = new Date();
  let status = 'INACTIVE';
  let isEffective = false;

  if (active && safePercent > 0) {
    if (startDate && now < startDate) {
      status = 'SCHEDULED';
      isEffective = false;
    } else if (endDate && now > endDate) {
      status = 'EXPIRED';
      isEffective = false;
    } else {
      status = 'ACTIVE';
      isEffective = true;
    }
  }

  let finalPrice = price;
  let savings = 0;
  if (isEffective) {
    finalPrice = Math.max(1000, Math.round(price * (1 - safePercent / 100)));
    savings = price - finalPrice;
  }

  return {
    normalPrice: price,
    finalPrice,
    savings,
    status,
    isEffective,
    percent: safePercent
  };
}

export const AdminProductsSection = ({ onNotification = () => {} }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [discountFilter, setDiscountFilter] = useState('ALL');

  // Modal de Creación / Edición
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Camisetas',
    price: 129900,
    stock: 50,
    sizes: ['S', 'M', 'L', 'XL'],
    color: 'Negro Profundo',
    composition: '100% Algodón Premium Heavyweight',
    description: '',
    is_active: true,
    discount_active: false,
    discount_percent: 0,
    discount_start_at: '',
    discount_end_at: ''
  });
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Modal de Gestión Rápida de Descuentos
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [discountTargetProduct, setDiscountTargetProduct] = useState(null);
  const [discountFormData, setDiscountFormData] = useState({
    price: 0,
    discount_active: false,
    discount_percent: 0,
    discount_start_at: '',
    discount_end_at: ''
  });
  const [discountModalError, setDiscountModalError] = useState(null);
  const [isSavingDiscount, setIsSavingDiscount] = useState(false);

  // Gestión de Galería de Imágenes (Neon S3 Storage)
  const [productImages, setProductImages] = useState([]);
  const [draftImages, setDraftImages] = useState([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [imageError, setImageError] = useState(null);
  const [dragOverDropzone, setDragOverDropzone] = useState(false);
  const [previewModalUrl, setPreviewModalUrl] = useState(null);
  const fileInputRef = useRef(null);

  // Modal de Eliminación de Producto
  const [deleteProductTarget, setDeleteProductTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Cargar productos al montar y al cambiar filtros
  useEffect(() => {
    loadProducts();
  }, [categoryFilter, statusFilter, discountFilter]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        search: searchTerm,
        category: categoryFilter,
        status: statusFilter,
        discount_status: discountFilter
      });
      const res = await fetch(`/api/admin/products?${query}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (err) {
      console.warn('Error consultando productos:', err);
    } finally {
      setLoading(false);
    }
  };

  // Abrir modal de creación
  const handleOpenCreateModal = () => {
    setEditingId(null);
    setFormData({
      name: '',
      category: 'Camisetas',
      price: 129900,
      stock: 50,
      sizes: ['S', 'M', 'L', 'XL'],
      color: 'Negro Profundo',
      composition: '100% Algodón Peinado 280 gsm',
      description: '',
      is_active: true,
      discount_active: false,
      discount_percent: 0,
      discount_start_at: '',
      discount_end_at: ''
    });
    setProductImages([]);
    setDraftImages([]);
    setFormError(null);
    setImageError(null);
    setIsModalOpen(true);
  };

  // Abrir modal de edición
  const handleOpenEditModal = async (p) => {
    setEditingId(p.id);
    setFormData({
      name: p.name || '',
      category: p.category || 'Camisetas',
      price: p.originalPrice || p.price || 0,
      stock: p.stock ?? 50,
      sizes: Array.isArray(p.sizes) ? p.sizes : ['S', 'M', 'L'],
      color: p.color || 'Negro',
      composition: p.composition || '',
      description: p.description || '',
      is_active: Boolean(p.is_active ?? p.isActive),
      discount_active: Boolean(p.discountActive ?? p.discount_active),
      discount_percent: Number(p.discountPercent ?? p.discount_percent ?? 0),
      discount_start_at: toLocalDatetimeInput(p.discountStartAt || p.discount_start_at),
      discount_end_at: toLocalDatetimeInput(p.discountEndAt || p.discount_end_at)
    });
    setDraftImages([]);
    setFormError(null);
    setImageError(null);
    setIsModalOpen(true);

    // Cargar galería de imágenes fresca desde Neon
    try {
      const res = await fetch(`/api/admin/products/${p.id}/images`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setProductImages(data.images || []);
      } else {
        setProductImages(p.images || []);
      }
    } catch {
      setProductImages(p.images || []);
    }
  };

  // Abrir modal de gestión rápida de descuentos
  const handleOpenDiscountModal = (p) => {
    setDiscountTargetProduct(p);
    setDiscountFormData({
      price: p.originalPrice || p.price || 0,
      discount_active: Boolean(p.discountActive ?? p.discount_active),
      discount_percent: Number(p.discountPercent ?? p.discount_percent ?? 0),
      discount_start_at: toLocalDatetimeInput(p.discountStartAt || p.discount_start_at),
      discount_end_at: toLocalDatetimeInput(p.discountEndAt || p.discount_end_at)
    });
    setDiscountModalError(null);
    setIsDiscountModalOpen(true);
  };

  // Guardar configuración de descuento
  const handleSaveDiscount = async (e) => {
    e.preventDefault();
    if (!discountTargetProduct) return;

    const numPrice = Number(discountFormData.price);
    if (isNaN(numPrice) || numPrice < 1000) {
      setDiscountModalError('El precio normal del producto debe ser mayor o igual a $1.000 COP.');
      return;
    }

    const isActive = Boolean(discountFormData.discount_active);
    const numPercent = Number(discountFormData.discount_percent);
    if (isActive && (isNaN(numPercent) || numPercent < 1 || numPercent > 99)) {
      setDiscountModalError('Para activar el descuento, debes especificar un porcentaje entre 1% y 99%.');
      return;
    }

    if (discountFormData.discount_start_at && discountFormData.discount_end_at) {
      const s = new Date(discountFormData.discount_start_at);
      const end = new Date(discountFormData.discount_end_at);
      if (end.getTime() <= s.getTime()) {
        setDiscountModalError('La fecha y hora de finalización debe ser posterior a la de inicio.');
        return;
      }
    }

    setIsSavingDiscount(true);
    setDiscountModalError(null);

    try {
      const res = await fetch(`/api/admin/products/${discountTargetProduct.id}/discount`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          price: numPrice,
          discount_active: isActive,
          discount_percent: numPercent,
          discount_start_at: fromLocalDatetimeInput(discountFormData.discount_start_at),
          discount_end_at: fromLocalDatetimeInput(discountFormData.discount_end_at)
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsDiscountModalOpen(false);
        onNotification(`Descuento de "${discountTargetProduct.name}" actualizado exitosamente.`);
        loadProducts();
      } else {
        setDiscountModalError(data.message || 'Error guardando descuento.');
      }
    } catch {
      setDiscountModalError('Error de conexión al guardar descuento.');
    } finally {
      setIsSavingDiscount(false);
    }
  };

  // Conmutación rápida de estado de descuento
  const handleToggleProductDiscount = async (p) => {
    const nextStatus = !Boolean(p.discountActive ?? p.discount_active);
    try {
      const res = await fetch(`/api/admin/products/${p.id}/discount/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ discount_active: nextStatus })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onNotification(`Descuento de "${p.name}" ${nextStatus ? 'ACTIVADO' : 'DESACTIVADO'}.`);
        loadProducts();
      } else {
        alert(data.message || 'Error conmutando descuento.');
      }
    } catch {
      alert('Error de conexión con el servidor.');
    }
  };

  const handleToggleSize = (size) => {
    setFormData((prev) => {
      const currentSizes = prev.sizes || [];
      if (currentSizes.includes(size)) {
        return { ...prev, sizes: currentSizes.filter((s) => s !== size) };
      } else {
        return { ...prev, sizes: [...currentSizes, size] };
      }
    });
  };

  // Procesar archivos seleccionados o arrastrados
  const processSelectedFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setImageError(null);

    const validFiles = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];

      // Validación de MIME
      if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
        setImageError(`El archivo "${file.name}" no es válido. Solo se permiten imágenes JPEG, PNG, WebP, AVIF o GIF.`);
        return;
      }

      // Validación de tamaño (máx 5MB)
      if (file.size > MAX_FILE_SIZE) {
        setImageError(`El archivo "${file.name}" supera el tamaño máximo permitido de 5 MB.`);
        return;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // Convertir a DataURL / Base64 para vista previa instantánea
    const readBase64Promises = validFiles.map((file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            data: reader.result,
            originalName: file.name,
            mimeType: file.type,
            fileSize: file.size,
            isDraft: true
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    try {
      const base64Items = await Promise.all(readBase64Promises);

      // Si estamos editando un producto existente, subimos de inmediato a Neon S3
      if (editingId) {
        setIsUploadingImages(true);
        const res = await fetch(`/api/admin/products/${editingId}/images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ images: base64Items })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setProductImages(data.images || []);
          onNotification(data.message);
          loadProducts();
        } else {
          setImageError(data.message || 'Error subiendo imágenes al servidor.');
        }
      } else {
        // En modo creación, agregamos a draftImages con vista previa instantánea
        setDraftImages((prev) => {
          const next = [...prev];
          base64Items.forEach((item, idx) => {
            next.push({
              id: `draft-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
              url: item.data,
              data: item.data,
              alt_text: item.originalName,
              originalName: item.originalName,
              file_size: item.fileSize,
              mime_type: item.mimeType,
              is_primary: prev.length === 0 && idx === 0,
              isDraft: true
            });
          });
          return next;
        });
      }
    } catch {
      setImageError('Error al leer los archivos de imagen locales.');
    } finally {
      setIsUploadingImages(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Marcar imagen como principal
  const handleSetPrimary = async (targetImg) => {
    setImageError(null);

    if (editingId) {
      try {
        const res = await fetch(`/api/admin/products/${editingId}/images/${targetImg.id}/primary`, {
          method: 'PUT',
          credentials: 'include'
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setProductImages(data.images || []);
          onNotification('Imagen principal actualizada en Neon.');
          loadProducts();
        } else {
          setImageError(data.message || 'Error actualizando imagen principal.');
        }
      } catch {
        setImageError('Error de red al actualizar portada.');
      }
    } else {
      // Modo borrador
      setDraftImages((prev) =>
        prev.map((img) => ({
          ...img,
          is_primary: img.id === targetImg.id
        }))
      );
    }
  };

  // Reordenar imágenes (mover izquierda/arriba o derecha/abajo)
  const handleMoveImage = async (index, direction) => {
    const list = editingId ? [...productImages] : [...draftImages];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    // Intercambiar
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    if (editingId) {
      setProductImages(list);
      try {
        const orderedImageIds = list.map((img) => img.id);
        const res = await fetch(`/api/admin/products/${editingId}/images/reorder`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ orderedImageIds })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setProductImages(data.images || list);
          onNotification('Orden de imágenes guardado en Neon.');
        }
      } catch {
        setImageError('Error de red al reordenar imágenes.');
      }
    } else {
      setDraftImages(list);
    }
  };

  // Eliminar una imagen
  const handleDeleteImage = async (targetImg) => {
    setImageError(null);

    if (editingId) {
      try {
        const res = await fetch(`/api/admin/products/${editingId}/images/${targetImg.id}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setProductImages(data.images || []);
          onNotification('Imagen eliminada de Neon Object Storage.');
          loadProducts();
        } else {
          setImageError(data.message || 'Error eliminando imagen.');
        }
      } catch {
        setImageError('Error de red al eliminar imagen.');
      }
    } else {
      // Modo borrador
      setDraftImages((prev) => {
        const filtered = prev.filter((img) => img.id !== targetImg.id);
        // Si eliminó la principal, reasignar la primera si existe
        if (targetImg.is_primary && filtered.length > 0) {
          filtered[0].is_primary = true;
        }
        return filtered;
      });
    }
  };

  // Guardar producto (Crear o Actualizar)
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    setFormError(null);

    // Validaciones en cliente
    if (!formData.name.trim() || formData.name.trim().length < 3) {
      setFormError('El nombre del producto debe tener al menos 3 caracteres.');
      return;
    }
    const numPrice = Number(formData.price);
    if (isNaN(numPrice) || numPrice < 1000) {
      setFormError('El precio debe ser un número válido en COP mayor o igual a $1.000.');
      return;
    }
    const numStock = Number(formData.stock);
    if (isNaN(numStock) || numStock < 0) {
      setFormError('El inventario no puede ser negativo.');
      return;
    }
    if (!formData.color.trim()) {
      setFormError('El color principal es obligatorio.');
      return;
    }
    if (!formData.sizes || formData.sizes.length === 0) {
      setFormError('Debes seleccionar al menos una talla disponible.');
      return;
    }

    const isDiscountActive = Boolean(formData.discount_active);
    const numPercent = Number(formData.discount_percent || 0);
    if (isDiscountActive && (isNaN(numPercent) || numPercent < 1 || numPercent > 99)) {
      setFormError('Para activar un descuento promocional, el porcentaje debe estar entre 1% y 99%.');
      return;
    }

    if (formData.discount_start_at && formData.discount_end_at) {
      const s = new Date(formData.discount_start_at);
      const e = new Date(formData.discount_end_at);
      if (e.getTime() <= s.getTime()) {
        setFormError('La fecha y hora de finalización debe ser posterior a la de inicio.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const isEdit = Boolean(editingId);
      const url = isEdit ? `/api/admin/products/${editingId}` : '/api/admin/products';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        price: numPrice,
        stock: numStock,
        discount_active: isDiscountActive,
        discount_percent: numPercent,
        discount_start_at: fromLocalDatetimeInput(formData.discount_start_at),
        discount_end_at: fromLocalDatetimeInput(formData.discount_end_at)
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const savedProduct = data.product;

        // Si creamos un producto nuevo y tenemos draftImages, subirlas ahora
        if (!isEdit && draftImages.length > 0 && savedProduct?.id) {
          try {
            await fetch(`/api/admin/products/${savedProduct.id}/images`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                images: draftImages.map((d) => ({
                  image: d.data,
                  originalName: d.originalName || `${savedProduct.name}-image`,
                  mimeType: d.mime_type,
                  isPrimary: Boolean(d.is_primary)
                }))
              })
            });
          } catch (imgErr) {
            console.warn('Aviso al subir imágenes de nuevo producto:', imgErr);
          }
        }

        setIsModalOpen(false);
        onNotification(
          isEdit
            ? `Producto "${formData.name}" actualizado en Neon PostgreSQL.`
            : `Producto "${formData.name}" creado con sus imágenes en Neon exitosamente.`
        );
        loadProducts();
      } else {
        setFormError(data.message || 'Error guardando producto en el servidor.');
      }
    } catch {
      setFormError('Error de conexión con el servidor al guardar.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (product) => {
    const newStatus = !Boolean(product.is_active ?? product.isActive);
    try {
      const res = await fetch(`/api/admin/products/${product.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: newStatus })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onNotification(`Producto "${product.name}" ${newStatus ? 'ACTIVADO' : 'DESACTIVADO'} para la tienda.`);
        loadProducts();
      } else {
        alert(data.message || 'Error modificando estado.');
      }
    } catch {
      alert('Error de red al actualizar estado.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteProductTarget || isDeleting) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/admin/products/${deleteProductTarget.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeleteProductTarget(null);
        onNotification(data.message);
        loadProducts();
      } else {
        alert(data.message || 'Error eliminando producto.');
      }
    } catch {
      alert('Error de red al eliminar producto.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatCOPPreview = (price) => {
    const num = Math.round(Number(price) || 0);
    return `$${num.toLocaleString('es-CO')} COP`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Imágenes a mostrar en el modal (reales o borradores)
  const activeModalImages = editingId ? productImages : draftImages;

  return (
    <div className="admin-products-container">
      
      {/* BARRA DE HERRAMIENTAS, FILTROS Y BÚSQUEDA */}
      <div className="products-toolbar">
        <div className="toolbar-filters">
          <input
            type="search"
            className="product-search-input"
            placeholder="Buscar por nombre, ID, color..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadProducts()}
          />
          <button type="button" className="btn-search" onClick={loadProducts}>
            Buscar
          </button>

          <select
            className="product-select-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="ALL">Todas las Categorías</option>
            {DEFAULT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            className="product-select-filter discount-filter"
            value={discountFilter}
            onChange={(e) => setDiscountFilter(e.target.value)}
            title="Filtrar por estado de promociones y descuentos"
          >
            <option value="ALL">Todos los Descuentos</option>
            <option value="ACTIVE">🟢 Activos Ahora</option>
            <option value="SCHEDULED">🟡 Programados a Futuro</option>
            <option value="EXPIRED">⌛ Promociones Vencidas</option>
            <option value="WITH_DISCOUNT">🏷️ Con Algún Descuento</option>
            <option value="INACTIVE">⚪ Sin Descuento</option>
          </select>

          <div className="status-pill-group">
            <button
              type="button"
              className={`status-pill-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              Todos
            </button>
            <button
              type="button"
              className={`status-pill-btn ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ACTIVE')}
            >
              Activos
            </button>
            <button
              type="button"
              className={`status-pill-btn ${statusFilter === 'INACTIVE' ? 'active' : ''}`}
              onClick={() => setStatusFilter('INACTIVE')}
            >
              Inactivos
            </button>
          </div>
        </div>

        <button
          type="button"
          className="btn-create-product"
          onClick={handleOpenCreateModal}
        >
          <span>＋</span> Nuevo Producto
        </button>
      </div>

      {/* TABLA DE PRODUCTOS */}
      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Prenda y Vista</th>
              <th>Categoría</th>
              <th>Precio Normal</th>
              <th>Descuento / Promo</th>
              <th>Precio Final</th>
              <th>Tallas</th>
              <th>Color</th>
              <th>Inventario</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="11" className="text-center py-4 text-muted">
                  Cargando catálogo e imágenes desde Neon PostgreSQL...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan="11" className="text-center py-4 text-muted">
                  No se encontraron productos con los filtros aplicados.
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const isActive = Boolean(p.is_active ?? p.isActive);
                const stockNum = Number(p.stock ?? 50);
                const mainImage = p.image || p.images?.[0]?.url || '/images/products/prod-tshirt.jpg';
                const imageCount = p.images?.length || 1;

                return (
                  <tr key={p.id}>
                    <td>
                      <code style={{ fontSize: '0.75rem', color: '#888' }}>{p.id}</code>
                    </td>
                    <td>
                      <div className="product-cell-with-thumb">
                        <div
                          className="table-product-thumb"
                          onClick={() => setPreviewModalUrl(mainImage)}
                          title="Clic para ampliar imagen"
                        >
                          <img src={mainImage} alt={p.name} />
                          {imageCount > 1 && (
                            <span className="thumb-gallery-count" title={`${imageCount} fotos disponibles`}>
                              📷 {imageCount}
                            </span>
                          )}
                        </div>
                        <div className="product-cell-name">
                          <span className="product-title-bold">{p.name}</span>
                          {p.composition && (
                            <span className="product-sub-meta">{p.composition}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="category-tag">{p.category}</span>
                    </td>
                    <td>
                      <span className="price-text-cop normal-price">
                        {p.formattedOriginalPrice || p.formatted_price || formatCOPPreview(p.price)}
                      </span>
                    </td>
                    <td>
                      {p.discountStatus === 'ACTIVE' && (
                        <span
                          className="badge-promo-active"
                          title={p.discountEndAt ? `Vence: ${new Date(p.discountEndAt).toLocaleString('es-CO')}` : 'Sin fecha fin'}
                        >
                          🟢 -{p.discountPercent}% ACTIVO
                        </span>
                      )}
                      {p.discountStatus === 'SCHEDULED' && (
                        <span
                          className="badge-promo-scheduled"
                          title={p.discountStartAt ? `Inicia: ${new Date(p.discountStartAt).toLocaleString('es-CO')}` : ''}
                        >
                          🟡 -{p.discountPercent}% PROG
                        </span>
                      )}
                      {p.discountStatus === 'EXPIRED' && (
                        <span
                          className="badge-promo-expired"
                          title={p.discountEndAt ? `Venció: ${new Date(p.discountEndAt).toLocaleString('es-CO')}` : ''}
                        >
                          ⌛ VENCIDO (-{p.discountPercent}%)
                        </span>
                      )}
                      {p.discountStatus === 'INACTIVE' && (
                        <span className="badge-promo-none">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`price-final-highlight ${p.hasActiveDiscount ? 'is-discounted' : ''}`}>
                        {p.formattedPrice || p.formatted_price || formatCOPPreview(p.price)}
                      </span>
                    </td>
                    <td>
                      <div className="sizes-badge-container">
                        {Array.isArray(p.sizes) && p.sizes.map((s) => (
                          <span key={s} className="size-chip">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td>{p.color || 'Negro'}</td>
                    <td>
                      <span
                        className={`stock-badge ${
                          stockNum === 0
                            ? 'stock-out'
                            : stockNum <= 10
                            ? 'stock-low'
                            : 'stock-high'
                        }`}
                      >
                        {stockNum} u. {stockNum <= 10 ? '⚠️' : '✓'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`status-toggle-btn ${isActive ? 'active' : 'inactive'}`}
                        onClick={() => handleToggleStatus(p)}
                        title="Haz clic para alternar activación"
                      >
                        {isActive ? '🟢 Activo' : '⚪ Inactivo'}
                      </button>
                    </td>
                    <td>
                      <div className="action-buttons-cell">
                        <button
                          type="button"
                          className="btn-action-discount"
                          onClick={() => handleOpenDiscountModal(p)}
                          title="Gestionar precios y promociones"
                        >
                          🏷️ Descuento
                        </button>
                        <button
                          type="button"
                          className="btn-action-gallery"
                          onClick={() => handleOpenEditModal(p)}
                          title="Administrar galería de imágenes"
                        >
                          🖼️ Fotos ({imageCount})
                        </button>
                        <button
                          type="button"
                          className="btn-action-edit"
                          onClick={() => handleOpenEditModal(p)}
                          title="Editar información del producto"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          className="btn-action-delete"
                          onClick={() => setDeleteProductTarget(p)}
                          title="Eliminar producto"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE CREACIÓN / EDICIÓN CON GESTIÓN DE IMÁGENES */}
      {isModalOpen && (
        <div className="product-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="product-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="product-modal-header">
              <div>
                <span className="modal-badge-tag">
                  {editingId ? 'Modificar Registro' : 'Catálogo Oficial'}
                </span>
                <h3 className="modal-header-title">
                  {editingId ? `Editar: ${formData.name || 'Producto'}` : 'Crear Nuevo Producto'}
                </h3>
              </div>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct}>
              <div className="product-modal-body">
                {formError && (
                  <div className="modal-error-box" role="alert">
                    ⚠️ {formError}
                  </div>
                )}

                <div className="product-form-grid">
                  
                  {/* NOMBRE */}
                  <div className="modal-field-group form-full-width">
                    <label className="modal-field-label">Nombre de la Prenda *</label>
                    <input
                      type="text"
                      className="modal-input"
                      placeholder="Ej: Camiseta Oversize 'Urban Artifacts'"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  {/* CATEGORÍA */}
                  <div className="modal-field-group">
                    <label className="modal-field-label">Categoría *</label>
                    <select
                      className="modal-input"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                    >
                      {DEFAULT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* PRECIO EN COP */}
                  <div className="modal-field-group">
                    <label className="modal-field-label">
                      <span>Precio Oficial ($ COP) *</span>
                      <strong style={{ color: 'var(--color-accent, #FF5A1F)' }}>
                        {formatCOPPreview(formData.price)}
                      </strong>
                    </label>
                    <input
                      type="number"
                      className="modal-input"
                      min="1000"
                      step="500"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                    />
                  </div>

                  {/* INVENTARIO */}
                  <div className="modal-field-group">
                    <label className="modal-field-label">Stock en Inventario *</label>
                    <input
                      type="number"
                      className="modal-input"
                      min="0"
                      step="1"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      required
                    />
                  </div>

                  {/* COLOR */}
                  <div className="modal-field-group">
                    <label className="modal-field-label">Color Principal *</label>
                    <input
                      type="text"
                      className="modal-input"
                      placeholder="Ej: Negro Carbón, Blanco Óptico..."
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      required
                    />
                  </div>

                  {/* COMPOSICIÓN */}
                  <div className="modal-field-group form-full-width">
                    <label className="modal-field-label">Composición Textil / Especificación</label>
                    <input
                      type="text"
                      className="modal-input"
                      placeholder="Ej: 100% Algodón Peinado 280 gsm Heavyweight"
                      value={formData.composition}
                      onChange={(e) => setFormData({ ...formData, composition: e.target.value })}
                    />
                  </div>

                  {/* SELECTOR DE TALLAS */}
                  <div className="modal-field-group form-full-width">
                    <label className="modal-field-label">
                      <span>Tallas Disponibles *</span>
                      <span style={{ color: '#aaa', fontSize: '0.75rem' }}>
                        Seleccionadas: {formData.sizes?.join(', ') || 'Ninguna'}
                      </span>
                    </label>
                    <div className="sizes-selector-box">
                      {PRESET_SIZES_APPAREL.map((size) => (
                        <button
                          key={size}
                          type="button"
                          className={`size-select-btn ${formData.sizes?.includes(size) ? 'selected' : ''}`}
                          onClick={() => handleToggleSize(size)}
                        >
                          {size}
                        </button>
                      ))}
                      {PRESET_SIZES_NUMERIC.map((size) => (
                        <button
                          key={size}
                          type="button"
                          className={`size-select-btn ${formData.sizes?.includes(size) ? 'selected' : ''}`}
                          onClick={() => handleToggleSize(size)}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* DESCRIPCIÓN */}
                  <div className="modal-field-group form-full-width">
                    <label className="modal-field-label">Descripción de la Prenda</label>
                    <textarea
                      className="modal-input modal-textarea"
                      placeholder="Detalles sobre el corte, caída, cuello y estética de la prenda..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  {/* SECCIÓN DE PROMOCIÓN Y DESCUENTOS */}
                  <div className="form-full-width discount-management-panel">
                    <div className="discount-panel-header">
                      <div>
                        <h4 className="discount-panel-title">🏷️ Promoción y Descuentos</h4>
                        <p className="discount-panel-desc">
                          Configura promociones temporales o permanentes. El servidor calcula los precios finales y revierte automáticamente al precio normal cuando expire.
                        </p>
                      </div>
                      <label className="discount-toggle-switch">
                        <input
                          type="checkbox"
                          checked={formData.discount_active}
                          onChange={(e) => setFormData({ ...formData, discount_active: e.target.checked })}
                        />
                        <span className="toggle-label">{formData.discount_active ? 'Promoción ACTIVA' : 'Promoción INACTIVA'}</span>
                      </label>
                    </div>

                    {formData.discount_active && (
                      <div className="discount-fields-grid">
                        <div className="modal-field-group">
                          <label className="modal-field-label">Porcentaje de Descuento (%) *</label>
                          <div className="percent-input-wrapper">
                            <input
                              type="number"
                              className="modal-input"
                              min="1"
                              max="99"
                              step="1"
                              placeholder="Ej: 20"
                              value={formData.discount_percent || ''}
                              onChange={(e) => setFormData({ ...formData, discount_percent: e.target.value })}
                              required={formData.discount_active}
                            />
                            <span className="percent-suffix">% OFF</span>
                          </div>
                        </div>

                        <div className="modal-field-group">
                          <label className="modal-field-label">Fecha y Hora de Inicio (Opcional)</label>
                          <input
                            type="datetime-local"
                            className="modal-input"
                            value={formData.discount_start_at}
                            onChange={(e) => setFormData({ ...formData, discount_start_at: e.target.value })}
                          />
                          <small className="field-hint">Vacío = Activo inmediatamente</small>
                        </div>

                        <div className="modal-field-group">
                          <label className="modal-field-label">Fecha y Hora de Fin (Opcional)</label>
                          <input
                            type="datetime-local"
                            className="modal-input"
                            value={formData.discount_end_at}
                            onChange={(e) => setFormData({ ...formData, discount_end_at: e.target.value })}
                          />
                          <small className="field-hint">Vacío = Sin vencimiento automático</small>
                        </div>

                        {/* CALCULADORA EN TIEMPO REAL */}
                        {(() => {
                          const preview = calculateLiveDiscountPreview(
                            formData.price,
                            formData.discount_percent,
                            formData.discount_start_at,
                            formData.discount_end_at,
                            formData.discount_active
                          );
                          return (
                            <div className="discount-live-preview-box">
                              <span className="preview-heading">⚡ Cálculo Oficial en Servidor:</span>
                              <div className="preview-metrics-row">
                                <div className="preview-metric">
                                  <span className="metric-label">Precio Normal:</span>
                                  <span className="metric-val">{formatCOPPreview(preview.normalPrice)}</span>
                                </div>
                                <div className="preview-metric">
                                  <span className="metric-label">Descuento:</span>
                                  <span className="metric-val discount-val">-{preview.percent}%</span>
                                </div>
                                <div className="preview-metric">
                                  <span className="metric-label">Ahorro Cliente:</span>
                                  <span className="metric-val savings-val">{formatCOPPreview(preview.savings)}</span>
                                </div>
                                <div className="preview-metric final-metric">
                                  <span className="metric-label">Precio Final Calculado:</span>
                                  <span className="metric-val highlight-final">{formatCOPPreview(preview.finalPrice)}</span>
                                </div>
                              </div>
                              <div className="preview-status-indicator">
                                <span>Estado estimado: </span>
                                {preview.status === 'ACTIVE' && <strong className="status-badge-active">🟢 ACTIVO AHORA en tienda pública</strong>}
                                {preview.status === 'SCHEDULED' && <strong className="status-badge-scheduled">🟡 PROGRAMADO (inicia en fecha futura)</strong>}
                                {preview.status === 'EXPIRED' && <strong className="status-badge-expired">⌛ VENCIDO (precio normal automático)</strong>}
                                {preview.status === 'INACTIVE' && <strong className="status-badge-inactive">⚪ INACTIVO</strong>}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* SECCIÓN DE GALERÍA DE IMÁGENES (NEON S3 STORAGE) */}
                  <div className="form-full-width image-management-panel">
                    <div className="image-panel-header">
                      <div>
                        <h4 className="image-panel-title">📸 Galería de Imágenes (Neon Object Storage)</h4>
                        <p className="image-panel-desc">
                          Sube fotos de alta definición. Las imágenes se guardan de forma persistente en Neon S3 y se optimizan para la vitrina pública.
                        </p>
                      </div>
                      <span className="image-count-tag">
                        {activeModalImages.length} {activeModalImages.length === 1 ? 'imagen' : 'imágenes'}
                      </span>
                    </div>

                    {imageError && (
                      <div className="image-error-alert" role="alert">
                        ⚠️ {imageError}
                      </div>
                    )}

                    {/* ZONA DE ARRASTRE Y SUBIDA */}
                    <div
                      className={`image-dropzone ${dragOverDropzone ? 'drag-over' : ''}`}
                      onDragOver={(e) => { e.preventDefault(); setDragOverDropzone(true); }}
                      onDragLeave={() => setDragOverDropzone(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverDropzone(false);
                        processSelectedFiles(e.dataTransfer.files);
                      }}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        id="product-images-input"
                        multiple
                        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                        onChange={(e) => processSelectedFiles(e.target.files)}
                        style={{ display: 'none' }}
                      />
                      <label htmlFor="product-images-input" className="dropzone-label-content">
                        <span className="dropzone-icon">☁️</span>
                        <div className="dropzone-texts">
                          <strong className="dropzone-cta">
                            {isUploadingImages ? 'Subiendo a Neon S3...' : 'Haz clic para seleccionar o arrastra imágenes aquí'}
                          </strong>
                          <span className="dropzone-sub">
                            Formatos: JPG, PNG, WebP, AVIF | Máx. 5 MB por archivo | Varias a la vez
                          </span>
                        </div>
                      </label>
                    </div>

                    {/* GRID DE TARJETAS DE IMÁGENES */}
                    {activeModalImages.length > 0 && (
                      <div className="image-cards-grid">
                        {activeModalImages.map((img, idx) => {
                          const isPrimary = Boolean(img.is_primary);
                          const isFirst = idx === 0;
                          const isLast = idx === activeModalImages.length - 1;

                          return (
                            <div
                              key={img.id || idx}
                              className={`image-card-item ${isPrimary ? 'is-primary-card' : ''}`}
                            >
                              <div className="image-card-thumb-wrapper">
                                <img src={img.url} alt={img.alt_text || 'Vista previa'} />

                                {isPrimary && (
                                  <span className="primary-cover-badge">
                                    ⭐ PORTADA PRINCIPAL
                                  </span>
                                )}

                                {!isPrimary && (
                                  <button
                                    type="button"
                                    className="btn-mark-primary"
                                    onClick={() => handleSetPrimary(img)}
                                    title="Marcar como imagen principal en el catálogo"
                                  >
                                    Hacer Principal
                                  </button>
                                )}

                                <button
                                  type="button"
                                  className="btn-preview-zoom"
                                  onClick={() => setPreviewModalUrl(img.url)}
                                  title="Ver imagen en tamaño completo"
                                >
                                  🔍
                                </button>
                              </div>

                              <div className="image-card-footer">
                                <div className="image-card-info">
                                  <span className="img-name" title={img.alt_text || img.originalName}>
                                    {img.alt_text || img.originalName || `Foto #${idx + 1}`}
                                  </span>
                                  {img.file_size > 0 && (
                                    <span className="img-size">{formatFileSize(img.file_size)}</span>
                                  )}
                                </div>

                                <div className="image-card-actions">
                                  <button
                                    type="button"
                                    className="btn-img-move"
                                    disabled={isFirst}
                                    onClick={() => handleMoveImage(idx, -1)}
                                    title="Mover antes"
                                  >
                                    ◀
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-img-move"
                                    disabled={isLast}
                                    onClick={() => handleMoveImage(idx, 1)}
                                    title="Mover después"
                                  >
                                    ▶
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-img-delete"
                                    onClick={() => handleDeleteImage(img)}
                                    title="Eliminar imagen"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* VISIBILIDAD */}
                  <div className="form-full-width">
                    <label className="active-toggle-container">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      />
                      <span>Publicar producto inmediatamente en la vitrina pública</span>
                    </label>
                  </div>

                </div>
              </div>

              <div className="product-modal-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-modal-save"
                  disabled={isSaving || isUploadingImages}
                >
                  {isSaving ? 'Guardando en Neon...' : editingId ? 'Guardar Cambios' : 'Crear Producto con Imágenes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE VISTA PREVIA DE IMAGEN EN TAMAÑO COMPLETO */}
      {previewModalUrl && (
        <div className="image-lightbox-backdrop" onClick={() => setPreviewModalUrl(null)}>
          <div className="image-lightbox-dialog" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="btn-lightbox-close"
              onClick={() => setPreviewModalUrl(null)}
              aria-label="Cerrar vista previa"
            >
              ✕
            </button>
            <div className="image-lightbox-image-box">
              <img src={previewModalUrl} alt="Vista previa de alta resolución" />
            </div>
            <div className="image-lightbox-meta">
              <span>Almacenamiento: Neon Object Storage (S3)</span>
              <a href={previewModalUrl} target="_blank" rel="noopener noreferrer" className="lightbox-open-link">
                Abrir URL original ↗
              </a>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN DE PRODUCTO */}
      {deleteProductTarget && (
        <div className="product-modal-backdrop" onClick={() => setDeleteProductTarget(null)}>
          <div className="delete-confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="delete-warn-icon">⚠️</div>
            <h3 className="delete-card-title">¿Eliminar Producto?</h3>
            <p className="delete-card-desc">
              ¿Estás seguro de que deseas eliminar <strong>"{deleteProductTarget.name}"</strong>?
              <br />
              <small style={{ color: '#888', display: 'block', marginTop: '0.4rem' }}>
                Si el producto ya cuenta con pedidos históricos asociados, el servidor lo desactivará automáticamente para preservar la integridad transaccional.
              </small>
            </p>
            <div className="delete-actions-row">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setDeleteProductTarget(null)}
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-confirm-delete"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Eliminando...' : 'Sí, Eliminar Producto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE GESTIÓN RÁPIDA DE DESCUENTOS */}
      {isDiscountModalOpen && discountTargetProduct && (
        <div className="product-modal-backdrop" onClick={() => setIsDiscountModalOpen(false)}>
          <div className="product-modal-card discount-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="product-modal-header">
              <div>
                <span className="modal-badge-tag">Gestión de Precios & Descuentos</span>
                <h3 className="modal-header-title">
                  🏷️ {discountTargetProduct.name}
                </h3>
              </div>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setIsDiscountModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDiscount}>
              <div className="product-modal-body">
                {discountModalError && (
                  <div className="modal-error-box" role="alert">
                    ⚠️ {discountModalError}
                  </div>
                )}

                <div className="discount-modal-intro">
                  <div className="discount-product-summary">
                    <img
                      src={discountTargetProduct.image || discountTargetProduct.images?.[0]?.url || '/images/products/prod-tshirt.jpg'}
                      alt={discountTargetProduct.name}
                      className="discount-thumb"
                    />
                    <div>
                      <strong className="summary-title">{discountTargetProduct.name}</strong>
                      <span className="category-text">{discountTargetProduct.category} | ID: <code>{discountTargetProduct.id}</code></span>
                    </div>
                  </div>
                </div>

                <div className="discount-form-body">
                  {/* PRECIO NORMAL */}
                  <div className="modal-field-group">
                    <label className="modal-field-label">
                      <span>Precio Normal ($ COP) *</span>
                      <strong style={{ color: 'var(--color-accent, #FF5A1F)' }}>
                        {formatCOPPreview(discountFormData.price)}
                      </strong>
                    </label>
                    <input
                      type="number"
                      className="modal-input"
                      min="1000"
                      step="500"
                      value={discountFormData.price}
                      onChange={(e) => setDiscountFormData({ ...discountFormData, price: e.target.value })}
                      required
                    />
                  </div>

                  {/* ACTIVACIÓN DE DESCUENTO */}
                  <div className="modal-field-group">
                    <label className="modal-field-label">Estado del Descuento</label>
                    <label className="discount-toggle-switch">
                      <input
                        type="checkbox"
                        checked={discountFormData.discount_active}
                        onChange={(e) => setDiscountFormData({ ...discountFormData, discount_active: e.target.checked })}
                      />
                      <span className="toggle-label">
                        {discountFormData.discount_active ? '🟢 Descuento Promocional Activado' : '⚪ Descuento Desactivado'}
                      </span>
                    </label>
                  </div>

                  {/* PORCENTAJE */}
                  <div className="modal-field-group">
                    <label className="modal-field-label">Porcentaje de Descuento (1% - 99%)</label>
                    <div className="percent-input-wrapper">
                      <input
                        type="number"
                        className="modal-input"
                        min="1"
                        max="99"
                        step="1"
                        placeholder="20"
                        value={discountFormData.discount_percent || ''}
                        onChange={(e) => setDiscountFormData({ ...discountFormData, discount_percent: e.target.value })}
                        disabled={!discountFormData.discount_active}
                      />
                      <span className="percent-suffix">% OFF</span>
                    </div>
                  </div>

                  {/* FECHAS */}
                  <div className="discount-dates-row">
                    <div className="modal-field-group">
                      <label className="modal-field-label">Fecha y Hora de Inicio</label>
                      <input
                        type="datetime-local"
                        className="modal-input"
                        value={discountFormData.discount_start_at}
                        onChange={(e) => setDiscountFormData({ ...discountFormData, discount_start_at: e.target.value })}
                        disabled={!discountFormData.discount_active}
                      />
                      <small className="field-hint">En blanco = Activo inmediatamente</small>
                    </div>

                    <div className="modal-field-group">
                      <label className="modal-field-label">Fecha y Hora de Finalización</label>
                      <input
                        type="datetime-local"
                        className="modal-input"
                        value={discountFormData.discount_end_at}
                        onChange={(e) => setDiscountFormData({ ...discountFormData, discount_end_at: e.target.value })}
                        disabled={!discountFormData.discount_active}
                      />
                      <small className="field-hint">En blanco = Sin vencimiento automático</small>
                    </div>
                  </div>

                  {/* LIVE PREVIEW CALCULATOR */}
                  {(() => {
                    const preview = calculateLiveDiscountPreview(
                      discountFormData.price,
                      discountFormData.discount_percent,
                      discountFormData.discount_start_at,
                      discountFormData.discount_end_at,
                      discountFormData.discount_active
                    );
                    return (
                      <div className="discount-live-preview-box">
                        <span className="preview-heading">⚡ Cálculo Oficial en Servidor:</span>
                        <div className="preview-metrics-row">
                          <div className="preview-metric">
                            <span className="metric-label">Precio Normal:</span>
                            <span className="metric-val">{formatCOPPreview(preview.normalPrice)}</span>
                          </div>
                          <div className="preview-metric">
                            <span className="metric-label">Descuento:</span>
                            <span className="metric-val discount-val">-{preview.percent}%</span>
                          </div>
                          <div className="preview-metric">
                            <span className="metric-label">Ahorro Cliente:</span>
                            <span className="metric-val savings-val">{formatCOPPreview(preview.savings)}</span>
                          </div>
                          <div className="preview-metric final-metric">
                            <span className="metric-label">Precio Final Calculado:</span>
                            <span className="metric-val highlight-final">{formatCOPPreview(preview.finalPrice)}</span>
                          </div>
                        </div>
                        <div className="preview-status-indicator">
                          <span>Estado: </span>
                          {preview.status === 'ACTIVE' && <strong className="status-badge-active">🟢 ACTIVO AHORA en tienda pública</strong>}
                          {preview.status === 'SCHEDULED' && <strong className="status-badge-scheduled">🟡 PROGRAMADO (iniciará a la fecha establecida)</strong>}
                          {preview.status === 'EXPIRED' && <strong className="status-badge-expired">⌛ VENCIDO (la tienda muestra precio normal)</strong>}
                          {preview.status === 'INACTIVE' && <strong className="status-badge-inactive">⚪ INACTIVO</strong>}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="product-modal-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setIsDiscountModalOpen(false)}
                  disabled={isSavingDiscount}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-modal-save"
                  disabled={isSavingDiscount}
                >
                  {isSavingDiscount ? 'Guardando en Servidor...' : 'Guardar Promoción & Precios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
