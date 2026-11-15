-- Append-only Support chat on top of `profiles.profile_data`.
--
-- The Support thread lives inside the client's profile document. Saving a
-- message used to mean writing the whole document back from the browser, which
-- has two problems:
--
--   1. cost      — every line rewrote ~70 kB of JSON (and the save echo was
--                  another ~70 kB down), so a conversation felt slow;
--   2. lost rows — two devices writing at the same time is last-writer-wins on
--                  the whole blob, so a reply could silently disappear and
--                  reappear. That is the "the conversation is not constant"
--                  symptom.
--
-- `support_thread_apply()` appends the new messages inside the database, under a
-- row lock, de-duplicating by message id, and returns the canonical thread. It
-- also applies read receipts and the "client asked for a person" flag, so the
-- chat never needs a full-document write.
--
-- Safe to run more than once. The browser falls back to full-profile saves if
-- this function is not deployed.

create or replace function public.support_thread_apply(
  p_email text,
  p_messages jsonb default '[]'::jsonb,
  p_handoff boolean default false,
  p_read_for text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_data jsonb;
  v_original jsonb;
  v_thread jsonb;
  v_handoff boolean;
  v_message jsonb;
begin
  if p_email is null or length(trim(p_email)) = 0 then
    return null;
  end if;

  -- Lock the row for the duration of the read-modify-write so two devices
  -- appending at the same moment queue up instead of overwriting each other.
  select coalesce(profile_data, '{}'::jsonb)
    into v_data
    from public.profiles
   where lower(email) = lower(p_email)
   for update;

  if v_data is null then
    -- No profile with that email: let the caller fall back to a normal save,
    -- which is what creates the row.
    return null;
  end if;

  v_original := v_data;

  v_thread := v_data -> 'supportThread';
  if v_thread is null or jsonb_typeof(v_thread) <> 'array' then
    v_thread := '[]'::jsonb;
  end if;

  v_handoff := coalesce((v_data -> 'supportHandoff') = 'true'::jsonb, false);

  -- 1. Append the new messages, skipping any id we already stored.
  if p_messages is not null and jsonb_typeof(p_messages) = 'array' then
    for v_message in select * from jsonb_array_elements(p_messages) loop
      if jsonb_typeof(v_message) = 'object'
         and v_message ? 'id'
         and v_message ->> 'id' is not null
         and jsonb_typeof(v_message -> 'body') = 'string'
         and not exists (
           select 1
             from jsonb_array_elements(v_thread) as existing
            where existing ->> 'id' = v_message ->> 'id'
         )
      then
        v_thread := v_thread || jsonb_build_array(v_message);
      end if;
    end loop;
  end if;

  -- 2. Read receipts for one side ("client" read the Support messages, or
  --    "support" read the client's messages).
  if p_read_for in ('client', 'support') then
    select coalesce(
             jsonb_agg(
               case
                 when (element ->> 'side') = case p_read_for
                                                when 'client' then 'support'
                                                else 'client'
                                              end
                 then element || jsonb_build_object(
                        case p_read_for when 'client' then 'readByClient' else 'readBySupport' end,
                        true
                      )
                 else element
               end
               order by element ->> 'createdAt', element ->> 'id'
             ),
             '[]'::jsonb
           )
      into v_thread
      from jsonb_array_elements(v_thread) as element;
  end if;

  -- 3. Keep the thread in a single, stable order so both sides read the same
  --    conversation even when the two clocks disagree slightly.
  select coalesce(
           jsonb_agg(element order by element ->> 'createdAt', element ->> 'id'),
           '[]'::jsonb
         )
    into v_thread
    from jsonb_array_elements(v_thread) as element;

  if coalesce(p_handoff, false) then
    v_handoff := true;
  end if;

  v_data := v_data || jsonb_build_object(
    'supportThread', v_thread,
    'supportHandoff', v_handoff
  );

  -- Nothing changed (a retry or a duplicate delivery): do not write, so no
  -- pointless realtime event is broadcast to every open device.
  if v_data = v_original then
    return jsonb_build_object('supportThread', v_thread, 'supportHandoff', v_handoff);
  end if;

  update public.profiles
     set profile_data = v_data,
         updated_at = now()
   where lower(email) = lower(p_email);

  return jsonb_build_object('supportThread', v_thread, 'supportHandoff', v_handoff);
end;
$$;

revoke all on function public.support_thread_apply(text, jsonb, boolean, text) from public;
grant execute on function public.support_thread_apply(text, jsonb, boolean, text) to anon, authenticated;

comment on function public.support_thread_apply(text, jsonb, boolean, text) is
  'Appends Support messages / read receipts to profiles.profile_data.supportThread without rewriting the whole profile.';
