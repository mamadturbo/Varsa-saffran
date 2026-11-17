-- Run as schema owner after migrations. Provision login/password separately.
-- The dedicated varsa_api role must already exist and must not be inherited by
-- browser/anon/authenticated roles. No superuser or BYPASSRLS is required.
GRANT USAGE ON SCHEMA public TO varsa_api;
GRANT SELECT,INSERT,UPDATE ON
 orders,commerce_products,product_variants,inventory,coupons,order_details,order_items,
 inventory_reservations,inventory_movements,coupon_redemptions,content_entries,store_config,
 outbox,stored_files,contact_messages_api,payment_attempts,card_transfer_receipts,bale_bot_state,
 customers,customer_sessions,customer_otps,customer_rate_limits,customer_order_links,
 customer_cases,customer_notifications,customer_reviews,admin_login_attempts,
 customer_addresses,customer_favorites,case_messages TO varsa_api;
GRANT DELETE ON customer_sessions,customer_otps,customer_rate_limits,admin_login_attempts,
 customer_addresses,customer_favorites TO varsa_api;
GRANT SELECT ON store_media,customer_media TO varsa_api;
GRANT USAGE ON SEQUENCE orders_id_seq,order_items_id_seq,inventory_reservations_id_seq,
 inventory_movements_id_seq,customer_notifications_id_seq,contact_messages_api_id_seq TO varsa_api;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['customers','customer_sessions','customer_otps','customer_rate_limits',
 'customer_order_links','customer_cases','customer_notifications','customer_reviews','admin_login_attempts'] LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=tab AND policyname='varsa_backend') THEN
     EXECUTE format('CREATE POLICY varsa_backend ON %I FOR ALL TO varsa_api USING (true) WITH CHECK (true)',tab);
   END IF;
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['store_media','customer_media'] LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=tab AND policyname='varsa_backend_read') THEN
     EXECUTE format('CREATE POLICY varsa_backend_read ON %I FOR SELECT TO varsa_api USING (true)',tab);
   END IF;
 END LOOP;
END $$;
-- Intentionally no access to the retired document or migration ledger.
GRANT SELECT,UPDATE ON admin_accounts TO varsa_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON admin_sessions,security_limits TO varsa_api;
GRANT INSERT ON security_audit TO varsa_api;
GRANT USAGE ON SEQUENCE security_audit_id_seq TO varsa_api;
GRANT SELECT,UPDATE ON security_storage_lock TO varsa_api;
