// Creators API resource names are lowerCamelCase (PA API v5 used PascalCase).
// Offers moved to offersV2 (price + savingBasis + savings live under price).
export const GET_ITEMS_RESOURCES = [
  "itemInfo.title",
  "itemInfo.byLineInfo",
  "images.primary.large",
  "offersV2.listings.price",
  "offersV2.listings.availability",
  "offersV2.listings.condition",
  "offersV2.listings.dealDetails",
  "offersV2.listings.isBuyBoxWinner",
  "customerReviews.count",
  "customerReviews.starRating",
  "parentASIN",
];

export const SEARCH_ITEMS_RESOURCES = [
  "itemInfo.title",
  "images.primary.large",
  "offersV2.listings.price",
];

export const VARIATIONS_RESOURCES = [
  "itemInfo.title",
  "images.primary.large",
  "offersV2.listings.price",
  "variationSummary.variationDimension",
];
