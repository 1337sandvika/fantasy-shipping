import { useEffect } from "react";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { I18nBoot } from "@/i18n";
import { installNativeApiFetch } from "@/lib/native-fetch";
import { bootNativeChrome } from "@/lib/native-chrome";
import appCss from "../styles.css?url";

installNativeApiFetch();

const APP_NAME = "Fantasy Shipping";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover",
      },
      { title: APP_NAME },
      { name: "theme-color", content: "#06141c" },
      {
        name: "description",
        content:
          "Fantasy Shipping worldwide RoRo. Start with cash, buy a hull, load cars from Europe to the oceans — and pay the ETS quotas.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  useEffect(() => {
    void bootNativeChrome();
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){if(window.parent===window)return;var c=[];try{if(document.referrer)c.push(document.referrer)}catch(e){}try{if(location.ancestorOrigins&&location.ancestorOrigins.length)c.push(location.ancestorOrigins[0])}catch(e){}function ok(h){h=String(h).toLowerCase();return h==="grok.com"||h.slice(-9)===".grok.com"||h==="grok.me"||h.slice(-8)===".grok.me"||h==="localhost"||h==="127.0.0.1"||h==="[::1]"}for(var i=0;i<c.length;i++){try{var u=new URL(c[i].indexOf("://")>=0?c[i]:("https://"+c[i]));if(u.protocol!=="https:"&&u.protocol!=="http:")continue;if(!ok(u.hostname))continue;var o=u.origin;function send(t,x){var m={channel:"grok-preview-bridge",version:1,type:t};if(x)for(var k in x)m[k]=x[k];window.parent.postMessage(m,o)}send("location",{path:location.pathname||"/",search:location.search,hash:location.hash});send("ready");return}catch(e){}}})();',
          }}
        />
        <PreviewHostBridge />
        <AuthProvider>
          <I18nBoot />
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
