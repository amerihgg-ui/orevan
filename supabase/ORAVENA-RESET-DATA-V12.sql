-- ORAVENA v12 — primary-admin-only reset for test/operational data.
-- Preserves auth.users, profiles, staff_permissions, staff_invitations and app_config.

create or replace function public.reset_oravena_operational_data(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  patient_count integer := 0;
  appointment_count integer := 0;
  record_count integer := 0;
begin
  if not public.is_primary_admin() then
    raise exception 'PRIMARY_ADMIN_ONLY';
  end if;
  if coalesce(trim(p_confirmation),'') <> 'تصفير' then
    raise exception 'INVALID_CONFIRMATION';
  end if;

  select count(*) into record_count from public.clinic_records where record_type<>'setting';
  select count(*) into appointment_count from public.appointments;
  select count(*) into patient_count from public.patients;

  -- Delete finance rows first so the treatment-plan finance trigger cannot
  -- collide with rows already being removed by this reset operation.
  delete from public.clinic_records where record_type='finance';
  delete from public.clinic_records where record_type<>'setting';
  delete from public.appointments;
  delete from public.patients;

  return jsonb_build_object(
    'ok',true,
    'patients_deleted',patient_count,
    'appointments_deleted',appointment_count,
    'records_deleted',record_count
  );
end;
$$;

revoke all on function public.reset_oravena_operational_data(text) from public,anon;
grant execute on function public.reset_oravena_operational_data(text) to authenticated;

select 'ORAVENA reset data v12 is ready' as result;
