begin;

update chat_messages
set sender_role = case
  when sender_role in ('admin', 'support_team') then 'support_team'
  else 'user'
end
where sender_role is distinct from 'user'
  and sender_role is distinct from 'support_team';

alter table chat_messages
  drop constraint if exists chat_messages_sender_role_check;

alter table chat_messages
  add constraint chat_messages_sender_role_check
  check (sender_role in ('user', 'support_team'));

commit;
