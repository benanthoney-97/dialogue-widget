begin;

alter table campaigns
  add column if not exists outcomes text[] default '{}'::text[];

comment on column campaigns.outcomes is 'List of bullet-style outcomes surfaced in the campaign UI';

commit;
