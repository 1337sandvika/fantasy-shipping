#!/usr/bin/env node
/**
 * iPad App Review: StoreKit's `product.purchase()` with no window scene does
 * not present the confirmation sheet on iPadOS 18.2+ (the sheet is tied to a
 * UIWindowScene). Patch @capgo/native-purchases so the purchase confirms in
 * the foreground scene, then falls back to the old call.
 *
 * Idempotent. No-ops when the package is not installed (web-only install).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MARKER = "fantasy-shipping: present StoreKit sheet in the foreground scene (iPad)";
const ANCHOR = "let result = try await product.purchase(options: purchaseOptions)";
const FILE = join(
  process.cwd(),
  "node_modules/@capgo/native-purchases/ios/Sources/NativePurchasesPlugin/NativePurchasesPlugin.swift",
);

const HELPER = `
// ${MARKER}
private extension NativePurchasesPlugin {
    @MainActor
    func purchaseInForegroundScene(
        _ product: Product,
        options: Set<Product.PurchaseOption>
    ) async throws -> Product.PurchaseResult {
        if #available(iOS 18.2, *) {
            let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            if let scene = scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first {
                return try await product.purchase(confirmIn: scene, options: options)
            }
        }
        return try await product.purchase(options: options)
    }
}
`;

function main() {
  if (!existsSync(FILE)) {
    console.log("[patch-native-purchases-ipad] plugin not installed — skip");
    return;
  }
  let source = readFileSync(FILE, "utf8");
  if (source.includes(MARKER)) {
    console.log("[patch-native-purchases-ipad] already patched");
    return;
  }
  if (!source.includes(ANCHOR)) {
    console.warn(
      "[patch-native-purchases-ipad] purchase call not found — plugin layout changed, iPad sheet patch was not applied",
    );
    return;
  }
  if (!source.includes("import UIKit")) {
    source = source.replace("import Foundation\n", "import Foundation\nimport UIKit\n");
  }
  source = source.replace(ANCHOR, "let result = try await self.purchaseInForegroundScene(product, options: purchaseOptions)");
  if (!source.endsWith("\n")) source += "\n";
  source += HELPER;
  writeFileSync(FILE, source);
  console.log("[patch-native-purchases-ipad] patched StoreKit purchase to confirm in the foreground scene");
}

main();
