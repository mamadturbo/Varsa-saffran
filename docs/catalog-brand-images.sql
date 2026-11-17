-- Optional catalog data update for the Supabase products database.
-- Run only after artwork approval and deployment of the three PNG files.
-- In the SAME transaction/session, set varsa.brand_asset_base_url to the
-- actual HTTPS site/subfolder that serves /products/*.png. No default domain.
-- This script is not an orders database/schema migration.
DO $brand_images$
DECLARE
  asset_base text := nullif(btrim(current_setting('varsa.brand_asset_base_url', true)), '');
BEGIN
  IF asset_base IS NULL OR asset_base !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9._~-]+)*/?$' THEN
    RAISE EXCEPTION 'Set varsa.brand_asset_base_url to the deployed HTTPS asset base before applying brand images';
  END IF;
  asset_base := rtrim(asset_base, '/');

  UPDATE public.products AS product
  SET image_url = asset_base || '/products/' || replacement.filename
  FROM (VALUES
    ('fd06cca4-3787-4444-9b4f-ff1646de8860', 'negin-1g', 'https://images.pexels.com/photos/33654800/pexels-photo-33654800.jpeg?auto=compress&cs=tinysrgb&h=900&w=900', 'negin-1g.png'),
    ('b2038836-1243-4ab3-a2e2-9083904f744f', 'negin-2g', 'https://images.pexels.com/photos/10487658/pexels-photo-10487658.jpeg?auto=compress&cs=tinysrgb&h=900&w=900', 'negin-2g.png'),
    ('a2cd33cc-cb9f-40da-b1c2-3209719e20ed', 'poshal-2g', 'https://images.pexels.com/photos/6707417/pexels-photo-6707417.jpeg?auto=compress&cs=tinysrgb&h=900&w=900', 'poshal-2g.png')
  ) AS replacement(id, slug, legacy_url, filename)
  WHERE product.id::text = replacement.id
    AND product.slug = replacement.slug
    AND product.image_url = replacement.legacy_url;
END;
$brand_images$;
