import { Link } from "wouter";
export function NotFoundPage() {
  return (
    <main className="container-luxe min-h-[65vh] pt-36 pb-20 text-center">
      <p className="text-sm text-cream-400">۴۰۴</p>
      <h1 className="mt-4 text-2xl font-bold text-cream-50">صفحه پیدا نشد</h1>
      <p className="mt-4 text-sm text-cream-300">
        این آدرس در سایت ورسا وجود ندارد.
      </p>
      <Link href="/" className="btn-solid mt-8">
        بازگشت به صفحه نخست
      </Link>
    </main>
  );
}
