import { useEffect } from "react";

const CUELINKS_SCRIPT_ID = "cuelinks-v2-script";
const CUELINKS_CHANNEL_ID = "303416";

export function CuelinksScript() {
  useEffect(() => {
    if (document.getElementById(CUELINKS_SCRIPT_ID)) return;

    const s = document.createElement("script");
    s.id = CUELINKS_SCRIPT_ID;
    s.type = "text/javascript";
    s.async = true;
    s.src =
      (document.location.protocol === "https:" ? "https://cdn0.cuelinks.com/js/" : "http://cdn0.cuelinks.com/js/") +
      "cuelinksv2.js";

    const inline = document.createElement("script");
    inline.type = "text/javascript";
    inline.textContent = `var cId = '${CUELINKS_CHANNEL_ID}';`;

    document.body.appendChild(inline);
    document.body.appendChild(s);
  }, []);

  return null;
}
