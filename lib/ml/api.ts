const ML_API_BASE_URL = "https://api.mercadolibre.com";
const SEARCH_PAGE_SIZE = 100;
const ITEM_DETAILS_BATCH_SIZE = 20;

type SellerItemsSearchResponse = {
  results?: string[] | null;
  scroll_id?: string | null;
};

type ItemDetailsEntry = {
  code: number;
  body?: unknown;
};

function buildAuthHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function getSellerItemIds(options: {
  accessToken: string;
  mlUserId: string;
  status?: string;
}) {
  const { accessToken, mlUserId, status = "active" } = options;

  const allIds: string[] = [];
  let scrollId: string | null = null;

  while (true) {
    const searchUrl = new URL(`${ML_API_BASE_URL}/users/${mlUserId}/items/search`);
    searchUrl.searchParams.set("search_type", "scan");
    searchUrl.searchParams.set("status", status);
    searchUrl.searchParams.set("limit", String(SEARCH_PAGE_SIZE));
    if (scrollId) {
      searchUrl.searchParams.set("scroll_id", scrollId);
    }

    const response = await fetch(searchUrl.toString(), {
      method: "GET",
      headers: buildAuthHeaders(accessToken),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ML items search failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as SellerItemsSearchResponse | null;
    if (!payload) {
      break;
    }

    const pageIds = payload.results ?? [];
    if (pageIds.length === 0) {
      break;
    }

    allIds.push(...pageIds);

    if (!payload.scroll_id) {
      break;
    }

    scrollId = payload.scroll_id;
  }

  return allIds;
}

export async function getItemsByIds(options: { accessToken: string; itemIds: string[] }) {
  console.log(' ** GETITEMSBYID OPTIONS ** ', options)
  const { accessToken, itemIds } = options;
  const allItems: unknown[] = [];

  for (let i = 0; i < itemIds.length; i += ITEM_DETAILS_BATCH_SIZE) {
    const idsBatch = itemIds.slice(i, i + ITEM_DETAILS_BATCH_SIZE);
    const itemsUrl = new URL(`${ML_API_BASE_URL}/items`);
    itemsUrl.searchParams.set("ids", idsBatch.join(","));

    const response = await fetch(itemsUrl.toString(), {
      method: "GET",
      headers: buildAuthHeaders(accessToken),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ML item details failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as ItemDetailsEntry[];

    for (const entry of payload) {
      if (entry.code === 200 && entry.body) {
        allItems.push(entry.body);
      }
    }
  }

  return allItems;
}
