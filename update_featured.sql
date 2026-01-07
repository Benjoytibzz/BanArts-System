-- SQL script to update existing artists to be featured
-- Run this if you need to mark default artists as featured
UPDATE Artists SET is_featured = 1 WHERE name IN ('Benjo R. Tibalan', 'George V. Aniban', 'Jessica Juje Sario');
UPDATE Artists SET is_featured = 0 WHERE is_featured IS NULL;