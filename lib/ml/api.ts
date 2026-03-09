import {
  isLikelyTransientNetworkError,
  isRetryableHttpStatus,
  RetryableRequestError,
  withRetry,
} from "../utils/retry";

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

export type MlItemSnapshot = {
  id: string;
  title: string;
  available_quantity: number;
  status?: string;
  permalink?: string | null;
};

export type MlOrderLine = {
  itemId: string;
  title: string;
  quantity: number;
};

export type MlOrderSnapshot = {
  id: string;
  status?: string;
  totalAmount?: number;
  lines: MlOrderLine[];
};

function buildAuthHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

async function fetchMlWithRetry(url: string, init: RequestInit, errorPrefix: string) {
  return withRetry(
    async () => {
      const response = await fetch(url, init);
      if (response.ok) {
        return response;
      }

      const errorText = await response.text();
      const message = `${errorPrefix}: ${response.status} ${errorText}`;
      if (isRetryableHttpStatus(response.status)) {
        throw new RetryableRequestError(message);
      }

      throw new Error(message);
    },
    {
      shouldRetry: (error) =>
        error instanceof RetryableRequestError || isLikelyTransientNetworkError(error),
    },
  );
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

    const response = await fetchMlWithRetry(
      searchUrl.toString(),
      {
        method: "GET",
        headers: buildAuthHeaders(accessToken),
        cache: "no-store",
      },
      "ML items search failed",
    );

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
  const { accessToken, itemIds } = options;
  const allItems: unknown[] = [];

  for (let i = 0; i < itemIds.length; i += ITEM_DETAILS_BATCH_SIZE) {
    const idsBatch = itemIds.slice(i, i + ITEM_DETAILS_BATCH_SIZE);
    const itemsUrl = new URL(`${ML_API_BASE_URL}/items`);
    itemsUrl.searchParams.set("ids", idsBatch.join(","));

    const response = await fetchMlWithRetry(
      itemsUrl.toString(),
      {
        method: "GET",
        headers: buildAuthHeaders(accessToken),
        cache: "no-store",
      },
      "ML item details failed",
    );

    const payload = (await response.json()) as ItemDetailsEntry[];

    for (const entry of payload) {
      if (entry.code === 200 && entry.body) {
        allItems.push(entry.body);
      }
    }
  }

  return allItems;
}

export async function getItemById(options: { accessToken: string; itemId: string }) {
  const items = await getItemsByIds({
    accessToken: options.accessToken,
    itemIds: [options.itemId],
  });

  const [first] = items as Partial<MlItemSnapshot>[];
  if (!first || typeof first.id !== "string") {
    return null;
  }

  const availableQuantity = Number(first.available_quantity);
  if (!Number.isFinite(availableQuantity)) {
    return null;
  }

  return {
    id: first.id,
    title: typeof first.title === "string" ? first.title : first.id,
    available_quantity: availableQuantity,
    status: typeof first.status === "string" ? first.status : undefined,
    permalink: typeof first.permalink === "string" ? first.permalink : null,
  } satisfies MlItemSnapshot;
}

export async function getOrderById(options: { accessToken: string; orderId: string }) {
  const response = await fetchMlWithRetry(
    `${ML_API_BASE_URL}/orders/${options.orderId}`,
    {
      method: "GET",
      headers: buildAuthHeaders(options.accessToken),
      cache: "no-store",
    },
    "ML order details failed",
  );

  const payload = (await response.json()) as {
    id?: string | number;
    status?: string;
    total_amount?: number;
    order_items?: Array<{
      quantity?: number;
      item?: {
        id?: string;
        title?: string;
      };
    }>;
  };

  const orderId = payload.id !== undefined && payload.id !== null ? String(payload.id) : null;
  if (!orderId) {
    return null;
  }

  const lines: MlOrderLine[] = [];
  for (const orderItem of payload.order_items ?? []) {
    const rawId = orderItem.item?.id;
    const itemId = typeof rawId === "string" && rawId.length > 0 ? rawId : null;
    if (!itemId) {
      continue;
    }

    const quantity = Number(orderItem.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

    const title =
      typeof orderItem.item?.title === "string" && orderItem.item.title.length > 0
        ? orderItem.item.title
        : itemId;

    lines.push({
      itemId,
      title,
      quantity,
    });
  }

  return {
    id: orderId,
    status: typeof payload.status === "string" ? payload.status : undefined,
    totalAmount: Number.isFinite(Number(payload.total_amount)) ? Number(payload.total_amount) : undefined,
    lines,
  } satisfies MlOrderSnapshot;
}
