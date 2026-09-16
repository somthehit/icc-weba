ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS districts varchar(500);
ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS municipalities varchar(1000);

UPDATE delivery_zones
SET districts = CASE
  WHEN lower(name) = 'kailali valley' THEN 'kailali'
  WHEN lower(name) = 'Dhangadhi valley' THEN 'kaski'
  WHEN lower(name) = 'butwal / bhairahawa' THEN 'rupandehi'
  WHEN lower(name) = 'biratnagar / itahari' THEN 'morang'
  WHEN lower(name) = 'dhangadhi main city' THEN 'kailali'
  ELSE name
END
WHERE districts IS NULL;

UPDATE delivery_zones
SET municipalities = CASE
  WHEN lower(name) = 'kailali valley' THEN 'dhangadhi metropolitan city'
  WHEN lower(name) = 'Dhangadhi valley' THEN 'Dhangadhi metropolitan city'
  WHEN lower(name) = 'butwal / bhairahawa' THEN 'butwal sub-metropolitan city,bhairahawa'
  WHEN lower(name) = 'biratnagar / itahari' THEN 'biratnagar metropolitan city,itahari'
  WHEN lower(name) = 'dhangadhi main city' THEN 'dhangadhi metropolitan city'
  ELSE name
END
WHERE municipalities IS NULL;
