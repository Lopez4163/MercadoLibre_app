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

export type MlOrderSaleType = "flex" | "full" | "other";

export type MlOrderShipment = {
  id: string;
  logisticType: string | null;
  orderId?: string | null;
  destinationCity?: string | null;
};

export type MlShipmentLabelDocument = {
  contentType: string;
  fileName: string;
  data: ArrayBuffer;
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

function mapLogisticType(logisticType: string | null | undefined): MlOrderSaleType | null {
  if (!logisticType) {
    return null;
  }

  const normalized = logisticType.toLowerCase();
  if (normalized === "self_service") {
    return "flex";
  }

  if (normalized === "fulfillment") {
    return "full";
  }

  return "other";
}

function extractShipmentCandidates(payload: unknown) {
  const directList = Array.isArray(payload) ? payload : null;
  const wrappedList =
    !Array.isArray(payload) &&
    typeof payload === "object" &&
    payload !== null &&
    "shipments" in payload &&
    Array.isArray((payload as { shipments?: unknown }).shipments)
      ? ((payload as { shipments: unknown[] }).shipments ?? null)
      : null;

  const list = directList ?? wrappedList;
  if (!list) {
    return [] as Array<{ id: string | null; logisticType: string | null }>;
  }

  return list.map((entry) => {
    const idRaw =
      typeof entry === "object" && entry !== null && "id" in entry
        ? (entry as { id?: unknown }).id
        : null;
    const logisticTypeRaw =
      typeof entry === "object" && entry !== null && "logistic_type" in entry
        ? (entry as { logistic_type?: unknown }).logistic_type
        : null;

    const id =
      (typeof idRaw === "string" && idRaw.length > 0) ||
      (typeof idRaw === "number" && Number.isFinite(idRaw))
        ? String(idRaw)
        : null;
    const logisticType = typeof logisticTypeRaw === "string" && logisticTypeRaw.length > 0 ? logisticTypeRaw : null;

    return { id, logisticType };
  });
}

function getFileNameFromContentDisposition(contentDisposition: string | null, fallbackFileName: string) {
  if (!contentDisposition) {
    return fallbackFileName;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const asciiMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (asciiMatch?.[1]) {
    return asciiMatch[1];
  }

  return fallbackFileName;
}

export async function getOrderShipments(options: { accessToken: string; orderId: string }) {
  const shipmentsResponse = await fetchMlWithRetry(
    `${ML_API_BASE_URL}/orders/${options.orderId}/shipments`,
    {
      method: "GET",
      headers: buildAuthHeaders(options.accessToken),
      cache: "no-store",
    },
    "ML order shipments failed",
  );

  const shipmentsPayload = (await shipmentsResponse.json()) as unknown;
  return extractShipmentCandidates(shipmentsPayload)
    .filter((candidate): candidate is MlOrderShipment => typeof candidate.id === "string" && candidate.id.length > 0)
    .map((candidate) => ({
      id: candidate.id,
      logisticType: candidate.logisticType,
    }));
}

export async function getShipmentById(options: { accessToken: string; shipmentId: string }) {
  const shipmentResponse = await fetchMlWithRetry(
    `${ML_API_BASE_URL}/shipments/${options.shipmentId}`,
    {
      method: "GET",
      headers: buildAuthHeaders(options.accessToken),
      cache: "no-store",
    },
    "ML shipment details failed",
  );

  const shipmentPayload = (await shipmentResponse.json()) as
    | {
        id?: unknown;
        logistic_type?: unknown;
        order_id?: unknown;
        order?: { id?: unknown } | null;
        receiver_address?: unknown;
        destination?: unknown;
      }
    | null;
  if (!shipmentPayload) {
    return null;
  }

  const shipmentId =
    (typeof shipmentPayload.id === "string" && shipmentPayload.id.length > 0) ||
    (typeof shipmentPayload.id === "number" && Number.isFinite(shipmentPayload.id))
      ? String(shipmentPayload.id)
      : options.shipmentId;

  const logisticType =
    typeof shipmentPayload.logistic_type === "string" && shipmentPayload.logistic_type.length > 0
      ? shipmentPayload.logistic_type
      : null;
  const orderIdRaw =
    shipmentPayload.order_id ??
    (shipmentPayload.order && typeof shipmentPayload.order === "object" ? shipmentPayload.order.id : null);
  const orderId =
    (typeof orderIdRaw === "string" && orderIdRaw.length > 0) ||
    (typeof orderIdRaw === "number" && Number.isFinite(orderIdRaw))
      ? String(orderIdRaw)
      : null;

  function extractCityName(value: unknown): string | null {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }

    if (typeof value === "object" && value !== null) {
      const fromName =
        "name" in value && typeof (value as { name?: unknown }).name === "string"
          ? (value as { name: string }).name.trim()
          : "";
      if (fromName.length > 0) {
        return fromName;
      }

      const fromCityName =
        "city_name" in value && typeof (value as { city_name?: unknown }).city_name === "string"
          ? (value as { city_name: string }).city_name.trim()
          : "";
      if (fromCityName.length > 0) {
        return fromCityName;
      }

      const nestedCity = "city" in value ? (value as { city?: unknown }).city : null;
      return extractCityName(nestedCity);
    }

    return null;
  }

  const destinationCity =
    extractCityName(shipmentPayload.receiver_address) ??
    extractCityName(shipmentPayload.destination) ??
    null;

  return {
    id: shipmentId,
    logisticType,
    orderId,
    destinationCity,
  } satisfies MlOrderShipment;
}

export async function getShipmentLabelDocument(options: { accessToken: string; shipmentId: string }) {
  const labelUrl = new URL(`${ML_API_BASE_URL}/shipment_labels`);
  labelUrl.searchParams.set("shipment_ids", options.shipmentId);
  labelUrl.searchParams.set("response_type", "pdf");

  const labelResponse = await fetchMlWithRetry(
    labelUrl.toString(),
    {
      method: "GET",
      headers: buildAuthHeaders(options.accessToken),
      cache: "no-store",
    },
    "ML shipment label failed",
  );

  const contentType = labelResponse.headers.get("content-type") ?? "application/pdf";
  const fileName = getFileNameFromContentDisposition(
    labelResponse.headers.get("content-disposition"),
    `shipment-label-${options.shipmentId}.pdf`,
  );

  return {
    contentType,
    fileName,
    data: await labelResponse.arrayBuffer(),
  } satisfies MlShipmentLabelDocument;
}

export async function getPrimaryOrderShipment(options: { accessToken: string; orderId: string }) {
  const shipments = await getOrderShipments(options);
  if (shipments.length === 0) {
    return null;
  }

  const firstWithLogisticType = shipments.find((shipment) => shipment.logisticType);
  if (firstWithLogisticType) {
    return firstWithLogisticType;
  }

  return getShipmentById({
    accessToken: options.accessToken,
    shipmentId: shipments[0].id,
  });
}

export async function getOrderSaleType(options: { accessToken: string; orderId: string }) {
  const shipments = await getOrderShipments(options);
  const candidates = shipments;
  for (const candidate of candidates) {
    const mapped = mapLogisticType(candidate.logisticType);
    if (mapped) {
      return mapped;
    }
  }

  const firstShipmentId = candidates[0]?.id;
  if (!firstShipmentId) {
    return null;
  }

  const shipment = await getShipmentById({
    accessToken: options.accessToken,
    shipmentId: firstShipmentId,
  });
  return mapLogisticType(shipment?.logisticType);
}
