-- Agmarknet (api.agmarknet.gov.in) as the main price source; Apify/data.gov.in stays as the fallback.

alter table public.commodities add column if not exists agmarknet_id integer;
alter table public.commodities add column if not exists agmarknet_group_id integer;

update public.commodities c set agmarknet_id = v.id, agmarknet_group_id = v.grp
from (values
  ('Onion', 23, 6), ('Tomato', 65, 6), ('Potato', 24, 6), ('Wheat', 1, 1), ('Soyabean', 13, 3),
  ('Brinjal', 32, 6), ('Cotton', 15, 4), ('Tur (Arhar)', 45, 2), ('Bengal Gram(Gram)(Whole)', 6, 2),
  ('Green Gram (Moong)(Whole)', 9, 2), ('Black Gram (Urd Beans)(Whole)', 8, 2), ('Jowar(Sorghum)', 5, 1),
  ('Bajra(Pearl Millet/Cumbu)', 28, 1), ('Maize', 4, 1), ('Paddy(Dhan)(Common)', 2, 1), ('Rice', 3, 1),
  ('Groundnut', 10, 3), ('Sugarcane', 122, 10), ('Cabbage', 126, 6), ('Cauliflower', 31, 6),
  ('Green Chilli', 73, 6), ('Ladies Finger', 127, 6), ('Bitter gourd', 67, 6), ('Bottle gourd', 68, 6),
  ('Cucumbar(Kheera)', 131, 6), ('Carrot', 125, 6), ('Garlic', 25, 6), ('Ginger(Green)', 87, 6),
  ('Coriander(Leaves)', 39, 6), ('Methi(Leaves)', 42, 6), ('Spinach', 290, 6), ('Peas Wet', 146, 6),
  ('Cluster beans', 66, 6), ('Capsicum', 136, 6), ('Pomegranate', 160, 5), ('Banana', 19, 5),
  ('Grapes', 22, 5), ('Mango', 20, 5), ('Orange', 18, 5), ('Lemon', 261, 6), ('Papaya', 59, 5),
  ('Water Melon', 60, 5), ('Turmeric', 35, 7)
) as v(name, id, grp)
where c.data_name = v.name;

alter table public.prices drop constraint if exists prices_source_check;
alter table public.prices add constraint prices_source_check check (source in ('sync', 'live', 'backfill', 'agmarknet'));

alter table public.sync_runs drop constraint if exists sync_runs_type_check;
alter table public.sync_runs add constraint sync_runs_type_check check (type in ('daily', 'live', 'webhook', 'agmarknet'));
