"use strict";

const assert = require("node:assert/strict");
const {
  hostnameMatches,
  isCommerceServiceUrl,
  isTransactionalUrl,
  isSameSite,
  shouldRestoreCanceledRequest,
  popupDecision,
} = require("./browser-commerce-compat.cjs");

assert.equal(hostnameMatches("widget.packeta.com", "packeta.com"), true);
assert.equal(hostnameMatches("evilpacketa.com", "packeta.com"), false);
assert.equal(isCommerceServiceUrl("https://widget.packeta.com/v6/"), true);
assert.equal(isCommerceServiceUrl("https://js.stripe.com/v3/"), true);
assert.equal(isCommerceServiceUrl("https://example.com/stripe.com/fake"), false);
assert.equal(isTransactionalUrl("https://shop.example/checkout/payment"), true);
assert.equal(isTransactionalUrl("https://shop.example/products/42"), false);
assert.equal(isSameSite("https://api.shop.example/cart", "https://www.shop.example/checkout"), true);

assert.equal(
  shouldRestoreCanceledRequest(
    { url: "https://shop.example/api/cart/price", resourceType: "xhr" },
    "https://www.shop.example/checkout",
  ),
  true,
  "same-site dynamic cart request must not be lost to a substring false positive",
);
assert.equal(
  shouldRestoreCanceledRequest(
    { url: "https://widget.packeta.com/api/points", resourceType: "xhr" },
    "https://shop.example/checkout",
  ),
  true,
  "Packeta/Zasilkovna widget requests must stay functional",
);
assert.equal(
  shouldRestoreCanceledRequest(
    { url: "https://tracker.example/pixel", resourceType: "image" },
    "https://shop.example/checkout",
  ),
  false,
  "unrelated third-party trackers must stay subject to normal protection",
);

assert.equal(popupDecision({ url: "https://checkout.stripe.com/c/pay", openerUrl: "https://shop.example/checkout" }), "popup");
assert.equal(popupDecision({ url: "https://widget.packeta.com/select", openerUrl: "https://shop.example/checkout" }), "popup");
assert.equal(popupDecision({ url: "https://pay.example/session", openerUrl: "https://shop.example/cart" }), "popup");
assert.equal(popupDecision({ url: "https://example.org/article", openerUrl: "https://shop.example/products/1" }), "tab");
assert.equal(popupDecision({ url: "https://example.org/login", frameName: "oauthPopup" }), "popup");
assert.equal(popupDecision({ url: "https://example.org/window", features: "width=500,height=700" }), "popup");
assert.equal(popupDecision({ url: "bankapp://payment/123", openerUrl: "https://shop.example/checkout" }), "external-confirm");
assert.equal(popupDecision({ url: "javascript:alert(1)" }), "deny");
assert.equal(popupDecision({ url: "data:text/html,hello" }), "deny");
assert.equal(popupDecision({ url: "http://checkout.stripe.com/pay" }), "deny");

console.log("✓ VoxarioBrowser commerce compatibility policy passed");
