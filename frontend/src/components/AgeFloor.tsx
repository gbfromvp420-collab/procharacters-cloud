"use client";

import { useEffect } from "react";

/** Canonical product age floor — rewrite leftover 18+ chrome after hydrate. */
const SWAPS: [RegExp, string][] = [
  [/Uncensored 18\+/g, "Uncensored 21+"],
  [/Consenting adult 18\+/g, "Consenting adult 21+"],
  [/\b18\+ · KGC/g, "21+ · KGC"],
  [/\b18-year-old\b/gi, "21+"],
  [/\b18 year old\b/gi, "21+"],
  [/\b18yo\b/gi, "21+"],
];

function rewrite(node: Node) {
  if (node.nodeType === Node.TEXT_NODE && node.nodeValue) {
    let next = node.nodeValue;
    for (const [re, to] of SWAPS) next = next.replace(re, to);
    if (next !== node.nodeValue) node.nodeValue = next;
    return;
  }
  node.childNodes.forEach(rewrite);
}

export function AgeFloor() {
  useEffect(() => {
    rewrite(document.body);
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach(rewrite);
        if (m.type === "characterData") rewrite(m.target);
      }
    });
    mo.observe(document.body, { subtree: true, childList: true, characterData: true });
    return () => mo.disconnect();
  }, []);
  return null;
}
