import { Link } from "wouter";
import { pageBreadcrumbs } from "@/lib/page-meta";
import { usePublicPage } from "@/lib/page-context";
import { categoryPath, storefrontRoute } from "@/lib/routes";

export function PageBreadcrumbs() {
  const { data } = usePublicPage();
  const route = storefrontRoute(data.path);
  const crumbs = pageBreadcrumbs(data.path, {
    product: data.product,
    article: data.article,
    category: route.kind === "category" ? route.category : undefined,
    categoryExists: Boolean(
      data.product && categoryPath(data.product.category),
    ),
  });
  if (!crumbs.length) return null;
  return (
    <nav
      aria-label="مسیر صفحه"
      className="mb-6 text-sm leading-7 text-cream-300"
    >
      <ol className="flex flex-wrap gap-x-2">
        {crumbs.map(([name, href], index) => (
          <li
            key={href}
            className={
              index === crumbs.length - 1
                ? "flex basis-full gap-2 sm:basis-auto"
                : "flex gap-2"
            }
          >
            {index > 0 && <span aria-hidden="true">/</span>}
            {index === crumbs.length - 1 ? (
              <span aria-current="page">{name}</span>
            ) : (
              <Link
                href={href}
                className="text-accent underline underline-offset-4"
              >
                {name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
