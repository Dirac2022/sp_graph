/**
 * Persistent search bar. Renders a debounced suggestion list (up to
 * {@link MAX_SUGGESTIONS} matches) and routes Enter / click events to the
 * selection callback.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

import { searchSps } from "../graph/search";

interface SearchBarProps {
  readonly names: ReadonlyArray<string>;
  readonly onPick: (id: string) => void;
}

const DEBOUNCE_MS = 100;

/** Top-of-sidebar input with ranked suggestions. */
export const SearchBar = ({ names, onPick }: SearchBarProps): JSX.Element => {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  const suggestions = useMemo(() => searchSps(debounced, names), [debounced, names]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const top = suggestions[0];
    if (top !== undefined) {
      onPick(top);
    }
  };

  const showEmpty = debounced.trim().length > 0 && suggestions.length === 0;

  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit}>
        <label htmlFor="sp-search" className="mb-1 block text-[0.7rem] uppercase tracking-wider text-neutral-400">
          Search
        </label>
        <div className="flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-950 px-2 focus-within:border-sky-500">
          <Search className="h-4 w-4 text-neutral-500" />
          <input
            id="sp-search"
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type an SP name"
            className="w-full bg-transparent py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </form>
      {suggestions.length > 0 ? (
        <ul className="overflow-hidden rounded-md border border-neutral-800 bg-neutral-950">
          {suggestions.map((name) => (
            <li key={name}>
              <button
                type="button"
                onClick={() => onPick(name)}
                className="block w-full truncate px-3 py-1.5 text-left font-mono text-xs text-neutral-200 hover:bg-neutral-800"
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {showEmpty ? (
        <p className="text-xs text-neutral-500">No SP matches that name.</p>
      ) : null}
    </div>
  );
};
