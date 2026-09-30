import { faFloppyDisk } from '@fortawesome/free-solid-svg-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  HttpsUrlSchema,
  ProductCreateBodySchema,
  type Product,
  type ProductUpdateBody,
} from '@sistema-e/contracts';
import { useState, type ChangeEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { applyFieldErrors, errorMessage, hasCode, notifyError } from '@/shared/http/errors';
import { cx } from '@/shared/lib/cx';
import { formatNumber } from '@/shared/lib/format';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/feedback';
import { Fieldset, FormField, Input, Select, Textarea } from '@/shared/ui/form';
import { ProductImage } from '@/shared/ui/ProductImage';
import { toast } from '@/shared/ui/toast';
import { useCategories, useCreateProduct, useUpdateProduct, useUploadProductImage } from '../hooks';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const IMAGE_MODES = {
  keep: 'Mantener la actual',
  none: 'Sin imagen',
  url: 'URL externa',
  file: 'Subir archivo',
  remove: 'Quitar imagen',
} as const;
type ImageMode = keyof typeof IMAGE_MODES;

// El stock solo se envía al crear.
const ProductFormSchema = ProductCreateBodySchema.omit({ categoryId: true, imageUrl: true }).extend(
  {
    categoryId: z
      .string()
      .min(1, { error: 'Selecciona una categoría.' })
      .pipe(z.coerce.number<string>().int().positive()),
    imageMode: z.enum(['keep', 'none', 'url', 'file', 'remove']),
    imageUrl: z
      .string()
      .trim()
      .transform((value) => value || undefined)
      .pipe(HttpsUrlSchema.optional()),
  },
);
type FormInput = z.input<typeof ProductFormSchema>;
type FormOutput = z.output<typeof ProductFormSchema>;

const FIELDS = ['categoryId', 'name', 'description', 'price', 'stock', 'imageUrl'] as const;

const externalUrl = (product: Product | null) =>
  product?.imageUrl?.startsWith('https://') ? product.imageUrl : '';

function readAsDataUrl(file: File, onLoad: (url: string) => void) {
  const reader = new FileReader();
  // Data URL: la CSP no permite blob:.
  reader.onload = () => {
    if (typeof reader.result === 'string') onLoad(reader.result);
  };
  reader.readAsDataURL(file);
}

export function ProductForm({ product }: { product: Product | null }) {
  const navigate = useNavigate();
  const categories = useCategories();
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const upload = useUploadProductImage();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    clearErrors,
    control,
    formState: { errors, dirtyFields, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(ProductFormSchema),
    defaultValues: {
      categoryId: product ? String(product.category.id) : '',
      name: product?.name ?? '',
      description: product?.description ?? '',
      price: product?.price ?? '',
      stock: 0,
      imageMode: product ? 'keep' : 'none',
      imageUrl: externalUrl(product),
    },
  });
  const imageMode = useWatch({ control, name: 'imageMode' });
  const typedUrl = useWatch({ control, name: 'imageUrl' });

  const modes: ImageMode[] = product
    ? ['keep', 'url', 'file', ...(product.imageUrl ? (['remove'] as const) : [])]
    : ['none', 'url', 'file'];

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(null);
    setPreview(null);
    if (!selected) return;
    if (!IMAGE_TYPES.includes(selected.type)) {
      setFileError('Solo se aceptan imágenes JPEG, PNG o WebP.');
    } else if (selected.size > MAX_IMAGE_BYTES) {
      setFileError('La imagen supera el tamaño máximo de 2 MB.');
    } else {
      setFileError(null);
      setFile(selected);
      readAsDataUrl(selected, setPreview);
    }
  };

  const buildPatch = (values: FormOutput): ProductUpdateBody => {
    const patch: ProductUpdateBody = {};
    if (dirtyFields.categoryId) patch.categoryId = values.categoryId;
    if (dirtyFields.name) patch.name = values.name;
    if (dirtyFields.description) patch.description = values.description;
    if (dirtyFields.price) patch.price = values.price;
    // Enviar imageUrl (aunque sea null) reemplaza la imagen subida.
    if (values.imageMode === 'url') patch.imageUrl = values.imageUrl;
    if (values.imageMode === 'remove') patch.imageUrl = null;
    return patch;
  };

  const save = async (values: FormOutput) => {
    if (values.imageMode === 'url' && !values.imageUrl) {
      setError('imageUrl', { type: 'required', message: 'Ingresa la URL de la imagen.' });
      return;
    }
    if (values.imageMode === 'file' && !file) {
      setFileError(fileError ?? 'Selecciona una imagen.');
      return;
    }

    let saved: Product;
    try {
      if (product) {
        const patch = buildPatch(values);
        const hasChanges = Object.keys(patch).length > 0;
        if (!hasChanges && values.imageMode !== 'file') {
          toast.info('No hay cambios para guardar.');
          return;
        }
        saved = hasChanges ? await update.mutateAsync({ id: product.id, body: patch }) : product;
      } else {
        const { categoryId, name, description, price, stock } = values;
        saved = await create.mutateAsync({
          categoryId,
          name,
          description,
          price,
          stock,
          imageUrl: values.imageMode === 'url' ? values.imageUrl : undefined,
        });
      }
    } catch (error) {
      if (hasCode(error, 'CATEGORY_NOT_FOUND')) {
        setError('categoryId', { type: 'server', message: error.message });
      } else if (!applyFieldErrors(error, setError, FIELDS)) {
        notifyError(error);
      }
      return;
    }

    if (values.imageMode === 'file' && file) {
      try {
        await upload.mutateAsync({ id: saved.id, file });
      } catch (error) {
        if (product) {
          setFileError(errorMessage(error));
        } else {
          toast.error(
            `El producto se creó, pero la imagen no se pudo subir: ${errorMessage(error)}`,
          );
          void navigate(`/admin/products/${saved.id}/edit`, { replace: true });
        }
        return;
      }
    }

    toast.success(product ? 'Producto actualizado.' : 'Producto creado.');
    void navigate('/admin/products');
  };

  const onSubmit = handleSubmit(save);

  const previewSrc =
    imageMode === 'keep'
      ? (product?.imageUrl ?? null)
      : imageMode === 'file'
        ? preview
        : imageMode === 'url' && typedUrl?.startsWith('https://')
          ? typedUrl
          : null;

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="space-y-6">
      <Card className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <FormField label="Nombre" htmlFor="name" error={errors.name?.message}>
            <Input id="name" maxLength={150} invalid={!!errors.name} {...register('name')} />
          </FormField>
          <FormField label="Categoría" htmlFor="categoryId" error={errors.categoryId?.message}>
            <Select id="categoryId" invalid={!!errors.categoryId} {...register('categoryId')}>
              <option value="">
                {categories.isPending ? 'Cargando...' : 'Selecciona una categoría'}
              </option>
              {categories.data?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Precio (Q)" htmlFor="price" error={errors.price?.message}>
            <Input
              id="price"
              inputMode="decimal"
              placeholder="0.00"
              invalid={!!errors.price}
              {...register('price')}
            />
          </FormField>
          {product ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-700">Stock</p>
              <p className="flex h-12 items-center text-sm text-slate-600">
                {formatNumber(product.stock)} unidades ·{' '}
                <Link
                  to="/admin/inventory"
                  className="ml-1 font-semibold text-blue-700 hover:underline"
                >
                  Ajustar en Inventario
                </Link>
              </p>
            </div>
          ) : (
            <FormField label="Stock inicial" htmlFor="stock" error={errors.stock?.message}>
              <Input
                id="stock"
                type="number"
                min={0}
                step={1}
                invalid={!!errors.stock}
                {...register('stock', { valueAsNumber: true })}
              />
            </FormField>
          )}
        </div>
        <FormField label="Descripción" htmlFor="description" error={errors.description?.message}>
          <Textarea
            id="description"
            rows={5}
            maxLength={5000}
            invalid={!!errors.description}
            {...register('description')}
          />
        </FormField>
      </Card>

      <Fieldset legend="Imagen">
        <div className="grid gap-5 md:grid-cols-[1fr_12rem]">
          <div className="space-y-4">
            <div
              role="radiogroup"
              aria-label="Origen de la imagen"
              className="flex flex-wrap gap-2"
            >
              {modes.map((mode) => (
                <label
                  key={mode}
                  className={cx(
                    'flex cursor-pointer items-center rounded-xl border px-4 py-2.5 text-sm font-medium transition has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue-600',
                    imageMode === mode
                      ? 'border-cyan-700 bg-accent-soft text-cyan-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                  )}
                >
                  <input
                    type="radio"
                    value={mode}
                    className="sr-only"
                    {...register('imageMode', {
                      onChange: (event: ChangeEvent<HTMLInputElement>) => {
                        clearErrors('imageUrl');
                        setValue(
                          'imageUrl',
                          event.target.value === 'url' ? externalUrl(product) : '',
                        );
                      },
                    })}
                  />
                  {IMAGE_MODES[mode]}
                </label>
              ))}
            </div>

            {imageMode === 'url' && (
              <FormField
                label="URL de la imagen"
                htmlFor="imageUrl"
                error={errors.imageUrl?.message}
                hint="Debe comenzar con https://"
              >
                <Input
                  id="imageUrl"
                  type="url"
                  placeholder="https://ejemplo.com/imagen.jpg"
                  invalid={!!errors.imageUrl}
                  {...register('imageUrl')}
                />
              </FormField>
            )}
            {imageMode === 'file' && (
              <FormField
                label="Archivo"
                htmlFor="imageFile"
                error={fileError ?? undefined}
                hint="JPEG, PNG o WebP de hasta 2 MB."
              >
                <input
                  id="imageFile"
                  type="file"
                  accept={IMAGE_TYPES.join(',')}
                  onChange={onFileChange}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-50 file:px-4 file:py-2.5 file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                />
              </FormField>
            )}
            {imageMode === 'remove' && (
              <p className="text-sm text-slate-500">El producto se mostrará sin imagen.</p>
            )}
          </div>
          <ProductImage
            src={previewSrc}
            alt="Vista previa"
            className="aspect-square w-full rounded-2xl border border-slate-200"
          />
        </div>
      </Fieldset>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <ButtonLink to="/admin/products" color="gray" variant="outline">
          Cancelar
        </ButtonLink>
        <Button type="submit" icon={faFloppyDisk} loading={isSubmitting}>
          {product ? 'Guardar cambios' : 'Crear producto'}
        </Button>
      </div>
    </form>
  );
}
