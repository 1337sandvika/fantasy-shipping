/**
 * Status bar + splash — only runs inside the Capacitor binary.
 * Dynamic import keeps `@capacitor/*` off the critical web path if the
 * bundler tree-shakes the native branch (web still gets a tiny stub).
 */
export async function bootNativeChrome(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
      import("@capacitor/status-bar"),
      import("@capacitor/splash-screen"),
    ]);
    await StatusBar.setStyle({ style: Style.Dark });
    try {
      await StatusBar.setBackgroundColor({ color: "#071018" });
    } catch {
      /* iOS ignores background color on some versions */
    }
    await SplashScreen.hide();
  } catch {
    /* web, or plugins not linked yet */
  }
}
