-- Generada con prisma migrate diff. Agregado a mano: extensiones y CHECK.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('CUSTOMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('PENDING_PAYMENT', 'COMPLETED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" CITEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'CUSTOMER',
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "name" CITEXT NOT NULL,
    "description" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "price" DECIMAL(12,2) NOT NULL,
    "external_image_url" VARCHAR(2048),
    "stock" INTEGER NOT NULL DEFAULT 0,
    "units_sold" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "content_type" VARCHAR(32) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "user_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("user_id","product_id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "total" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("order_id","product_id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" VARCHAR(64) NOT NULL,
    "paid_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_price_idx" ON "products"("price");

-- CreateIndex
CREATE INDEX "products_units_sold_id_idx" ON "products"("units_sold" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "products_name_trgm_idx" ON "products" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "products_description_trgm_idx" ON "products" USING GIN ("description" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "product_images_product_id_key" ON "product_images"("product_id");

-- CreateIndex
CREATE INDEX "cart_items_product_id_idx" ON "cart_items"("product_id");

-- CreateIndex
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_order_id_key" ON "payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_reference_key" ON "payments"("reference");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheckConstraints

-- users
ALTER TABLE "users" ADD CONSTRAINT "users_name_not_blank" CHECK (btrim("name") <> '');
ALTER TABLE "users" ADD CONSTRAINT "users_email_length" CHECK (char_length("email") BETWEEN 3 AND 254);

-- categories
ALTER TABLE "categories" ADD CONSTRAINT "categories_name_not_blank" CHECK (btrim("name") <> '');
ALTER TABLE "categories" ADD CONSTRAINT "categories_name_length" CHECK (char_length("name") <= 80);

-- products
ALTER TABLE "products" ADD CONSTRAINT "products_name_not_blank" CHECK (btrim("name") <> '');
ALTER TABLE "products" ADD CONSTRAINT "products_price_positive" CHECK ("price" > 0);
ALTER TABLE "products" ADD CONSTRAINT "products_stock_non_negative" CHECK ("stock" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "products_units_sold_non_negative" CHECK ("units_sold" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "products_external_image_url_https"
    CHECK ("external_image_url" IS NULL OR "external_image_url" LIKE 'https://%');

-- product_images
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_content_type_allowed"
    CHECK ("content_type" IN ('image/jpeg', 'image/png', 'image/webp'));
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_byte_size_range"
    CHECK ("byte_size" BETWEEN 1 AND 2097152);
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_byte_size_matches_data"
    CHECK ("byte_size" = octet_length("data"));

-- cart_items
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_quantity_positive" CHECK ("quantity" > 0);

-- orders
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_positive" CHECK ("total" > 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_completed_at_matches_status"
    CHECK (("status" = 'COMPLETED') = ("completed_at" IS NOT NULL));

-- order_items
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_unit_price_positive" CHECK ("unit_price" > 0);

-- payments
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive" CHECK ("amount" > 0);
