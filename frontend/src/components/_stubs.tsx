/**
 * Null-returning placeholders so the App shell compiles before the real
 * components land. Each story phase replaces the corresponding stub.
 */

/** Replaced by `<ErrorBanner/>` in US4 (Phase 6). */
export const ErrorBannerStub = (): null => null;

/** Replaced by `<WarningBanner/>` in US4 (Phase 6). */
export const WarningBannerStub = (): null => null;

/** Replaced by `<GraphCanvas/>` in US1 (Phase 3). */
export const GraphCanvasStub = (): JSX.Element => (
  <div className="flex h-full w-full items-center justify-center text-neutral-500">
    Graph canvas will render here once US1 lands.
  </div>
);

/** Replaced by `<SearchBar/>` in US2 (Phase 4). */
export const SearchBarStub = (): null => null;

/** Replaced by `<DetailPanel/>` in US3 (Phase 5). */
export const DetailPanelStub = (): null => null;

/** Replaced by `<Legend/>` in US1 (Phase 3). */
export const LegendStub = (): null => null;
