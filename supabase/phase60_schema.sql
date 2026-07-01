-- Money owed: add expected repayment date and partial-payment tracking
alter table money_owed add column if not exists expected_date date;
alter table money_owed add column if not exists amount_paid   numeric(10,2) not null default 0;
