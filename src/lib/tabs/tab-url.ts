/**
 * The link of a screen tab bound to the URL (`<Tabs urlParam>`), from the
 * current URL: swaps the tab's parameter and drops the default value, as the
 * click does (nuqs' `withDefault` keeps the default out of the URL). Path +
 * query, no origin or hash.
 */
export function tabUrl(
  currentHref: string,
  param: string,
  value: string,
  defaultValue?: string,
): string {
  const url = new URL(currentHref, "http://basecast.local");
  if (defaultValue !== undefined && value === defaultValue) {
    url.searchParams.delete(param);
  } else {
    url.searchParams.set(param, value);
  }
  const query = url.searchParams.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}
