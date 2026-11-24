import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "wouter";
import {
  usePathname,
  useSearch as browserSearch,
} from "wouter/use-browser-location";
import {
  browserPublicApi,
  readPublicPage,
  type PublicPage,
} from "./public-page";
import { relativeMetaPath, type MetaConfig } from "./page-meta";

export interface StorefrontBootstrap {
  page: PublicPage;
  config: MetaConfig;
}

const PageContext = createContext<{
  data: PublicPage;
  config: MetaConfig;
  loading: boolean;
  reload: () => void;
} | null>(null);

export function PublicPageProvider({
  initial,
  children,
}: {
  initial?: StorefrontBootstrap;
  children: ReactNode;
}) {
  const config = initial?.config ?? {
    indexable: false,
    basePath: import.meta.env.BASE_URL,
  };
  const path = relativeMetaPath(usePathname(useRouter()), config.basePath);
  const [page, setPage] = useState(initial?.page);
  const [attempt, setAttempt] = useState(0);
  const [loadedAttempt, setLoadedAttempt] = useState(0);
  const current = page?.path === path ? page : undefined;
  const loading = !current || attempt !== loadedAttempt;
  useEffect(() => {
    if (!loading) return;
    let active = true;
    readPublicPage(path, browserPublicApi).then((result) => {
      if (!active) return;
      setPage(result);
      setLoadedAttempt(attempt);
    });
    return () => {
      active = false;
    };
  }, [loading, path, attempt]);
  return (
    <PageContext.Provider
      value={{
        data: current ?? { path, status: 200 },
        config,
        loading,
        reload: () => setAttempt((value) => value + 1),
      }}
    >
      {children}
    </PageContext.Provider>
  );
}

export function usePublicPage() {
  const value = useContext(PageContext);
  if (!value) throw new Error("Missing storefront page context");
  return value;
}

export function useRawSearch() {
  const search = browserSearch(useRouter());
  return search && !search.startsWith("?") ? `?${search}` : search;
}

export function useAssetOrigin() {
  return usePublicPage().config.siteUrl ?? "https://assets.invalid";
}
