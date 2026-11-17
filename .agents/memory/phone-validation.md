The stage 3 fix uses `@workspace/validation` for Iranian mobile formatting.
Accept Persian/Arabic/ASCII or mixed digits, whitespace, ASCII hyphens, and
09 / +98 / 0098 prefixes; store canonical 11-digit ASCII 09 numbers. Do not
silently drop letters, infer missing digits, or accept non-string input.
Raw input is limited to 64 characters. Both form labels explicitly say mobile.
Checkout API returns 400 before catalog access or persistence on invalid input.
ContactPage and submitContact validate/normalize before the Supabase insert;
database constraints/RLS for contact_messages were not modified. Tests use a
local in-memory HTTP fixture; real order database writes remain unverified.
No SMS/OTP or phone ownership verification was added.
