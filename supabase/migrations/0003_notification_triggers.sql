create or replace function public.notify_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (recipient_id, actor_id, type)
  values (new.followed_id, new.follower_id, 'follow');
  return new;
end;
$$;

create or replace function public.notify_appreciation()
returns trigger language plpgsql security definer set search_path = public as $$
declare photographer uuid;
begin
  select owner_id into photographer from public.photographs where id = new.photograph_id;
  if photographer is not null and photographer <> new.user_id then
    insert into public.notifications (recipient_id, actor_id, type, photograph_id)
    values (photographer, new.user_id, 'appreciation', new.photograph_id);
  end if;
  return new;
end;
$$;

create or replace function public.notify_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare recipient uuid;
begin
  if new.parent_id is not null then
    select author_id into recipient from public.comments where id = new.parent_id;
  else
    select owner_id into recipient from public.photographs where id = new.photograph_id;
  end if;
  if recipient is not null and recipient <> new.author_id then
    insert into public.notifications (recipient_id, actor_id, type, photograph_id)
    values (recipient, new.author_id, case when new.parent_id is null then 'comment' else 'reply' end, new.photograph_id);
  end if;
  return new;
end;
$$;

create trigger follows_notify after insert on public.follows for each row execute function public.notify_follow();
create trigger appreciations_notify after insert on public.appreciations for each row execute function public.notify_appreciation();
create trigger comments_notify after insert on public.comments for each row execute function public.notify_comment();
