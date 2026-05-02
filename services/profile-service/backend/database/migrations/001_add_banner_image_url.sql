-- Run if your database was created before banner_image_url existed:
ALTER TABLE members ADD COLUMN banner_image_url TEXT NULL;
