-- Run with Supabase CLI (`supabase db push`) or paste into the SQL editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text,
  language_preference text not null default 'en' check (language_preference in ('en', 'my')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 100),
  storefront_group text not null default 'Other',
  enabled boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  description text not null default '',
  sku text unique,
  price numeric(12,2) not null check (price >= 0),
  currency char(3) not null default 'MMK',
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  featured boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists products_public_listing_idx on public.products(status, created_at desc);
create index if not exists products_category_idx on public.products(category_id, status);
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null check (char_length(url) <= 2048), alt_text text not null default '', sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists product_images_product_idx on public.product_images(product_id, sort_order);

create table if not exists public.carts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.carts(user_id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity between 1 and 99),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id, product_id)
);
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  recipient_name text not null, phone text not null, address_line text not null, city text not null default '', township text not null default '', is_default boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists addresses_user_idx on public.addresses(user_id);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
  order_number text not null unique default ('ORD-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12))),
  status text not null default 'pending' check (status in ('pending','confirmed','processing','shipped','delivered','cancelled')),
  currency char(3) not null default 'MMK', subtotal numeric(12,2) not null check (subtotal >= 0), delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0), discount numeric(12,2) not null default 0 check (discount >= 0), total numeric(12,2) not null check (total >= 0),
  recipient_name text not null, recipient_phone text not null, shipping_address jsonb not null,
  idempotency_key uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id, idempotency_key)
);
create index if not exists orders_user_created_idx on public.orders(user_id, created_at desc);
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null, unit_price numeric(12,2) not null check (unit_price >= 0), quantity integer not null check (quantity between 1 and 99), line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items(order_id);
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
  discount_type text not null check (discount_type in ('percentage','fixed')), amount numeric(12,2) not null check (amount > 0), currency char(3) not null default 'MMK', starts_on date, ends_on date, enabled boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (ends_on is null or starts_on is null or ends_on >= starts_on), check (discount_type <> 'percentage' or amount <= 100)
);
create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(), image_url text not null, alt_text text not null default '', link_url text not null default '', sort_order integer not null default 0, starts_on date, ends_on date, enabled boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create table if not exists public.store_settings (
  key text primary key check (char_length(key) between 1 and 100), value jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);
create table if not exists public.support_channels (
  id uuid primary key default gen_random_uuid(), channel text not null, account_name text not null default '', username text not null default '', link text not null default '', description text not null default '', sort_order integer not null default 0, enabled boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade, role text not null check (role in ('admin')), primary key(user_id, role)
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.create_order(p_items jsonb, p_shipping_address jsonb, p_recipient_name text, p_recipient_phone text, p_delivery_fee numeric default 0, p_discount numeric default 0, p_idempotency_key uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_order_id uuid; v_subtotal numeric(12,2) := 0; v_total numeric(12,2); v_line record; v_product public.products%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then raise exception 'Invalid order items'; end if;
  if p_delivery_fee < 0 or p_discount < 0 then raise exception 'Invalid delivery or discount'; end if;
  if p_idempotency_key is not null then
    select id into v_order_id from public.orders where user_id = v_user and idempotency_key = p_idempotency_key;
    if v_order_id is not null then return v_order_id; end if;
  end if;
  for v_line in select (item->>'product_id')::uuid as product_id, (item->>'quantity')::integer as quantity from jsonb_array_elements(p_items) item loop
    if v_line.quantity < 1 or v_line.quantity > 99 then raise exception 'Invalid quantity'; end if;
    select * into v_product from public.products where id = v_line.product_id and status = 'published' for update;
    if not found then raise exception 'Product unavailable'; end if;
    if v_product.stock_quantity < v_line.quantity then raise exception 'Insufficient stock for %', v_product.name; end if;
    v_subtotal := v_subtotal + v_product.price * v_line.quantity;
  end loop;
  if p_discount > v_subtotal then raise exception 'Discount exceeds subtotal'; end if;
  v_total := v_subtotal + p_delivery_fee - p_discount;
  insert into public.orders(user_id, currency, subtotal, delivery_fee, discount, total, recipient_name, recipient_phone, shipping_address, idempotency_key)
  values(v_user, 'MMK', v_subtotal, p_delivery_fee, p_discount, v_total, left(trim(p_recipient_name),120), left(trim(p_recipient_phone),40), p_shipping_address, p_idempotency_key) returning id into v_order_id;
  for v_line in select (item->>'product_id')::uuid as product_id, (item->>'quantity')::integer as quantity from jsonb_array_elements(p_items) item loop
    update public.products set stock_quantity = stock_quantity - v_line.quantity, updated_at = now() where id = v_line.product_id returning * into v_product;
    insert into public.order_items(order_id, product_id, product_name, unit_price, quantity, line_total)
    values(v_order_id, v_product.id, v_product.name, v_product.price, v_line.quantity, v_product.price * v_line.quantity);
  end loop;
  return v_order_id;
end;
$$;
revoke all on function public.create_order(jsonb,jsonb,text,numeric,numeric,uuid) from public;
grant execute on function public.create_order(jsonb,jsonb,text,numeric,numeric,uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.promotions enable row level security;
alter table public.banners enable row level security;
alter table public.store_settings enable row level security;
alter table public.support_channels enable row level security;
alter table public.user_roles enable row level security;

create policy "profile owners read" on public.profiles for select to authenticated using (id = (select auth.uid()) or public.is_admin());
create policy "profile owners update" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profile creation self" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "public active categories" on public.categories for select to anon, authenticated using (enabled or public.is_admin());
create policy "admins manage categories" on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public published products" on public.products for select to anon, authenticated using (status = 'published' or public.is_admin());
create policy "admins manage products" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public published images" on public.product_images for select to anon, authenticated using (exists(select 1 from public.products p where p.id = product_id and (p.status = 'published' or public.is_admin())));
create policy "admins manage images" on public.product_images for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "owners manage cart" on public.carts for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "owners manage cart items" on public.cart_items for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "owners manage addresses" on public.addresses for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "owners read orders" on public.orders for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy "admins update orders" on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "owners read order items" on public.order_items for select to authenticated using (exists(select 1 from public.orders o where o.id = order_id and (o.user_id = (select auth.uid()) or public.is_admin())));
create policy "public enabled promotions" on public.promotions for select to anon, authenticated using ((enabled and (starts_on is null or starts_on <= current_date) and (ends_on is null or ends_on >= current_date)) or public.is_admin());
create policy "admins manage promotions" on public.promotions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public enabled banners" on public.banners for select to anon, authenticated using ((enabled and (starts_on is null or starts_on <= current_date) and (ends_on is null or ends_on >= current_date)) or public.is_admin());
create policy "admins manage banners" on public.banners for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public settings read" on public.store_settings for select to anon, authenticated using (key in ('car_gate_pickup_fee','currency','store_name') or public.is_admin());
create policy "admins manage settings" on public.store_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public enabled support channels" on public.support_channels for select to anon, authenticated using (enabled or public.is_admin());
create policy "admins manage support channels" on public.support_channels for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "users cannot read roles" on public.user_roles for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy "admins manage roles" on public.user_roles for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.categories, public.products, public.product_images, public.promotions, public.banners, public.store_settings, public.support_channels to anon, authenticated;
grant select, insert, update on public.profiles, public.carts, public.cart_items, public.addresses to authenticated;
grant select on public.orders, public.order_items, public.user_roles to authenticated;
grant update on public.orders to authenticated;
grant insert, update, delete on public.categories, public.products, public.product_images, public.promotions, public.banners, public.store_settings, public.support_channels, public.user_roles to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name, phone) values(new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.phone) on conflict(id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
