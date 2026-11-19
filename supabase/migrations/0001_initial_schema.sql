create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null check (handle ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  bio text check (char_length(bio) <= 500),
  location text check (char_length(location) <= 120),
  website text check (char_length(website) <= 240),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.photographs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  image_path text not null,
  title text check (char_length(title) <= 140),
  description text check (char_length(description) <= 1200),
  categories text[] not null default '{}' check (cardinality(categories) <= 3),
  comments_enabled boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index photographs_owner_created_idx on public.photographs(owner_id, created_at desc);
create index photographs_published_idx on public.photographs(published_at desc) where status = 'published';

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create table public.bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  photograph_id uuid not null references public.photographs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, photograph_id)
);

create table public.appreciations (
  user_id uuid not null references public.profiles(id) on delete cascade,
  photograph_id uuid not null references public.photographs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, photograph_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  photograph_id uuid not null references public.photographs(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_photograph_created_idx on public.comments(photograph_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('comment', 'reply', 'appreciation', 'follow')),
  photograph_id uuid references public.photographs(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_created_idx on public.notifications(recipient_id, created_at desc);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('profile', 'photograph', 'comment')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.discovery_exposures (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid references public.profiles(id) on delete cascade,
  photograph_id uuid not null references public.photographs(id) on delete cascade,
  session_id uuid not null default gen_random_uuid(),
  shown_at timestamptz not null default now()
);
create index discovery_exposures_viewer_shown_idx on public.discovery_exposures(viewer_id, shown_at desc);

alter table public.profiles enable row level security;
alter table public.photographs enable row level security;
alter table public.follows enable row level security;
alter table public.bookmarks enable row level security;
alter table public.appreciations enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;
alter table public.discovery_exposures enable row level security;

create policy "public profiles are readable" on public.profiles for select using (true);
create policy "users insert own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "users update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "published photographs are readable" on public.photographs for select using (status = 'published' or (select auth.uid()) = owner_id);
create policy "owners create photographs" on public.photographs for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "owners update photographs" on public.photographs for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners delete photographs" on public.photographs for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "follows are readable" on public.follows for select using (true);
create policy "users manage own follows" on public.follows for all to authenticated using ((select auth.uid()) = follower_id) with check ((select auth.uid()) = follower_id);
create policy "users manage own bookmarks" on public.bookmarks for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "users manage own appreciations" on public.appreciations for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "comments on published work are readable" on public.comments for select using (exists (select 1 from public.photographs p where p.id = photograph_id and p.status = 'published'));
create policy "users create own comments" on public.comments for insert to authenticated with check ((select auth.uid()) = author_id and exists (select 1 from public.photographs p where p.id = photograph_id and p.status = 'published' and p.comments_enabled));
create policy "authors delete own comments" on public.comments for delete to authenticated using ((select auth.uid()) = author_id);

create policy "recipients read own notifications" on public.notifications for select to authenticated using ((select auth.uid()) = recipient_id);
create policy "recipients update own notifications" on public.notifications for update to authenticated using ((select auth.uid()) = recipient_id) with check ((select auth.uid()) = recipient_id);
create policy "users create own reports" on public.reports for insert to authenticated with check ((select auth.uid()) = reporter_id);
create policy "users read own reports" on public.reports for select to authenticated using ((select auth.uid()) = reporter_id);
create policy "users manage own blocks" on public.blocks for all to authenticated using ((select auth.uid()) = blocker_id) with check ((select auth.uid()) = blocker_id);
create policy "users record own exposures" on public.discovery_exposures for insert to authenticated with check ((select auth.uid()) = viewer_id);
create policy "users read own exposures" on public.discovery_exposures for select to authenticated using ((select auth.uid()) = viewer_id);
