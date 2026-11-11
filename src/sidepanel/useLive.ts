import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
export function useLive<T>(query: () => Promise<T>, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({ next: setValue, error: console.error });
    return () => subscription.unsubscribe();
  }, deps);
  return value;
}
